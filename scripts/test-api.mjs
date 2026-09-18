import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.QUIZ_TEST_URL||'http://localhost:5174';const bank=JSON.parse(await fs.readFile('data/questions.json','utf8'));
async function post(data,token){const r=await fetch(base+'/api/game',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});return {status:r.status,...await r.json()};}
async function get(code,token){const r=await fetch(base+'/api/game?code='+code,{headers:{Authorization:'Bearer '+token}});return {statusCode:r.status,...await r.json()};}
const settings={mode:'multi',category:'characters',difficulty:'all',season:-1,episode:'',rounds:5,duration:15,specials:true};
const host=await post({op:'create',name:'Host-'+Date.now().toString().slice(-5),settings});assert.equal(host.status,200,JSON.stringify(host));const code=host.state.code;
const joins=await Promise.all(['Charlie','Alan','Jake'].map(name=>post({op:'join',code,name})));for(const j of joins)assert.equal(j.status,200,JSON.stringify(j));
const before=await get(code,host.token);assert.equal(before.players.length,4);const expires=before.expires;assert.equal((await get(code,host.token)).expires,expires);
assert.equal((await post({op:'join',code,name:'Charlie'})).code,'nameTaken');assert.equal((await get(code,'wrong')).statusCode,401);
assert.equal((await post({op:'start',code},joins[0].token)).status,403);
const start=await post({op:'start',code},host.token);assert.equal(start.state.status,'countdown');
await new Promise(r=>setTimeout(r,3700));const playing=await get(code,host.token);assert.equal(playing.status,'playing');assert.equal(playing.answer,null);
const q=bank.find(q=>q.prompt===playing.question.prompt),answer=playing.question.choices.length?String(playing.question.choices.indexOf(q.answer)):q.answer;
const simultaneous=await Promise.all([host,...joins].map(p=>post({op:'answer',code,answer,index:0,game:playing.game},p.token)));simultaneous.forEach(r=>assert.equal(r.status,200,JSON.stringify(r)));
assert.equal((await post({op:'answer',code,answer,index:0,game:playing.game},host.token)).code,'alreadyAnswered');
const after=await get(code,host.token);assert(after.players.every(p=>p.score>0&&p.answered));assert(after.expires>expires);assert(!JSON.stringify(after).includes(host.token));assert.equal(after.answer,null);
assert.equal((await post({op:'join',code,name:'Late'})).code,'inProgress');
console.log('PASS: 4 clients, concurrent joins/answers, host-only start, name uniqueness, private tokens, answer-once, server points, late join rejection, passive-vs-active TTL. Room:',code);
