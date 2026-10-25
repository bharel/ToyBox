import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleLoader,fixtureSettings as settings} from './helpers.mjs';
const load=moduleLoader(),s=load('lib/sync.ts'),e=load('lib/observed-progress.ts'),g=load('lib/progression.ts'),q=load('lib/quest-progress.ts'),r=load('lib/routines.ts'),t=load('lib/today.ts'),p=load('lib/planner.ts'),{legionFinds}=load('lib/legion-archaeology.ts');
const now=Date.parse('2026-10-23T15:05:00Z'),at=now-60000,end=Date.parse('2026-10-28T04:00:00Z');
const raw={...JSON.parse(readFileSync('work/addon-fixture.json','utf8')),exportedAt:at,toys:[],ownedToyIds:[],raidLockouts:[],questLog:[],completedQuestIds:[],watchedQuests:[],dailyResetAt:now+86400000,weeklyResetAt:end,game:{version:1,questsAvailable:true,instances:[],recipes:[],professions:{at,data:[{id:794,name:'Archaeology',skill:800,max:800}]}}};
function join(value=raw){return e.observedProgress([],[{...s.parseAddon(value,now),binding:settings.bindings.priest}],settings,now);}
assert.equal(legionFinds.length,13);
for(const find of legionFinds){
 const active={...raw,questLog:[{id:find.quests[0].id,title:find.quests[0].name,frequency:3,complete:false,objectives:[{text:'Find fragments',fulfilled:2,required:5,finished:false}]}]};
 const progress=join(active),rotation=g.rotationFor({},settings,now,progress[0]);
 assert.equal(rotation.rotation.findId,find.id);assert.equal(rotation.end,null);assert.equal(rotation.period,null);
 assert.equal(g.routineEligibility(r.routineSeeds[1],'priest',{},settings,progress,now).state,'ready');
 assert.equal(g.routineEligibility(r.routineSeeds[1],'druid',{},settings,progress,now).state,'unknown');
 assert.equal(g.rotationFor({},settings,end,progress[0]).rotation,undefined);
 assert.equal(q.observedQuestRows(progress,settings,now)[0].cadence,'archaeology');
}
assert.equal(g.rotationFor({},settings,now,join({...raw,completedQuestIds:[41157]})[0]).rotation,undefined); // Lifetime flags cannot identify today's rotation.
const beacon=legionFinds.find(f=>f.id==='beacon'),complete={...raw,game:{...raw.game,archaeologyEndAt:end,questTurnIns:[{id:41173,title:'A Beacon of Hope',frequency:3,at,resetAt:end}]}};
let progress=join(complete),rotation=g.rotationFor({},settings,now,progress[0]);assert.equal(rotation.end,end);assert.equal(rotation.rotation.complete,true);
assert.equal(q.observedQuestRows(progress,settings,now)[0].deadline,end);assert.equal(q.observedQuestRows(progress,settings,now)[0].state,'turned-in');
let plan=t.todayPlan([],{'routine-retired:argent-tournament':true},settings,progress,now);assert(plan.done.some(u=>u.routine?.id==='legion-archaeology'&&u.automatic));assert(!Object.keys({}).some(k=>k.startsWith('owned:')));
const weekly={...r.routineSeeds[0],id:'custom-quest-test',title:'Weekly fixture',cadence:'weekly',custom:true,priority:1,questIds:[12345]},weeklyData={...raw,game:{...raw.game,questTurnIns:[{id:12345,title:'Weekly fixture',frequency:2,at,resetAt:end}]}};
progress=join(weeklyData);assert(q.linkedRoutineDone(weekly,'priest',progress,settings,now));assert(!q.linkedRoutineDone(weekly,'druid',progress,settings,now));assert(!q.linkedRoutineDone(weekly,'priest',progress,settings,end));assert.equal(q.observedQuestRows(progress,settings,now)[0].state,'turned-in');
const records={['routine:'+weekly.id]:weekly,'note:keep':'Keep my notes','owned:keep':true};assert(p.validateRecord('routine:'+weekly.id,weekly));assert(!p.validateRecord('routine:'+weekly.id,{...weekly,assignment:'warband'}));assert(!p.validateRecord('routine:'+weekly.id,{...weekly,questIds:[NaN]}));
plan=t.todayPlan([],records,settings,progress,now);assert(plan.done.some(u=>u.routine?.id===weekly.id&&u.automatic));assert.equal(records['note:keep'],'Keep my notes');assert.equal(records['owned:keep'],true);
assert(!q.linkedRoutineDone(weekly,'priest',join({...raw,completedQuestIds:[12345]}),settings,now)); // An old one-time flag is not this week's turn-in.
const scheduled={...raw,questLog:[{id:123,title:'Scheduler-owned quest',frequency:3,complete:false,objectives:[]}]};const row=q.observedQuestRows(join(scheduled),settings,now)[0];assert.equal(row.cadence,'scheduled');assert.equal(row.deadline,undefined);
const negative=join({...raw,game:{...raw.game,questChecks:[{id:58457,completed:false,at}]}})[0];assert.equal(g.requirementsMet({questsAll:[58457],source:'https://example.com'},negative).state,'blocked');assert.equal(g.requirementsMet({questsAll:[99],source:'https://example.com'},negative).state,'unknown');
for(const fields of [{questTurnIns:[{id:123,title:'Bad',at:now+1}]},{questChecks:[{id:123,completed:'yes',at}]},{archaeologyEndAt:now+20*p.DAY},{professions:{at,data:[{id:794,name:'Archaeology',skill:10,max:1}]}}])assert.throws(()=>s.parseAddon({...raw,game:{...raw.game,...fields}},now));
console.log('Passed automatic quests: all 13 archaeology chains, no manual anchor requirement, reported timers, dated final turn-ins, stale rotations, daily/weekly boundaries, scheduler-owned resets, exact character binding, explicit prerequisites, profession observations, linked routines, record preservation and old one-time flags.');
