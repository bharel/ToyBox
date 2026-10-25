/** Compile reviewed catalogue walkthrough batches; research candidates never earn full-path coverage. */
import {readFileSync,existsSync} from 'node:fs';
const read=file=>JSON.parse(readFileSync(file,'utf8'));
const kinds=new Set(['accept','objective','turnin','travel','observe','interact','interaction','purchase','loot','receive','learn','craft','prepare','mission','equip','use','collect','achievement']);
const owned=(rule,item)=>rule?.kind==='toyOwned'&&rule.itemId===item;
const sourceUrls=value=>{const rows=Array.isArray(value)?value:[];return rows.map(v=>typeof v==='string'?v:v.url).filter(Boolean);};
function rules(rule,fn){if(!rule||typeof rule!=='object')return;fn(rule);for(const child of rule.all||rule.any||rule.rules||[])rules(child,fn);if(rule.negate)rules(rule.negate,fn);}
const all=(...rows)=>({all:rows.filter(Boolean)}),any=(...rows)=>({any:rows.filter(Boolean)});
const done=questId=>({kind:'questTurnedIn',questId,scope:'character'});
function parameters(value,context){
 if(Array.isArray(value))return value.map(v=>parameters(v,context));
 if(!value||typeof value!=='object')return value;
 const out={};for(const [key,v] of Object.entries(value)){
  if(key.endsWith('Parameter')){if(!Number.isFinite(context[v])||context[v]<0)throw Error('Missing positive shared-path parameter '+v);out[key.slice(0,-9)]=context[v];}
  else out[key]=parameters(v,context);
 }return out;
}
function normalizeNode(raw,bySource,route){
 const n=structuredClone(raw),navigation=n.navigation||{};
 n.kind=({interaction:'interact',turnIn:'turnin',kill:'loot',subguide:'observe',prerequisite:'observe'})[n.kind]||n.kind;
 if(navigation.kind==='fixed')n.destination=navigation.destination;
 if(/^nativeQuest/.test(navigation.kind||''))n.nativeWaypoint=true;
 n.sources=(n.sources||route.sourceIds||[]).map(s=>bySource.get(s)||s);
 if(!n.recovery&&route.recovery)n.recovery={text:Array.isArray(route.recovery)?route.recovery.join(' '):route.recovery};
 return n;
}
/** Inline parameterized dependencies. A live resource terminal may bypass farming;
 * a cursor click never satisfies that terminal or a subsequent purchase gate. */
