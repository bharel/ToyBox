import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getPlatformProxy} from 'wrangler';
import {moduleLoader} from './helpers.mjs';
const proxy=await getPlatformProxy({configPath:'dist/server/wrangler.json',persist:{path:'.wrangler/catalogue-integration-check'},remoteBindings:false,envFiles:[]});const env={...proxy.env};
const load=moduleLoader({'cloudflare:workers':{env},'../../chatgpt-auth':{getChatGPTUser:async()=>user}}),server=load('lib/server-catalogue.ts'),storage=load('lib/server-sync.ts'),pure=load('lib/toy-catalogue.ts'),sample=pure.catalogueToys()[0],original=globalThis.fetch;
let failures=new Set(),calls=[],user=null;
globalThis.fetch=async(url,options={})=>{const u=new URL(url);calls.push(u.href);if([...failures].some(s=>u.href.includes(s)))return new Response('Unavailable',{status:503});
 if(u.pathname==='/data/wow/toy/index'){assert.equal(options.headers.Authorization,'Bearer fixture-token');return Response.json({toys:[{id:sample.toyId,name:sample.name},{id:999991,name:'New API toy'}]});}
 if(u.pathname==='/data/wow/toy/999991')return Response.json({item:{id:999992}});
 if(u.host==='raw.githubusercontent.com')return Response.json(Array(12).fill({name:'fixture'}));
 if(u.host==='nether.wowhead.com')return Response.json({name:'Jaraxxus',icon:'inv_misc_toy_01',tooltip:'<div class="whtt-extra whtt-droppedby">Dropped by: The Demon Within</div><div class="whtt-extra whtt-dropchance">Drop Chance: 0.76%</div>'});
 throw Error('Unexpected public request '+u.href);
};
try{
 for(const file of ['0000_living_doorman.sql','0001_strange_morlun.sql'])for(const stmt of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint').filter(s=>s.trim())){const table=stmt.match(/CREATE TABLE `([^`]+)`/)[1];if(!await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(table).first())await env.DB.prepare(stmt).run();}
 await env.DB.prepare("DELETE FROM sync_snapshots WHERE user_id='public:toybox-catalogue:v1'").run();
 const now=Date.now();const values=await Promise.all([server.refreshCatalogue('fixture-token',now),server.refreshCatalogue('fixture-token',now)]);const first=values.find(v=>v?.index.length);assert(first);assert.equal(calls.filter(x=>x.includes('/toy/index')).length,1);assert.equal(first.index.length,2);assert.equal(first.index.find(t=>t.toyId===999991).itemId,999992);assert.equal(first.metadataAt,now);
 const count=calls.length;await server.refreshCatalogue('fixture-token',now+pure.METADATA_TTL-1);assert.equal(calls.length,count);
 failures.add('/toy/index');failures.add('raw.githubusercontent.com');const partial=await server.refreshCatalogue('fixture-token',now+pure.METADATA_TTL);assert.equal(partial.indexAt,now);assert.equal(partial.metadataAt,now);assert.equal(partial.index.length,2);assert.equal(partial.errors.length,2);assert(pure.catalogueView({},[],partial,now+pure.METADATA_TTL).coverage.stale);
 failures.clear();const restored=await server.refreshCatalogue('fixture-token',now+pure.METADATA_TTL+100);assert.equal(restored.errors.length,0);assert(restored.indexAt>now);
 const detail=await server.cachedToyDetails(119211,now);assert.equal(detail.drop.percent,.76);assert.equal(detail.drop.scope,'pooled');const before=calls.length;await server.cachedToyDetails(119211,now+pure.METADATA_TTL-1);assert.equal(calls.length,before);
 failures.add('nether.wowhead.com');const old=await server.cachedToyDetails(119211,now+pure.METADATA_TTL);assert.equal(old.drop.percent,.76);assert.equal(old.retrievedAt,now);assert(old.error);const none=await server.cachedToyDetails(122304,now);assert.equal(none.drop,undefined);assert(none.error);
 await storage.saveSnapshot('private-fixture-user','secret-test','fixture',{profile:'private'});const publicData=JSON.stringify(await server.readCatalogue());assert(!publicData.includes('private'));assert(!publicData.includes('fixture-token'));
 const toyApi=load('app/api/toys/route.ts'),syncApi=load('app/api/sync/route.ts');assert.equal((await toyApi.GET(new Request('https://test/api/toys?item=119211'))).status,401);user={userId:'private-fixture-user'};assert.equal((await toyApi.GET(new Request('https://test/api/toys?item=0'))).status,400);assert.equal((await toyApi.GET(new Request('https://test/api/toys?item=99999998'))).status,400);failures.clear();assert.equal((await toyApi.GET(new Request('https://test/api/toys?item=999992'))).status,200);const read=await (await syncApi.GET(new Request('https://test/api/sync?catalogue=1'))).json();assert.equal(read.catalogueCounts.owned,0);assert(read.catalogueEntries.some(t=>t.itemId===999992&&t.availability.state==='unknown'));assert(read.catalogueCoverage.revision);assert(!JSON.stringify(read).includes('fixture-token'));
 console.log('Passed real local database: concurrent metadata lease, toy index/item joins, 24-hour cache boundary, partial failures preserve successful snapshots, recovery, sourced rate cache, stale fallback, unknown fallback, private/public isolation.');
}finally{globalThis.fetch=original;await proxy.dispose();}
