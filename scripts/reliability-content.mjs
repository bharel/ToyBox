import {reliableReputation} from './reliability-reputation.mjs';
import {reliablePaths} from './reliability-paths.mjs';
import {readFileSync} from 'node:fs';
const read=name=>JSON.parse(readFileSync('lib/data/'+name+'.json','utf8'));
const any=(...v)=>({any:v.flat().filter(Boolean)}),all=(...v)=>({all:v.flat().filter(Boolean)}),done=id=>({kind:'questTurnedIn',questId:id,cadence:'once'}),logged=id=>({kind:'questInLog',questId:id}),offered=id=>({kind:'questOffered',questId:id});
export function reliabilityContent(guides,{questNodes,validateGraph}){
 const priority=read('reliability-priority-facts'),catalogue=read('reliability-catalogue-paths'),niffen=read('reliability-niffen-campaign'),sources=new Map([...priority.sources,...catalogue.sources,...niffen.sources].map(s=>[s.id,s.url]));
 for(const r of catalogue.routes){const g=guides.find(g=>g.id===r.id);if(!g)throw Error('Missing reliability route '+r.id);Object.assign(g,{walkthrough:r.walkthrough,steps:r.walkthrough.nodes,costs:r.costs,requirements:r.requirements,outcome:r.outcome,method:r.method,cadence:r.cadence,facts:{...g.facts,...r.facts},npcId:r.facts?.npcId,authored:true,validation:{sourceChecked:true,completePath:true,playtested:false,gaps:r.knownGaps||[],reviewedAt:catalogue.reviewedAt},coverage:'walkthrough',availabilityReview:r.itemId===127666?'unknown':undefined});}
 for(const audit of priority.contentAudits){const g=guides.find(g=>g.id===audit.guideId);if(g){g.validation.completePath=false;g.validation.checkpointChecked=!!audit.sourceCheckedCheckpoint;g.validation.gaps=[...new Set([...(g.validation.gaps||[]),...(audit.remaining||[])])];g.validation.pathAudit=audit.reason||'Source-checked checkpoints do not establish a complete fresh-character path.';}}
 const archaeology=guides.find(g=>g.id==='legion-archaeology');archaeology.validation.completePath=false;archaeology.validation.checkpointChecked=true;
 for(const chain of priority.archaeologyCandidates)for(const candidate of chain.steps){const n=archaeology.walkthrough.nodes.find(n=>n.questId===candidate.questId&&n.kind===candidate.kind);if(!n)continue;if(candidate.instructions?.length)n.text=candidate.instructions.join(' ');if(candidate.destinationEvidence?.includes('inferred')){n.destination=undefined;n.nativeWaypoint=true;n.recovery={text:'Use the live quest end marker. The static handoff is not established; accepting the next stage is separate.'};}}
 archaeology.validation.gaps=[...new Set([...(archaeology.validation.gaps||[]),'Some archaeology handoffs and fresh-character profession/material prerequisites remain unverified. Native quest or dig-site observations are required for those checkpoints.'])];
 const argent=guides.find(g=>g.id==='argent-tournament');
 for(const set of argent.walkthrough.dailySets||[]){const fact=priority.argentDailySets.find(s=>s.collectionQuestId===set.collectionQuestId);if(fact){set.resourceId=fact.resourceId;set.fullSetYield=fact.quantity;set.yieldSources=fact.sources.map(id=>sources.get(id)).filter(Boolean);}}
 for(const sub of priority.subguides){
  const refs=sub.sources.map(id=>sources.get(id)).filter(Boolean),id=sub.id;
  if(sub.questId){const steps=sub.steps,accept=steps.find(s=>s.kind==='accept'),objective=steps.find(s=>s.kind==='objective'),turnin=steps.find(s=>s.kind==='turnIn');
   const nodes=questNodes({id:sub.questId,title:'Threat From Above',isDaily:true,source:refs[0],accept:{npcId:accept.npcId,destination:accept.destination},turnin:{npcId:turnin.npcId,destination:turnin.destination},actionInstructions:[accept.text,objective.text,turnin.text]},{prefix:id,cadence:'daily'});
   const when=any(offered(sub.questId),logged(sub.questId));for(const n of nodes){n.when=when;n.sources=refs;n.recovery={text:sub.recovery.find(r=>r.problem==='quest-not-offered')?.text||sub.recovery[0].text};if(n.kind==='objective'){n.destination=undefined;n.nativeWaypoint=true;}else{n.stopId=sub.stopId;n.stopLabel='Argent Champion questgivers';}}
   guides.push({id,title:'Threat From Above',zone:'Icecrown · Argent Tournament',method:'Daily quest',cadence:'daily',system:'argent-champion',persistent:true,metadataRoute:false,rewards:argent.rewards,minutes:10,questIds:[sub.questId],steps:nodes,playStyle:'group',outcome:'guaranteed-progress',source:refs[0],walkthrough:{version:2,contentVersion:'2.3.0',nodes,includesPrerequisites:false,routeIds:[],completeWhen:{kind:'questTurnedIn',questId:sub.questId,cadence:'daily',currentPeriodFlag:true}},validation:{sourceChecked:true,completePath:false,checkpointChecked:true,playtested:false,gaps:sub.coverageGaps}});
  }else{
   const questIds=sub.steps.find(s=>s.questVariants)?.questVariants||[],variants=priority.reputationTurnIns.filter(t=>questIds.includes(t.questId));if(!variants.length)continue;
   const nodes=[];for(const variant of variants){const affordable=all(variant.costs.map(c=>({kind:'itemCount',itemId:c.id,quantity:c.quantity}))),selected=any(offered(variant.questId),logged(variant.questId));
    nodes.push({id:id+':handin-'+variant.questId,kind:'turnin',questId:variant.questId,text:'Inspect and personally complete the offered token hand-in. Review the displayed quantity and reputation reward before spending your tokens.',when:selected,requires:affordable,destination:variant.destination,npcId:variant.npcId,manualOnly:true,stopId:'npc:'+variant.npcId,sources:refs,completeWhen:{kind:'questTurnedInSince',guideId:id,questIds},recovery:{text:sub.recovery[1].text}});
   }
   guides.push({id,title:sub.id.includes('tuskarr')?'Turn in owned Tuskarr tokens':sub.id.includes('maruuk')?'Turn in owned Maruuk tokens':'Turn in owned Titan relics',zone:sub.steps[0].destination?.label||'Faction token quartermaster',method:'Reputation tokens',cadence:'repeatable',persistent:true,rewards:[],minutes:3,questIds,steps:nodes,playStyle:'solo',outcome:'guaranteed-progress',walkthrough:{version:2,contentVersion:'2.3.0',nodes,includesPrerequisites:false,routeIds:[],completeWhen:{kind:'questTurnedInSince',guideId:id,questIds}},validation:{sourceChecked:true,checkpointChecked:true,completePath:false,playtested:false,gaps:[sub.coverageGap]},source:refs[0]});
  }
 }
 for(const correction of priority.corrections.filter(c=>c.questId&&c.requires))for(const g of guides)for(const n of g.walkthrough?.nodes||[])if(n.questId===correction.questId&&n.kind==='accept'){
  const r=correction.requires,prior=r.anyQuestTurnedIn?any(r.anyQuestTurnedIn.map(done)):all((r.allQuestTurnedIn||[]).map(done));n.when=any(logged(correction.questId),offered(correction.questId),prior);
 }

 // Original connected chapter instructions. Native offers override historical prerequisite
 // inference, but never write completion evidence or require both breadcrumbs.
 const niffenNodes=[];const access=any({kind:'questTurnedIn',questId:75644,scope:'warband'},offered(75665),logged(75665));
 for(const q of niffen.quests){
  const prior=q.historicalPrerequisites,prerequisite=prior.anyQuestTurnedIn?any(prior.anyQuestTurnedIn.map(done)):prior.allQuestTurnedIn?.length?all(prior.allQuestTurnedIn.map(done)):null;
  const entry=any(logged(q.questId),offered(q.questId),prerequisite);
  const other=q.questId===72975?75456:q.questId===75456?72975:null;
  const branch=other?all(entry,{negate:done(other)},{negate:logged(other)}):entry;
  for(const action of q.steps){const navigation=action.navigation||{},kind=action.kind==='turnIn'?'turnin':action.kind;
   const complete=kind==='accept'?any(logged(q.questId),done(q.questId)):kind==='objective'?any({kind:'questObjectivesComplete',questId:q.questId},done(q.questId)):done(q.questId);
   let requires=kind==='accept'?undefined:kind==='objective'?logged(q.questId):{kind:'questObjectivesComplete',questId:q.questId};
   if(kind==='turnin'&&[72872,72873].includes(q.questId)){const peer=q.questId===72872?72873:72872;requires=all(requires,any(done(peer),{kind:'questObjectivesComplete',questId:peer}));}
   const destination=navigation.kind==='fixed'?navigation.destination:undefined;
   niffenNodes.push({id:action.id,kind,questId:q.questId,text:action.instructions?.join(' ')||action.text,when:branch,requires,completeWhen:complete,destination,nativeWaypoint:kind!=='accept',npcId:navigation.npcId,stopId:kind==='accept'?q.stopId:undefined,stopLabel:kind==='accept'?q.title:undefined,sources:action.sources.map(id=>sources.get(id)).filter(Boolean),recovery:{text:q.recovery.join(' '),destination:kind==='accept'?destination:undefined},recoveryCases:[{reason:'quest',text:q.recovery.join(' '),destination:kind==='accept'?destination:undefined,completeWhen:any(logged(q.questId),done(q.questId)),manual:true},{reason:'objective',text:action.instructions?.join(' ')||action.text,completeWhen:complete,manual:true}]});
  }
 }
 guides.push({id:niffen.guide.id,title:niffen.guide.title,zone:'Forbidden Reach · Zaralek Cavern',method:'Campaign unlock',cadence:'once',persistent:true,rewards:[204389],questIds:niffen.quests.map(q=>q.questId),minutes:45,source:niffen.sources[0].url,steps:niffenNodes,playStyle:'solo',outcome:'guaranteed-progress',walkthrough:{version:2,contentVersion:'2.3.0',nodes:niffenNodes,includesPrerequisites:false,routeIds:[],completeWhen:access},validation:{sourceChecked:true,checkpointChecked:true,completePath:false,playtested:false,gaps:[niffen.guide.gapBoundary],reviewedAt:niffen.reviewedAt}});
 // The weekly's observed native offer establishes its own access. Do not replay an
 // account-unlocked campaign on an alt just to satisfy local historical flags.
 const weekly=guides.find(g=>g.id==='rep-niffen-weekly');if(weekly){weekly.unlockGuideId=niffen.guide.id;weekly.unlockCondition=access;}

 const paths=reliablePaths(guides,{questNodes}),reputation=reliableReputation(guides,{questNodes});
 for(const g of guides){
  if(g.id.startsWith("reliability-"))g.expansion=g.id.includes("threat-from-above")?"Wrath of the Lich King":"Dragonflight";
  if(g.facts?.npcID===84212||g.npcId===84212){g.validation=g.validation||{sourceChecked:false,playtested:false,gaps:[]};g.availabilityReview='unknown';g.validation.completePath=false;g.validation.sourceChecked=false;g.validation.gaps.push('Talador Jepetto stock is phase/level dependent; the exact merchant offer must be observed. No exact level cutoff is established.');}
  if(g.id==='att-174830-deb934dcf253'){g.validation=g.validation||{sourceChecked:false,playtested:false,gaps:[]};g.method='Pet-battle challenge';g.validation.sourceChecked=false;g.validation.completePath=false;g.validation.gaps.push('Achievement 14020 and challenge quests 58457/58458 require a connected pet-battle walkthrough.');}
  for(const n of g.walkthrough?.nodes||[])if(n.recovery){n.recoveryCases=n.recoveryCases||[{reason:'npc',text:n.recovery.text,destination:n.recovery.destination||n.destination,completeWhen:n.completeWhen,manual:true,sources:n.sources},{reason:'objective',text:n.text,destination:n.destination,completeWhen:n.completeWhen,manual:true,sources:n.sources}];}
  if(g.walkthrough)validateGraph(g.walkthrough,g.id);
 }
 const yields=priority.yields.filter(r=>['daily-reset','weekly-reset','once'].includes(r.cadence)).map(r=>({id:r.id,guideId:r.resourceId===241||r.resourceId===44987||r.resourceId===45192?'argent-tournament':undefined,questId:r.questId,kind:r.resourceKind,resourceId:r.resourceId,quantity:r.quantity,cadence:r.cadence.replace('-reset',''),sharedGroup:r.sharedGroup,scope:r.scope==='warband'?'warband':'character',sourceChecked:r.sourceChecked,sources:r.sources.map(id=>sources.get(id)).filter(Boolean),choiceRequired:r.rewardChoice===true,modifiersUnknown:!!r.modifiers?.length,when:r.questId?any(logged(r.questId),offered(r.questId)):undefined}));
 return {sources:[...priority.sources,...catalogue.sources,...niffen.sources,...paths.sources,...reputation.sources],yields,dailyYieldSets:priority.argentDailySets.map(s=>({...s,sources:s.sources.map(id=>sources.get(id)).filter(Boolean)})),audits:catalogue.importerAudits};
}
