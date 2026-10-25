import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getPlatformProxy} from 'wrangler';
import {moduleLoader,fixtureSettings as settings} from './helpers.mjs';
const proxy=await getPlatformProxy({configPath:'dist/server/wrangler.json',persist:{path:'.wrangler/companion-check'},remoteBindings:false,envFiles:[]});
const env={...proxy.env,BLIZZARD_TOKEN_KEY:Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')};let user={userId:'companion-fixture-a'};
const load=moduleLoader({'cloudflare:workers':{env},'../../chatgpt-auth':{getChatGPTUser:async()=>user}}),server=load('lib/server-sync.ts'),companion=load('lib/companion.ts'),api=load('app/api/companion/route.ts'),sync=load('app/api/sync/route.ts');
const post=(body,token='',origin='https://test')=>api.POST(new Request('https://test/api/companion',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)}));
try{
 for(const file of ['0000_living_doorman.sql','0001_strange_morlun.sql'])for(const stmt of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint').filter(s=>s.trim())){const table=stmt.match(/CREATE TABLE `([^`]+)`/)[1];if(!await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(table).first())await env.DB.prepare(stmt).run();}
 for(const scope of ['companion-fixture-a','companion-fixture-b',companion.COMPANION_SCOPE])await env.DB.batch(['planner_records','sync_snapshots'].map(t=>env.DB.prepare(`DELETE FROM ${t} WHERE user_id=?`).bind(scope)));
 await env.DB.batch(server.recordStatements(user.userId,[{key:'settings',value:settings},{key:'note:guldan',value:'Preserve my note'},{key:'owned:jaraxxus',value:true}]));
 const proof='1'.repeat(64),challenge=await server.sha256(proof);
 user=null;const started=await (await post({action:'start',name:'Fixture Mac',challenge})).json();assert(started.id);assert.equal((await post({action:'approve',id:started.id})).status,401);
 assert.equal((await api.GET(new Request(`https://test/api/companion?pair=${started.id}`,{headers:{'X-Toybox-Pairing':'2'.repeat(64)}}))).status,401);
 assert.equal((await companion.pollPair(started.id,proof)).pending,true);
 user={userId:'companion-fixture-a'};assert.equal((await post({action:'approve',id:started.id})).status,200);assert.equal((await post({action:'approve',id:started.id})).status,409);
 const paired=await companion.pollPair(started.id,proof);assert.equal(paired.pending,false);assert(paired.token);const token=paired.token;
 const raw=JSON.parse(readFileSync('work/addon-fixture.json','utf8')),now=Date.now();raw.exportedAt=now-120000;raw.dailyResetAt=now+3600000;raw.weeklyResetAt=now+86400000;raw.raidLockouts=[];raw.game.recipes=raw.game.recipes.map(r=>({...r,at:now-120000}));raw.game.instances=[];raw.game.offeredQuests=[];
 assert.equal((await post({action:'upload',snapshot:raw})).status,401);assert.equal((await post({action:'upload',snapshot:raw},token,'https://evil.test')).status,400);
 user=null;let response=await post({action:'upload',snapshot:raw},token);assert.equal(response.status,200,JSON.stringify(await response.clone().json()));assert.equal((await response.json()).evidenceMatched,true);
 assert.equal((await post({action:'upload',snapshot:raw},token)).status,200);
 const old={...raw,exportedAt:raw.exportedAt-1000,game:{...raw.game,recipes:raw.game.recipes.map(r=>({...r,at:r.at-1000}))}};response=await post({action:'upload',snapshot:old},token);assert.equal(response.status,200);assert.equal((await response.json()).ignored,true);
 let records=await server.readRecords('companion-fixture-a');assert.equal(records['note:guldan'],'Preserve my note');assert.equal(records['owned:jaraxxus'],true);assert.equal(Object.keys(records).filter(k=>k.startsWith('cooldown2:')).length,2);
 await post({action:'heartbeat',status:'waiting'},token);await assert.rejects(()=>companion.pollPair(started.id,proof),/already claimed/);
 user={userId:'companion-fixture-b'};assert.equal((await post({action:'revoke',id:paired.deviceId})).status,404);assert.equal((await sync.GET(new Request('https://test/api/sync'))).status,200);assert.equal((await (await sync.GET(new Request('https://test/api/sync'))).json()).companion.devices.length,0);
 user={userId:'companion-fixture-a'};const view=await (await sync.GET(new Request('https://test/api/sync'))).json();assert.equal(view.companion.devices.length,1);assert.equal(view.companion.devices[0].characters[0].name,'Examplepriest');assert(!JSON.stringify(view).includes(token));const backup=await (await sync.GET(new Request('https://test/api/sync?export=1'))).json();assert(!backup.snapshots.some(s=>s.key.startsWith('companion:')));
 assert.equal((await post({action:'revoke',id:paired.deviceId})).status,200);assert.equal((await post({action:'upload',snapshot:raw},token)).status,401);
 const race=await companion.startPair('Race test',challenge);const approvals=await Promise.allSettled([companion.approvePair(race.id,'companion-fixture-a'),companion.approvePair(race.id,'companion-fixture-b')]);assert.equal(approvals.filter(r=>r.status==='fulfilled').length,1);
 const expired=await companion.startPair('Expired',challenge);const p=await server.snapshot(companion.COMPANION_SCOPE,`pair:${expired.id}`);await server.saveSnapshot(companion.COMPANION_SCOPE,`pair:${expired.id}`,'fixture',{...p,expiresAt:Date.now()-1});await assert.rejects(()=>companion.pollPair(expired.id,proof),/expired/);
 console.log('Passed real-database companion: browser approval, hashed pairing proof, single approval under race, expiration, service/device separation, token-bound account isolation, revoked/wrong tokens, origin checks, stale/replayed imports, no secrets in reads/backups, preserved notes/ownership and observed cooldowns.');
}finally{await proxy.dispose();}
