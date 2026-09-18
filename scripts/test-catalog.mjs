import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
await build({entryPoints:['lib/game.ts'],bundle:true,platform:'node',format:'esm',outfile:'.source-cache/test-catalog-bundle.mjs'});
const {questions,pool,validateSettings,begin,view,guess}=await import('../.source-cache/test-catalog-bundle.mjs');
const catalog=JSON.parse(await fs.readFile('data/catalog-public.json','utf8'));
assert.equal(catalog.length,262);assert.equal(questions.length,3442);
const seasons=[24,24,24,24,19,24,22,16,24,23,22,16];
const base={mode:'solo',category:'episodes',difficulty:'all',season:-1,episode:'',rounds:13,duration:15,specials:false};
for(let s=1;s<=12;s++)assert.deepEqual(catalog.filter(e=>e.season===s).map(e=>e.number),Array.from({length:seasons[s-1]},(_,i)=>i+1),`Season ${s}`);
for(const e of catalog){
 assert.deepEqual(e.counts,{easy:4,medium:4,hard:5},e.id);
 const settings=validateSettings({...base,season:e.season,episode:e.id});
 assert.equal(pool(settings).length,13,e.id);
 for(const [difficulty,n]of Object.entries(e.counts)){const s=validateSettings({...settings,difficulty,rounds:n});assert.equal(pool(s).length,n);assert.throws(()=>validateSettings({...s,rounds:10}),/tooFewQuestions/);}
 const now=Date.now(),player={id:'catalog',secret:'local-only',name:'Katalogtest',score:0,roundScore:0,answers:{},lastSeen:now,active:true};
 const room={code:'CAT234',settings,players:[player],host:player.id,started:0,deck:[],created:now,lastActive:now,game:0,gamesPlayed:0,used:[]};
 begin(room,now);assert.equal(room.deck.length,13);assert.equal(new Set(room.deck.map(q=>q.id)).size,13);
 for(let i=0;i<13;i++){
  const time=room.started+i*22000+1000,q=room.deck[i].question,slot=room.deck[i];
  assert.equal(q.episodeId,e.id);assert.equal(view(room,player,time).answer,null,'hidden answer');
  const answer=slot.choices.length?String(slot.choices.indexOf(q.answer)):q.answer;
  assert(guess(room,player,{answer,index:i,game:room.game},time).correct,`${e.id} ${i}`);
 }
}
console.log('PASS: all 262 episodes, contiguous season coverage, exact 4/4/5 pools, 4/5/13-question games and 3406 correctly scored episode answers.');
