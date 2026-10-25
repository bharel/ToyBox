import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {moduleLoader} from './helpers.mjs';
const {sessionChecklist,allocateResources}=moduleLoader()('lib/daily-session.ts'),now=1792800000;
const turned={kind:'questTurnedIn',questId:90001,cadence:'daily',currentPeriodFlag:true},logged={kind:'questInLog',questId:90001},objectives={kind:'questObjectivesComplete',questId:90001};
const guide={id:'fixture',title:'Fixture',zone:'Hub',cadence:'daily',rewards:[999999],metadataRoute:true,walkthrough:{version:2,nodes:[
 {id:'fixture:accept',kind:'accept',text:'Accept',questId:90001,when:{kind:'questOffered',questId:90001},completeWhen:{any:[logged,turned]}},
 {id:'fixture:objective',kind:'objective',text:'Objectives',questId:90001,requires:logged,completeWhen:{any:[objectives,turned]}},
 {id:'fixture:turnin',kind:'turnin',text:'Turn in',questId:90001,requires:objectives,completeWhen:turned}
],completeWhen:{kind:'toyOwned',itemId:999999}}};
const base={guid:'Player-1-ABC',class:'PRIEST',region:'EU',questsAt:now,quests:{},flags:{},turnIns:{},skipped:{},offersAt:now,offers:{},dailyResetAt:now+3600,weeklyResetAt:now+86400};
const cases=[
 ['offered',{offers:{90001:now}}],['accepted',{quests:{90001:{title:'Quest',complete:false}}}],['ready',{quests:{90001:{title:'Quest',complete:true}}}],['turned',{turnIns:{90001:now}}],['old daily',{turnIns:{90001:now-86400}}],['unavailable',{questsAt:now-301}],['deferred',{quests:{90001:{title:'Quest',complete:false}},skipped:{'fixture:objective':now+3600}}]
].map(([name,state])=>({name,now,guide,state:{...base,...state}}));
const dir=mkdtempSync(join(tmpdir(),'toybox-session-'));try{
 const file=join(dir,'cases.json');writeFileSync(file,JSON.stringify(cases));const lua=JSON.parse(execFileSync('python3',['tests/session-lua.py',file],{encoding:'utf8'}));
 cases.forEach((f,i)=>assert.deepEqual(sessionChecklist([guide],f.state,{now,owned:new Set()}).map(({stepId,state,available})=>({stepId,state,available})),lua[i],f.name));
}finally{rmSync(dir,{recursive:true,force:true});}
const balance={...base,currencies:{99:{quantity:15,at:now,isAccountWide:true},100:{quantity:20,at:now,isAccountTransferable:true}}};
const r=allocateResources([{...guide,id:'a',costs:[['c',99,10],['c',100,5]]},{...guide,id:'b',costs:[['c',99,10]]}],balance,{now,owned:new Set()});
assert.equal(r.a[0].scope,'warband');assert.equal(r.a[1].scope,'transferable-character');assert.equal(r.b[0].allocated,5);assert.equal(r.b[0].shortfall,5);
console.log('Passed shared Lua/TypeScript session states: offers, acceptance, objectives, turn-in, reset expiry, unavailable observations and deferral; scoped resource reservations passed.');
