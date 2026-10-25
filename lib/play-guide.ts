import {actorScope} from './characters';
import {todayPlan,type PlanUnit} from './today';
import {argentProgress,progressFor,rotationFor,type CharacterProgress} from './progression';
import {observedQuestRows} from './quest-progress';
import type {Activity} from './catalog';
import type {Records,Settings} from './planner';

export type GuideStep={key:string;unit:PlanUnit;title:string;steps:string[];mode:'play'|'observe'|'unlock';manualCompletion:boolean;automatic:boolean;source:string;reward?:string};

// This is a presentation of the existing plan. Browsing or skipping a step never
// changes attempts, quest completion, cooldown history, or toy ownership.
export function guideStep(u:PlanUnit,records:Records,settings:Settings,progress:CharacterProgress[],now:number):GuideStep{
 const mode=u.eligibility.state==='blocked'?'unlock':u.eligibility.state==='unknown'?'observe':'play';
 const rotation=u.routine?.id==='legion-archaeology'?rotationFor(records,settings,now,progressFor(u.actor,settings,progress)).rotation:undefined;
 const questIds=rotation?.questIds||u.routine?.questIds||[];
 const quests=observedQuestRows(progress,settings,now).filter(q=>q.actor===u.actor&&questIds.includes(q.id)&&['ready','in-progress'].includes(q.state));
 let title=u.title,steps:string[];
 if(u.activity?.toyRoute){
  // Authored routes include conditional pickup, unlock and purchase directions.
  // They can guide an unobserved stop without declaring access verified.
  steps=u.activity.steps;
 }else if(mode!=='play'){
  title=u.routine?.id==='legion-archaeology'&&u.eligibility.check==='archaeology'?'Visit Dariness the Learned':u.routine?.id==='argent-tournament'?'Visit the Argent Tournament':u.profession?`Open ${u.profession.preset.professionName}`:u.title;
  steps=[u.routine?.id==='legion-archaeology'&&u.eligibility.check==='archaeology'?'Speak with Dariness in Broken Isles Dalaran. Accept her archaeology quest if one is offered.':u.routine?.id==='argent-tournament'&&u.eligibility.check==='argent'?'Visit your faction’s questgivers at the Argent Tournament Grounds in Icecrown. Pick up the quests offered to this character.':u.profession?mode==='unlock'?`Learn ${u.profession.preset.title} if it serves your goals, or retire this routine in the full planner.`:`Open your own ${u.profession.preset.professionName} window and its expansion recipe lists. The addon will read the recipes and cooldowns it can see.`:u.eligibility.nextAction];
 }else if(u.profession){
  const {preset,match}=u.profession;title=`Craft ${preset.title}`;
  steps=[`Open ${preset.professionName} and choose ${preset.tier}.`,`Find ${preset.title}. If the game shows it available and you have the materials, craft it.`];
 }else if(u.routine?.id==='argent-tournament'){
  const argent=argentProgress(u.actor,records,settings,progress,now);
  title='Visit the Argent Tournament';
  steps=argent.stage==='champion'||argent.stage==='crusader'?['Go to the Argent Tournament Grounds in Icecrown.',`Pick up the ${argent.stage==='crusader'?'Champion and Crusader':'Champion'} dailies available to this character.`,'Complete their objectives and turn the quests in before leaving.']:[u.eligibility.nextAction];
 }else if(u.routine?.id==='legion-archaeology'){
  title=rotation?.title?`Work on ${rotation.title}`:'Visit Dariness the Learned';
  steps=quests.length?quests.map(q=>q.state==='ready'?`Turn in ${q.title}.`:`Continue ${q.title}; follow its objectives in your quest log.`):['Speak with Dariness in Broken Isles Dalaran and pick up the offered archaeology quest.','Follow the quest chain to its final turn-in.'];
 }else if(quests.length){
  steps=quests.map(q=>q.state==='ready'?`Turn in ${q.title}.`:`Continue ${q.title}; follow its objectives in your quest log.`);
 }else if(u.activity?.raid){
  steps=[`Enter ${u.activity.raid.instance} on ${u.difficulty||'your selected difficulty'}.`,`Defeat ${u.activity.raid.encounter} and loot the boss.`];
 }else{
  // Legacy guides included instructions to operate Toybox's old tracking UI.
  // Keep game instructions here; the existing journal retains the full notes.
  steps=(u.routine?.steps||u.activity?.steps||[u.eligibility.nextAction]).filter(s=>!/^mark |^track |^only set |^set available|^confirm a new|^record /i.test(s)&&!/use New cycle|manually confirmed control cycle|record your stage|Record Used now|mark anything you already own/i.test(s));
  if(!steps.length)steps=[u.eligibility.nextAction];
 }
 const automatic=!!u.profession||!!u.activity?.raid||u.routine?.id==='legion-archaeology'||!!u.routine?.questIds?.length||!!u.activity?.toyRoute?.questIds.length;
 const cooldown=u.cooldown,opportunity=cooldown?.timing.kind==='elapsed'?cooldown.readyAt??cooldown.lastUsedAt??'unobserved':cooldown?.timing.kind==='charges'?`${cooldown.charges??'unknown'}:${cooldown.nextRechargeAt??'cap'}`:u.deadline??'open';
 return {key:`${u.id}:${actorScope(settings,u.actor)||'unbound'}:${opportunity}:${mode}`,unit:u,title,steps,mode,automatic,manualCompletion:mode==='play'&&!automatic&&!!u.routine&&u.completionKeys.length>0,source:u.profession?.preset.source||u.routine?.source||u.activity?.source||'',...(rotation?.title?{reward:rotation.title}:{})};
}

export function playGuide(activities:Activity[],records:Records,settings:Settings,progress:CharacterProgress[],now:number){
 const plan=todayPlan(activities,records,settings,progress,now);
 // Essential prerequisites remain actionable directions without pretending that
 // access is verified. Optional unknown routes never become mandatory questions.
 const essential=[...plan.essential,...plan.unresolvedEssential].sort((a,b)=>(a.deadline??Infinity)-(b.deadline??Infinity)||a.id.localeCompare(b.id));
 const steps=[...essential,...plan.optional].map(u=>guideStep(u,records,settings,progress,now));
 const seen=new Set(steps.map(s=>s.unit.id));
 const extras=[...plan.deferred,...plan.unknown.filter(u=>!u.essential&&u.activity?.toyRoute),...plan.blocked.filter(u=>!u.essential&&u.activity?.toyRoute&&u.activity.requirements?.reputation)].filter(u=>!seen.has(u.id));
 const more=extras.map(u=>guideStep(u,records,settings,progress,now)).sort((a,b)=>Number(b.unit.activity?.toyRoute?.kind==='weekly-reputation')-Number(a.unit.activity?.toyRoute?.kind==='weekly-reputation')||a.unit.priority-b.unit.priority||a.unit.location.localeCompare(b.unit.location));
 return {steps,more,plan};
}
