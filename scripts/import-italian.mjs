import fs from 'node:fs/promises';
const names=['prima','seconda','terza','quarta','quinta','sesta','settima','ottava','nona','decima','undicesima','dodicesima'];
const decode=s=>s.replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&nbsp;',' ');
const clean=s=>decode(s.replace(/<sup\b[\s\S]*?<\/sup>/g,'').replace(/<[^>]+>/g,'')).replace(/\s+/g,' ').trim();
const result=[];
for(let start=0;start<12;start+=3){
 const batch=await Promise.all(names.slice(start,start+3).map(async(name,i)=>{
  const season=start+i+1,url=`https://it.wikipedia.org/wiki/Episodi_di_Due_uomini_e_mezzo_(${name}_stagione)`;
  const file=`.source-cache/italian-${season}.html`;let html;
  try{html=await fs.readFile(file,'utf8')}catch{const r=await fetch(url);if(!r.ok)throw Error(`${r.status} ${url}`);html=await r.text();await fs.writeFile(file,html);}
  const sections=html.split(/(?=<h2\b)/);const entries=[];
  for(const section of sections){
   if(!section.includes('Titolo originale:'))continue;
   const originalTitle=clean(section.match(/Titolo originale:\s*([\s\S]*?)<\/li>/)?.[1]||'');
   const heading=section.match(/<h2\b[^>]*id="([^"]+)"/i)?.[1];
   const plot=section.split(/<h3\b/).slice(1).filter(x=>/id="Trama/.test(x)).flatMap(s=>[...s.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map(m=>clean(m[1]))).join(' ');
   if(originalTitle&&plot)entries.push({season,number:entries.length+1,originalTitle,plot,source:url+'#'+heading,revision:html.match(/"wgRevisionId":(\d+)/)?.[1]});
  }
  console.log(`Italian season ${season}: ${entries.length} plots`);return entries;
 }));result.push(...batch.flat());
}
await fs.writeFile('.source-cache/italian.json',JSON.stringify(result,null,2));
