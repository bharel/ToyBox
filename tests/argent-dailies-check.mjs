import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {moduleLoader} from './helpers.mjs';
const {walkthroughSteps}=moduleLoader()('lib/walkthrough.ts');
const guide=JSON.parse(readFileSync('lib/data/guide-pack.json')).guides.find(g=>g.id==='argent-tournament');
const now=1000000,reset=now+3600,context={now,owned:new Set()};
const collection=(count=20,complete=false)=>({title:"The Valiant's Charge",complete,objectives:[{text:`${count}/25 Valiant's Seal`,numFulfilled:count,numRequired:25,finished:complete}]});
const quest={title:'The Grand Melee',complete:false,objectives:[{text:'0/3 Mark of the Valiant',numFulfilled:0,numRequired:3,finished:false}]};
const base={questsAt:now,quests:{13718:collection()},dailyResetAt:reset,turnIns:{},flags:{},faction:'Alliance'};
const completed=Object.fromEntries([13665,13592,13847,13603].map(id=>[id,now-10]));
const cases=[
 ['active daily leads',{...base,quests:{...base.quests,13665:quest}}],
 ['unaccepted set observes four opportunities',base],
 ['four dailies finish today with twenty seals',{...base,turnIns:completed}],
 ['three dailies do not finish rotating weapon',{...base,turnIns:{13665:now-10,13592:now-10,13847:now-10}}],
 ['next reset reopens dailies and retains seals',{...base,turnIns:completed,dailyResetAt:reset+86400}],
 ['twenty five seals advances to collection turnin',{...base,quests:{13718:collection(25,true),13665:quest}}],
 ['abandoned daily returns to giver',{...base,turnIns:{13592:now-10,13847:now-10,13603:now-10}}],
 ['unavailable log cannot complete daily session',{...base,questsAt:now-301,turnIns:completed}],
 ['other city stays isolated',{...base,quests:{13714:collection(),13665:quest}}],
 ['skipping does not finish a daily',{...base,quests:{...base.quests,13665:quest},turnIns:{13592:now-10,13847:now-10,13603:now-10},skipped:{'argent-tournament:q13665:objective':reset}}],
 ['expired flags cannot complete current day',{...base,flags:Object.fromEntries(Object.keys(completed).map(id=>[id,{at:now-86400,value:true,source:'current-client'}]))}],
 ['one rotating variant suffices',{...base,turnIns:{13665:now-10,13592:now-10,13847:now-10,13616:now-10}}],
 ['skipping an observation hides only that step',{...base,skipped:{'argent-tournament:valiant-13718:weapon:offers':reset,'fixture:valiant-13718:weapon:offers':reset}}],
];
const results=cases.map(([,state])=>walkthroughSteps(guide.walkthrough,guide.id,state,context));
assert.equal(results[0].rows[0].questId,13665);assert.equal(results[0].rows[0].kind,'objective');
assert.equal(results[0].rows[0].longTermProgress.count,20);
assert.equal(results[1].rows.length,4);assert.equal(results[1].dailySession.waiting,false);
assert(results[2].dailySession.waiting);assert.equal(results[2].complete,false);assert.equal(results[2].dailySession.progress.count,20);
assert.equal(results[3].rows.length,1);assert.equal(results[3].dailySession.done,3);assert.equal(results[3].dailySession.waiting,false);
assert.equal(results[4].dailySession.done,0);assert.equal(results[4].dailySession.progress.count,20);
assert.equal(results[5].rows[0].kind,'turnin');assert.equal(results[5].rows[0].questId,13718);
assert.equal(results[6].dailySession.done,3);assert.equal(results[6].dailySession.waiting,false);
assert.equal(results[7].dailySession.waiting,false);assert(results[7].rows.every(r=>r.text.includes('refresh')));
assert(results[8].rows.every(r=>!r.questId||r.questId!==13665));
assert.equal(results[9].dailySession.waiting,false);assert.equal(results[9].dailySession.done,3);
assert.equal(results[10].dailySession.done,0);assert(results[11].dailySession.waiting);
assert.equal(results[12].rows.length,3);assert.equal(results[12].dailySession.done,0);
// City bindings cover all ten branches and preserve weapon alternatives as one group.
assert.equal(guide.walkthrough.dailySets.length,12);
for(const set of guide.walkthrough.dailySets)assert.deepEqual(set.groups.map(g=>g.questIds.length),set.stage==='Aspirant'?[1,1,3]:[1,1,1,3]);
const dir=mkdtempSync(join(tmpdir(),'toybox-dailies-'));
try{
 const file=join(dir,'cases.json');writeFileSync(file,JSON.stringify(cases.map(([name,state])=>({name,state,now,graph:guide.walkthrough}))));
 // The shared runner uses the fixture ID for cursor leases.
 const lua=JSON.parse(execFileSync('python3',['tests/walkthrough-lua.py',file],{encoding:'utf8',maxBuffer:8e6}));
 const plain=r=>({complete:r.complete,rows:r.rows.map(row=>({id:row.id,text:row.text,available:row.available,counters:row.counters??null}))});
 const parity=cases.map(([,state])=>plain(walkthroughSteps(guide.walkthrough,'fixture',state,context)));
 assert.deepEqual(lua,parity);
}finally{rmSync(dir,{recursive:true,force:true});}
console.log(`Passed ${cases.length} real Argent daily-session scenarios in Lua and TypeScript; all ten cities have four opportunities, with three weapon alternatives sharing one slot.`);
