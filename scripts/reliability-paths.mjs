import {readFileSync} from 'node:fs';
const read=n=>JSON.parse(readFileSync('lib/data/'+n+'.json','utf8'));
const any=(...v)=>({any:v.flat().filter(Boolean)}),all=(...v)=>({all:v.flat().filter(Boolean)}),done=q=>({kind:'questTurnedIn',questId:q,cadence:'once'}),bag=i=>({kind:'itemCount',itemId:i}),owned=i=>({kind:'toyOwned',itemId:i});
function prior(p){if(p.all)return all(p.all.map(prior));if(p.any)return any(p.any.map(prior));if(p.anyQuestTurnedIn)return any(p.anyQuestTurnedIn.map(done));if(p.allQuestTurnedIn?.length)return all(p.allQuestTurnedIn.map(done));if(p.questTurnedIn)return done(p.questTurnedIn);if(p.questOffered)return {kind:'questOffered',questId:p.questOffered};}
export function reliablePaths(guides,{questNodes}){
 const argent=read('reliability-argent-paths'),arch=read('reliability-archaeology-paths'),sources=new Map(argent.sources.map(s=>[s.id,s.url]));
 const g=guides.find(g=>g.id==='argent-tournament');
 for(const q of argent.quests){
  let nodes=g.walkthrough.nodes.filter(n=>n.questId===q.questId);
  if(!nodes.length){const accept=q.steps.find(n=>n.kind==='accept');nodes=questNodes({id:q.questId,title:q.title,source:sources.get(q.sourceIds[0]),accept:{npcId:accept.npcId,destination:accept.navigation?.destination},isDaily:q.terminal.period==='current-daily-period'},{prefix:g.id,cadence:q.terminal.period==='current-daily-period'?'daily':'once'});g.walkthrough.nodes.push(...nodes);g.questIds.push(q.questId);}
  const entry=any({kind:'questInLog',questId:q.questId},{kind:'questOffered',questId:q.questId},prior(q.expectedPrerequisites));
  const classRule=q.classRestriction?{kind:'class',value:q.classRestriction.classFile}:undefined;
  const branch=all(q.faction&&{kind:'faction',value:q.faction},classRule&&(q.classRestriction.operator==='notEqual'?{negate:classRule}:classRule),entry);
  for(const n of nodes){const action=q.steps.find(a=>a.kind===(n.kind==='turnin'?'turnIn':n.kind));if(!action)continue;
   n.when=branch;n.text=action.instructions?.join(' ')||action.text;n.sources=action.sources.map(id=>sources.get(id)).filter(Boolean);n.recovery={text:q.recovery.join(' ')};
   if(n.kind==='accept'){if(action.navigation?.destination)n.destination=action.navigation.destination;}
   else if(n.kind==='objective'){const fixed=action.navigation?.fixedPoints||[];n.destination=fixed[0];n.waypoints=fixed.length>1?fixed:undefined;n.nativeWaypoint=true;}
   else {n.destination=undefined;n.nativeWaypoint=true;}
  }
 }
 for(const family of argent.dailyFamilies)for(const n of g.walkthrough.nodes)if(n.kind==='objective'&&family.questIds.includes(n.questId)){
  n.text='Complete quest #'+n.questId+'.\n'+family.instructions.join(' ');n.destination=family.destinations?.[0];n.waypoints=family.destinations?.length>1?family.destinations:undefined;n.nativeWaypoint=true;n.sources=family.sourceIds.map(id=>sources.get(id)).filter(Boolean);n.recovery={text:family.recovery};
 }
 const correction=argent.verifiedCorrections.find(c=>c.questId===13633);for(const n of g.walkthrough.nodes)if(n.questId===13633&&n.kind==='objective'){n.destination={...correction.replace,label:'Moonbrook · Dusty Journal'};n.text='Find the Dusty Journal (item 45058) in the Moonbrook house in Westfall. Use the actual quest objective to confirm recovery of the journal, then return to Crusader Rhydalla.';n.sources=correction.sources.map(id=>sources.get(id)).filter(Boolean);}
 g.validation.observedEntryPathChecked=true;g.validation.gaps=argent.remainingGaps.map(r=>r.detail);g.validation.completePath=false;
 // City progress, actual reputation, live stock and affordability are separate gates.
 for(const path of argent.cityToyPaths){
  const ready=all(done(path.progression.ceremonyQuestId),{kind:'reputation',metric:'reaction',factionId:path.factionId,value:8}),offer={kind:'merchantOffer',npcId:path.purchase.npcId,itemId:path.toyItemId},received=any(bag(path.toyItemId),owned(path.toyItemId));
  for(const route of guides.filter(r=>r.progressGuideId===g.id&&r.rewards?.includes(path.toyItemId))){route.requirements={...route.requirements,faction:path.faction};route.goalReputation={factionId:path.factionId,metric:'reaction',value:8};route.cityReputationGuideId='reliability-argent-reputation-'+path.factionId;
   for(const n of route.walkthrough?.nodes||[]){if(n.id.endsWith(':progress')){n.completeWhen=any(ready,offer,received);n.text='Complete the '+path.city+' Champion ceremony and reach Exalted with the city. Follow Tournament dailies for seals; choose Champion writs for city badges when reputation is still needed.';n.linkedGuideId=g.id;}
    if(n.kind==='purchase')n.requires=all(any(ready,offer),{kind:'currency',currencyId:241,quantity:15},offer);n.recovery={text:path.recovery};}
   route.validation.observedEntryPathChecked=true;
  }
  const rep=argent.cityReputationPaths.find(r=>r.factionId===path.factionId),id='reliability-argent-reputation-'+path.factionId,standing={kind:'reputation',metric:'reaction',factionId:path.factionId,value:8},badge=rep.steps[1].itemId,refs=rep.sources.map(id=>sources.get(id)).filter(Boolean),recovery={text:rep.recovery};
  const nodes=[{id:id+':writ',kind:'observe',text:rep.steps[0].text,linkedGuideId:g.id,completeWhen:any(bag(46114),bag(badge),standing),sources:refs,recovery},{id:id+':vendor',kind:'purchase',text:rep.steps[1].text,npcId:path.purchase.npcId,destination:path.purchase.destination,stopId:'vendor:'+path.purchase.npcId,requires:all(bag(46114),{kind:'merchantOffer',npcId:path.purchase.npcId,itemId:badge}),completeWhen:any(bag(badge),standing),sources:refs,recovery},{id:id+':badge',kind:'interact',itemId:badge,text:rep.steps[2].text,requires:bag(badge),completeWhen:standing,manual:true,sources:refs,recovery}];
  guides.push({id,title:path.city+' reputation with Champion writs',zone:'Icecrown · '+path.city+' quartermaster',expansion:'Wrath of the Lich King',method:'Reputation',cadence:'repeatable',minutes:3,rewards:[path.toyItemId],requirements:{faction:path.faction},costs:[['i',46114,1]],goalReputation:{factionId:path.factionId,metric:'reaction',value:8},steps:nodes,source:refs[0],walkthrough:{version:2,contentVersion:'2.3.0',nodes,includesPrerequisites:false,routeIds:[],completeWhen:standing},validation:{sourceChecked:true,completePath:false,checkpointChecked:true,playtested:false,gaps:['Requires this city quartermaster’s actually available badge offer and an eligible Champion reward choice. External reputation alternatives are not fully authored.']},playStyle:'solo',outcome:'guaranteed-progress'});
 }
 for(const branch of argent.crusaderBranches){
  const id='reliability-'+branch.id.replaceAll(':','-'),toy=branch.toyPath,refs=branch.sources.map(id=>sources.get(id)).filter(Boolean),offer={kind:'merchantOffer',npcId:toy.npcId,itemId:toy.itemId},received=any(bag(toy.itemId),owned(toy.itemId)),nodes=[];
  for(const condition of branch.expectedPredicate.all){const rep=condition.kind==='reputationStandingAtLeast',rule=rep?{kind:'reputation',factionId:condition.factionId,metric:'reaction',value:condition.standingId}:condition,city=argent.cityToyPaths.find(p=>rep?p.factionId===condition.factionId:p.progression.ceremonyQuestId===condition.questId);
   nodes.push({id:id+':'+(rep?'standing-'+condition.factionId:'champion-'+condition.questId),kind:'observe',text:rep?'Reach Exalted with '+(city?.city||'the Argent Crusade')+'. City writ badges are separate from Champion seals; observe the actual standing.':'Finish the '+(city?.city||'required city')+' Champion ceremony through its offered Tournament progression.',linkedGuideId:rep&&city?'reliability-argent-reputation-'+city.factionId:'argent-tournament',completeWhen:any(rule,offer,received),sources:refs,recovery:{text:branch.recovery}});
  }
  nodes.push({id:id+':seals',kind:'prepare',text:'Earn 15 Champion seals from eligible daily opportunities. Count this purchase once in your preparation list.',linkedGuideId:'argent-tournament',completeWhen:any({kind:'currency',currencyId:241,quantity:15},received),sources:refs,recovery:{text:branch.recovery}},{id:id+':vendor',kind:'observe',text:'Visit Dame Evniki Kapsalis and inspect the Crusader Banner offer. The actual usable stock resolves account or faction-change access differences.',destination:toy.destination,stopId:'vendor:'+toy.npcId,completeWhen:any(offer,received),sources:refs,recovery:{text:branch.recovery}},{id:id+':purchase',kind:'purchase',text:'Buy the Crusader Banner yourself after checking its price.',requires:all(offer,{kind:'currency',currencyId:241,quantity:15}),destination:toy.destination,stopId:'vendor:'+toy.npcId,completeWhen:received,sources:refs,recovery:{text:branch.recovery}},{id:id+':learn',kind:'learn',itemId:toy.itemId,text:'Learn the Crusader Banner from your bags.',requires:bag(toy.itemId),completeWhen:owned(toy.itemId),sources:refs,recovery:{text:branch.recovery}});
  // Dependencies keep the overview's missing gates ahead of the purchase, while
  // live stock can discharge historical gates without inventing quest flags.
  for(let i=1;i<nodes.length;i++)nodes[i].after=[nodes[i-1].id];
  guides.push({id,title:'Crusader Banner · '+branch.faction,zone:'Icecrown · Argent Tournament',expansion:'Wrath of the Lich King',method:'Vendor progression',cadence:'repeatable',minutes:5,rewards:[toy.itemId],requirements:{faction:branch.faction},costs:[['c',241,15]],npcId:toy.npcId,steps:nodes,questIds:branch.expectedPredicate.all.filter(c=>c.questId).map(c=>c.questId),source:refs[0],walkthrough:{version:2,contentVersion:'2.3.0',nodes,includesPrerequisites:false,routeIds:[],completeWhen:owned(toy.itemId)},validation:{sourceChecked:true,checkpointChecked:true,completePath:false,playtested:false,gaps:['Fresh-character roots, exceptional phases and faster external Argent Crusade reputation alternatives remain incompletely authored.']},playStyle:'solo',outcome:'guaranteed-progress'});
 }
 // Keep the existing archaeology routine and stable action IDs. Branch completion
 // uses its observed fortnightly end, while already-received toys can still be learned.
 const archaeology=guides.find(g=>g.id==='legion-archaeology'),observe=archaeology.walkthrough.nodes.find(n=>n.id.endsWith(':observe'));
 const nodes=arch.chains.flatMap(c=>c.walkthrough.nodes.map(n=>({...n,acquisitionRecovery:n.id.endsWith(':open-reward')||undefined,manualOnly:n.knownCostMustPause||n.rewardChoiceMustPause||undefined,itemId:n.kind==='learn'?c.rewardItemId:n.itemId,kind:n.kind==='interaction'?'interact':n.kind})));
 if(observe){observe.text=arch.entryGuide.instructions.join(' ');observe.destination=arch.entryGuide.destination;observe.recovery={text:arch.entryGuide.limitations.join(' ')};nodes.unshift(observe);}
 archaeology.walkthrough.nodes=nodes;archaeology.steps=nodes;archaeology.validation.activeChainsChecked=13;archaeology.validation.completePath=false;archaeology.validation.gaps=arch.unresolvedGaps.map(g=>g.detail);
 for(const c of arch.chains){if(!c.isToy)continue;const id=c.candidateId+'-toy',toyNodes=nodes.filter(n=>n.id.includes(':'+c.id+':'));
  guides.push({id,title:'Learn '+c.title,zone:'Legion Dalaran · '+c.title,expansion:'Legion',method:'Archaeology toy',cadence:'fortnightly',minutes:30,rewards:[c.rewardItemId],requirements:{professionId:794},steps:toyNodes,questIds:c.questIds,source:c.walkthrough.nodes[0].sources[0],walkthrough:{...c.walkthrough,nodes:toyNodes,completeWhen:owned(c.rewardItemId)},validation:{sourceChecked:true,completePath:false,checkpointChecked:true,playtested:false,gaps:c.remainingGaps},playStyle:'solo',outcome:'guaranteed-progress'});
 }
 return {sources:[...argent.sources,...arch.sources],argent,arch};
}
