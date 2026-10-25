import {readFileSync} from 'node:fs';
const any=(...r)=>({any:r.flat().filter(Boolean)}),done=id=>({kind:'questTurnedIn',questId:id,cadence:'once'}),offered=id=>({kind:'questOffered',questId:id}),logged=id=>({kind:'questInLog',questId:id});
export function reliableReputation(guides,{questNodes}){
 const data=JSON.parse(readFileSync('lib/data/reliability-reputation-unlocks.json','utf8')),sources=new Map(data.sources.map(s=>[s.id,s.url]));
 const ids={feast:'rep-tuskarr-feast',hunts:'rep-maruuk-hunt',siege:'rep-valdrakken-siege',soridormi:'rep-soridormi-weekly',posters:'rep-expedition-posters',niffen:'rep-niffen-weekly'},intro=new Set([70938,71231,70501,71210,77679,72397]);
 for(const q of data.quests){const current=guides.find(g=>g.id===ids[q.system]);let groups=guides.filter(g=>g.walkthrough?.nodes.some(n=>n.questId===q.questId));
  if(intro.has(q.questId)&&current&&!current.walkthrough.nodes.some(n=>n.questId===q.questId)){const accept=q.steps.find(s=>s.kind==='accept'),nodes=questNodes({id:q.questId,title:q.title,source:sources.get(accept.sources[0]),accept:{destination:accept.navigation?.destination,npcId:accept.navigation?.npcId}},{prefix:current.id});for(const n of nodes){n.when=any(logged(q.questId),offered(q.questId));n.hideWhenUnknown=true;}current.walkthrough.nodes.unshift(...nodes);current.questIds.push(q.questId);groups=[...new Set([...groups,current])];}
  for(const g of groups)for(const n of g.walkthrough.nodes.filter(n=>n.questId===q.questId)){
   const action=q.steps.find(s=>s.kind===(n.kind==='turnin'?'turnIn':n.kind));if(!action)continue;const navigation=action.navigation||{};
   n.text=action.instructions?.join(' ')||action.text;n.sources=action.sources.map(id=>sources.get(id)).filter(Boolean);n.recovery={text:q.recovery.join(' ')};
   n.destination=navigation.destination||navigation.fixedPoint||undefined;n.nativeWaypoint=n.kind!=='accept';
   if(n.kind==='accept'&&navigation.kind==='followPlayerQuestGiver')n.destination=undefined;
   if(q.questId===70501)n.when=any(logged(70501),offered(70501),done(71231),{kind:'questTurnedIn',questId:72366,scope:'warband'});
   if(q.questId===77236&&n.completeWhen){const scope=rule=>{if(rule.kind==='questTurnedIn'&&rule.questId===77236)rule.scope='warband';for(const list of [rule.all,rule.any,rule.rules])for(const r of list||[])scope(r);};scope(n.completeWhen);}
  }
 }
 for(const system of data.systems){const g=guides.find(g=>g.id===ids[system.id]);if(!g)continue;g.validation.completePath=false;g.validation.checkpointChecked=system.sourceCheckedCheckpointPaths;g.validation.gaps=system.unresolvedGaps.map(v=>typeof v==='string'?v:v.detail||v.fact||JSON.stringify(v));
  if(system.id==='posters'&&g.walkthrough.completeWhen)g.walkthrough.completeWhen.requireCompleteScan=true;
  if(system.id==='soridormi'){g.sharedGroup='soridormi-account-weekly';g.walkthrough.completeWhen={kind:'questTurnedIn',questId:77236,cadence:'weekly',scope:'warband',currentPeriodFlag:true};}
  for(const toy of system.toyLinks){for(const route of guides.filter(g=>g.progressGuideId===ids[system.id]&&g.rewards?.includes(toy.itemId))){if(route.method==='Vendor'&&toy.route==='vendor'){
    route.costs=(toy.cost||[]).map(c=>[c.kind==='currency'?'c':'i',c.currencyId||c.itemId,c.quantity]);route.goalReputation=toy.requiredRenownRank?{factionId:system.factionId,metric:'renown',value:toy.requiredRenownRank}:route.goalReputation;
    const merchant={kind:'merchantOffer',npcId:toy.vendor.npcId,itemId:toy.itemId},received=any({kind:'itemCount',itemId:toy.itemId},{kind:'toyOwned',itemId:toy.itemId}),standing=toy.requiredRenownRank&&{kind:'reputation',factionId:system.factionId,metric:'renown',value:toy.requiredRenownRank};
    const resources={all:route.costs.map(([kind,id,quantity])=>kind==='c'?{kind:'currency',currencyId:id,quantity}:{kind:'itemCount',itemId:id,quantity})};
    for(const n of route.walkthrough.nodes){if(n.id.endsWith(':progress'))n.completeWhen=any(standing,merchant,received);if(n.id.endsWith(':prepare'))n.completeWhen=any(resources,received);if(n.id.endsWith(':vendor'))n.requires=resources;if(n.kind==='purchase')n.requires={all:[resources,merchant]};}
   }} }
 }
 return {sources:data.sources};
}
