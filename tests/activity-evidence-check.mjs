import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleLoader,fixtureSettings as settings} from './helpers.mjs';
const load=moduleLoader(),s=load('lib/sync.ts'),e=load('lib/observed-progress.ts'),g=load('lib/progression.ts'),p=load('lib/planner.ts'),{catalog}=load('lib/catalog.ts');
const now=Date.parse('2026-10-23T15:05:00Z'),at=now-60000,raid=catalog.find(a=>a.id==='guldan');
const raw={...JSON.parse(readFileSync('work/addon-fixture.json','utf8')),exportedAt:at,toys:[],ownedToyIds:[],dailyResetAt:now+86400000,weeklyResetAt:now+6*86400000,game:{version:1,questsAvailable:true,instances:[],recipes:[]},raidLockouts:[{name:'The Nighthold',difficultyId:16,difficultyName:'Mythic',resetAt:now+86400000,encounters:[{name:"Gul'dan",killed:true}]}]};
const addon={...s.parseAddon(raw,now),binding:settings.bindings.priest};
let progress=e.observedProgress([], [addon],settings,now);
assert.equal(g.activityEligibility(raid,'priest',{},settings,progress,now,'Mythic').state,'ready');
assert.equal(g.activityEligibility(raid,'priest',{},settings,progress,now,'Normal').state,'unknown');
assert.equal(g.activityEligibility(raid,'druid',{},settings,progress,now,'Mythic').state,'unknown');
assert.equal(g.activityEligibility(raid,'priest',{},settings,e.observedProgress([],[{...addon,raidsFresh:false}],settings,now),now,'Mythic').state,'unknown');
const different={...settings,bindings:{...settings.bindings,priest:{...settings.bindings.priest,id:999}}};
assert.equal(e.observedProgress([],[addon],different,now).length,0);
const memento=catalog.find(a=>a.id==='memento'),darkmoon=catalog.find(a=>a.id==='darkmoon'),arachnis=catalog.find(a=>a.id==='arachnis');
assert.equal(g.activityEligibility(darkmoon,'priest',{},settings,progress,now).state,'blocked');
for(const [activity,npcId] of [[arachnis,96323],[memento,147845]]){
 const route={route:activity.id,kind:'npc',npcId,at,expiresAt:at+300000};
 const observed={...addon,game:{...addon.game,routes:[route]}};
 progress=e.observedProgress([],[observed],settings,now);
 assert.equal(g.activityEligibility(activity,'priest',{},settings,progress,now).state,'ready');
 assert.equal(g.activityEligibility(activity,'priest',{},settings,progress,route.expiresAt).state,'unknown');
 assert.equal(g.activityEligibility(activity,'druid',{},settings,progress,now).state,'unknown');
 assert.deepEqual(s.addonAttemptUpdates(observed,{},settings,[activity]),[]); // A sighting is never a kill.
 assert.deepEqual(s.ownedUpdates(observed.toys,[activity]),[]);
 for(const change of [{expiresAt:at+300001},{npcId:1},{at:now+1},{route:'__proto__'},{kind:'guessed'}])assert.throws(()=>s.parseAddon({...raw,game:{...raw.game,routes:[{...route,...change}]}},now),/route observation/);
}
const calendar={...addon,game:{...addon.game,routes:[{route:'darkmoon',kind:'calendar',at,expiresAt:at+300000}]}};
assert.equal(g.activityEligibility(darkmoon,'priest',{},settings,e.observedProgress([],[calendar],settings,now),now).state,'ready');
assert.equal(g.activityEligibility(darkmoon,'priest',{},settings,e.observedProgress([],[calendar],settings,now),at+300000).state,'blocked');
console.log('Passed route evidence: saved raid kills by exact difficulty, identity isolation, stale raid data rejected, event closure, direct NPC and calendar observations, strict five-minute expiry, malformed evidence, and no inferred loot, kills or toy ownership.');
