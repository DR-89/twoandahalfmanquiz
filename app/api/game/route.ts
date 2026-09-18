import {translate} from '../../../lib/i18n';
import {begin,guess,phase,validateSettings,view,TTL,type Room,type Player} from '../../../lib/game';
import {db,read,write,cleanup} from '../../../db/rooms';
export const dynamic='force-dynamic';
const messages:Record<string,string>={invalidSettings:'Die Spieleinstellungen sind ungültig.',tooFewQuestions:'Für diese Auswahl gibt es zu wenige Fragen. Wähle mehr Folgen oder weniger Fragen pro Spiel.',roundClosed:'Diese Frage ist schon vorbei. Die nächste erscheint gleich.',alreadyAnswered:'Deine Antwort wurde bereits gespeichert.',invalidAnswer:'Bitte gib eine gültige Antwort ein.',roomMissing:'Diese Session existiert nicht mehr oder ist nach 24 Stunden Inaktivität abgelaufen.',unauthorized:'Bitte tritt dem Raum erneut bei.',forbidden:'Diese Aktion ist nicht erlaubt.',invalidName:'Bitte wähle einen Nickname mit 2 bis 24 Zeichen.',nameTaken:'Dieser Nickname ist in der Session schon vergeben.',roomFull:'In diesem Raum spielen bereits 8 Personen.',inProgress:'Das Spiel läuft bereits. Du kannst nach dem Spiel beitreten.',hostOnly:'Nur der Gastgeber kann das Spiel starten.',retry:'Gerade ist viel los. Bitte versuche es erneut.',unavailable:'Die Verbindung zum Spielserver ist unterbrochen. Bitte versuche es gleich noch einmal.',invalidCode:'Bitte gib den sechsstelligen Raumcode ein.',invalidRequest:'Diese Anfrage ist ungültig.',soloRoom:'Dieser Raum ist für ein Solospiel reserviert.'};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function failure(req:Request,code:string,status=400){return json({error:translate(messages[code]||messages.unavailable,req.headers.get('accept-language')?.startsWith('en')?'en':'de'),code:Object.hasOwn(messages,code)?code:'unavailable'},status);}
async function digest(s:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');}
async function identity(req:Request,room:Room){const secret=await digest(req.headers.get('authorization')?.replace(/^Bearer /,'')||'');const p=room.players.find(p=>p.secret===secret);if(!p)throw Error('unauthorized');return p;}
function nickname(raw:unknown){if(typeof raw!=='string')throw Error('invalidName');const s=raw.normalize('NFC').trim();if(s.length<2||s.length>24||/[\p{C}]/u.test(s))throw Error('invalidName');return s;}
function code(raw:unknown){const s=String(raw||'').toUpperCase();if(!/^[A-HJ-NP-Z2-9]{6}$/.test(s))throw Error('invalidCode');return s;}
export async function GET(req:Request){const fail=(code:string,status=400)=>failure(req,code,status);try{
 await cleanup();const {room,revision}=await read(code(new URL(req.url).searchParams.get('code')));const p=await identity(req,room);
 // Presence is deliberately separate from activity: an idle open tab cannot renew a session.
 if(Date.now()-p.lastSeen>20000){p.lastSeen=Date.now();p.active=true;await write(room,revision);}
 return json(view(room,p,Date.now(),req.headers.get('accept-language')?.startsWith('en')?'en':'de'));
}catch(e){const k=e instanceof Error?e.message:'unavailable';return fail(k,k==='roomMissing'?410:k==='unauthorized'?401:503);}}
export async function POST(req:Request){const fail=(code:string,status=400)=>failure(req,code,status);try{
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return fail('forbidden',403);
 if(Number(req.headers.get('content-length'))>4096)return fail('invalidRequest',413);
 const body=await req.text();if(body.length>4096)return fail('invalidRequest',413);const input=JSON.parse(body);if(!input||typeof input!=='object')return fail('invalidRequest');
 await cleanup();
 if(input.op==='create'){
  const settings=validateSettings(input.settings),name=nickname(input.name),now=Date.now(),token=crypto.randomUUID()+crypto.randomUUID(),id=crypto.randomUUID();
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for(let tries=0;tries<4;tries++){
   const roomCode=Array.from(crypto.getRandomValues(new Uint8Array(6)),b=>alphabet[b%alphabet.length]).join('');
   const p:Player={id,secret:await digest(token),name,score:0,roundScore:0,answers:{},lastSeen:now,active:true};
   const room:Room={code:roomCode,settings,players:[p],host:id,started:0,deck:[],created:now,lastActive:now,game:0,gamesPlayed:0,used:[]};if(settings.mode==='solo')begin(room,now);
   const result=await db().prepare('INSERT OR IGNORE INTO quiz_rooms (code,state,revision,expires) VALUES (?,?,0,?)').bind(roomCode,JSON.stringify(room),now+TTL).run();
   if(result.meta.changes===1)return json({token,state:view(room,p,Date.now(),req.headers.get('accept-language')?.startsWith('en')?'en':'de')});
  }return fail('retry',409);
 }
 const roomCode=code(input.code),joinToken=input.op==='join'?crypto.randomUUID()+crypto.randomUUID():null,joinId=crypto.randomUUID();
 for(let attempt=0;attempt<10;attempt++){
  const {room,revision}=await read(roomCode),now=Date.now();let p:Player;
  if(input.op==='join'){
   if(room.settings.mode==='solo')return fail('soloRoom');if(!['lobby','finished'].includes(phase(room).status))return fail('inProgress');
   const name=nickname(input.name);if(room.players.some(p=>p.name.toLocaleLowerCase('de')===name.toLocaleLowerCase('de')))return fail('nameTaken');if(room.players.length>=8)return fail('roomFull');
   p={id:joinId,secret:await digest(joinToken!),name,score:0,roundScore:0,answers:{},lastSeen:now,active:true};room.players.push(p);room.lastActive=now;
  }else{
   p=await identity(req,room);
   if(input.op==='start'){
    if(!['lobby','finished'].includes(phase(room).status))return fail('inProgress');
    if(room.host!==p.id){const host=room.players.find(x=>x.id===room.host);if(host?.active&&now-host.lastSeen<65000)return fail('hostOnly',403);room.host=p.id;}
    if(input.settings)room.settings=validateSettings({...input.settings,mode:room.settings.mode});begin(room,now);
   }else if(input.op==='answer'){guess(room,p,input,now);}
   else if(input.op==='leave'){p.active=false;p.lastSeen=0;if(room.host===p.id)room.host=room.players.find(x=>x.id!==p.id&&x.active)?.id||p.id;}
   else return fail('invalidRequest');
   if(input.op!=='leave'){p.lastSeen=now;p.active=true;}
  }
  if(await write(room,revision))return json(input.op==='leave'?{left:true}:{token:joinToken||undefined,state:view(room,p,Date.now(),req.headers.get('accept-language')?.startsWith('en')?'en':'de')});
 }
 return fail('retry',409);
}catch(e){const k=e instanceof SyntaxError?'invalidRequest':e instanceof Error?e.message:'unavailable';if(!Object.hasOwn(messages,k))console.error('Quiz request failed',e);return fail(k,k==='roomMissing'?410:k==='unauthorized'?401:k==='unavailable'?503:400);}}
