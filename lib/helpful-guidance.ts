import {evaluateCondition,walkthroughSteps,type GuideObservations,type GuideContext,type GuideNode} from './walkthrough';
import {allocateResources,sessionChecklist,stopFor,type GuideDefinition,type SessionState} from './daily-session';
import {progressForecast,type YieldRule,type ForecastRequirement} from './forecast';
export type GuidanceObservation=GuideObservations&{merchant?:{at:number;npcId:number};rewardOffers?:Record<number,{at:number;items:Record<number,number>;currencies?:Record<number,number>}>};
export function recoveryView(g:GuideDefinition|undefined,s:GuidanceObservation,c:GuideContext,session?:SessionState){
 const active=(session as SessionState&{recovery?:unknown})?.recovery;if(!g?.walkthrough)return {active,options:[]};const row=walkthroughSteps(g.walkthrough,g.id,s,c).rows[0];
 return {active,options:row?[{id:'npc',label:'NPC or object is missing'},{id:'phase',label:'Wrong phase or inaccessible area'},{id:'objective',label:'The objective does not match'},...(row.questId?[{id:'quest',label:'Quest is not offered'}]:[]),...(row.requires||('itemId' in row)?[{id:'item',label:'Required item is missing'}]:[])]:[]};
}
export function leavingFindings(guides:GuideDefinition[],s:GuidanceObservation,c:GuideContext,session?:SessionState,selected?:string){
 if(!session?.activeStop)return [];const result:{id:string;kind:string;label:string;guideId?:string;itemId?:number}[]=[],seen=new Set<string>();
 for(const op of sessionChecklist(guides,s,c,session))if(op.stop.id===session.activeStop&&op.questId&&s.questsAt&&s.questsAt<=c.now&&c.now-s.questsAt<=300&&s.quests?.[op.questId]?.complete===true&&op.state!=='completed'){result.push({id:op.id,kind:'turnin',label:'Turn in '+op.label,guideId:op.guideId});seen.add(op.id);}
 const allocated=allocateResources(guides,s,c);
 for(const g of guides)for(const itemId of g.rewards){if(c.owned.has(itemId))continue;const row=g.walkthrough?walkthroughSteps(g.walkthrough,g.id,s,c).rows[0]:undefined,same=row&&stopFor(g,row).id===session.activeStop;
  if(evaluateCondition({kind:'itemCount',itemId},s,c)===true&&(same||selected===g.id)&&!seen.has('toy:'+itemId)){result.push({id:'toy:'+itemId,kind:'learn',itemId,label:'Learn the received toy'});seen.add('toy:'+itemId);}
  else if(same&&(g as GuideDefinition&{npcId?:number}).npcId&&s.merchant&&s.merchant.at<=c.now&&c.now-s.merchant.at<=300&&s.merchant.npcId===(g as GuideDefinition&{npcId:number}).npcId&&evaluateCondition({kind:'merchantOffer',npcId:s.merchant.npcId,itemId},s,c)===true&&g.costs?.length&&allocated[g.id].every(r=>r.shortfall===0))result.push({id:'buy:'+itemId,kind:'purchase',guideId:g.id,label:'Buy the followed toy at this vendor'});
 }return result.sort((a,b)=>a.id.localeCompare(b.id));
}
export function goalForecast(g:GuideDefinition,s:GuidanceObservation,c:GuideContext,rules:YieldRule[],allocations=allocateResources([g],s,c)){
 const requirements:ForecastRequirement[]=allocations[g.id]?.map(r=>{const m=r.key.match(/:([icg]):(\d+)$/);return {key:r.key,required:r.required,remaining:r.shortfall,scope:r.scope,kind:m?.[1]==='i'?'item':m?.[1]==='g'?'money':'currency',resourceId:Number(m?.[2])};})||[];
 const usable=rules.filter(r=>!(r as YieldRule&{guideId?:string}).guideId||(r as YieldRule&{guideId?:string}).guideId===g.id||(r as YieldRule&{guideId?:string}).guideId===g.progressGuideId).map(rule=>{
  const observation=rule.questId?s.rewardOffers?.[rule.questId]:undefined;const observed=observation&&observation.at<=c.now&&c.now-observation.at<=300?(rule.kind==='item'?observation.items[rule.resourceId]:observation.currencies?.[rule.resourceId]):undefined;
  return observed!==undefined?{...rule,quantity:observed,sourceChecked:true,sources:['Observed game reward'],modifiersUnknown:false}:rule;
 });
 const graph=g.walkthrough?walkthroughSteps(g.walkthrough,g.id,s,c):undefined;
 const daily=graph&&'dailySession' in graph?graph.dailySession as {done:number;total:number;progress?:{count:number;total:number};label:string}|undefined:undefined;
 if(daily?.progress){const set=g.walkthrough?.dailySets?.find(set=>s.quests?.[set.collectionQuestId]);const full=set as typeof set&{resourceId?:number;fullSetYield?:number};
  if(full?.resourceId&&full.fullSetYield){requirements.splice(0,requirements.length,{key:'collection:'+daily.label,required:daily.progress.total,remaining:Math.max(0,daily.progress.total-daily.progress.count),kind:'item',resourceId:full.resourceId,scope:'character'});}
 }
 const reputation=(g as GuideDefinition&{goalReputation?:{factionId:number;metric:string;value:number}}).goalReputation;
 if(reputation)requirements.push({key:'reputation:'+reputation.factionId,required:reputation.value,remaining:evaluateCondition({kind:'reputation',...reputation},s,c)===true?0:undefined,scope:'character',kind:'reputation',resourceId:reputation.factionId});
 const result=progressForecast(requirements,usable,s,c,(g as GuideDefinition&{outcome?:string}).outcome==='random-drop');
 if(daily?.progress&&result.status==='unknown'){const set=g.walkthrough?.dailySets?.find(set=>s.quests?.[set.collectionQuestId]) as {fullSetYield?:number}|undefined;if(set?.fullSetYield)result.label=`${Math.max(0,daily.progress.total-daily.progress.count)} seals remaining; ${set.fullSetYield} per verified full daily set. Today's partial yield needs reward evidence.`;}
 for(const row of result.requirements){const id=Number(row.key.match(/:(\d+)$/)?.[1]);const names:Record<number,string>={241:"Champion's Seals",44987:"Valiant's Seals",45192:"Aspirant's Seals",46114:"Champion's Writs",2003:'Dragon Isles Supplies'};row.label=row.key.startsWith('reputation:')?'Reputation / Renown prerequisite':names[id]||'Resource requirement';if(row.key.startsWith('reputation:')&&row.remaining===undefined)row.reason='The required standing is not established as met. Remaining reputation and its eligible yields need current threshold evidence.';}
 result.assumptions.push('This estimates the listed resources. Remaining introductions, reward collection and learning are separate steps.');
 return result;
}
