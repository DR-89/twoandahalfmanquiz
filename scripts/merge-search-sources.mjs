import fs from 'node:fs/promises';
import {normalize,candidates} from './question-tools.mjs';
const es=JSON.parse(await fs.readFile('.source-cache/combined.json','utf8'));
const authored=JSON.parse(await fs.readFile('data/authored.json','utf8'));
function distance(a,b){let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const row=[i];for(let j=1;j<=b.length;j++)row[j]=Math.min(row[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=row;}return prev[b.length];}
let imported=0;const unmatched=[];
for(const file of (await fs.readdir('.source-cache')).filter(f=>/^search-\d+\.txt$/.test(f))){
 const text=await fs.readFile('.source-cache/'+file,'utf8');
 for(const block of text.split(/-{30,}\n/)){
  const first=block.split('\n')[0],url=first.match(/\((https:\/\/twoandahalfmen\.fandom\.com\/wiki\/[^\s)]+)\)/)?.[1];if(!url)continue;
  const title=first.split(' | ')[0].trim();
  const parts=[...block.matchAll(/\n## (?:Plot|Summary|Trivia)(?:\s*\[\])?\s*\n([\s\S]*?)(?=\n(?:##|Season \d|Categories|Two and a Half Men Episodes)|$)/g)].map(m=>m[1].trim());
  if(!parts.length)continue;
  let e=es.find(e=>normalize(e.originalTitle)===normalize(title));
  if(!e){const scored=es.map(e=>({e,d:distance(normalize(e.originalTitle),normalize(title))/Math.max(normalize(e.originalTitle).length,normalize(title).length)})).sort((a,b)=>a.d-b.d);if(scored[0].d<.21)e=scored[0].e;}
  if(!e){unmatched.push(title);continue;}
  let plot=parts.join('\n').replace(/[^]*/g,'').replace(/^\s*[•*·]\s*/gm,'').replace(/\s+/g,' ').trim();
  // Remove actor credits, not parenthetical narrative details.
  plot=plot.replace(/\((?:Charlie Sheen|Jon Cryer|Angus T\. Jones|Marin Hinkle|Melanie Lynskey|Holland Taylor|Conchata Ferrell|Ashton Kutcher|April Bowlby|[A-Z][a-z]+ [A-Z][a-z]+)\)/g,'').replace(/\s+([,.;!?])/g,'$1');
  if(plot.length<80)continue;
  const prior=e.sources.find(s=>s.url===url);if(prior){if(prior.text.length<plot.length)prior.text=plot;}else{e.sources.push({url,language:'en',text:plot,discovery:file});imported++;}
 }
}
await fs.writeFile('.source-cache/combined.json',JSON.stringify(es,null,2));
const stats=es.map(e=>{const c=e.sources.flatMap(s=>candidates(s.text,s.url));const distinct=[...new Map(c.map(x=>[x.key,x])).values()];return {id:e.id,title:e.originalTitle,n:distinct.length,s:new Set(distinct.map(x=>x.sentence)).size,authored:authored.filter(q=>q.episodeId===e.id).length};});
await fs.writeFile('.source-cache/candidate-coverage.json',JSON.stringify(stats,null,2));
console.log(JSON.stringify({imported,unmatched:[...new Set(unmatched)],short:stats.filter(e=>e.n+e.authored<13)},null,2));
