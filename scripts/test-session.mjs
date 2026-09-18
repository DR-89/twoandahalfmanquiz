import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {DatabaseSync} from 'node:sqlite';
const base='http://localhost:5174';
async function post(data,token){const r=await fetch(base+'/api/game',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});return {http:r.status,...await r.json()};}
async function get(code,token){const r=await fetch(base+'/api/game?code='+code,{headers:{Authorization:'Bearer '+token}});return {http:r.status,...await r.json()};}
const settings={mode:'solo',category:'characters',difficulty:'all',season:-1,episode:'',rounds:5,duration:15,specials:true};
const created=await post({op:'create',name:'Session-Test',settings});assert.equal(created.http,200);const code=created.state.code,token=created.token;
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject';let db;for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.sqlite')&&f!=='metadata.sqlite')){const candidate=new DatabaseSync(path.join(dir,f));if(candidate.prepare("SELECT name FROM sqlite_master WHERE name = 'quiz_rooms'").get()){db=candidate;break;}candidate.close();}assert(db);
// Mutate only the disposable room just created by this script.
function change(fn){const row=db.prepare('SELECT state FROM quiz_rooms WHERE code = ?').get(code);const room=JSON.parse(row.state);fn(room);db.prepare('UPDATE quiz_rooms SET state = ?, expires = ?, revision = revision + 1 WHERE code = ?').run(JSON.stringify(room),room.lastActive+86400000,code);}
change(room=>{room.started=Date.now()-200000;room.players[0].score=987;room.players[0].roundScore=987;});
assert.equal((await get(code,token)).status,'finished');const rematch=await post({op:'start',code},token);assert.equal(rematch.state.players[0].score,987);assert.equal(rematch.state.players[0].roundScore,0);assert.equal(rematch.state.game,2);
change(room=>{room.lastActive=Date.now()-86400000+60000;});const alive=await get(code,token);assert.equal(alive.http,200);const expiry=alive.expires;assert.equal((await get(code,token)).expires,expiry);
change(room=>{room.lastActive=Date.now()-86400001;});assert.equal((await get(code,token)).http,410);assert.equal(db.prepare('SELECT count(*) AS n FROM quiz_rooms WHERE code = ?').get(code).n,0);assert.equal((await post({op:'join',code,name:'Late'})).http,410);db.close();
console.log('PASS: real DB rematch keeps 987 session points, round points reset, passive polling does not extend expiry, expired session inaccessible and physically removed on cleanup.');
