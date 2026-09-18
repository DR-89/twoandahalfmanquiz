import bank from '../data/questions.json';
import catalog from '../data/catalog-public.json';
import type {Question,Settings,GameView} from './types';
export const questions=bank as Question[];
export const questionMap=new Map(questions.map(q=>[q.id,q]));
const titles=new Map(catalog.map(e=>[e.id,e.title]));
const englishTitles=new Map(catalog.map(e=>[e.id,e.originalTitle]));
function english(q:Question){return q.en||questionMap.get(q.id)?.en;}
export const TTL=24*60*60*1000;
export type Player={id:string;secret:string;name:string;score:number;roundScore:number;answers:Record<string,{choice:string;correct:boolean;points:number}>;lastSeen:number;active:boolean};
export type Room={code:string;settings:Settings;players:Player[];host:string;started:number;deck:{id:string;choices:string[];question?:Question}[];created:number;lastActive:number;game:number;gamesPlayed:number;used:string[]};
export function normalize(s:string){return s.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/ß/g,'ss').replace(/[^\p{L}\p{N}]/gu,'');}
export function shuffle<T>(input:T[]):T[]{const a=[...input];for(let i=a.length-1;i>0;i--){const b=crypto.getRandomValues(new Uint32Array(1))[0];const j=b%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function pool(s:Settings){return questions.filter(q=>(s.category==='mixed'||q.category===s.category)&&(s.difficulty==='all'||q.difficulty===s.difficulty)&&(q.category==='characters'||((!s.episode||q.episodeId===s.episode)&&(s.season===-1||catalog.find(e=>e.id===q.episodeId)?.season===s.season)&&(s.specials||!['special','movie'].includes(catalog.find(e=>e.id===q.episodeId)?.kind||'')))));}
export function validateSettings(raw:unknown):Settings{
 const s=raw as Settings;
 if(!s||!['solo','multi'].includes(s.mode)||!['mixed','episodes','characters'].includes(s.category)||!['all','easy','medium','hard'].includes(s.difficulty)||!Number.isInteger(s.season)||s.season< -1||s.season>30||typeof s.episode!=='string'||s.episode.length>30||!s.episode&&s.episode!==''||![4,5,10,13,15,20].includes(s.rounds)||![15,20,30,45,60].includes(s.duration)||typeof s.specials!=='boolean')throw Error('invalidSettings');
 const result={mode:s.mode,category:s.category,difficulty:s.difficulty,season:s.season,episode:s.episode,rounds:s.rounds,duration:s.duration,specials:s.specials};
 if(pool(result).length<s.rounds)throw Error('tooFewQuestions');return result;
}
export function phase(room:Room,now=Date.now()){
 if(!room.started)return {status:'lobby' as const,index:0,remaining:0,end:0,nextAt:0};
 if(now<room.started)return {status:'countdown' as const,index:0,remaining:room.started-now,end:room.started,nextAt:room.started};
 const span=room.settings.duration*1000+7000,index=Math.floor((now-room.started)/span);
 if(index>=room.deck.length)return {status:'finished' as const,index:room.deck.length-1,remaining:0,end:0,nextAt:0};
 const start=room.started+index*span,end=start+room.settings.duration*1000;
 return {status:now>=end?'reveal' as const:'playing' as const,index,remaining:Math.max(0,end-now),end,nextAt:end+7000};
}
export function begin(room:Room,now=Date.now()){
 const available=pool(room.settings);let fresh=available.filter(q=>!room.used.includes(q.id));if(fresh.length<room.settings.rounds){fresh=available;room.used=[];}
 room.deck=shuffle(fresh).slice(0,room.settings.rounds).map(q=>({id:q.id,choices:shuffle(q.choices),question:structuredClone(q)}));
 room.used.push(...room.deck.map(q=>q.id));room.started=now+3500;room.game++;room.gamesPlayed++;room.lastActive=now;
 for(const p of room.players){p.roundScore=0;p.answers={};}
}
export function guess(room:Room,player:Player,input:{answer:unknown;index:unknown;game:unknown},now=Date.now()){
 const ph=phase(room,now);if(ph.status!=='playing'||input.index!==ph.index||input.game!==room.game)throw Error('roundClosed');
 if(player.answers[ph.index])throw Error('alreadyAnswered');
 if(typeof input.answer!=='string'||input.answer.length>160||!input.answer.trim())throw Error('invalidAnswer');
 const slot=room.deck[ph.index],q=slot.question||questionMap.get(slot.id)!;let value=input.answer.trim();
 if(slot.choices.length){if(!/^\d$/.test(value)||!slot.choices[+value])throw Error('invalidAnswer');value=slot.choices[+value];}
 const correct=[q.answer,...q.aliases,...(english(q)?[english(q)!.answer]:[])].some(a=>normalize(a)===normalize(value));
 const base={easy:100,medium:200,hard:300}[q.difficulty];const points=correct?base+Math.ceil(ph.remaining/(room.settings.duration*1000)*100):0;
 player.answers[ph.index]={choice:value,correct,points};player.score+=points;player.roundScore+=points;room.lastActive=now;player.lastSeen=now;return player.answers[ph.index];
}
export function view(room:Room,player:Player,now=Date.now(),language:'de'|'en'='de'):GameView{
 const ph=phase(room,now),slot=room.deck[ph.index],q=slot?(slot.question||questionMap.get(slot.id)):null;
 const reveal=ph.status==='reveal'||ph.status==='finished';
 const en=q&&language==='en'?english(q):undefined;
 const choice=(value:string)=>en&&q?en.choices[q.choices.indexOf(value)]||value:value;
 return {code:room.code,settings:room.settings,host:room.host,me:player.id,serverTime:now,expires:room.lastActive+TTL,...ph,round:ph.index+1,game:room.game,gamesPlayed:room.gamesPlayed,
  players:room.players.map(p=>({id:p.id,name:p.name,score:p.score,roundScore:p.roundScore,answered:!!p.answers[ph.index],active:p.active&&now-p.lastSeen<65000})).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'de')),
  question:q&&['playing','reveal','finished'].includes(ph.status)?{prompt:en?.prompt||q.prompt,choices:slot.choices.map(choice),difficulty:q.difficulty,episode:(language==='en'?englishTitles:titles).get(q.episodeId)||(language==='en'?'Character trivia':'Charakterwissen'),review:q.review}:null,
  answer:reveal&&q?{text:en?.answer||q.answer,explanation:en?.explanation||q.explanation,source:q.source}:null,
  result:player.answers[ph.index]?{...player.answers[ph.index],choice:choice(player.answers[ph.index].choice),correct:reveal?player.answers[ph.index].correct:false,points:reveal?player.answers[ph.index].points:0}:null};
}
