import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getPlatformProxy} from 'wrangler';
import {moduleLoader} from './helpers.mjs';
const proxy=await getPlatformProxy({configPath:'dist/server/wrangler.json',persist:{path:'.wrangler/guide-profile-check'},remoteBindings:false,envFiles:[]});
const env={...proxy.env};let user={userId:'guide-fixture-a'};
const load=moduleLoader({'cloudflare:workers':{env},'../../chatgpt-auth':{getChatGPTUser:async()=>user}}),profile=load('lib/guide-profile.ts'),api=load('app/api/guides/route.ts'),parse=load('lib/guide-profile-data.ts'),server=load('lib/server-sync.ts'),{importAddon}=load('lib/import-addon.ts');
const request=operations=>new Request('https://test/api/guides',{method:'POST',headers:{Origin:'https://test','Content-Type':'application/json'},body:JSON.stringify({operations})});
try{
 for(const file of ['0000_living_doorman.sql','0001_strange_morlun.sql'])for(const stmt of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint').filter(s=>s.trim())){const table=stmt.match(/CREATE TABLE `([^`]+)`/)[1];if(!await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(table).first())await env.DB.prepare(stmt).run();}
 await env.DB.batch(['planner_records','sync_snapshots'].flatMap(t=>['guide-fixture-a','guide-fixture-b'].map(id=>env.DB.prepare(`DELETE FROM ${t} WHERE user_id=?`).bind(id))));
 const initial=await profile.guideProfile(user.userId);assert.equal(initial.values.budget,30);
 const op={id:'device-a:1',key:'budget',value:15};assert.equal((await api.POST(request([op]))).status,200);
 const first=await profile.guideProfile(user.userId);await api.POST(request([op]));assert.deepEqual(await profile.guideProfile(user.userId),first);
 await api.POST(request([{id:'web:2',key:'budget',value:60}]));await api.POST(request([op]));assert.equal((await profile.guideProfile(user.userId)).values.budget,60);
 await Promise.all([api.POST(request([{id:'a:3',key:'follow:rep-niffen-weekly',value:true}])),api.POST(request([{id:'b:3',key:'follow:rep-tuskarr-feast',value:true}]))]);
 const current=await profile.guideProfile(user.userId);assert.equal(current.values['follow:rep-niffen-weekly'],true);assert.equal(current.values['follow:rep-tuskarr-feast'],true);
 assert.equal((await api.POST(request([{id:'evil:1',key:'owned:199892',value:true}]))).status,400);
 await env.DB.batch(server.recordStatements(user.userId,[{key:'note:keep',value:'Unchanged note'}]));
 const raw=JSON.parse(readFileSync('work/addon-fixture.json','utf8'));raw.character={guid:'Player-99-FF',name:'Othermage',realm:'A Realm',region:'US',classFile:'MAGE'};raw.guides={version:1,profile:current.profile,revision:current.revision,operations:[{id:'mage:1',key:'engineering:Player-99-FF',value:true}],roster:{...raw.character,at:raw.exportedAt},observed:{recipes:{447312:{learned:true}}}};
 await importAddon(user.userId,raw);const imported=await profile.guideProfile(user.userId);assert.equal(imported.roster[0].guid,'Player-99-FF');assert.equal(imported.values['engineering:Player-99-FF'],true);assert.equal((await server.readRecords(user.userId))['note:keep'],'Unchanged note');
 const now=Math.floor(Date.now()/1000);raw.exportedAt=now;raw.dailyResetAt=now+1000;raw.weeklyResetAt=now+10000;raw.guides.observed={timeUnit:'unix-seconds',questsAt:now,quests:{70893:{title:'Community Feast',complete:false,objectives:[{text:'Tasks 2/5',numFulfilled:2,numRequired:5,finished:false}]}},questFlags:{},turnIns:{},weeklyResetAt:now+10000};
 await importAddon(user.userId,raw);
 const walkthrough=await (await api.GET(new Request('https://test/api/guides?walkthrough=rep-tuskarr-feast&guid=Player-99-FF'))).json();assert.equal(walkthrough.character.guid,'Player-99-FF');assert(walkthrough.steps.some(s=>s.counters==='Tasks 2/5'));assert(!walkthrough.complete);
 const wrongCharacter=await (await api.GET(new Request('https://test/api/guides?walkthrough=rep-tuskarr-feast&guid=Player-88-FF'))).json();assert.equal(wrongCharacter.character,null);
 const oldSource=await (await api.GET(new Request('https://test/api/guides?walkthrough=att-223312-e3218de244e0&guid=Player-99-FF'))).json();assert.equal(oldSource.id,'vendor-path-att-223312-e3218de244e0');assert.equal(oldSource.character.guid,'Player-99-FF');assert(oldSource.walkthrough.nodes.some(n=>n.questId===81930));
 const alternateId='att-119211-50d04d0a73b3-lfr';assert.equal((await api.POST(request([{id:'web:lfr',key:'follow:'+alternateId,value:true}]))).status,200);const alternate=await (await api.GET(new Request('https://test/api/guides?walkthrough='+alternateId+'&guid=Player-99-FF'))).json();assert.equal(alternate.id,alternateId);assert(alternate.walkthrough.nodes[0].text.includes('Betrayer'));

 assert.throws(()=>parse.parseGuideSnapshot({...raw.guides,roster:{...raw.guides.roster,guid:'Player-88-FF'}},raw.character));
 await assert.rejects(()=>profile.updateGuideProfile(user.userId,[{id:'wrong:1',key:'budget',value:30}],{...raw.guides,profile:'different'}));
 user={userId:'guide-fixture-b'};assert.deepEqual((await profile.guideProfile(user.userId)).roster,[]);assert.notEqual((await profile.guideProfile(user.userId)).profile,initial.profile);
 await env.DB.prepare("DELETE FROM sync_snapshots WHERE user_id=? AND key='guides:profile:v1'").bind(user.userId).run();
 await env.DB.batch(server.recordStatements(user.userId,[{key:'plan-prefs:today',value:{minutes:45,actor:'all'}},{key:'pin:rep-niffen-weekly',value:true}]));
 const migrated=await profile.guideProfile(user.userId);assert.equal(migrated.values.budget,45);assert.equal(migrated.values['follow:rep-niffen-weekly'],true);
 user=null;assert.equal((await api.GET()).status,401);assert.equal((await api.POST(request([op]))).status,401);
 console.log('Passed real-database guide profile: concurrent edits, server order, idempotency, cross-user/profile and GUID isolation, arbitrary region/class roster, preference-only operations and preservation of notes.');
}finally{await proxy.dispose();}
