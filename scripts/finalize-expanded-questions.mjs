import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {people,entities,escape,normalize} from './question-tools.mjs';
const bank=JSON.parse(await fs.readFile('.source-cache/translated.json','utf8'));
const memory=JSON.parse(await fs.readFile('.source-cache/question-translations-v2.json','utf8'));
const tr=s=>memory[createHash('sha256').update(s).digest('hex')];
let improved=0;const unresolved=[],duplicates=[];
const nounAliases={housekeeper:['Haushälterin','Putzfrau'],roommate:['Mitbewohner','Mitbewohnerin','Zimmergenossin'],girlfriend:['Freundin'],boyfriend:['Freund'],mother:['Mutter'],brother:['Bruder'],son:['Sohn','Sohnes','Söhne'],daughter:['Tochter','Töchter'],children:['Kinder'],cat:['Katze','Kater'],dog:['Hund'],puppet:['Puppe','Marionette'],couch:['Couch','Sofa'],sofa:['Sofa','Couch'],television:['Fernseher','Fernsehen','TV'],TV:['Fernseher','Fernsehen','TV'],Army:['Army','Armee','US-Armee'],'The Taming of the Shrew':['Der Widerspenstigen Zähmung'],'Pavlov’s':['Pavlov’s','Pavlov','Pawlows','Pawlow'],"Pavlov's":['Pavlov’s','Pavlov','Pawlows','Pawlow'],'Charlie Waffles':['Charlie Waffles','Charlie Waffeln'],football:['Football','American Football'],alimony:['Unterhalt','Alimente'],proposal:['Heiratsantrag','Antrag'],engagement:['Verlobung'],commitment:['Bindung','Verpflichtung'],wedding:['Hochzeit','Trauung']};
for(const q of bank){
 if(q.generation?.kind!=='cloze')continue;
 const entity=entities.find(e=>e.name===q.en.answer&&e.kind===q.answerKind);
 // Make the German gap from the full translation whenever the translated answer
 // is identifiable. This preserves the real noun's gender and inflections.
 const forms=q.answerKind==='character'?entity?.forms||[q.answer]:[q.answer,...(nounAliases[q.en.answer]||[])];
 let sentence=q.explanation;
 if(q.answerKind==='character'){
  // Genitive -s is allowed, but a first name must never match inside another name.
  const pattern=new RegExp(`(?<![\\p{L}])(?:${[...forms].sort((a,b)=>b.length-a.length).map(escape).join('|')})(?=s?[^\\p{L}]|s?$)`,'gu');
  sentence=sentence.replace(pattern,'____');
 }else{
  const pattern=new RegExp(`(?<![\\p{L}])(?:${[...new Set(forms)].sort((a,b)=>b.length-a.length).map(escape).join('|')})(?:s|es|en|n|e|er)?(?![\\p{L}])`,'giu');
  const matches=[...sentence.matchAll(pattern)];
  if(matches.length){q.aliases=[...new Set([...q.aliases,...forms,...matches.map(m=>m[0])])];sentence=sentence.replace(pattern,'____');}
 }
 if(sentence.includes('____')){q.prompt='Ergänze die Lücke: '+sentence;improved++;}
 else unresolved.push(q.id);
 if(q.choices.length&&new Set(q.choices.map(normalize)).size!==4){
  const chosen=[],chosenEn=[];
  const pool=[...q.en.choices,...entities.filter(e=>e.group===entity.group&&e.kind===entity.kind).map(e=>e.name)];
  for(const en of pool){const de=q.answerKind==='character'?en:tr(en);if(!de||chosen.some(x=>normalize(x)===normalize(de)))continue;chosen.push(de);chosenEn.push(en);if(chosen.length===4)break;}
  q.choices=chosen;q.en.choices=chosenEn;duplicates.push(q.id);
 }
 // Language choices must retain identical indices for the server's scoring map.
 assert.equal(q.choices.length,q.en.choices.length,q.id);
 if(q.choices.length){assert.equal(q.choices.length,4,q.id);assert.equal(new Set(q.choices.map(normalize)).size,4,q.id);assert.equal(q.choices.indexOf(q.answer),q.en.choices.indexOf(q.en.answer),q.id);}
 assert(q.prompt.includes('____'),q.id);
 assert(!/Bananarama|ZXITEM|ZXNAME|undefined|BAD_NAME/.test(JSON.stringify(q)),q.id);
}
await fs.writeFile('.source-cache/finalize-audit.json',JSON.stringify({improved,unresolved,duplicates},null,2));
await fs.writeFile('data/expanded-questions.json',JSON.stringify(bank.filter(q=>q.review==='generated').map(({generation,...q})=>q),null,2)+'\n');
console.log({improved,unresolved:unresolved.length,repairedChoiceSets:duplicates.length,expanded:bank.filter(q=>q.review==='generated').length});
