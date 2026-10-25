import {evaluateCondition,walkthroughSteps,type GuideObservations,type GuideContext,type Walkthrough,type Destination} from './walkthrough';
export type OpportunityState='available'|'accepted'|'objectives-finished'|'ready-turnin'|'completed'|'deferred'|'cooling-down'|'unknown';
export type GuideDefinition={id:string;title:string;zone:string;method:string;cadence:string;rewards:number[];persistent?:boolean;engineering?:boolean;aliasOf?:string;requirements?:Record<string,unknown>;costs?:[string,number,number?][];progressGuideId?:string;walkthrough?:Walkthrough;validation?:{sourceChecked:boolean;completePath?:boolean;gaps:string[]}};
export type SessionOpportunity={id:string;guideId:string;stepId:string;questId?:number;label:string;state:OpportunityState;available:boolean;stop:{id:string;label:string;destination?:Destination};reason?:string;readyAt?:number;count?:number;total?:number};
export type SessionState={version:1;createdAt:number;guides:string[];activeStop?:string;pending?:{guideId:string;stepId:string;stop:{id:string;label:string}};seen:Record<string,Record<string,{questId?:number;stepId:string;label:string;cadence:string;stop:SessionOpportunity['stop']}>>;farm:Record<string,{duration:number;elapsed:number}>;spent:number};
export function opportunityState(input:{questId?:number;stepId:string;cadence:string;available:boolean;eligibility?:string;objectiveOnly?:boolean},s:GuideObservations,c:GuideContext):OpportunityState{
 let state:OpportunityState='unknown';
 const q=input.questId?s.quests?.[input.questId]:undefined;
 if(input.questId&&evaluateCondition({kind:'questTurnedIn',questId:input.questId,cadence:input.cadence,currentPeriodFlag:true},s,c)===true)state='completed';
 else if((s.skipped?.[input.stepId]??0)>c.now)state='deferred';
 else if(input.questId&&q&&s.questsAt!==undefined&&s.questsAt<=c.now&&c.now-s.questsAt<=300)state=q.complete?(input.objectiveOnly?'objectives-finished':'ready-turnin'):'accepted';
 else if(input.available)state='available';
 if(input.eligibility==='owned'||input.eligibility==='done')state=input.questId&&state!=='completed'?'deferred':'completed';else if(input.eligibility==='upcoming')state='cooling-down';
 else if(input.eligibility==='blocked'||input.eligibility==='unknown')state='unknown';
 return state;
}
export function stopFor(g:GuideDefinition,row:{id:string;destination?:Destination;stopId?:string;stopLabel?:string}){
 const d=row.destination;return {id:row.stopId||(d?`map:${d.mapID}:${d.x.toFixed(5)}:${d.y.toFixed(5)}`:`activity:${g.id}`),label:row.stopLabel||d?.label||g.zone||g.title,destination:d};
}
export function sessionChecklist(guides:GuideDefinition[],s:GuideObservations,c:GuideContext,session?:SessionState):SessionOpportunity[]{
 const result:SessionOpportunity[]=[],seenKeys=new Set<string>();
 for(const g of guides){if(g.aliasOf)continue;const rows=g.walkthrough?walkthroughSteps(g.walkthrough,g.id,s,c).rows:[];
  const classIds=g.requirements?.classIds as number[]|undefined,classId=g.requirements?.classId as number|undefined,classes:Record<string,number>={WARRIOR:1,PALADIN:2,HUNTER:3,ROGUE:4,PRIEST:5,DEATHKNIGHT:6,SHAMAN:7,MAGE:8,WARLOCK:9,MONK:10,DRUID:11,DEMONHUNTER:12,EVOKER:13};
  if((classId||classIds)&&s.class&&!(classIds||[classId!]).includes(classes[s.class]))continue;
  if(g.requirements?.faction&&s.faction&&String(g.requirements.faction).toLowerCase()!==s.faction.toLowerCase())continue;
  const observed=Object.fromEntries(Object.entries(session?.seen?.[g.id]||{}));const current=new Map<string,typeof rows[number]>();
  for(const row of rows){const key=row.questId?`quest:${row.questId}`:row.id;const old=current.get(key);if(!old||row.available&&!old.available)current.set(key,row);}
  for(const [key,row] of current)observed[key]={questId:row.questId,stepId:row.id,label:s.quests?.[row.questId||0]?.title||row.text,cadence:(row as typeof row&{cadence?:string}).cadence||g.cadence,stop:stopFor(g,row)};
  for(const [key,item] of Object.entries(observed)){
   const row=current.get(key),dedup=item.questId?`${s.guid}:${item.questId}`:`${g.id}:${key}`;if(seenKeys.has(dedup))continue;seenKeys.add(dedup);
   let eligibility:string|undefined;if(g.rewards.length&&!g.persistent&&!g.engineering&&g.rewards.every(id=>c.owned.has(id)))eligibility='owned';
   if(g.walkthrough?.completeWhen&&evaluateCondition(g.walkthrough.completeWhen,s,c)===true)eligibility='done';
   if(!eligibility){
    if(row?.kind==='observe'||row?.available!==true)eligibility='unknown';
    const req=g.requirements||{};if(req.professionId&&(!s.professionsAt||c.now-s.professionsAt>300||!s.professions?.[Number(req.professionId)]))eligibility='unknown';
    if((req.level||req.minLevel)&&(!s.level||s.level<Number(req.level||req.minLevel)))eligibility='blocked';
    if(req.reputation){const rep=req.reputation as {kind?:string;id:number;raw?:number;value?:number};if(evaluateCondition({kind:'reputation',factionId:rep.id,metric:rep.kind==='renown'?'renown':'standing',value:rep.raw??rep.value},s,c)!==true)eligibility='unknown';}
    const variants=(g as GuideDefinition&{variants?:{spellId:number}[]}).variants;
    if(variants&&!variants.some(v=>{const r=s.recipes?.[v.spellId] as {learned?:boolean;at?:number;readyAt?:number;charges?:number;invalidatedAt?:number}|undefined;return r?.learned&&!r.invalidatedAt&&r.at!==undefined&&c.now-r.at<=300&&r.at<=c.now&&(r.charges!==undefined?r.charges>0:r.readyAt!==undefined&&r.readyAt<=c.now);}))eligibility='unknown';
   }
   let state=opportunityState({questId:item.questId,stepId:item.stepId,cadence:item.cadence,available:row?.available===true,objectiveOnly:row?.kind==='objective',eligibility},s,c);
   if(session?.farm[g.id]&&session.farm[g.id].elapsed>=session.farm[g.id].duration&&state!=='completed')state='deferred';
   result.push({id:`${g.id}:${key}`,guideId:g.id,questId:item.questId,stepId:row?.id||item.stepId,label:s.quests?.[item.questId||0]?.title||item.label,state,available:row?.available===true&&!['completed','deferred','cooling-down','unknown'].includes(state),stop:row?stopFor(g,row):item.stop,count:row?.count,total:row?.total});
  }
 }
 const rank:Record<OpportunityState,number>={'ready-turnin':1,'objectives-finished':2,accepted:3,available:4,unknown:5,deferred:6,'cooling-down':7,completed:8};
 const inspections=new Set<string>();return result.filter(op=>{if(op.questId||op.state!=='unknown')return true;const key=op.stop.id+':'+op.label;if(inspections.has(key))return false;inspections.add(key);return true;}).sort((a,b)=>a.guideId.localeCompare(b.guideId)||rank[a.state]-rank[b.state]||a.stop.id.localeCompare(b.stop.id)||a.id.localeCompare(b.id));
}
export type ResourceAllocation={key:string;scope:string;required:number;observed?:number;allocated?:number;shortfall?:number;at?:number};
export function allocateResources(guides:GuideDefinition[],s:GuideObservations,c:GuideContext){
 const balances=new Map<string,number|undefined>(),allocations:Record<string,ResourceAllocation[]>={};
 for(const g of guides){const list:ResourceAllocation[]=[];for(const cost of g.costs||[]){
  if(!['i','c','g'].includes(cost[0]))continue;const kind=cost[0],id=kind==='g'?0:cost[1],required=kind==='g'?cost[1]:cost[2]||0;
  const currency=kind==='c'?s.currencies?.[id]:undefined,scope=currency?.isAccountWide?'warband':currency?.isAccountTransferable?'transferable-character':'character-observed',key=`${scope==='warband'?s.region+':warband':s.guid}:${kind}:${id}`;
  const money=(s as GuideObservations&{money?:{at:number;quantity:number}}).money;
  const observation=kind==='i'?s.inventory:kind==='c'?s.currencies?.[id]:money;
  const at=observation?.at;const known=at!==undefined&&at<=c.now&&c.now-at<=300;
  const value=kind==='i'?(s.inventory?.data[id]??0):kind==='c'?s.currencies?.[id]?.quantity:money?.quantity;
  if(!balances.has(key))balances.set(key,known?value:undefined);const available=balances.get(key);
  const allocated=available===undefined?undefined:Math.min(available,required);if(allocated!==undefined)balances.set(key,available!-allocated);
  list.push({key,scope,required,observed:known?value:undefined,allocated,shortfall:allocated===undefined?undefined:required-allocated,at});
 }allocations[g.id]=list;}
 return allocations;
}
export function toyGoals(guides:GuideDefinition[],s:GuideObservations,c:GuideContext,followed:Record<string,boolean|number|string>){
 const targets=new Set<number>();for(const g of guides)if(!g.aliasOf)for(const id of g.rewards)if(followed[`follow:${g.id}`]===true||followed[`followToy:${id}`]===true)targets.add(id);
 const items=new Map<number,GuideDefinition[]>();for(const g of guides)if(!g.aliasOf)for(const id of g.rewards)if(targets.has(id)){const routes=items.get(id)||[];routes.push(g);items.set(id,routes);}
 return [...items].map(([itemId,routes])=>({itemId,owned:c.owned.has(itemId),routes:routes.map(g=>{
  const result=g.walkthrough?walkthroughSteps(g.walkthrough,g.id,s,c):undefined,received=evaluateCondition({kind:'itemCount',itemId,quantity:1},s,c)===true;
  const resources=allocateResources([g],s,c)[g.id];
  return {guideId:g.id,title:g.title,progressGuideId:g.progressGuideId,sourceChecked:g.validation?.sourceChecked===true&&g.validation.completePath!==false&&g.walkthrough?.includesPrerequisites!==false,gaps:g.validation?.gaps||[],stage:c.owned.has(itemId)?'owned':received?'learn':resources.some(r=>r.shortfall===undefined||r.shortfall>0)?'prepare':result?.rows[0]?.kind||'needs-checking',next:result?.rows[0],resources};
 })}));
}
