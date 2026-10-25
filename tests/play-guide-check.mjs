import assert from 'node:assert/strict';
import {moduleLoader,fixtureSettings as settings} from './helpers.mjs';
const load=moduleLoader(),g=load('lib/play-guide.ts'),p=load('lib/planner.ts'),r=load('lib/routines.ts'),c=load('lib/profession-cooldowns.ts'),{catalog}=load('lib/catalog.ts');
const now=Date.parse('2026-10-23T16:00:00Z'),source=data=>({status:'ok',attemptedAt:now,fetchedAt:now,data});
const progress=[{version:2,ref:settings.bindings.priest,updatedAt:now,profile:source({level:90,classId:5,raceId:1,faction:'ALLIANCE'}),quests:source({completedIds:[13667],trackedIds:[],completedCount:1}),reputations:source([]),professions:source([{id:794,name:'Archaeology',skill:800,max:800},{id:202,name:'Engineering',skill:100,max:100,tiersStatus:'reported',tiers:[{id:2500,name:'Pandaria Engineering',skill:75,max:75,recipeStatus:'reported',knownRecipes:[{id:31427,name:'Jard’s Peculiar Energy Source'}]}]}]),achievements:source([])}];
let records={'owned:jaraxxus':true,'note:guldan':'Preserve notes'},original=structuredClone(records);
let guide=g.playGuide(catalog,records,settings,progress,now);
assert.deepEqual(records,original);
assert(guide.steps.some(s=>s.unit.routine?.id==='argent-tournament'&&s.manualCompletion));
const arch=guide.steps.find(s=>s.unit.routine?.id==='legion-archaeology');assert.equal(arch.mode,'observe');assert.equal(arch.manualCompletion,false);assert.match(arch.steps[0],/Speak with Dariness/);assert(!arch.steps.join(' ').includes('confirm'));
assert(!guide.steps.some(s=>s.unit.activity?.id==='guldan')); // Owned toy and optional unknown routes do not become questions.
const craft=guide.steps.find(s=>s.unit.profession);assert.equal(craft.automatic,true);assert.equal(craft.manualCompletion,false);assert.match(craft.steps[0],/Pandaria/);
const jard=c.professionPresets.find(x=>x.id==='jard'),use=c.craftEventUpdate(jard,'priest',settings,{version:1,id:'guide-test-use',kind:'use',variant:'daily',at:now});
const cooling={...records,[use.key]:use.value};assert(!g.playGuide(catalog,cooling,settings,progress,now).steps.some(s=>s.unit.profession?.preset.id==='jard'));assert.equal(cooling['owned:jaraxxus'],true);
const weekly={...r.routineSeeds[0],id:'custom-guide-weekly',title:'Weekly quest',cadence:'weekly',questIds:[12345],custom:true};records={...records,['routine:'+weekly.id]:weekly};
const game={ref:settings.bindings.priest,at:now,completedQuestIds:[],questLogIds:[12345],questLog:[{id:12345,title:'Weekly quest',frequency:2,complete:true}],data:{version:1,questsAvailable:true,instances:[],recipes:[]}};
const observed=[{...progress[0],inGame:game}];guide=g.playGuide(catalog,records,settings,observed,now);const linked=guide.steps.find(s=>s.unit.routine?.id===weekly.id);assert(linked);assert.equal(linked.automatic,true);assert.equal(linked.manualCompletion,false);assert.match(linked.steps[0],/Turn in/);
const done=[{...progress[0],inGame:{...game,questLogIds:[],questLog:[],data:{...game.data,questTurnIns:[{id:12345,title:'Weekly quest',frequency:2,at:now}]}}}];assert(!g.playGuide(catalog,records,settings,done,now).steps.some(s=>s.unit.routine?.id===weekly.id));
const changed={...settings,bindings:{...settings.bindings,priest:{...settings.bindings.priest,id:99}}};const other=g.guideStep(craft.unit,records,changed,progress,now);assert.notEqual(other.key,craft.key); // Skipping in one character/window cannot hide a replacement.
const tomorrow=g.playGuide(catalog,records,settings,progress,now+p.DAY).steps.find(s=>s.unit.routine?.id==='argent-tournament');assert.notEqual(tomorrow.key,g.playGuide(catalog,records,settings,progress,now).steps.find(s=>s.unit.routine?.id==='argent-tournament').key);
const timed={...craft.unit,deadline:null,cooldown:{timing:{kind:'elapsed',durationMs:20*3600000},readyAt:now,state:'ready'}};assert.notEqual(g.guideStep(timed,records,settings,progress,now).key,g.guideStep({...timed,cooldown:{...timed.cooldown,readyAt:now+20*3600000}},records,settings,progress,now+20*3600000).key);
assert.notEqual(g.guideStep({...craft.unit,eligibility:{...craft.unit.eligibility,state:'unknown'}},records,settings,progress,now).key,craft.key);
console.log('Passed guide behavior: no record mutation, essential order, optional unknown routes, observed prerequisites, learned crafts, cooling tasks hidden, automatic quest completion, exact character/reset keys, and preserved ownership/notes.');
