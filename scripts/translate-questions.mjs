import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {people,escape} from './question-tools.mjs';
const qs=JSON.parse(await fs.readFile('.source-cache/selected.json','utf8'));
const filename='.source-cache/question-translations-v2.json';
let memory={};try{memory=JSON.parse(await fs.readFile(filename,'utf8'));}catch{}
const key=s=>createHash('sha256').update(s).digest('hex');
const all=[...new Set(qs.filter(q=>q.generation?.kind==='cloze').flatMap(q=>[q.generation.masked,q.generation.sentence,...(q.answerKind==='character'?[]:[q.en.answer,...q.en.choices])]))];
const forms=[...new Set(people.flatMap(p=>p.forms))].sort((a,b)=>b.length-a.length);
const names=new RegExp(`(?<![\\p{L}])(?:${forms.map(escape).join('|')})(?![\\p{L}])`,'gu');
function protect(s){return {text:s.replaceAll('____','Bananarama'),restore:t=>t.replace(/Bananarama/gi,'____')};}
async function request(text){
 for(let attempt=0;attempt<5;attempt++)try{
  const url='https://translate.googleapis.com/translate_a/single?'+new URLSearchParams({client:'gtx',sl:'en',tl:'de',dt:'t',q:text});
  const r=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();return data[0].map(x=>x[0]||'').join('');
 }catch(e){if(attempt===4)throw e;await new Promise(r=>setTimeout(r,1000*(attempt+1)));}
}
const missing=all.filter(s=>!memory[key(s)]);const batches=[];let batch=[],size=0;
for(const s of missing){if(size+s.length>4500&&batch.length){batches.push(batch);batch=[];size=0;}batch.push(s);size+=s.length+50;}if(batch.length)batches.push(batch);
let next=0,done=0,save=Promise.resolve();const issues=[];
async function worker(){while(next<batches.length){const index=next++,texts=batches[index],safe=texts.map(protect);
 const result=await request(safe.map((p,i)=>`ZXITEM${i}XZ\n${p.text}`).join('\n\n'));
 const matches=[...result.matchAll(/ZX\s*ITEM\s*(\d+)\s*XZ\s*([\s\S]*?)(?=ZX\s*ITEM\s*\d+\s*XZ|$)/gi)];
 if(matches.length!==texts.length){matches.length=0;for(let i=0;i<texts.length;i++)matches.push(['',String(i),await request(safe[i].text)]);}
 for(const match of matches){const i=+match[1],s=texts[i];let value=safe[i].restore(match[2].trim());
  const invalid=v=>!s||/ZX(?:NAME|BLANK|ITEM)|BAD_NAME/i.test(v)||(s.length>50&&v.length<s.length*.45)||((s.match(/____/g)||[]).length!==(v.match(/____/g)||[]).length);
  if(invalid(value))value=safe[i].restore(await request(safe[i].text));
  if(invalid(value)){issues.push({source:s,value});continue;}
  memory[key(s)]=value;
 }
 done++;const snapshot=JSON.stringify(memory,null,2);save=save.then(()=>fs.writeFile(filename,snapshot));await save;if(done%10===0||done===batches.length)console.log(`Translated ${done}/${batches.length} batches (${Object.keys(memory).length} strings cached)`);
}}
console.log(`Translation: ${all.length} strings, ${missing.length} missing in ${batches.length} batches.`);
await Promise.all(Array.from({length:3},worker));
if(issues.length){await fs.writeFile('.source-cache/translation-issues.json',JSON.stringify(issues,null,2));console.log(`${issues.length} translations need manual correction; valid translations cached.`);process.exit(1);}
for(const q of qs){
 if(q.generation?.kind!=='cloze')continue;
 const tr=s=>memory[key(s)];
 q.prompt='Ergänze die Lücke: '+tr(q.generation.masked);q.explanation=tr(q.generation.sentence);
 q.answer=q.answerKind==='character'?q.en.answer:tr(q.en.answer);
 q.choices=q.answerKind==='character'?q.en.choices:q.en.choices.map(tr);
}
await fs.writeFile('.source-cache/translated.json',JSON.stringify(qs,null,2));
console.log('Translated question bank saved for validation; active bank unchanged.');
