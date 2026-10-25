import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {moduleLoader} from './helpers.mjs';
import {validateGraph} from '../scripts/walkthrough-content.mjs';
const {evaluateCondition,walkthroughSteps}=moduleLoader()('lib/walkthrough.ts');
const fixtures=JSON.parse(readFileSync('tests/fixtures/walkthrough.json'));
const lua=JSON.parse(execFileSync('python3',['tests/walkthrough-lua.py'],{encoding:'utf8'}));
fixtures.forEach((f,i)=>{
 const context={now:f.now??1000000,owned:new Set(f.owned||[]),characters:f.characters||[]},s={guid:'Player-1-ABC',region:'EU',turnIns:{},flags:{},quests:{},skipped:{},...f.state};
 let result;if(f.rule)result=evaluateCondition(f.rule,s,context);else {const g=walkthroughSteps(f.graph,'fixture',s,context);result={complete:g.complete,rows:g.rows.map(r=>({id:r.id,text:r.text,available:r.available,counters:r.counters??null}))};}
 assert.deepEqual(result,f.expected,f.name+' website');assert.deepEqual(lua[i],f.expected,f.name+' addon');
});
const pack=JSON.parse(readFileSync('lib/data/guide-pack.json'));for(const g of pack.guides)if(g.walkthrough)validateGraph(g.walkthrough,g.id);
const toy=id=>pack.guides.find(g=>g.rewards?.includes(id)&&g.authored);
assert(toy(156833).walkthrough.nodes.some(n=>n.kind==='accept'));assert(toy(156833).walkthrough.nodes.some(n=>n.kind==='receive'));
assert(!toy(117550).walkthrough.nodes.some(n=>n.kind==='accept'));
assert.equal(toy(190457).walkthrough.nodes.find(n=>n.destination?.label?.includes('Vault'))?.destination?.x,.7753);
assert(pack.guides.filter(g=>g.rewards?.includes(117573)&&g.validation?.sourceChecked&&!g.aliasOf).every(g=>!g.walkthrough.nodes.some(n=>n.text.startsWith('Defeat '))));
const barter=pack.toys.find(t=>t.itemId===156649);assert.equal(barter.routes.filter(r=>!r.summaryOnly&&!r.duplicateOf&&r.guideIds.some(id=>pack.guides.find(g=>g.id===id)?.authored)).length,1);
const lava=toy(140632);assert.deepEqual(lava.requirements.classIds,[7]);assert(lava.walkthrough.nodes.filter(n=>JSON.stringify(n.completeWhen).includes('4107')).length>=5);
const draenor=toy(109167);assert.equal(draenor.requirements.professionId,202);assert(draenor.walkthrough.nodes.some(n=>n.when?.kind==='faction'&&n.when.value==='Horde'));assert(draenor.walkthrough.nodes.some(n=>n.requires&&n.materials));
const genericQuest=pack.guides.find(g=>g.metadataRoute&&!g.aliasOf&&g.validation?.gaps.some(x=>x.includes('source-specific objective instructions')));assert(genericQuest&&!genericQuest.validation.sourceChecked);
const graph={version:2,contentVersion:'test',routeIds:[],nodes:[{id:'a',kind:'observe',text:'A',manual:true,sources:['https://example.org'],after:['b']},{id:'b',kind:'observe',text:'B',manual:true,sources:['https://example.org'],after:['a']}]};
assert.throws(()=>validateGraph(graph,'cycle'),/cycle/);graph.nodes[0].after=['missing'];assert.throws(()=>validateGraph(graph,'missing'),/missing/);
console.log(`Passed ${fixtures.length} shared walkthrough scenarios in Lua and TypeScript, curated routes, hidden tracking flags, corrected puzzle pin, dependency validation and complete content graph validation.`);
