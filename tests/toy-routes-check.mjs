import assert from 'node:assert/strict';
import {moduleLoader,fixtureSettings as settings} from './helpers.mjs';
const load=moduleLoader(),{catalog}=load('lib/catalog.ts'),routes=load('lib/toy-routes.ts'),g=load('lib/progression.ts'),guide=load('lib/play-guide.ts'),t=load('lib/today.ts'),p=load('lib/planner.ts'),data=load('lib/data/toys.json');
const now=Date.parse('2026-10-24T14:00:00Z'),source=data=>({status:'ok',fetchedAt:now,attemptedAt:now,data});
const profile=actor=>({version:2,ref:settings.bindings[actor],updatedAt:now,profile:source({level:actor==='priest'?90:40,classId:actor==='priest'?5:11,faction:'ALLIANCE'}),quests:source({completedIds:[],trackedIds:[],completedCount:0}),professions:source([{id:202,name:'Engineering',skill:100,max:100}]),reputations:source([{id:2511,name:'Iskaara Tuskarr',raw:0,value:0,max:2500,standing:'Renown 1',accountWide:true}]),achievements:source([])});
const game={version:1,questsAvailable:true,instances:[],recipes:[]};
function withGame(actor,fields){return {...profile(actor),inGame:{ref:settings.bindings[actor],at:now,completedQuestIds:[],questLogIds:[],questLog:[],data:game,...fields}};}
const feast=catalog.find(a=>a.id==='rep-tuskarr-feast'),shop=catalog.find(a=>a.id==='toys-tuskarr-vendors'),book=catalog.find(a=>a.id==='toy-scarlet-book');
assert.equal(routes.toyActivities.length,23);assert.equal(new Set(routes.toyActivities.flatMap(a=>a.rewards.map(r=>r.itemId))).size,37);assert.equal(routes.toyActivities.filter(a=>a.cadence==='weekly').length,6);
assert.deepEqual(feast.toyRoute.questIds,[70893]);assert(!routes.toyActivities.some(a=>a.toyRoute.questIds.some(id=>[74382,70750,80385,80386,80388].includes(id))));
for(const a of routes.toyActivities){assert(p.safeUrl(a.source));assert.equal(new Set(a.rewards.map(r=>r.itemId)).size,a.rewards.length);for(const r of a.rewards){const entry=data.toys.find(t=>t.itemId===r.itemId);assert(entry);assert(entry.routes.some(r=>!r.notObtainable&&!r.notReleased&&!r.resale&&!r.path.includes('Promotion')));}}
const active=withGame('priest',{questLogIds:[70893],questLog:[{id:70893,title:'Community Feast',frequency:2,complete:false}]});
assert.equal(g.activityEligibility(feast,'priest',{},settings,[active],now).state,'ready'); // Farming is not gated by the toy purchase rank.
assert.equal(g.activityEligibility(feast,'priest',{},settings,[profile('priest')],now).state,'unknown');
assert.equal(g.activityEligibility(book,'druid',{},settings,[profile('druid')],now).state,'blocked');
assert.equal(g.activityEligibility(catalog.find(a=>a.id==='toy-wormhole-pandaria'),'priest',{},settings,[profile('priest')],now).state,'unknown'); // Profession alone is not a learned recipe.
const turnedIn=withGame('priest',{data:{...game,questTurnIns:[{id:70893,title:'Community Feast',frequency:2,at:now-10000}]}});
assert(routes.routeQuestDone(feast,'priest',settings,[turnedIn],now));assert(!routes.routeQuestDone(feast,'priest',settings,[turnedIn],p.weeklyStart(now,4)+7*p.DAY));
const lifetime=withGame('priest',{completedQuestIds:[70893]});assert(!routes.routeQuestDone(feast,'priest',settings,[lifetime],now));
const otherRealm={...turnedIn,ref:{...turnedIn.ref,realmSlug:'kazzak',realm:'Kazzak'}};assert(!routes.routeQuestDone(feast,'priest',settings,[otherRealm],now));
const altTurnIn=withGame('druid',{data:{...game,questTurnIns:[{id:70893,title:'Community Feast',frequency:2,at:now-10000}]}});assert(routes.routeQuestDone(feast,'priest',settings,[profile('priest'),altTurnIn],now));
const records={'plan-prefs:today':{actor:'all',minutes:15},'note:keep':'Keep my notes','routine-retired:argent-tournament':true,'routine-retired:legion-archaeology':true},before=structuredClone(records);
let plan=t.todayPlan(catalog,records,settings,[turnedIn],now);assert(plan.done.some(u=>u.activity?.id===feast.id&&u.automatic));assert([...plan.optional,...plan.deferred].some(u=>u.activity?.id===shop.id));
assert.equal(t.todayPlan(catalog,{...records,['assignment:'+feast.id]:'both'},settings,[active,profile('druid')],now).optional.concat(t.todayPlan(catalog,{...records,['assignment:'+feast.id]:'both'},settings,[active,profile('druid')],now).deferred).filter(u=>u.activity?.id===feast.id).length,1);
const own={...records,...Object.fromEntries(feast.rewards.map(r=>['owned:'+r.id,true]))};plan=t.todayPlan(catalog,own,settings,[active],now);assert(![...plan.optional,...plan.deferred,...plan.unknown,...plan.done].some(u=>[feast.id,shop.id].includes(u.activity?.id)));
const custom={id:'custom-feast',title:'My feast routine',cadence:'weekly',assignment:'priest',priority:1,location:'Iskaara',why:'Toys',steps:['Cook'],source:'https://www.wowhead.com/quest=70893',questIds:[70893],custom:true};plan=t.todayPlan(catalog,{...records,'routine:custom-feast':custom},settings,[active],now);const units=[...plan.optional,...plan.deferred,...plan.unknown,...plan.done];assert(!units.some(u=>u.activity?.id===feast.id));assert(units.some(u=>u.routine?.id===custom.id&&u.rewards.some(r=>r.itemId===199892)));
const bundle={...custom,questIds:[70893,75665]};plan=t.todayPlan(catalog,{...records,'routine:custom-feast':bundle},settings,[turnedIn],now);assert(!plan.done.some(u=>u.routine?.id===bundle.id)); // A partial overlap must not finish a larger custom checklist.
const expanded=guide.playGuide(catalog,records,settings,[profile('priest')],now);assert(expanded.more.some(s=>s.unit.activity?.id===feast.id&&s.mode==='observe'));assert(!expanded.more.some(s=>s.unit.activity?.id==='darkmoon'));assert.deepEqual(records,before);
assert(!p.validateRecord('custom:custom-policy',{...feast,id:'custom-policy',custom:true}));
console.log('Passed 23 toy routes/37 targets: active source metadata, six weeklies, Feast ID, retired quest exclusions, purchase-vs-grind requirements, class/recipe checks, dated turn-ins/reset expiry, realm isolation, Warband deduplication, routine overlap, ownership, notes and extra guide choices.');
