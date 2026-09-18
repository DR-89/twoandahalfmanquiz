import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root='.source-cache';await fs.mkdir(`${root}/seasons`,{recursive:true});
const decode=s=>s.replace(/&(?:#(\d+)|#x([a-f0-9]+)|([a-z]+));/gi,(m,n,h,name)=>n?String.fromCodePoint(+n):h?String.fromCodePoint(parseInt(h,16)):({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',ndash:'–',mdash:'—',rsquo:'’',lsquo:'‘',hellip:'…'}[name]||m));
export const clean=s=>decode(s.replace(/<sup\b[\s\S]*?<\/sup>/g,'').replace(/<style\b[\s\S]*?<\/style>/g,'').replace(/<br\s*\/?\s*>/gi,' ').replace(/<[^>]+>/g,'')).replace(/\s+/g,' ').trim();
async function download(file,url){try{return await fs.readFile(file,'utf8')}catch{const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`${r.status}: ${url}`);const html=await r.text();await fs.writeFile(file,html);return html;}}
const german=await download(`${root}/episodes-de.html`,'https://de.wikipedia.org/wiki/Two_and_a_Half_Men/Episodenliste');
const deTitles=new Map();
for(const row of german.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)){
 const cells=[...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/g)].map(x=>clean(x[1]));
 if(cells.length>=4&&/^\d+$/.test(cells[0])&&/^\d+$/.test(cells[1]))deTitles.set(+cells[0],cells[2]);
}
let results=[];
// Bound network concurrency to three season pages.
for(let start=1;start<=12;start+=3){
 const group=await Promise.all(Array.from({length:Math.min(3,13-start)},(_,i)=>start+i).map(async season=>{
  const url=`https://en.wikipedia.org/wiki/Two_and_a_Half_Men_season_${season}`;
  const html=await download(`${root}/seasons/${season}.html`,url);
  const revision=html.match(/"wgRevisionId":(\d+)/)?.[1];
  const rows=[...html.matchAll(/<tr\b[^>]*class="vevent[^"\n]*"[^>]*>([\s\S]*?)<\/tr>\s*<tr\b[^>]*class="expand-child"[^>]*>([\s\S]*?)<\/tr>/g)];
  const episodes=[];
  for(const row of rows){
   const cells=[...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/g)].map(x=>clean(x[1]));
   const overall=+(row[1].match(/id="ep(\d+)"/)?.[1]||cells[0]);
   const number=+cells[1];
   const originalTitle=clean(row[1].match(/class="summary"[^>]*>([\s\S]*?)<\/td>/)?.[1]||'').replace(/^"|"$/g,'');
   let plot=clean(row[2]).split(/Title quotation from\s*:/i)[0].trim();
   plot=plot.replace(/\([^)]*\)/g,'').replace(/\s+/g,' ').trim();
   episodes.push({id:`s${season}e${number}`,season,number,overall,title:deTitles.get(overall)||originalTitle,originalTitle,kind:'episode',source:`${url}#ep${overall}`,revision,plot,rawSummary:clean(row[2])});
  }
  console.log(`Season ${season}: ${episodes.length} rows, ${episodes.filter(e=>e.plot.length<250).length} short plots`);
  return episodes;
 }));results.push(...group.flat());
}
results.sort((a,b)=>a.season-b.season||a.number-b.number);
await fs.writeFile(`${root}/episodes.json`,JSON.stringify(results,null,2));
console.log(JSON.stringify({rows:results.length,germanTitles:deTitles.size,invalid:results.filter(e=>!Number.isInteger(e.number)||!e.originalTitle),short:results.filter(e=>e.plot.length<250).map(e=>({id:e.id,plot:e.plot}))},null,2));
