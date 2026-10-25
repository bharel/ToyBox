import {readFileSync} from 'node:fs';
const read=name=>JSON.parse(readFileSync('lib/data/'+name+'.json','utf8'));
const any=(...v)=>({any:v.flat().filter(Boolean)}),all=(...v)=>({all:v.flat().filter(Boolean)});
const owned=id=>({kind:'toyOwned',itemId:id}),bag=id=>({kind:'itemCount',itemId:id,quantity:1});
export function sessionContent(guides,{questNodes,validateGraph}){
 const priority=read('session-priority-paths'),catalogue=read('session-catalogue-paths'),source=id=>priority.sources.find(s=>s.id===id)?.url;
 for(const r of catalogue.routes){const g=guides.find(g=>g.id===r.id);if(!g)throw Error('Candidate route absent: '+r.id);
  Object.assign(g,{title:'Collect '+r.title,method:r.method,cadence:r.cadence,requirements:r.requirements||{},walkthrough:r.walkthrough,authored:true,trackingQuestId:undefined,questIds:[...new Set(r.walkthrough.nodes.map(n=>n.questId).filter(Boolean))],costs:r.costs||[],validation:{sourceChecked:r.sourceChecked,playtested:false,gaps:r.knownGaps||[],reviewedAt:r.reviewedAt},coverage:r.sourceChecked?'walkthrough':'partial-walkthrough'});
  for(const n of g.walkthrough.nodes)if(n.kind==='learn')n.itemId=r.itemId;
 }
 const argent=guides.find(g=>g.id==='argent-tournament');
 for(const sub of priority.subguides||[])if(sub.kind==='daily-quest')for(const n of argent.walkthrough.nodes.filter(n=>n.questId===sub.questId)){
  const action=sub.steps.find(s=>s.kind===n.kind);if(action){n.text=action.text;n.recovery={text:action.recovery||'Return to the indicated questgiver and check the offered variant.'};if(action.destination)n.destination=action.destination;if(n.kind!=='objective'){n.stopId=sub.stopId;n.stopLabel='Argent daily questgivers';}}
 }
 for(const r of priority.routes){
  if(!/^[a-z0-9:-]+$/.test(r.id))throw Error('Invalid priority ID '+r.id);
  const sources=[...new Set(r.evidence.map(e=>source(e.sourceId)).filter(Boolean))],req=r.requirements||{},rep=req.reputation;
  const merchant={kind:'merchantOffer',npcId:r.npcId,itemId:r.itemId},received=any(bag(r.itemId),owned(r.itemId));
  const standing=rep?{kind:'reputation',metric:rep.metric,factionId:rep.factionId,value:rep.value}:undefined;
  const access=any(standing,req.positiveOfferQuestId&&{kind:'questOffered',questId:req.positiveOfferQuestId},req.positiveOfferQuestId&&{kind:'questInLog',questId:req.positiveOfferQuestId},merchant);
  const costs=(r.costs||[]).map(c=>c.kind==='gold'?['g',c.quantity]:[c.kind==='currency'?'c':'i',c.id,c.quantity]);
  const resources=all(costs.map(([kind,id,quantity])=>kind==='c'?{kind:'currency',currencyId:id,quantity}:kind==='i'?{kind:'itemCount',itemId:id,quantity}:{kind:'money',quantity:id}));
  const recovery={text:r.steps.find(s=>s.kind==='purchase'||s.kind==='quest')?.recovery||'Check the marked source and its current offer. Missing data does not prove access.'};
  const nodes=[{id:r.id+':progress',kind:'observe',text:r.steps.find(s=>s.kind==='prerequisite')?.text||'Follow the connected progression guide.',linkedGuideId:r.progressGuideId,completeWhen:any(access,received),sources,recovery},{id:r.id+':prepare',kind:'prepare',text:'Gather the listed currency and materials. Use the connected progression activity for useful daily or weekly progress; the toy remains a separate goal.',linkedGuideId:r.progressGuideId,completeWhen:any(resources,received),after:[r.id+':progress'],sources,recovery}];
  if(r.acquisition==='purchase'){
   nodes.push({id:r.id+':vendor',kind:'observe',text:`Visit ${r.npcName||'the marked vendor'} and inspect the ${r.name} offer and its displayed price.`,destination:r.destination,npcId:r.npcId,stopId:'vendor:'+r.npcId,stopLabel:r.npcName,requires:resources,observedAcquisition:true,completeWhen:any(merchant,received),after:[r.id+':prepare'],sources,recovery});
   nodes.push({id:r.id+':purchase',kind:'purchase',text:`Buy ${r.name} yourself after reviewing the displayed price.`,requires:all(access,resources,merchant),destination:r.destination,npcId:r.npcId,stopId:'vendor:'+r.npcId,stopLabel:r.npcName,completeWhen:received,after:[r.id+':vendor'],observedAcquisition:true,sources,recovery});
  }else if(r.acquisition==='quest-reward'){
   nodes.push(...questNodes({id:r.questId,title:r.name+' reward',source:sources[0],accept:{npcId:r.npcId,destination:r.destination},actionInstructions:[`Accept the offered reward quest from ${r.npcName}.`,'Complete the displayed objectives and review the reward choices. Another toy choice does not grant the target toy.',`Turn in the completed reward quest and choose ${r.name} if offered.`]},{prefix:r.id}));
   nodes.push({id:r.id+':receive',kind:'receive',text:`Check bags and mail for ${r.name}. If another reward was chosen, use a listed alternative route.`,completeWhen:received,requires:{kind:'questTurnedIn',questId:r.questId,cadence:'once'},sources,recovery});
  }else continue;
  nodes.push({id:r.id+':learn',kind:'learn',itemId:r.itemId,text:`Use ${r.name} from your bags to learn it.`,requires:bag(r.itemId),completeWhen:owned(r.itemId),sources,recovery});
  const g={id:r.id,title:r.name,zone:r.destination?.label||r.npcName||'Reward source',expansion:'Retail',method:r.acquisition==='purchase'?'Vendor':'Quest',cadence:'repeatable',minutes:5,rewards:[r.itemId],requirements:{...(req.faction?{faction:req.faction}:{})},goalReputation:rep,progressGuideId:r.progressGuideId,goalPath:true,metadataRoute:true,costs,source:sources[0],destination:r.destination,npcId:r.npcId,steps:nodes,walkthrough:{version:2,contentVersion:'2.2.0',nodes,routeIds:[],includesPrerequisites:false,completeWhen:owned(r.itemId)},validation:{sourceChecked:false,playtested:false,gaps:r.validation.gaps,acquisitionFactsVerified:true,reviewedAt:priority.reviewedAt},coverage:'partial-walkthrough',playStyle:'solo',outcome:'guaranteed-progress'};
  validateGraph(g.walkthrough,g.id);guides.push(g);
 }
 const hunt=guides.find(g=>g.id==='rep-maruuk-hunt');for(const n of hunt.walkthrough.nodes.filter(n=>n.questId===70501))if(n.when)n.when=any({kind:'questInLog',questId:70501},{kind:'questOffered',questId:70501},{kind:'questTurnedIn',questId:71231,cadence:'once'},{kind:'questTurnedIn',questId:72778,cadence:'once',scope:'warband'});
 return {sources:[...priority.sources,...catalogue.sources],priorityRoutes:priority.routes.length,catalogueRoutes:catalogue.routes.length};
}
