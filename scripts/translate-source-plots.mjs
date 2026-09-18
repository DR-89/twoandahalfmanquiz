import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const input=JSON.parse(await fs.readFile('.source-cache/italian.json','utf8'));
await fs.mkdir('.source-cache/translations',{recursive:true});
let cursor=0,done=0;const failures=[];
async function worker(){while(cursor<input.length){const e=input[cursor++];
 const file='.source-cache/translations/'+crypto.createHash('sha256').update('it-en:'+e.plot).digest('hex')+'.json';
 try{e.english=JSON.parse(await fs.readFile(file,'utf8'));done++;continue;}catch{}
 try{for(let attempt=0;attempt<4;attempt++){try{
   const r=await fetch('https://translate.googleapis.com/translate_a/single?'+new URLSearchParams({client:'gtx',sl:'it',tl:'en',dt:'t',q:e.plot}),{signal:AbortSignal.timeout(35000)});
   if(!r.ok)throw Error(String(r.status));const value=(await r.json())[0].map(x=>x[0]).join('');if(!value)throw Error('empty');e.english=value;await fs.writeFile(file,JSON.stringify(value));break;
 }catch(err){if(attempt===3)throw err;await new Promise(r=>setTimeout(r,2000*(attempt+1)));}}
 done++;if(done%20===0)console.log(`${done}/${input.length} translated plots`);
 }catch(error){failures.push({season:e.season,title:e.originalTitle,error:error.message});}
}}
await Promise.all([worker(),worker()]);
await fs.writeFile('.source-cache/italian-en.json',JSON.stringify(input,null,2));
console.log({translated:done,failures});if(failures.length)process.exitCode=1;
