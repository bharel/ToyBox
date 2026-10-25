import {professionOpportunities} from './profession-cooldowns';
import type {CooldownTiming,CooldownStatus} from './cooldown-types';
import type {Activity} from './catalog';
import {boundCharacter,type CharacterRef} from './characters';
import {actorsFor,type Records,type Settings} from './planner';
import {activityEligibility,routineEligibility,type CharacterProgress,type GoalEligibility} from './progression';
import {routinesFrom,routineActors} from './routines';
export type EligibilityView={version:2;generatedAt:number;characters:{ref:CharacterRef;goals:({activityId:string;difficulty:string}&GoalEligibility)[];routines:({routineId:string;timing?:CooldownTiming;cooldown?:CooldownStatus}&GoalEligibility)[]}[]};
// The sync contract and browser recommendations use the same evaluator and source timestamps.
// This is a read-time view: expiring windows are never frozen into permanent eligibility records.
export function eligibilityView(activities:Activity[],records:Records,settings:Settings,progress:CharacterProgress[],now:number):EligibilityView{
 const professions=professionOpportunities(records,settings,progress,now),allRoutines=routinesFrom(records,settings,progress,now);
 return {version:2,generatedAt:now,characters:(['priest','druid'] as const).flatMap(actor=>{const ref=boundCharacter(settings,actor);if(!ref)return [];return [{ref,goals:activities.filter(a=>actorsFor(a,records).includes(actor)).flatMap(a=>(a.difficulties||['Run']).map(difficulty=>({activityId:a.id,difficulty,...activityEligibility(a,actor,records,settings,progress,now,difficulty)}))),routines:allRoutines.filter(r=>!records[`routine-retired:${r.id}`]&&routineActors(r).includes(actor)).map(r=>({routineId:r.id,...(r.profession?{timing:r.timing,cooldown:professions.find(o=>o.routine.id===r.id)?.cooldown}:{}),...routineEligibility(r,actor,records,settings,progress,now)}))}];})};
}
