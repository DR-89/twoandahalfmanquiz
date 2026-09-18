import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {normalize,candidates} from './question-tools.mjs';
const en=JSON.parse(await fs.readFile('.source-cache/episodes.json','utf8'));
const it=JSON.parse(await fs.readFile('.source-cache/italian-en.json','utf8'));
const authored=JSON.parse(await fs.readFile('data/authored.json','utf8'));
// Title spelling differences verified against both episode lists.
const aliases={s1e8:'Twenty Five Little Pre-Pubers Without a Snootfull',s1e13:'Sara Like Puny Alan',s1e20:'Hey, I Can Pee Outside the Dark',s2e17:'Woo-Hoo, An Ernia Exam!',s2e19:'A Low Gutteral Tongue-Flapping Noise',s3e17:'The Unfortunate Little Schnauser',s4e10:'Kissing Abraham Lincoln',s5e7:'The Leather Gear is in the Guest Room',s6e20:"Hello, I'm Alan Cousteau",s8e14:"Looking' for Japanese Subs",s8e15:'Three Hookers and a Phily Cheesesteak',s9e5:'A Giant Cat Holding Churro',s9e8:'Thanks for the Intercourse',s9e9:"Frodo's Heatshots",s9e10:'Fishbowl Full of Glass Eyes',s10e4:'You Know What The Lollipop Is For',s12e9:'Bouncy, Bouncy, Bouncy Lindsay',s12e13:'Boompa Loved These Hookers'};
for(const e of en){
 const other=it.find(i=>i.season===e.season&&normalize(i.originalTitle)===normalize(aliases[e.id]||e.originalTitle));
 assert(other||e.id==='s1e16',e.id+' missing title match');
 e.sources=[{url:e.source,revision:e.revision,language:'en',text:e.plot}];
 if(other){assert(other.english,e.id+' missing translated plot');e.sources.push({url:other.source,revision:other.revision,language:'it',text:other.english,original:other.plot,machineTranslated:true});}
}
// The hour-long finale is counted as two broadcast episodes, as in the German list.
const finale=en.find(e=>e.id==='s12e15');
assert(finale);
finale.title='Natürlich ist er tot (1)';finale.originalTitle="Of Course He’s Dead – Part One";
en.push({...structuredClone(finale),id:'s12e16',number:16,overall:262,title:'Natürlich ist er tot (2)',originalTitle:"Of Course He’s Dead – Part Two"});
en.sort((a,b)=>a.season-b.season||a.number-b.number);
assert.equal(en.length,262);
const expected=[24,24,24,24,19,24,22,16,24,23,22,16];
expected.forEach((n,i)=>assert.deepEqual(en.filter(e=>e.season===i+1).map(e=>e.number),Array.from({length:n},(_,j)=>j+1)));
const stats=en.map(e=>{const c=e.sources.flatMap(s=>candidates(s.text,s.url));const distinct=[...new Map(c.map(x=>[x.key,x])).values()];return {id:e.id,n:distinct.length,sentences:new Set(distinct.map(x=>x.sentence)).size,authored:authored.filter(q=>q.episodeId===e.id).length};});
await fs.writeFile('.source-cache/combined.json',JSON.stringify(en,null,2));
await fs.writeFile('.source-cache/candidate-coverage.json',JSON.stringify(stats,null,2));
console.log(JSON.stringify({total:en.length,short:stats.filter(e=>e.n+e.authored<13),lowDiversity:stats.filter(e=>e.sentences<7).map(e=>({id:e.id,n:e.n,s:e.sentences}))},null,2));
