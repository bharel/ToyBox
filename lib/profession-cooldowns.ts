import {actorScope,boundCharacter,characterScope,type Actor} from './characters';
import {dailyStart,DAY,type Records,type Settings} from './planner';
import type {CharacterProgress,GoalEligibility,Evidence} from './progression';
import type {Routine} from './routines';
import {professionPresets,PROFESSION_PRESETS_VERSION,type ProfessionPreset,type CraftVariant} from './profession-presets';
import {validCooldownEvent,type CooldownEvent,type CooldownStatus} from './cooldown-types';
export {professionPresets,PROFESSION_PRESETS_VERSION};
const normalized=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export const presetKey=(kind:'enabled'|'retired'|'recipe',preset:ProfessionPreset,actor:string,settings:Settings)=>{const scope=actorScope(settings,actor);return scope&&scope!=='warband'?kind==='recipe'?`confirm2:recipe:${preset.id}:${scope}`:`profession-${kind}2:${preset.id}:${scope}`:null};
export const eventPrefix=(preset:ProfessionPreset,actor:string,settings:Settings)=>{const scope=actorScope(settings,actor);return scope&&scope!=='warband'?`cooldown2:${preset.id}:${scope}:`:null};
export function craftEvents(preset:ProfessionPreset,actor:string,records:Records,settings:Settings,now:number){const prefix=eventPrefix(preset,actor,settings);return prefix?Object.entries(records).filter(([k,v])=>k.startsWith(prefix)&&validCooldownEvent(v)&&(v as CooldownEvent).at<=now).map(([key,value])=>({key,event:value as CooldownEvent})).sort((a,b)=>a.event.at-b.event.at||(a.event.recordedAt||a.event.at)-(b.event.recordedAt||b.event.at)||Number(a.event.kind==='use')-Number(b.event.kind==='use')||a.event.id.localeCompare(b.event.id)):[];}
export type RecipeMatch={state:'learned'|'unknown'|'not-learned';reason:string;variant?:CraftVariant;recipeId?:number;evidence:Evidence[]};
export function recipeMatch(preset:ProfessionPreset,actor:string,records:Records,settings:Settings,progress:CharacterProgress[],now:number):RecipeMatch{
 const ref=boundCharacter(settings,actor);if(!ref)return {state:'unknown',reason:'Match this character with Battle.net first.',evidence:[]};
 const source=progress.find(p=>characterScope(p.ref)===characterScope(ref))?.professions,profession=source?.data?.find(p=>p.id===preset.professionId),evidence:Evidence[]=source?.data?[{source:source.status==='ok'?'Blizzard professions':'Cached Blizzard professions',detail:`${preset.professionName} data for this exact character.`,at:source.fetchedAt}]:[];
 const observed=preset.variants.flatMap(variant=>(progress.find(p=>characterScope(p.ref)===characterScope(ref))?.inGame?.data.recipes||[]).filter(r=>r.spellId===variant.spellId).map(recipe=>({variant,recipe}))).at(-1);
 if(observed&&!(source?.data&&!profession&&(source.fetchedAt||0)>observed.recipe.at))return {state:'learned',reason:'Your addon observed this learned recipe on this character.',variant:observed.variant,recipeId:observed.recipe.blizzardRecipeId,evidence:[...evidence,{source:'WoW addon · learned recipe',detail:`${preset.tier} · crafting spell #${observed.recipe.spellId}${observed.recipe.blizzardRecipeId?` · Blizzard recipe #${observed.recipe.blizzardRecipeId}`:''}`,at:observed.recipe.at}]};
 if(source?.data&&!profession)return {state:'not-learned',reason:`${preset.professionName} was not reported for this character.`,evidence};
 const key=presetKey('recipe',preset,actor,settings),manual=key?records[key] as {value:string;at:number;expiresAt?:number}|undefined:undefined;
 const manualValid=manual&&manual.at<=now+300000&&(!manual.expiresAt||now<manual.expiresAt);
 if(manualValid){const variant=preset.variants.find(v=>v.id===manual.value);if(variant)return {state:'learned',reason:'You confirmed this recipe on this character.',variant,evidence:[...evidence,{source:'Your permanent recipe confirmation',detail:preset.title,at:manual.at}]};}
 const notLearned=manualValid&&manual.value==='not-learned'?{state:'not-learned' as const,reason:'You marked this recipe as not learned.',evidence}:undefined;
 if(!profession)return notLearned||{state:'unknown',reason:'Profession data is unavailable. Confirm the learned recipe once, or sync.',evidence};
 const tiers=profession.tiers?.filter(t=>normalized(t.name).includes(normalized(preset.tier))),known=(tiers||[]).flatMap(t=>t.knownRecipes||[]);
 const recipeAt=Math.max(0,...(tiers||[]).map(t=>t.recipeFetchedAt||0))||source?.fetchedAt,recipeSource=tiers?.some(t=>t.recipeStatus==='unavailable')?'Cached Blizzard learned recipes':'Blizzard learned recipes';
 const matches=preset.variants.flatMap(v=>known.filter(r=>v.recipeIds.includes(r.id)).map(r=>({variant:v,recipeId:r.id})));
 // Upgraded recipes replace the base recipe for the same shared opportunity.
 if(matches.length){const match=matches[matches.length-1];return {state:'learned',reason:'The learned recipe was reported by Blizzard.',...match,evidence:[...evidence,{source:recipeSource,detail:`${preset.tier} · ${preset.title} · recipe #${match.recipeId}`,at:recipeAt}]};}
 const named=known.filter(r=>normalized(r.name||'')===normalized(preset.title));
 if(named.length&&preset.variants.length===1)return {state:'learned',reason:'Blizzard reports this learned recipe by name and expansion.',variant:preset.variants[0],recipeId:named[0].id,evidence:[...evidence,{source:recipeSource,detail:`${preset.tier} · ${preset.title} · recipe #${named[0].id}`,at:recipeAt}]};
 if(notLearned)return notLearned;
 if(named.length)return {state:'unknown',reason:'The recipe is learned, but its daily or charged variant needs confirmation.',evidence};
 if(tiers?.length&&tiers.every(t=>t.recipeStatus==='reported'))return {state:'not-learned',reason:`This recipe was not listed among your learned ${preset.tier} recipes.`,evidence};
 if(profession.tiersStatus==='reported'&&!tiers?.length)return {state:'not-learned',reason:`${preset.tier} ${preset.professionName} was not reported learned.`,evidence};
 return {state:'unknown',reason:'Learned recipe data is missing. Skill level alone does not confirm access.',evidence};
}
export function professionEligibility(preset:ProfessionPreset,actor:string,records:Records,settings:Settings,progress:CharacterProgress[],now:number):GoalEligibility{const m=recipeMatch(preset,actor,records,settings,progress,now);return {state:m.state==='learned'?'ready':m.state==='not-learned'?'blocked':'unknown',reason:m.reason,nextAction:m.state==='learned'?'Check the cooldown in game and use the craft when available.':m.state==='not-learned'?'Learn this recipe, confirm it in game, or retire this routine.':'Sync or confirm the exact recipe variant once.',evidence:m.evidence};}
export function cooldownStatus(preset:ProfessionPreset,variant:CraftVariant,actor:string,records:Records,settings:Settings,now:number):CooldownStatus{
 const timing=variant.timing,events=craftEvents(preset,actor,records,settings,now).filter(e=>e.event.variant===variant.id),base:CooldownStatus={state:'unknown',label:'Check in game',timing,estimated:true,...(timing.kind==='daily'?{deadline:dailyStart(now,settings.dailyHour,settings.dailyAnchor)+DAY}:{})};
 if(!events.length)return base;
 const latest=events[events.length-1].event;base.evidenceAt=latest.at;base.evidenceSource=latest.source;base.latestEventId=latest.id;const lastUse=events.filter(e=>e.event.kind==='use').at(-1)?.event;base.lastUsedAt=lastUse?.at;
 if(timing.kind==='daily'){
  const start=dailyStart(now,settings.dailyHour,settings.dailyAnchor),ready=latest.kind==='observe'?latest.readyAt===undefined||latest.readyAt<=now:latest.at<start;
  return {...base,state:ready?'ready':'cooling',label:ready?'Not logged this reset · check in game':'Used this reset',deadline:start+DAY,readyAt:ready?undefined:start+DAY};
 }
 if(timing.kind==='elapsed'){
  const readyAt=latest.kind==='use'?latest.at+timing.durationMs:latest.readyAt??latest.at;
  return {...base,state:now>=readyAt?'ready':'cooling',label:now>=readyAt?'Estimated ready':'Cooling down',readyAt};
 }
 let charges:number|undefined,next:number|undefined;
 const advance=(at:number)=>{if(charges===undefined||next===undefined||at<next)return;const gained=Math.floor((at-next)/timing.durationMs)+1;charges=Math.min(timing.maxCharges,charges+gained);next=charges===timing.maxCharges?undefined:next+gained*timing.durationMs;};
 for(const {event:e} of events){advance(e.at);if(e.kind==='observe'){charges=e.charges;next=e.nextRechargeAt;if(charges===timing.maxCharges)next=undefined;}else if(charges!==undefined){if(charges===timing.maxCharges)next=e.at+timing.durationMs;charges=Math.max(0,charges-1);}}
 advance(now);
 if(charges===undefined)return {...base,maxCharges:timing.maxCharges,label:'Check charges in game'};
 const capAt=charges===timing.maxCharges?now:next===undefined?undefined:next+(timing.maxCharges-charges-1)*timing.durationMs;
 return {...base,state:charges>0?'ready':next!==undefined?'cooling':'unknown',label:charges===timing.maxCharges?'At charge cap · use when useful':charges>0?'Estimated charges available':next?'Recharging':'Check next recharge in game',charges,maxCharges:timing.maxCharges,nextRechargeAt:next,readyAt:charges===0?next:undefined,capAt};
}
export type ProfessionOpportunity={preset:ProfessionPreset;actor:Actor;routine:Routine;match:RecipeMatch;eligibility:GoalEligibility;cooldown?:CooldownStatus;enabled:boolean;retired:boolean};
export function professionOpportunities(records:Records,settings:Settings,progress:CharacterProgress[],now:number):ProfessionOpportunity[]{return (['priest','druid'] as Actor[]).flatMap(actor=>{const ref=boundCharacter(settings,actor);if(!ref)return [];const source=progress.find(p=>characterScope(p.ref)===characterScope(ref))?.professions;return professionPresets.flatMap(preset=>{
 const enabledKey=presetKey('enabled',preset,actor,settings)!,retiredKey=presetKey('retired',preset,actor,settings)!,match=recipeMatch(preset,actor,records,settings,progress,now),history=craftEvents(preset,actor,records,settings,now),explicit=records[enabledKey];
 const exists=match.evidence.some(e=>e.source==='WoW addon · learned recipe')||records[retiredKey]!==undefined||source?.data?.some(p=>p.id===preset.professionId)||explicit!==undefined||history.length||records[presetKey('recipe',preset,actor,settings)!];if(!exists)return [];
 const enabled=typeof explicit==='boolean'?explicit:actor==='priest'&&preset.professionId===202&&match.state==='learned'||history.length>0,retired=records[retiredKey]===true;
 const variant=match.variant,scope=characterScope(ref),routine:Routine={id:`profession-${preset.id}-${scope.replaceAll('_','-')}`,title:preset.title,cadence:'daily',assignment:actor,priority:preset.professionId===202&&actor==='priest'?0:1,minutes:2,location:`${preset.professionName} · ${preset.tier}`,why:preset.purpose,steps:['Open the correct expansion in your profession window.','Check ingredients, tools and cooldown, then craft if useful.','Record Used now only after crafting; adjust the time if you crafted earlier.'],source:preset.source,timing:variant?.timing,profession:{presetId:preset.id,professionId:preset.professionId,variantId:variant?.id,recipeId:match.recipeId,spellId:variant?.spellId}};
 return [{preset,actor,routine,match,enabled:!!enabled,retired,eligibility:professionEligibility(preset,actor,records,settings,progress,now),cooldown:variant?cooldownStatus(preset,variant,actor,records,settings,now):undefined}];
 });});}
export function craftEventUpdate(preset:ProfessionPreset,actor:string,settings:Settings,event:CooldownEvent){const prefix=eventPrefix(preset,actor,settings);if(!prefix||!validCooldownEvent(event)||!preset.variants.some(v=>v.id===event.variant))throw Error('Choose a bound character and a valid craft observation.');return {key:prefix+event.id,value:event};}
export function professionCooldownView(records:Records,settings:Settings,progress:CharacterProgress[],now:number){return {version:1,presetVersion:PROFESSION_PRESETS_VERSION,generatedAt:now,opportunities:professionOpportunities(records,settings,progress,now).map(o=>({ref:boundCharacter(settings,o.actor),presetId:o.preset.id,routineId:o.routine.id,title:o.preset.title,professionId:o.preset.professionId,enabled:o.enabled,retired:o.retired,learned:o.match.state,blizzardRecipeId:o.match.recipeId,spellId:o.match.variant?.spellId,timing:o.match.variant?.timing,cooldown:o.cooldown,eligibility:o.eligibility}))};}
