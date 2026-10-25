import {boundCharacter,characterScope} from './characters';
import {addonActor,type AddonSnapshot} from './sync';
import type {ApiProfile} from './raid-history';
import type {CharacterProgress} from './progression';
import type {Records,Settings} from './planner';
import {professionPresets,craftEventUpdate} from './profession-cooldowns';
import {capturedRaidClears,mergeRaidClears} from './activity-evidence';

// Read-time joining keeps API data and in-game observations separately attributed.
export function observedProgress(profiles:ApiProfile[],addons:AddonSnapshot[],settings:Settings,now=Date.now()):CharacterProgress[]{
 return (['priest','druid'] as const).flatMap(actor=>{
  const ref=boundCharacter(settings,actor);if(!ref)return [];
  const profile=profiles.find(p=>p.progress?.version===2&&characterScope(p.progress.ref)===characterScope(ref));
  const addon=addons.filter(a=>a.game&&a.binding&&characterScope(a.binding)===characterScope(ref)&&addonActor(a,settings)===actor&&a.exportedAt<=now+300000).sort((a,b)=>b.exportedAt-a.exportedAt)[0];
  if(!profile?.progress&&!addon)return [];
  const unavailable={status:'unavailable' as const,attemptedAt:now};
  const p:CharacterProgress=profile?.progress||{version:2 as const,ref,updatedAt:addon!.exportedAt,profile:unavailable,quests:unavailable,reputations:unavailable,professions:unavailable,achievements:unavailable};
  const ownProfessions=addon?.game?.professions;
  const professions=ownProfessions&&ownProfessions.at>(p.professions.fetchedAt||0)?{status:'ok' as const,attemptedAt:ownProfessions.at,fetchedAt:ownProfessions.at,data:ownProfessions.data.map(v=>({...p.professions.data?.find(old=>old.id===v.id),...v}))}:p.professions;
  return [{...p,professions,...(profile?.raids?{raidHistory:{data:profile.raids,at:profile.raidsFetchedAt||profile.updatedAt}}:{}),...(addon?.game?{inGame:{ref,at:addon.exportedAt,completedQuestIds:[...new Set([...addon.completedQuestIds,...(addon.game.permanentQuestIds||[])])],questLogIds:addon.questLog.map(q=>q.id),questLog:addon.questLog,data:{...addon.game,raidClears:mergeRaidClears(addon.game.raidClears,capturedRaidClears(addon))}}}:{})}];
 });
}

// An import is an observation, never a craft-use or a collectible acquisition.
export function addonCooldownUpdates(a:AddonSnapshot,records:Records,settings:Settings){
 const actor=addonActor(a,settings),ref=actor&&boundCharacter(settings,actor);
 if(!actor||!ref||!a.game||!a.binding||characterScope(a.binding)!==characterScope(ref))return [];
 return professionPresets.flatMap(preset=>{
  const matches=preset.variants.flatMap(variant=>a.game!.recipes.filter(r=>r.spellId===variant.spellId).map(recipe=>({variant,recipe})));
  const match=matches.at(-1);if(!match)return [];
  const {variant,recipe}=match,timing=variant.timing;
  if(recipe.cooldownSeconds===undefined||recipe.cooldownSeconds*1000>(timing.kind==='daily'?86400000:timing.durationMs))return [];
  const fields=timing.kind==='charges'?(recipe.charges!==undefined&&recipe.maxCharges===timing.maxCharges?{charges:recipe.charges,...(recipe.charges<timing.maxCharges&&recipe.cooldownSeconds>0?{nextRechargeAt:recipe.at+recipe.cooldownSeconds*1000}:{})}:null):{readyAt:recipe.at+recipe.cooldownSeconds*1000};
  if(!fields)return [];
  const event={version:1 as const,id:`addon-${recipe.spellId}-${recipe.at}`,at:recipe.at,recordedAt:a.exportedAt,kind:'observe' as const,variant:variant.id,source:'addon' as const,...fields};
  const update=craftEventUpdate(preset,actor,settings,event);
  // Stable event IDs make repeated imports idempotent.
  return records[update.key]===undefined?[update]:[];
 });
}
