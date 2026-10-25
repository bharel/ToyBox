import {professionOpportunities,type ProfessionOpportunity} from './profession-cooldowns';
import type {CooldownStatus} from './cooldown-types';
import type {Reward} from './catalog';
import type {Activity} from './catalog';
import {isComplete as rewardComplete} from './planner';
import {actorsFor,attemptKey,isComplete,isSnoozed,nextReset,type Records,type Settings} from './planner';
import {routinesFrom,routineActors,routineKey,routineReset,type Routine} from './routines';
import {activityEligibility,routineEligibility,rotationFor,progressFor,type CharacterProgress,type GoalEligibility} from './progression';
import {linkedRoutineDone} from './quest-progress';
import {routeActors,routeQuestDone} from './toy-routes';
export type PlanUnit={id:string;title:string;actor:string;location:string;minutes:number;deadline:number|null;essential:boolean;priority:number;pinned:boolean;guaranteed:boolean;automatic?:boolean;eligibility:GoalEligibility;activity?:Activity;routine?:Routine;profession?:ProfessionOpportunity;cooldown?:CooldownStatus;difficulty?:string;completionKeys:string[];rewards:Reward[]};
export type TodayPreferences={minutes:number;actor:'all'|'priest'|'druid'};
export function todayPreferences(records:Records):TodayPreferences{const p=records['plan-prefs:today'] as TodayPreferences|undefined;return p&&Number.isInteger(p.minutes)&&p.minutes>=5&&p.minutes<=240?{minutes:p.minutes,actor:['all','priest','druid'].includes(p.actor)?p.actor:'all'}:{minutes:30,actor:'all'};}
const deadline=(u:PlanUnit)=>u.deadline??Infinity;
export function todayPlan(activities:Activity[],records:Records,settings:Settings,progress:CharacterProgress[],now:number,prefs=todayPreferences(records)){
 const units:PlanUnit[]=[],done:PlanUnit[]=[],upcoming:PlanUnit[]=[];const crafts=professionOpportunities(records,settings,progress,now);const activeRoutines=routinesFrom(records,settings,progress,now).filter(r=>!records[`routine-retired:${r.id}`]);const merged=new Set<string>();
 const wantedActor=(actor:string)=>prefs.actor==='all'||actor===prefs.actor||actor==='warband';
 const {rotation,end}=rotationFor(records,settings,now);
 for(const r of activeRoutines)for(const actor of routineActors(r)){
  const {rotation,end}=rotationFor(records,settings,now,progressFor(actor,settings,progress));
  if(!wantedActor(actor))continue;const key=routineKey(r,actor,now,records,settings),keys=key?[key]:[];
  const goals=r.id==='legion-archaeology'&&rotation?activities.filter(a=>a.group==='archaeology'&&actorsFor(a,records).includes(actor)&&((a.id==='arch-eye'&&rotation.reward==='eye')||(a.id==='arch-beacon'&&rotation.reward==='beacon'))&&!isComplete(a,records)&&!isSnoozed(a,records,now)):r.cadence==='weekly'&&r.questIds?.length?activities.filter(a=>a.cadence==='weekly'&&a.toyRoute?.questIds.length===r.questIds!.length&&a.toyRoute.questIds.every(id=>r.questIds!.includes(id))&&(a.toyRoute.warband||actorsFor(a,records).includes(actor))&&!isComplete(a,records)&&!isSnoozed(a,records,now)):[];
  for(const a of goals){keys.push(attemptKey(a,actor,'Run',now,records,settings));merged.add(`${a.id}:${a.toyRoute?.warband?'warband':actor}`);}
  const craft=crafts.find(o=>o.routine.id===r.id);
  const unit:PlanUnit={...(craft?{profession:craft,cooldown:craft.cooldown}:{}),id:`routine:${r.id}:${actor}`,title:r.title,actor,location:r.location,minutes:r.minutes||20,deadline:craft?(craft.cooldown?.timing.kind==='daily'?craft.cooldown.deadline||null:null):routineReset(r,now,records,settings),essential:r.priority===0,priority:r.priority,pinned:false,guaranteed:true,eligibility:routineEligibility(r,actor,records,settings,progress,now),routine:r,completionKeys:keys,rewards:goals.flatMap(a=>a.rewards.filter(v=>!rewardComplete({...a,rewards:[v]},records)))};
  if(r.id==='legion-archaeology')unit.deadline=end;
  unit.automatic=linkedRoutineDone(r,actor,progress,settings,now)||r.id==='legion-archaeology'&&rotation?.complete===true;
  if(craft?.cooldown?.state==='cooling'&&unit.eligibility.state==='ready')upcoming.push(unit);else if(unit.automatic||keys.some(k=>records[k]===true))done.push(unit);else units.push(unit);
 }
 for(const a of activities){
  if(isComplete(a,records)||isSnoozed(a,records,now))continue;
  for(const actor of routeActors(a,actorsFor(a,records),settings,progress)){
   const {end}=rotationFor(records,settings,now,progressFor(actor,settings,progress));
   if(!wantedActor(actor)||merged.has(`${a.id}:${actor}`)||merged.has(`${a.id}:warband`))continue;
   // A completed rare routine covers the same quest work as its linked toy goal.
   const sameRoutine=a.group==='archaeology'?activeRoutines.find(r=>r.id==='legion-archaeology'&&routineActors(r).includes(actor)):undefined;
   for(const difficulty of a.difficulties||['Run']){
    const key=attemptKey(a,actor,difficulty,now,records,settings);const sameKey=sameRoutine?routineKey(sameRoutine,actor,now,records,settings):null;
    const unit:PlanUnit={id:`goal:${a.id}:${actor}:${difficulty}`,title:a.title,actor,location:a.zone,minutes:a.minutes,deadline:a.group==='archaeology'?end:nextReset(a.cadence,now,settings)||(a.season?Date.parse(a.season.end):null),essential:false,priority:a.priority,pinned:records[`pin:${a.id}`]===true,guaranteed:/vendor|guaranteed|achievement|challenge|rotation/i.test(a.kind+' '+a.description),eligibility:activityEligibility(a,actor,records,settings,progress,now,difficulty),activity:a,difficulty,completionKeys:[key],rewards:a.rewards.filter(v=>!rewardComplete({...a,rewards:[v]},records))};
    unit.automatic=routeQuestDone(a,actor,settings,progress,now);
    if(unit.automatic||records[key]===true||sameKey&&records[sameKey]===true)done.push(unit);else if(unit.pinned||unit.priority<=2)units.push(unit);
   }
  }
 }
 const essential=units.filter(u=>u.essential&&u.eligibility.state==='ready').sort((a,b)=>deadline(a)-deadline(b)||a.id.localeCompare(b.id));
 const blocked=units.filter(u=>u.eligibility.state==='blocked').sort((a,b)=>Number(b.essential)-Number(a.essential)||deadline(a)-deadline(b));
 const unknown=units.filter(u=>u.eligibility.state==='unknown').sort((a,b)=>Number(b.essential)-Number(a.essential)||deadline(a)-deadline(b));
 const candidates=units.filter(u=>!u.essential&&u.eligibility.state==='ready').sort((a,b)=>Number(b.pinned)-Number(a.pinned)||a.priority-b.priority||Number(b.guaranteed)-Number(a.guaranteed)||deadline(a)-deadline(b)||Number(a.actor==='druid')-Number(b.actor==='druid')||a.location.localeCompare(b.location)||a.id.localeCompare(b.id));
 let used=essential.reduce((n,u)=>n+u.minutes,0);const optional:PlanUnit[]=[],deferred:PlanUnit[]=[];
 for(const unit of candidates){if(used+unit.minutes<=prefs.minutes){optional.push(unit);used+=unit.minutes;}else deferred.push(unit);}
 // Group nearby optional stops. Essential order remains determined by the next deadline.
 optional.sort((a,b)=>a.location.split(' · ')[0].localeCompare(b.location.split(' · ')[0])||a.actor.localeCompare(b.actor));
 upcoming.sort((a,b)=>(a.cooldown?.readyAt||Infinity)-(b.cooldown?.readyAt||Infinity));
 return {essential,optional,deferred,blocked,unknown,done,upcoming,used,overrun:Math.max(0,used-prefs.minutes),essentialMinutes:essential.reduce((n,u)=>n+u.minutes,0),unresolvedEssential:[...blocked,...unknown].filter(u=>u.essential)};
}
