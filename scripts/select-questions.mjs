import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {candidates,entities,people,normalize} from './question-tools.mjs';
const es=JSON.parse(await fs.readFile('.source-cache/prepared.json','utf8'));
const authored=JSON.parse(await fs.readFile('data/authored.json','utf8'));
const bank=[...authored],shortages=[];
const hash=s=>[...s].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7);
const sorted=(a,key)=>[...a].sort((x,y)=>hash(key+JSON.stringify(x))-hash(key+JSON.stringify(y)));
const writerTeam=e=>(e.writers.match(/Teleplay by\s*:\s*(.*)/)?.[1]||e.writers).replace(/^Story by\s*:\s*/,'').replace(/\s*\|\s*/g,' & ');
const similar=(a,b)=>{const x=new Set(normalizeWords(a)),y=new Set(normalizeWords(b));return [...x].filter(w=>y.has(w)).length/Math.max(x.size,y.size);};
function normalizeWords(s){return s.toLowerCase().match(/[a-z]{3,}/g)||[];}
function distractors(c,e){
 const correct=c.entity.name;
 const options=entities.filter(x=>x.group===c.entity.group&&x.kind===c.entity.kind&&normalize(x.name)!==normalize(correct)&&!c.sentence.toLowerCase().includes(x.name.toLowerCase()));
 // Common characters are more useful choices than obscure one-episode cameos.
 const preferred=c.entity.kind==='character'?options.filter(x=>people.indexOf(x)<40):options;
 return [correct,...sorted(preferred.length>=3?preferred:options,e.id+c.key).slice(0,3).map(x=>x.name)];
}
for(const e of es){
 const prior=bank.filter(q=>q.episodeId===e.id),used=[];
 let cs=e.sources.flatMap((s,sourceIndex)=>candidates(s.text,s.url).map(c=>({...c,sourceIndex,adaptation:!!s.adaptation,machineTranslated:!!s.machineTranslated})));
 cs=[...new Map(cs.map(c=>[c.key,c])).values()].filter(c=>c.sentence.length<310&&!/(?:\bSeason \d|\bEpisodes\b|\bstarring\b|\bcast\b|\bepisode aired\b|\bviewers\b|\btitle refers\b|\btitle phrase\b|\bthe title\b|\bfirst appearance\b|\bfinal appearance\b|\bThis marks\b|\bto be continued\b|•|\[\d+\]|https?:|\b(?:the|a|an|in|of|to|with|and|or|at)\.$|^After Charlie consoles her)/i.test(c.sentence));
 cs=cs.filter(c=>!/(?:which becomes a reality in|next episode|previous episode|season premiere|season finale|____-in-law)/i.test(c.masked));
 cs=cs.filter(c=>!c.machineTranslated&&!/(?:In-joke:|do(?:es)? not appear|picture from|^The date starts|^After a fun date|^Instead of|^The man |^The woman |^The four |^Soon the woman|^Together with)/i.test(c.sentence));
 cs=cs.filter(c=>c.entity.kind==='character'||!['date','watch','model','check','ring','cold','pipe','dating','singing','acting'].includes(c.entity.name));
 cs=cs.filter(c=>!/(?:^\w+:|is a reference to|is a reference of|would have|had married|boat-load|boat load|^When a patient|which he does in|can be heard|then departs|than departs|that's Andy|that’s Andy)/i.test(c.sentence));
 cs=cs.filter(c=>!(c.entity.name==='Winning'&&!c.sentence.includes('Chuck Lorre'))&&!(c.entity.name==='beach'&&/beach.house/i.test(c.sentence))&&!(c.entity.name==='business'&&/none of|not my|not his/i.test(c.sentence)));
 cs=cs.filter(c=>!/["“][^"”]{45,}["”]/.test(c.sentence));
 const usedPrompt=new Set(prior.map(q=>normalize(q.en.prompt)));
 const pick=level=>{
  const ranked=cs.filter(c=>!used.includes(c)&&!usedPrompt.has(c.key)&&!used.some(x=>x.entity.name===c.entity.name&&similar(x.sentence,c.sentence)>.42)).map(c=>{
   const sameAnswer=used.filter(x=>x.entity.name===c.entity.name).length;
   const sameSentence=used.filter(x=>x.sentence===c.sentence).length;
   const duplicateFact=Math.max(0,...used.filter(x=>x.entity.name===c.entity.name).map(x=>similar(x.sentence,c.sentence)));
   const preference=level==='easy'?(c.main?35:c.entity.kind==='character'?12:0):level==='medium'?(!c.main?25:0):(c.entity.kind==='text'?40:!c.main?30:-35);
   const quality=(c.adaptation?15:!c.machineTranslated?8:-10)-Math.max(0,c.sentence.length-140)/15;
   return {c,score:preference+quality-sameAnswer*23-sameSentence*55-(duplicateFact>.45?duplicateFact*90:0)+hash(e.id+c.key)%7/10};
  }).sort((a,b)=>b.score-a.score);
  const top=ranked[0];if(!top)return null;
  used.push(top.c);usedPrompt.add(top.c.key);return top.c;
 };
 for(const difficulty of ['easy','medium']){
  const count=prior.filter(q=>q.difficulty===difficulty).length;
  for(let n=count+1;n<=4;n++){
   const c=pick(difficulty);if(!c){shortages.push(`${e.id} ${difficulty} ${n}`);continue;}
   bank.push(make(c,e,difficulty,n));
  }
 }
 const hardCount=prior.filter(q=>q.difficulty==='hard').length;
 // Reserve at most three slots for production facts. Prefer detailed plot facts
 // when enough independent sentences remain after the easy/medium questions.
 const extra=cs.filter(c=>!used.includes(c)&&!c.main&&used.every(x=>x.sentence!==c.sentence&&!(x.entity.name===c.entity.name&&similar(x.sentence,c.sentence)>.45)));
 const quotation=e.rawSummary?.split(/Title quot(?:ation|e) from\s*:/i)[1]?.trim().replace(/^A drunken /,'');
 const speaker=quotation&&people.find(p=>p.forms.some(f=>quotation.startsWith(f+',')||quotation.startsWith(f+' ')||quotation===f+'.'));
 const metadataCount=Math.min(speaker?4:3,Math.max(speaker?2:1,5-hardCount-extra.length));
 for(let n=hardCount+1;n<=5-metadataCount;n++){
  const c=pick('hard');if(!c){shortages.push(`${e.id} hard ${n}`);continue;}bank.push(make(c,e,'hard',n));
 }
 const metadata=[
  ...(speaker?[{key:'quotation',prompt:'Which character says the line that gives this episode its original English title?',dePrompt:'Welche Figur sagt den Satz, dem diese Folge ihren englischen Originaltitel verdankt?',answer:speaker.name,all:people.filter(p=>['Charlie Harper','Alan Harper','Jake Harper','Berta','Evelyn Harper','Judith Harper','Walden Schmidt','Rose','Chelsea Melini','Lyndsey McElroy'].includes(p.name)).map(p=>p.name),label:'The title quotation is spoken by',deLabel:'Das Titelzitat stammt von'}]:[]),
  {key:'director',prompt:'Who directed this episode?',dePrompt:'Wer führte bei dieser Folge Regie?',answer:e.director,all:es.map(e=>e.director),label:'Director',deLabel:'Regie'},
  {key:'writers',prompt:'Which writing team is credited for the teleplay of this episode?',dePrompt:'Welches Autorenteam schrieb das Drehbuch dieser Folge?',answer:writerTeam(e),all:es.map(writerTeam),label:'Teleplay',deLabel:'Drehbuch'},
  {key:'airdate',prompt:'On which date did this episode first air in the United States?',dePrompt:'An welchem Datum wurde diese Folge erstmals in den USA ausgestrahlt?',answer:e.airDate,all:es.filter(x=>x.season===e.season).map(x=>x.airDate),label:'First US broadcast',deLabel:'US-Erstausstrahlung'}
 ];
 for(const m of metadata.slice(0,metadataCount)){
  const options=[m.answer,...sorted([...new Set(m.all)].filter(a=>a!==m.answer),e.id+m.key).slice(0,3)];
  assert(options.length===4,e.id+' metadata choices');
  const deOptions=m.key==='airdate'?options.map(s=>new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(new Date(s))):options;
  const enOptions=m.key==='airdate'?options.map(s=>new Intl.DateTimeFormat('en-US',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(s))):options;
  const title=e.originalTitle.replace(/ – Part (One|Two)/,'');
  bank.push({id:`${e.id}-production-${m.key}`,episodeId:e.id,category:'episodes',difficulty:'hard',answerKind:m.key==='quotation'?'character':'text',prompt:m.dePrompt,answer:deOptions[0],aliases:[],choices:deOptions,explanation:`${m.deLabel}: ${deOptions[0]}.`,source:e.source,review:'generated',en:{prompt:m.prompt,answer:enOptions[0],choices:enOptions,explanation:`${m.label}: ${enOptions[0]}.`},generation:{kind:'metadata',key:m.key}});
 }
}
function make(c,e,difficulty,n){
 const choices=c.entity.kind==='character'||difficulty!=='hard'?distractors(c,e):[];
 const en={prompt:`Fill in the blank: ${c.masked}`,answer:c.entity.name,choices,explanation:c.sentence};
 return {id:`${e.id}-expanded-${difficulty}-${n}`,episodeId:e.id,category:'episodes',difficulty,answerKind:c.entity.kind,prompt:'',answer:'',choices:[],aliases:c.entity.aliases,explanation:'',source:c.source,review:'generated',en,generation:{kind:'cloze',sentence:c.sentence,masked:c.masked,entity:c.entity.name,sourceMachineTranslated:c.machineTranslated}};
}
console.log({shortages});assert.equal(bank.length,3442);
for(const e of es)for(const [d,n]of Object.entries({easy:4,medium:4,hard:5}))assert.equal(bank.filter(q=>q.episodeId===e.id&&q.difficulty===d).length,n,`${e.id} ${d}`);
await fs.writeFile('.source-cache/selected.json',JSON.stringify(bank,null,2));
await fs.writeFile('data/episode-source-data.json',JSON.stringify(es.map(({id,season,number,overall,title,originalTitle,kind,source,revision,director,writers,airDate,sources})=>({id,season,number,overall,title,originalTitle,kind,source,revision,director,writers,airDate,sources:sources.map(({text,original,...s})=>s)})),null,2));
console.log(JSON.stringify({total:bank.length,cloze:bank.filter(q=>q.generation?.kind==='cloze').length,metadata:bank.filter(q=>q.generation?.kind==='metadata').length,long:bank.filter(q=>q.en.prompt.length>350).length},null,2));
