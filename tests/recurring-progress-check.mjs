import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {moduleLoader} from './helpers.mjs';
const {walkthroughSteps,evaluateCondition}=moduleLoader()('lib/walkthrough.ts');
const pack=JSON.parse(readFileSync('lib/data/guide-pack.json')),facts=JSON.parse(readFileSync('lib/data/att-toy-routes.json')).quests,priority=JSON.parse(readFileSync('lib/data/priority-guide-facts.json'));
const guide=id=>pack.guides.find(g=>g.id===id).walkthrough,now=1000000,reset=now+3600,context={now,owned:new Set()};
const q=(title,count=0,total=10,complete=false)=>({title,complete,objectives:[{text:`${count}/${total} ${title}`,numFulfilled:count,numRequired:total,finished:complete}]});
const base={questsAt:now,quests:{},turnIns:{},flags:{},dailyResetAt:reset,weeklyResetAt:reset+86400,faction:'Alliance'};
const cases=[],add=(name,graph,state,check)=>cases.push({name,graph,state:{...base,...state},check});
add('Aspirant daily replaces fifteen-seal goal',guide('argent-tournament'),{quests:{13672:q('Aspirant seals',5,15),13625:q('Learning the Reins')}},r=>{assert.equal(r.rows[0].questId,13625);assert.equal(r.rows[0].longTermProgress.total,15);assert.equal(r.dailySession.total,3);});
add('Aspirant three opportunities wait for reset',guide('argent-tournament'),{quests:{13672:q('Aspirant seals',10,15)},turnIns:{13625:now,13671:now,13666:now}},r=>{assert(r.dailySession.waiting);assert(!r.complete);assert(r.rows[0].text.includes('Aspirant'));});
add('Aspirant reset keeps seals',guide('argent-tournament'),{quests:{13672:q('Aspirant seals',10,15)},turnIns:{13625:now-86400,13671:now-86400,13666:now-86400}},r=>{assert.equal(r.dailySession.done,0);assert.equal(r.dailySession.progress.count,10);});
add('Horde Aspirant stays separate',guide('argent-tournament'),{faction:'Horde',quests:{13678:q('Aspirant seals',5,15),13677:q('Horde reins'),13625:q('Alliance reins')}},r=>{assert.equal(r.rows[0].questId,13677);assert.equal(r.dailySession.total,3);});
add('Aspirant ready collection turnin',guide('argent-tournament'),{quests:{13672:q('Aspirant seals',15,15,true)}},r=>{assert.equal(r.rows[0].questId,13672);assert.equal(r.rows[0].kind,'turnin');});
const loamm={...base,quests:{75665:q('Loamm reputation',500,1500)},repTasksAt:now,repTasks:{2564:{90001:{title:'Observed world quest',destination:{mapID:2133,x:.5,y:.4},expiresAt:now+600},90002:{title:'Expired',expiresAt:now-1},75665:{title:'The weekly itself'}}}};
add('Loamm actual world quest leads weekly counter',guide('rep-niffen-weekly'),loamm,r=>{assert.equal(r.rows.length,1);assert.equal(r.rows[0].questId,90001);assert.equal(r.rows[0].longTermProgress.count,500);assert(!r.complete);});
add('Loamm live counters stay on actual task',guide('rep-niffen-weekly'),{...loamm,quests:{...loamm.quests,90001:q('Observed world quest',2,8)}},r=>{assert.equal(r.rows[0].count,2);assert.equal(r.rows[0].total,8);assert.equal(r.rows[0].longTermProgress.total,1500);});
add('Loamm completed task does not finish weekly',guide('rep-niffen-weekly'),{...loamm,turnIns:{90001:now}},r=>{assert(!r.complete);assert.equal(r.rows[0].kind,'observe');});
add('Loamm stale sources remain observation',guide('rep-niffen-weekly'),{...loamm,repTasksAt:now-301},r=>assert.equal(r.rows[0].kind,'observe'));
add('Loamm other faction cannot supply activities',guide('rep-niffen-weekly'),{...loamm,repTasks:{2503:loamm.repTasks[2564]}},r=>assert.equal(r.rows[0].kind,'observe'));
add('Unavailable map tasks are not eligible work',guide('rep-niffen-weekly'),{...loamm,repTasks:{2564:{90001:{title:'Unavailable',isTask:true,eligible:false},90002:{title:'Unknown',isTask:true}}}},r=>assert.equal(r.rows[0].kind,'observe'));
add('World tasks do not invent an NPC turnin',guide('rep-niffen-weekly'),{...loamm,quests:{...loamm.quests,90001:q('Observed world quest',8,8,true)},repTasks:{2564:{90001:{title:'Observed world quest',isTask:true,eligible:true}}}},r=>assert.equal(r.rows[0].kind,'objective'));
add('Loamm quota switches to weekly turnin',guide('rep-niffen-weekly'),{...loamm,quests:{75665:q('Loamm reputation',1500,1500,true)}},r=>{assert.equal(r.rows[0].questId,75665);assert.equal(r.rows[0].kind,'turnin');});
add('Loamm weekly turnin is its terminal',guide('rep-niffen-weekly'),{...loamm,quests:{},turnIns:{75665:now}},r=>assert(r.complete));
add('Wanted quests lead inspection prompt',guide('rep-expedition-posters'),{quests:{71007:q('Disoriented Wishtail')}},r=>assert.equal(r.rows[0].questId,71007));
const posters={...base,questSets:{'rep-expedition-posters':{resetAt:base.weeklyResetAt,quests:{71007:now,71001:now}}},turnIns:{71007:now}};
add('One wanted quest cannot finish another',guide('rep-expedition-posters'),posters,r=>assert(!r.complete));
add('Observed wanted set finishes independently of reputation',guide('rep-expedition-posters'),{...posters,questSets:{'rep-expedition-posters':{...posters.questSets['rep-expedition-posters'],completeScan:true}},turnIns:{71007:now,71001:now}},r=>assert(r.complete));
add('Partial poster inspections do not prove full weekly completion',guide('rep-expedition-posters'),{...posters,turnIns:{71007:now,71001:now}},r=>assert(!r.complete));
add('Old poster introduction cannot finish weekly set',guide('rep-expedition-posters'),{questSets:{'rep-expedition-posters':{resetAt:base.weeklyResetAt,quests:{72397:now}}},turnIns:{72397:now}},r=>assert(!r.complete));
add('Soridormi weekly keeps one-time toy reward separate',guide('rep-soridormi-weekly'),{quests:{77236:q('When Time Needs Mending',0,1)}},r=>{assert.equal(r.rows[0].questId,77236);assert(!r.rows[0].text.includes('Minute Glass'));assert(!r.rows[0].text.includes('Foreseeable Friendship'));});
const chain=priority.archaeology[0],last=chain.questIds.at(-1);
add('Archaeology first stage is not final reward',guide('legion-archaeology'),{archaeology:{id:chain.id,at:now-86400,endAt:now+86400},turnIns:{[chain.questIds[0]]:now-500}},r=>assert(!r.complete));
add('Known archaeology window retains final turnin',guide('legion-archaeology'),{archaeology:{id:chain.id,at:now-86400,endAt:now+86400},turnIns:{[last]:now-500}},r=>assert(r.complete));
add('Expired archaeology window reopens observation',guide('legion-archaeology'),{archaeology:{id:chain.id,at:now-86400,endAt:now-1},turnIns:{[last]:now-500}},r=>assert(!r.complete));
add('Unknown archaeology window is not invented',guide('legion-archaeology'),{archaeology:{id:chain.id,at:now-86400},turnIns:{[last]:now-500}},r=>assert(!r.complete));
const dir=mkdtempSync(join(tmpdir(),'toybox-recurring-'));
try{
 const file=join(dir,'cases.json');writeFileSync(file,JSON.stringify(cases.map(({check,...f})=>({...f,now}))));
 const lua=JSON.parse(execFileSync('python3',['tests/walkthrough-lua.py',file],{encoding:'utf8',maxBuffer:8e6}));
 cases.forEach((f,i)=>{const r=walkthroughSteps(f.graph,'fixture',f.state,context);f.check(r);assert.deepEqual(lua[i],{complete:r.complete,rows:r.rows.map(n=>({id:n.id,text:n.text,available:n.available,counters:n.counters??null}))},f.name+' parity');});
}finally{rmSync(dir,{recursive:true,force:true});}
// Source flags are compared across every compiled graph, with archaeology's
// explicitly authored fortnightly override kept separate from ATT's weekly bit.
const mismatches=[];
function rules(r){return r?[r,...(r.all||r.any||r.rules||[]).flatMap(rules),...(r.negate?rules(r.negate):[])]:[];}
for(const g of pack.guides)if(!g.aliasOf)for(const node of g.walkthrough?.nodes||[]){
 const f=facts[node.questId],expected=priority.archaeology.some(c=>c.questIds.includes(node.questId))?'fortnightly':f?.isWeekly?'weekly':f?.isDaily?'daily':undefined;
 for(const r of rules(node.completeWhen))if(expected&&r.kind==='questTurnedIn'&&r.questId===node.questId&&r.cadence!==expected)mismatches.push([g.id,node.questId,expected,r.cadence]);
}
assert.deepEqual(mismatches,[]);
for(const id of [13625,13677,14074,14143])assert(guide('argent-tournament').nodes.some(n=>n.questId===id&&rules(n.completeWhen).some(r=>r.cadence==='daily')));
console.log(`Passed ${cases.length} recurring progression scenarios in Lua and TypeScript; daily/weekly/fortnightly source-cadence audit passed across every compiled walkthrough.`);
