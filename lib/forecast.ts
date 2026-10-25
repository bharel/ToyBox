import {evaluateCondition,type Condition,type GuideContext,type GuideObservations} from './walkthrough';
export type YieldRule={id:string;questId?:number;kind:'item'|'currency'|'reputation'|'money';resourceId:number;quantity:number|null;cadence:'daily'|'weekly'|'fortnightly'|'once';sharedGroup?:string;scope?:'character'|'warband';when?:Condition;sourceChecked:boolean;sources:string[];choiceRequired?:boolean;modifiersUnknown?:boolean};
export type ForecastRequirement={key:string;required:number;remaining?:number;scope:string;kind:YieldRule['kind'];resourceId:number};
export type ProgressForecast={status:'ready'|'estimated'|'unknown'|'random';label:string;requirements:{key:string;label?:string;remaining?:number;cadence?:string;setsRemaining?:number;additionalResets?:number;nextResetAt?:number;reason?:string}[];assumptions:string[]};
export function progressForecast(requirements:ForecastRequirement[],rules:YieldRule[],s:GuideObservations,c:GuideContext,random=false):ProgressForecast{
 if(random)return {status:'random',label:'Random drop; no guaranteed completion date.',requirements:[],assumptions:[]};
 const results:ProgressForecast['requirements']=[],assumptions=['Assumes you complete the selected eligible activities and their access and reward rules stay unchanged.'];
 for(const requirement of requirements){
  const out:ProgressForecast['requirements'][number]={key:requirement.key,remaining:requirement.remaining};results.push(out);
  if(requirement.remaining===undefined){out.reason='The current balance or required amount is not established.';continue;}if(requirement.remaining<=0)continue;
  const groups=new Map<string,YieldRule>();
  for(const rule of rules){if(rule.kind!==requirement.kind||rule.resourceId!==requirement.resourceId||!rule.sourceChecked||!rule.sources.length||rule.choiceRequired||rule.modifiersUnknown||typeof rule.quantity!=='number'||rule.quantity<=0||(rule.scope==='warband')!==(requirement.scope==='warband')||rule.when&&evaluateCondition(rule.when,s,c)!==true)continue;
   const key=rule.sharedGroup||rule.id,old=groups.get(key);if(!old||rule.quantity<Number(old.quantity))groups.set(key,rule);
  }
  const eligible=[...groups.values()],cadences=new Set(eligible.map(r=>r.cadence));
  if(!eligible.length){out.reason='No verified eligible yield is established for the selected activities.';continue;}
  if(cadences.size!==1){out.reason='Selected yields use different reset schedules; a combined finish period is not established.';continue;}
  const cadence=eligible[0].cadence;out.cadence=cadence;const reset=cadence==='daily'?s.dailyResetAt:cadence==='weekly'?s.weeklyResetAt:cadence==='fortnightly'?s.archaeology?.endAt:undefined;
  if(cadence!=='once'&&(!reset||reset<=c.now)){out.reason='The current reset boundary is not established.';continue;}
  let available=0,total=0,unknown=false;
  for(const rule of eligible){total+=Number(rule.quantity);if(!rule.questId){unknown=true;continue;}const done=evaluateCondition({kind:'questTurnedIn',questId:rule.questId,cadence,scope:rule.scope,currentPeriodFlag:true},s,c);if(done===null)unknown=true;else if(done===false)available+=Number(rule.quantity);}
  if(unknown){out.reason='Completion of part of the current set is unknown; the verified full-set yield is '+total+'.';continue;}
  const remaining=requirement.remaining,additional=remaining<=available?0:cadence==='once'?undefined:Math.ceil((remaining-available)/total);
  if(additional===undefined){out.reason='The known one-time rewards do not cover the remaining requirement.';continue;}
  out.additionalResets=additional;out.setsRemaining=(available>0?1:0)+additional;if(additional===1)out.nextResetAt=reset;
 }
 const unknown=results.some(r=>r.reason),ready=results.length>0&&results.every(r=>r.remaining===0),estimated=results.filter(r=>r.additionalResets!==undefined);
 const label=ready?'Known resource requirements are covered.':unknown||!estimated.length?'Finish estimate needs more evidence.':estimated.map(r=>`${r.setsRemaining} ${r.cadence} set${r.setsRemaining===1?'':'s'} remaining; ${r.additionalResets} additional reset${r.additionalResets===1?'':'s'}`).join(' · ');
 return {status:ready?'ready':unknown||!estimated.length?'unknown':'estimated',label,requirements:results,assumptions};
}
