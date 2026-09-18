import assert from 'node:assert/strict';
import {build} from 'esbuild';
await build({entryPoints:['lib/game.ts'],bundle:true,platform:'node',format:'esm',outfile:'.source-cache/test-language.mjs'});
const {questions,guess,view}=await import('../.source-cache/test-language.mjs');
for(const q of questions){
 const now=Date.now();
 const player={id:'a',secret:'test-only',name:'Language test',score:0,roundScore:0,answers:{},lastSeen:now,active:true};
 const room={code:'TESTAB',settings:{mode:'solo',category:'mixed',difficulty:'all',season:-1,episode:'',rounds:5,duration:30,specials:false},players:[player],host:'a',started:now-1000,deck:[{id:q.id,choices:[...q.choices].reverse(),question:structuredClone(q)}],created:now,lastActive:now,game:1,gamesPlayed:1,used:[]};
 const en=view(room,player,now,'en');
 assert.equal(en.question.prompt,q.en.prompt,q.id);
 const value=en.question.choices.length?String(en.question.choices.indexOf(q.en.answer)):q.en.answer;
 assert.notEqual(value,'-1',q.id);
 assert(guess(room,player,{answer:value,index:0,game:1},now).correct,q.id);
 assert.equal(view(room,player,room.started+30000,'de').answer.text,q.answer);
 assert.equal(view(room,player,room.started+30000,'en').answer.text,q.en.answer);
}
console.log(`PASS: all ${questions.length} English prompts, shuffled answer positions, free-text answers and bilingual reveals.`);