function expandDependencies(route,batch,bySource){
 const definitions=new Map((batch.sharedGuides||[]).map(g=>[g.id,g])),questRecords=new Map((batch.questRecords||[]).map(q=>[q.questId,q]));
 const nodes=[],proofs=[],memo=new Map(),stack=new Set(),requirements={...route.requirements};
 const npcId=route.vendor?.npcId||route.npcId;
 const observedAccess=npcId?{kind:'merchantOffer',npcId,itemId:route.itemId}:null;
 function expand(ref,outer){
  if(!ref.sharedGuideId)return null;
  const shared=definitions.get(ref.sharedGuideId);if(!shared)throw Error('Missing shared path '+ref.sharedGuideId);
  const context=ref.parameters||{},identity=shared.id+':'+JSON.stringify(context);
  if(stack.has(identity))throw Error('Shared path cycle '+identity);
  if(memo.has(identity))return memo.get(identity);
  stack.add(identity);const spec=parameters(shared,context),terminal=spec.terminal;
  if(!terminal)throw Error('Shared path lacks observed terminal '+identity);
  if(spec.requirements?.level)requirements.level=Math.max(requirements.level||0,spec.requirements.level);
  const proof={id:shared.id,completePath:spec.completePath===true,sourceChecked:spec.sourceChecked===true};proofs.push(proof);
  // Any positive access shortcut is optional. The fully authored ordinary path
  // remains available; unknown access never becomes an invented unlock.
  const refs=spec.prerequisites?.sharedGuideId?[spec.prerequisites]:(spec.prerequisites?.any||[]).filter(r=>r.sharedGuideId);
  // A transferred balance or Warband Renown does not prove this character's
  // introduction/phase. Only its own quest terminal or a usable live offer can
  // bypass upstream access instructions.
  const prerequisiteBypass=any(spec.type==='questGraph'&&terminal.kind==='questTurnedIn'&&terminal.scope!=='warband'?terminal:null,observedAccess,outer);
  for(const prerequisite of refs)expand(prerequisite,prerequisiteBypass.any.length?prerequisiteBypass:null);
  let actions=spec.steps||[];
  if(spec.type==='questGraph'&&spec.questIds?.length){
   const ids=spec.questIds,children=new Map(ids.map(id=>[id,[]]));
   const priorFor=q=>{const p=q.historicalPrerequisites||{},allIds=p.questIds||[],requiredIds=allIds.filter(id=>!questRecords.get(id)?.optional);return {ids:requiredIds,count:Math.max(0,(p.minimumRequired??allIds.length)-(allIds.length-requiredIds.length))};};
   for(const id of ids){const q=questRecords.get(id),p=q?.historicalPrerequisites;if(!q)throw Error('Missing shared-path quest '+id);
    const prior=priorFor(q),factions=prior.ids.map(id=>questRecords.get(id)?.when).filter(r=>r?.kind==='faction');
    const exclusiveFactionPair=prior.count===1&&prior.ids.length===2&&factions.length===2&&factions[0].value!==factions[1].value;
    if(prior.count===prior.ids.length||exclusiveFactionPair)for(const parent of prior.ids)children.get(parent)?.push(id);
   }
   const descendants=id=>{const found=new Set();function visit(n){for(const child of children.get(n)||[])if(!found.has(child)){found.add(child);visit(child);}}visit(id);return [...found];};
   actions=ids.flatMap(id=>{
    const q=questRecords.get(id);if(q.optional)return [];const prior=priorFor(q);
    const prerequisite=prior.count?{atLeast:prior.count,rules:prior.ids.map(done)}:null;
    const branch=q.when,entry=prerequisite?any({kind:'questInLog',questId:id},{kind:'questOffered',questId:id},prerequisite):null;
    const reached=descendants(id),seen=any(done(id),reached.length?{kind:'questReached',questIds:reached}:null);
    return q.steps.map(action=>({...action,when:branch?all(branch,entry):entry||undefined,
     requires:action.kind==='objective'?{kind:'questInLog',questId:id}:['turnIn','turnin'].includes(action.kind)?{kind:'questObjectivesComplete',questId:id}:undefined,
     completeWhen:any(action.completeWhen,seen),hideWhenUnknown:!!entry}));
   });
  }
  const prefix=route.id+':'+shared.id+':'+Object.values(context).join('-'),idMap=new Map(actions.map(n=>[n.id,prefix+':'+n.id]));
  for(const raw of actions){const n=normalizeNode(raw,bySource,shared);n.id=idMap.get(raw.id);n.after=n.after?.map(id=>idMap.get(id)||id);n.afterAny=n.afterAny?.map(id=>idMap.get(id)||id);
   n.completeWhen=any(n.completeWhen,terminal,outer);nodes.push(n);
  }
  if(spec.repeat){
   const last=actions.find(n=>n.destination),n=normalizeNode({id:prefix+':balance',kind:'objective',text:`Continue the indicated ${spec.title.toLowerCase()} activities until the observed ${terminal.kind==='reputation'?'reputation':'resource'} reaches the target. If the listed reset opportunities are spent or the source is absent, defer this activity; no fixed yield or respawn time is assumed.`,completeWhen:any(terminal,outer),destination:last?.destination,interfaceObservation:{interface:terminal.kind==='reputation'?'reputation':'currency'},sources:spec.sourceIds||spec.sources||actions[0]?.sources,recovery:{text:spec.recovery?.join(' ')||'Use the actual balance. Return after an observed reset or choose another eligible source.'}},bySource,shared);nodes.push(n);
  }
  stack.delete(identity);memo.set(identity,terminal);return terminal;
 }
 for(const dependency of route.dependencies||[])expand(dependency);
 return {nodes,proofs,requirements};
}
export function checkCompleteRoute(route,graph,knownSources){
 const issues=[];const item=route.itemId;
 if(!route.sourceRouteIds?.length&&!route.sourceRouteId)issues.push('Exact catalogue acquisition route identity is missing.');
 if(!route.reviewedAt||route.sourceChecked!==true)issues.push('The authored factual sequence has not been source checked.');
 if(route.completePath!==true)issues.push('Fresh/returning prerequisite coverage is not established as complete.');
 if(route.gaps?.length||route.unresolved?.length||route.coverageGaps?.length)issues.push(...(route.gaps||[]),...(route.unresolved||[]),...(route.coverageGaps||[]));
 if(!owned(graph.completeWhen,item))issues.push('The toy path must terminate on Toy Box ownership of this exact item.');
 if(!graph.nodes.some(n=>n.kind==='learn'&&owned(n.completeWhen,item)))issues.push('An observed, separate learning action is missing.');
 if(graph.nodes.length<2)issues.push('The acquisition and learning actions are not separated.');
 for(const node of graph.nodes){
  if(!kinds.has(node.kind))issues.push('Unsupported action kind '+node.kind+'.');
  if(!node.sources?.length||node.sources.some(s=>!knownSources.has(s)))issues.push('Unresolved evidence on '+node.id+'.');
  if(node.destination&&(!Number.isInteger(node.destination.mapID)||node.destination.mapID<=0||![node.destination.x,node.destination.y].every(v=>Number.isFinite(v)&&v>=0&&v<=1)))issues.push('Invalid destination on '+node.id+'.');
  if(['accept','travel','purchase','loot'].includes(node.kind)&&!node.destination&&!node.nativeWaypoint&&!node.interfaceObservation&&!node.writtenDestination&&!node.details?.destinationPolicy)issues.push('A usable destination or sourced interface/observation instruction is missing on '+node.id+'.');
  if(!node.recovery?.text&&!route.recovery)issues.push('Recovery is missing on '+node.id+'.');
  if(/^(Check the next offered stage|Complete the live objectives|Go to the marked location|Complete the indicated quest)/.test(node.text||''))issues.push('Generic placeholder instruction remains on '+node.id+'.');
  for(const rule of [node.when,node.requires])rules(rule,r=>{if(r.kind==='evidenceUnavailable')issues.push('Critical unknown prerequisite remains on '+node.id+'.');});
  if(!node.manual)rules(node.completeWhen,r=>{if(r.kind==='evidenceUnavailable')issues.push('Unobservable action needs an explicit manual cursor control on '+node.id+'.');});
 }
 return [...new Set(issues)];
}
export function catalogueContent(guides,{validateGraph}){
 const path='lib/data/catalogue-release.json';if(!existsSync(path))return {sources:[],reviews:[]};
 const release=read(path),sources=[],reviews=[],pending=[];
 for(const file of release.inputs){if(!existsSync(file))throw Error('Missing approved catalogue input '+file);const batch=read(file);sources.push(...(batch.sources||[]));
  const bySource=new Map((batch.sources||[]).map(s=>[s.id,s.url])),urls=new Set(sourceUrls(batch.sources));
  for(const input of batch.routes||[]){
   const route={...input,completePath:input.completePath??input.completePrerequisites,gaps:[...(input.gaps||[]),...(input.knownGaps||[])]};
   if(route.id&&!/^[\w-]{1,150}$/.test(route.id))throw Error('Guide identity is incompatible with preference/export interfaces: '+route.id);
   const sourceRouteIds=route.sourceRouteIds||[route.sourceRouteId].filter(Boolean);
   if(!route.walkthrough?.nodes?.length){reviews.push({id:route.id,sourceRouteIds,itemId:route.itemId,completePath:false,sourceChecked:false,issues:route.coverageGaps||route.gaps||['No approved executable action graph.']});continue;}
   // A research inventory may contain unreviewed draft actions. Retain its gap
   // ledger without replacing an existing usable guide with those drafts.
   if(route.sourceChecked!==true){reviews.push({id:route.id,sourceRouteIds,itemId:route.itemId,completePath:false,sourceChecked:false,issues:route.coverageGaps||route.gaps||['Source review unfinished.']});continue;}
   const graph=structuredClone(route.walkthrough),shared=expandDependencies(route,batch,bySource);
   graph.nodes=[...shared.nodes,...graph.nodes.filter(n=>n.kind!=='subguide'&&!(batch.sharedGuides||[]).some(g=>g.id===n.linkedGuideId)).map(n=>normalizeNode(n,bySource,route))];
   graph.version=2;graph.contentVersion=release.release;graph.routeIds=sourceRouteIds;
   validateGraph(graph,route.id||sourceRouteIds[0]);const issues=checkCompleteRoute(route,graph,urls);for(const sharedProof of shared.proofs)if(!sharedProof.completePath||!sharedProof.sourceChecked)issues.push('Unfinished shared prerequisite '+sharedProof.id+'.');const full=!issues.length;
   reviews.push({id:route.id,sourceRouteIds,itemId:route.itemId,completePath:full,sourceChecked:route.sourceChecked===true,issues});
   const id=route.id||'catalogue-'+sourceRouteIds[0],existing=guides.find(g=>g.id===id);
   if(existing&&(existing.rewards.length!==1||existing.rewards[0]!==route.itemId))throw Error('Catalogue canonical guide item mismatch '+id);
   const entryRequirements=shared.requirements;
   if(entryRequirements.reputation&&(route.dependencies||[]).some(d=>batch.sharedGuides?.find(g=>g.id===d.sharedGuideId)?.terminal?.kind==='reputation'))delete entryRequirements.reputation;
   const destination=route.destination||route.vendor?.destination||existing?.destination||graph.nodes.find(n=>n.destination)?.destination;
   const guide={id,title:route.title,zone:route.zone||existing?.zone||destination?.label||'Toy route',expansion:route.expansion||existing?.expansion||'Retail',method:route.method||'Toy walkthrough',cadence:route.cadence||'once',minutes:route.minutes||10,rewards:[route.itemId],requirements:entryRequirements,costs:route.costs||[],questIds:[...new Set(graph.nodes.map(n=>n.questId).filter(Boolean))],destination,npcId:route.npcId||route.vendor?.npcId,outcome:route.outcome||'guaranteed-progress',playStyle:route.playStyle||existing?.playStyle||(/instance/i.test(route.method||'')?'group':'solo'),steps:graph.nodes,walkthrough:{...graph,includesPrerequisites:full},authored:true,source:graph.nodes[0].sources[0],validation:{sourceChecked:route.sourceChecked===true,completePath:full,checkpointChecked:route.sourceChecked===true&&!full,playtested:false,reviewedAt:route.reviewedAt,gaps:issues},coverage:full?'walkthrough':'partial-walkthrough'};
   const drops=existing?.dropEstimates||guides.find(g=>g.rewards?.includes(route.itemId)&&g.dropEstimates)?.dropEstimates;if(drops)guide.dropEstimates=structuredClone(drops);
   for(const key of ['progressGuideId','materialAlternatives','recipeSpellIds','recipeIdNamespace','raid','validDifficultyIds','instanceId','encounterId','sharedGroup','availabilityReview','engineering','persistent','instanceContext'])if(route[key]!==undefined)guide[key]=structuredClone(route[key]);
   for(const node of guide.walkthrough.nodes)if(node.sharedSubguideId){const sub=batch.subguides?.find(g=>g.id===node.sharedSubguideId);if(!sub?.sourceChecked||!sub.routeId)throw Error('Missing supported shared acquisition '+node.sharedSubguideId);node.linkedGuideId=sub.routeId;}
   if(existing){Object.assign(existing,guide);delete existing.aliasOf;}else guides.push(guide);
   // Retire overstated coverage on older authored guides for this exact source
   // relationship too. An alias update must not leave a duplicate library card
   // claiming its unfinished profession introduction is a complete path.
   if(!full)for(const previous of guides){
    if(previous.id===id||!previous.walkthrough?.routeIds?.some(sourceId=>sourceRouteIds.includes(sourceId)))continue;
    if(previous.validation?.sourceChecked){previous.validation={...previous.validation,completePath:false,checkpointChecked:true,gaps:[...new Set([...(previous.validation.gaps||[]),...issues])]};previous.walkthrough.includesPrerequisites=false;previous.coverage='partial-walkthrough';}
   }
   if(!route.alternativeOnly)for(const sourceId of sourceRouteIds){const old=guides.find(g=>g.id===sourceId);if(old&&old.id!==id){if(old.rewards.length!==1||old.rewards[0]!==route.itemId)throw Error('Catalogue route item mismatch: '+sourceId);old.aliasOf=id;}else if(!old)pending.push({sourceId,guide});}
  }
 }
 // Previously sourceless records still retain their exact frozen route IDs.
 for(const {sourceId,guide} of pending)guides.push({...guide,id:sourceId,aliasOf:guide.id,metadataRoute:true});
 return {sources,reviews};
}
