import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {getPlatformProxy} from 'wrangler';
const options={configPath:'dist/server/wrangler.json',persist:{path:'.wrangler/integration-check'},remoteBindings:false,envFiles:[]};
import {moduleLoader} from './helpers.mjs';
const planner=moduleLoader()('lib/planner.ts');
const route=ts.transpileModule(readFileSync('app/api/progress/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let proxy=await getPlatformProxy(options);let actor=null;
function handlers(){const m={exports:{}};new Function('require','module','exports',route)(name=>name==='cloudflare:workers'?{env:proxy.env}:name.includes('chatgpt-auth')?{getChatGPTUser:async()=>actor}:planner,m,m.exports);return m.exports;}
try{
 const existing=await proxy.env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='planner_records'").first();
 if(!existing)await proxy.env.DB.prepare(readFileSync('drizzle/0000_living_doorman.sql','utf8')).run();
 let api=handlers();assert.equal((await api.GET()).status,401);
 actor={userId:'integration-user-a',email:'qa@example.invalid'};
 function request(updates,origin='https://toybox.example'){return new Request('https://toybox.example/api/progress',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({updates})})}
 const updates=[{key:'owned:jaraxxus',value:true},{key:'attempt:guldan:druid:Normal:qa',value:true},{key:'routine-done:argent-tournament:priest:1792555200000',value:true},{key:'routine-note:argent-tournament',value:'Valiant progress survives resets'}];
 assert.equal((await api.POST(request(updates))).status,200);
 assert.equal((await (await api.GET()).json()).records['owned:jaraxxus'],true);
 await proxy.dispose();proxy=await getPlatformProxy(options);api=handlers();
 assert.equal((await (await api.GET()).json()).records['owned:jaraxxus'],true);
 assert.equal((await (await api.GET()).json()).records['routine-note:argent-tournament'],'Valiant progress survives resets');
 assert.equal((await (await api.GET()).json()).records['routine-done:argent-tournament:priest:1792555200000'],true);
 actor={userId:'integration-user-b',email:'qb@example.invalid'};
 assert.deepEqual((await (await api.GET()).json()).records,{});
 actor={userId:'integration-user-a',email:'qa@example.invalid'};
 assert.equal((await api.POST(request([{key:'owned:jaraxxus',value:'invalid'}]))).status,400);
 assert.equal((await api.POST(request([{key:'owned:jaraxxus',value:false}],'https://wrong.example'))).status,403);
 assert.equal((await (await api.GET()).json()).records['owned:jaraxxus'],true);
 assert.equal((await api.POST(request(updates.map(u=>({key:u.key,value:null}))))).status,200);
 assert.deepEqual((await (await api.GET()).json()).records,{});
 console.log('Passed API + real local D1: sign-in guard, restart persistence, account isolation, validation, origin checks, and cleanup.');
}finally{await proxy.dispose()}
