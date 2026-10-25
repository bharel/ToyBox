import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getPlatformProxy} from 'wrangler';
import {moduleLoader} from './helpers.mjs';
const proxy=await getPlatformProxy({configPath:'dist/server/wrangler.json',persist:{path:'.wrangler/guide-reports-check'},remoteBindings:false,envFiles:[]});
const env={...proxy.env};let user={userId:'report-fixture-a'};
const load=moduleLoader({'cloudflare:workers':{env},'../../chatgpt-auth':{getChatGPTUser:async()=>user}}),reports=load('lib/guide-reports.ts'),profile=load('lib/guide-profile.ts'),api=load('app/api/guide-reports/route.ts');
const report={version:1,id:'device:report:1',revision:1,guideId:'argent-tournament',stepId:'argent:q1:objective',createdAt:Math.floor(Date.now()/1000),addonVersion:'2.2.0',contentVersion:'2.2.0',character:{guid:'Player-1-ABC',name:'Tester',realm:'Realm',region:'EU'},context:{questId:1,quest:{title:'Quest',token:'never store',objectives:[{numFulfilled:2,numRequired:5}]},inventory:{secret:'no'},credentials:{token:'no'},navigation:{message:'Fallback directions'}}};
const request=body=>new Request('https://test/api/guide-reports',{method:'POST',headers:{Origin:'https://test','Content-Type':'application/json'},body:JSON.stringify(body)});
try{
 for(const file of ['0000_living_doorman.sql','0001_strange_morlun.sql'])for(const stmt of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint').filter(s=>s.trim())){const table=stmt.match(/CREATE TABLE `([^`]+)`/)[1];if(!await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(table).first())await env.DB.prepare(stmt).run();}
 for(const id of ['report-fixture-a','report-fixture-b'])await env.DB.prepare('DELETE FROM sync_snapshots WHERE user_id=?').bind(id).run();
 const p=await profile.guideProfile(user.userId);assert.deepEqual((await reports.uploadGuideReports(user.userId,[{...report,profile:p.profile}],p.profile)).ack,[report.id]);
 await reports.uploadGuideReports(user.userId,[report],p.profile);assert.equal((await reports.guideReports(user.userId)).length,1);
 const saved=(await reports.guideReports(user.userId))[0];assert(!saved.context.inventory&&!saved.context.credentials&&!saved.context.quest.token);
 await reports.uploadGuideReports(user.userId,[{...report,revision:2,note:'The NPC is absent.'}],p.profile);assert.equal((await reports.guideReports(user.userId))[0].note,'The NPC is absent.');
 assert.equal((await api.POST(request({id:report.id,status:'resolved'}))).status,200);assert.equal((await reports.guideReports(user.userId))[0].status,'resolved');
 await profile.updateGuideProfile(user.userId,[{id:'pref:1',key:'checklistExpanded',value:true},{id:'pref:2',key:'followToy:45015',value:true}]);
 assert.equal((await profile.guideProfile(user.userId,[])).values.checklistExpanded,undefined);assert.equal((await profile.guideProfile(user.userId,['session-v1'])).values['followToy:45015'],true);
 assert.equal((await profile.guideProfile(user.userId,['reports-v1'],[report.id])).reportAck[report.id],2);
 await assert.rejects(()=>reports.uploadGuideReports(user.userId,[{...report,profile:'someone-else'}],p.profile));assert.throws(()=>reports.parseGuideReport({...report,note:'x'.repeat(2001)}));
 user={userId:'report-fixture-b'};assert.equal((await (await api.GET()).json()).reports.length,0);assert.equal((await api.POST(request({id:report.id,status:'ignored'}))).status,400);
 user={userId:'report-fixture-a'};assert.equal((await api.POST(request({id:report.id,deleted:true}))).status,200);await reports.uploadGuideReports(user.userId,[report],p.profile);assert.equal((await reports.guideReports(user.userId)).length,0);
 await reports.uploadGuideReports(user.userId,[{...report,revision:4,note:'Delayed offline edit'}],p.profile);assert.equal((await reports.guideReports(user.userId)).length,0);assert.equal((await profile.guideProfile(user.userId,['reports-v1'],[report.id])).reportAck[report.id],4);
 for(const key of ['id','guideId','stepId'])assert.throws(()=>reports.parseGuideReport({...report,[key]:undefined}));
 user=null;assert.equal((await api.GET()).status,401);assert.equal((await api.POST(request({id:report.id,status:'open'}))).status,401);
 console.log('Passed private report database/API: bounded sanitization, deduplication, notes/revisions, profile binding, capability negotiation, statuses, cross-user isolation, deletion replay and authorization.');
}finally{await proxy.dispose();}
