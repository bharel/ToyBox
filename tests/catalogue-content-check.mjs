import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {moduleLoader} from './helpers.mjs';
import {checkCompleteRoute} from '../scripts/catalogue-content.mjs';
import {auditCatalogue} from '../scripts/catalogue-audit.mjs';
import {validateGraph} from '../scripts/walkthrough-content.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8')),pack=read('lib/data/guide-pack.json');
const guide=id=>pack.guides.find(g=>g.id===id),{walkthroughSteps}=moduleLoader()('lib/walkthrough.ts'),now=1792800000;
const audit=auditCatalogue(pack);assert.equal(audit.failures.length,0);assert.equal(audit.frozenActiveRoutes,1000);assert.equal(audit.activeRoutes,1000);
assert.equal(audit.completePaths,pack.coverage.activePlayableRoutes);
for(const r of read('lib/data/catalogue-crafting-walkthroughs.json').routes.filter(r=>!r.completePath))for(const g of pack.guides.filter(g=>g.walkthrough?.routeIds?.includes(r.sourceRouteId)))assert.equal(g.validation.completePath,false,'Duplicate source guide must retain its upstream gap: '+g.id);
const removed=structuredClone(pack);removed.toys.flatMap(t=>t.routes).find(r=>r.id===audit.rows[0].routeId).availability='unknown';assert(auditCatalogue(removed).failures.length,'Reclassifying an active gap must fail the frozen-catalogue gate.');
const batch=read('lib/data/catalogue-vendor-paths.json'),candidate=batch.routes.find(r=>r.completePath),sources=new Set(batch.sources.map(s=>s.url)),canonical=guide(candidate.id),graph=canonical.walkthrough;
assert.deepEqual(checkCompleteRoute(candidate,graph,sources),[]);
for(const [label,mutate,pattern] of [
 ['unknown prerequisite',g=>g.nodes[0].requires={kind:'evidenceUnavailable'},/unknown prerequisite/],
 ['invalid coordinate',g=>g.nodes[0].destination.x=NaN,/Invalid destination/],
 ['placeholder',g=>g.nodes[0].text='Complete the live objectives for this quest.',/placeholder/],
 ['no learning',g=>g.nodes=g.nodes.filter(n=>n.kind!=='learn'),/learning/],
 ['completion from reward receipt',g=>g.completeWhen={kind:'itemCount',itemId:candidate.itemId},/Toy Box ownership/],
 ['missing source',g=>g.nodes[0].sources=['https://invalid.example/unreviewed'],/Unresolved evidence/]
]){const value=structuredClone(graph);mutate(value);assert(checkCompleteRoute(candidate,value,sources).some(s=>pattern.test(s)),label);}
const bad=structuredClone(graph);bad.nodes[0].when={atLeast:2,rules:[{kind:'level',value:10}]};assert.throws(()=>validateGraph(bad,'impossible'),/cardinality/);
const graphs=read('lib/data/catalogue-release.json').inputs.flatMap(path=>read(path).routes||[]).filter(r=>r.sourceChecked&&r.walkthrough).map(r=>guide(r.id));
assert(graphs.length>=90);for(const g of graphs){assert(g,'Every published graph has a runtime guide');validateGraph(g.walkthrough,g.id);for(const n of g.walkthrough.nodes)if(n.linkedGuideId)assert(guide(n.linkedGuideId),'Linked walkthrough is bundled: '+n.linkedGuideId);}
for(const item of [119211,143544]){const main=pack.guides.find(g=>g.rewards.includes(item)&&g.id.startsWith('att-')&&!g.id.endsWith('-lfr')&&g.validation?.completePath);assert(main&&!main.aliasOf);assert.equal(main.walkthrough.nodes[0].linkedGuideId,main.id+'-lfr');assert(guide(main.id+'-lfr').validation.completePath);}
const crystal=guide('vendor-path-att-223312-e3218de244e0'),renown=guide('vendor-path-att-228706-5c0b6dc1f21a');
const flags=Object.fromEntries([...new Set(crystal.questIds.concat(renown.questIds))].map(id=>[id,{at:now,value:false,source:'current-client'}]));
const base={guid:'Player-1-ABC',region:'EU',faction:'Alliance',class:'PRIEST',level:80,questsAt:now,quests:{},offersAt:now,offers:{},flags,turnIns:{},inventory:{at:now,data:{}},currencies:{2815:{at:now,quantity:0}},dailyResetAt:now+3600,weeklyResetAt:now+86400};
const cases=[];
const add=(name,g,state,check,owned=[])=>cases.push({name,now,graph:g.walkthrough,state:{...base,...state},owned,check});
add('fresh Alliance introduction',crystal,{},r=>assert(r.rows[0].id.includes('q81930:accept')));
add('fresh Horde introduction',crystal,{faction:'Horde'},r=>assert(r.rows[0].id.includes('q78713:accept')));
add('transferred currency is not phase access',crystal,{currencies:{2815:{at:now,quantity:100}}},r=>assert(r.rows[0].id.includes('q81930:accept')));
add('Warband Renown is not character introduction',renown,{reputations:{2590:{at:now,renown:14}}},r=>assert(r.rows[0].id.includes('q81930:accept')));
add('return mid-chain',crystal,{quests:{78715:{title:'Active quest',complete:false,objectives:[{numFulfilled:1,numRequired:3}]}}},r=>{assert(r.rows[0].id.includes('q78715:objective'));assert.equal(r.rows[0].text,crystal.walkthrough.nodes.find(n=>n.questId===78715&&n.kind==='objective').text);assert.equal(r.rows[0].counters,'');});
add('live vendor proves access but not money',crystal,{merchant:{at:now,npcId:226250,offers:{223312:{usable:true}}}},r=>{assert(!r.rows.some(n=>n.id.includes('vendor-khaz:')));assert(!r.rows.some(n=>n.kind==='purchase'&&n.available));assert.equal(r.complete,false);});
add('affordable observed offer',crystal,{currencies:{2815:{at:now,quantity:10}},merchant:{at:now,npcId:226250,offers:{223312:{usable:true}}}},r=>assert(r.rows.some(n=>n.kind==='purchase'&&n.available)));
add('received item goes to learn',crystal,{inventory:{at:now,data:{223312:1}}},r=>assert.equal(r.rows[0].kind,'learn'));
add('learning confirms account ownership',crystal,{},r=>assert.equal(r.complete,true),[223312]);
add('skipping every instruction never completes toy',crystal,{skipped:Object.fromEntries(crystal.walkthrough.nodes.map(n=>[n.id,now+1000]))},r=>assert.equal(r.complete,false));
const questBatch=read('lib/data/catalogue-quest-paths.json');
for(const input of questBatch.routes.filter(r=>r.sourceChecked&&r.walkthrough)){
 const g=guide(input.id),faction=g.requirements?.faction||'Alliance';
 for(const id of new Set(g.walkthrough.nodes.filter(n=>n.kind==='objective'&&n.questId).map(n=>n.questId)))
  add('resume exact quest '+g.id+':'+id,g,{faction,flags:{},quests:{[id]:{title:'Observed active quest',complete:false,objectives:[{text:'Live progress 1/3',numFulfilled:1,numRequired:3}]}}},r=>{assert(r.rows.some(n=>n.questId===id&&n.kind==='objective'&&n.available),'Accepted quest must resume from its live objective: '+g.id+':'+id);assert(!r.rows.some(n=>n.questId===id&&n.kind==='turnin'&&n.available),'Unmet turn-in cannot become actionable.');});
}
for(const g of graphs){
 const inventory={[g.rewards[0]]:1},learn=g.walkthrough.nodes.find(n=>n.kind==='learn');
 function materials(rule){if(rule?.kind==='itemCount')inventory[rule.itemId]=rule.quantity||1;for(const r of rule?.all||rule?.any||[])materials(r);}materials(learn?.requires);
 add('received learning inputs '+g.id,g,{inventory:{at:now,data:inventory}},r=>{assert.equal(r.complete,false);assert.equal(r.rows[0]?.kind,'learn',g.id);});
 add('learned toy '+g.id,g,{},r=>assert.equal(r.complete,true),g.rewards);
}
const dir=mkdtempSync(join(tmpdir(),'toybox-catalogue-'));try{
 const path=join(dir,'cases.json');writeFileSync(path,JSON.stringify(cases.map(({check,...c})=>c)));
 const lua=JSON.parse(execFileSync('python3',['tests/walkthrough-lua.py',path],{encoding:'utf8',maxBuffer:20*1024*1024}));
 cases.forEach((f,i)=>{const result=walkthroughSteps(f.graph,'fixture',f.state,{now,owned:new Set(f.owned)});f.check(result);assert.deepEqual({complete:result.complete,rows:result.rows.map(({id,text,available,counters})=>({id,text,available,counters:counters??null}))},lua[i],f.name);});
}finally{rmSync(dir,{recursive:true,force:true});}
console.log(`Passed frozen 1,000-route identity audit, strict authoring gates, bundled dependency checks and ${cases.length} shared Lua/TypeScript catalogue scenarios.`);
