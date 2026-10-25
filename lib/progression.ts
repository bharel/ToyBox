import {boundCharacter,characterScope,type CharacterRef,type Actor} from './characters';
import {DAY,weeklyStart,availability,isComplete,unlockKey,type Records,type Settings} from './planner';
import type {Activity} from './catalog';
import type {Routine} from './routines';
import {professionEligibility} from './profession-cooldowns';
import {professionPresets} from './profession-presets';
import {routinePeriod} from './routines';
import type {BoundGameEvidence} from './game-evidence';
import type {RaidMode} from './raid-history';
import {currentRoute,knownDarkmoonClosure,evidenceName,raidDifficultyIds} from './activity-evidence';
import {findForQuest} from './legion-archaeology';
import {toyRouteEligibility} from './toy-routes';
export type Source<T>={status:'ok'|'unavailable';fetchedAt?:number;attemptedAt:number;error?:string;data?:T};
export type ProfileDetails={level:number;classId:number;raceId?:number;raceName?:string;faction?:'ALLIANCE'|'HORDE';lastLoginAt?:number};
export type Reputation={id:number;name:string;raw:number;value:number;max:number;standing:string;accountWide:boolean};
export type ProfessionTier={id:number;name:string;skill:number;max:number;recipeStatus:'reported'|'unavailable';recipeFetchedAt?:number;knownRecipes?:{id:number;name?:string}[]};
export type Profession={id:number;name:string;skill:number;max:number;tiersStatus?:'reported'|'unavailable';tiers?:ProfessionTier[]};
export type AchievementEvidence={id:number;completedAt:number;name:string};
export type CharacterProgress={version:2;ref:CharacterRef;updatedAt:number;profile:Source<ProfileDetails>;quests:Source<{completedIds:number[];trackedIds:number[];completedCount:number}>;reputations:Source<Reputation[]>;professions:Source<Profession[]>;achievements:Source<AchievementEvidence[]>;inGame?:BoundGameEvidence;raidHistory?:{data:RaidMode[];at:number}};
export type SyncRun={runId:string;startedAt:number;finishedAt?:number;leaseExpiresAt:number;status:'running'|'partial'|'complete';lastSuccessAt?:number;errors:string[]};
export type Evidence={source:string;detail:string;at?:number};
export type GoalEligibility={state:'ready'|'blocked'|'unknown'|'complete';reason:string;nextAction:string;evidence:Evidence[];check?:'access'|'availability'|'argent'|'archaeology'|'sync'};
export type Requirement={minLevel?:number;classId?:number;professionId?:number;reputation?:{id:number;raw:number};questsAll?:number[];questsAny?:number[];source:string};
export type ArgentCity={id:string;name:string;faction:'ALLIANCE'|'HORDE';raceIds:number[];valiantQuest:number;laterQuest:number;chargeQuest:number;challengeQuest:number;championQuest?:number};
// Populated from verified Retail quest data; see progression-content.ts for checkpoint provenance.
export {argentCities,ARGENT_INTROS,ARGENT_ASPIRANT_CHALLENGES,ARGENT_CRUSADER_ACHIEVEMENTS,relevantQuestIds,relevantAchievementIds} from './progression-content';
import {argentCities,ARGENT_INTROS,ARGENT_ASPIRANT_CHALLENGES,ARGENT_CRUSADER_ACHIEVEMENTS} from './progression-content';
export function progressFor(actor:string,settings:Settings,progress:CharacterProgress[]){const ref=boundCharacter(settings,actor);return ref?progress.find(p=>characterScope(p.ref)===characterScope(ref)):undefined;}
export function confirmationKey(kind:string,id:string,actor:string,settings:Settings){const ref=boundCharacter(settings,actor);return ref?`confirm2:${kind}:${id}:${characterScope(ref)}`:null;}
export function confirmed(records:Records,key:string|null,now:number){if(!key)return undefined;const c=records[key] as {value:boolean|string;at:number;expiresAt?:number}|undefined;return c&&Number.isFinite(c.at)&&c.at<=now+300000&&(!c.expiresAt||now<c.expiresAt)?c:undefined;}
const result=(state:GoalEligibility['state'],reason:string,nextAction:string,evidence:Evidence[]=[],check?:GoalEligibility['check']):GoalEligibility=>({state,reason,nextAction,evidence,check});
export function availabilityCheckId(a:Activity,records:Records){return `${a.group?'group-'+a.group:a.id}-${String(records[`epoch:${a.group||a.id}`]||'initial')}`;}
const questIds=(p:CharacterProgress|undefined)=>new Set([...(p?.quests.data?.completedIds||[]),...(p?.inGame?.completedQuestIds||[])]);
export function requirementsMet(requirements:Requirement,progress:CharacterProgress|undefined):GoalEligibility{
 const evidence:Evidence[]=[];const need=(reason:string,action:string)=>result('blocked',reason,action,evidence);const unknown=(reason:string)=>result('unknown',reason,'Sync this character to check the requirement.',evidence,'sync');
 if(requirements.classId!==undefined){if(!progress?.profile.data)return unknown('Character class has not been reported.');if(progress.profile.data.classId!==requirements.classId)return need('This character has a different class.','Choose an eligible character.');evidence.push({source:'Blizzard profile',detail:'Required class matches.',at:progress.profile.fetchedAt});}
 if(requirements.minLevel!==undefined){if(!progress?.profile.data)return unknown('Character level has not been reported.');if(progress.profile.data.level<requirements.minLevel)return need(`Requires level ${requirements.minLevel}; last reported level is ${progress.profile.data.level}.`,'Level this character before this activity.');evidence.push({source:'Blizzard profile',detail:`Level ${progress.profile.data.level} meets the verified minimum.`,at:progress.profile.fetchedAt});}
 if(requirements.professionId!==undefined){if(!progress?.professions.data)return unknown('Profession data is unavailable.');const profession=progress.professions.data.find(p=>p.id===requirements.professionId);if(!profession)return need('The required profession was not reported for this character.','Learn the required profession, then sync again.');evidence.push({source:'Blizzard professions',detail:profession.name,at:progress.professions.fetchedAt});}
 if(requirements.reputation){if(!progress?.reputations.data)return unknown('Reputation data is unavailable.');const rep=progress.reputations.data.find(r=>r.id===requirements.reputation!.id);if(!rep)return unknown('The required reputation was not reported.');if(rep.raw<requirements.reputation.raw)return need(`${rep.name}: ${rep.standing}; more reputation is needed.`,`Continue ${rep.name} progression.`);evidence.push({source:'Blizzard reputations',detail:`${rep.name}: ${rep.standing}`,at:progress.reputations.fetchedAt});}
 if(requirements.questsAll?.length||requirements.questsAny?.length){const ids=questIds(progress),all=requirements.questsAll||[],any=requirements.questsAny||[];if(all.some(id=>!ids.has(id))||(any.length&&!any.some(id=>ids.has(id)))){const checks=progress?.inGame?.data.questChecks||[],missingAll=all.filter(id=>!ids.has(id)),missingAny=any.length&&!any.some(id=>ids.has(id));const explicit=missingAll.some(id=>checks.some(q=>q.id===id&&!q.completed))||missingAny&&any.every(id=>checks.some(q=>q.id===id&&!q.completed));return result(explicit?'blocked':'unknown',explicit?'The addon reports an unfinished prerequisite quest.':'A permanent quest checkpoint has not been observed.',explicit?`Complete the missing prerequisite quest${missingAll.length>1?'s':''}: ${[...missingAll,...(missingAny?any:[])].join(', ')}.`:'The next addon snapshot can supply this checkpoint; a manual confirmation is optional.',evidence,explicit?undefined:'access');}evidence.push({source:progress?.inGame?.data.questsAvailable?'Blizzard / in-game quest checkpoints':'Blizzard quest history',detail:'Permanent quest checkpoints completed.',at:Math.max(progress?.quests.fetchedAt||0,progress?.inGame?.at||0)});}
 return result('ready','Verified requirements are met.','Continue this activity.',evidence);
}
export type ArchaeologyRotation={reward:'eye'|'beacon'|'other';title?:string;findId?:string;questIds?:number[];at:number;end:number;source:string;complete?:boolean};
export function rotationFor(records:Records,settings:Settings,now:number,progress?:CharacterProgress):{period:number|null;end:number|null;rotation:ArchaeologyRotation|undefined}{
 const r={id:'legion-archaeology',cadence:'fortnightly'} as Routine,manualPeriod=routinePeriod(r,now,records,settings),timer=progress?.inGame?.data.archaeologyEndAt;
 const end=timer&&timer>now?timer:manualPeriod===null?null:manualPeriod+14*DAY,period=end===null?null:end-14*DAY;
 const manual=period===null?undefined:records[`rotation2:legion-archaeology:${period}`] as {reward:'eye'|'beacon'|'other';title?:string;at:number;end:number}|undefined;
 const rotation:ArchaeologyRotation|undefined=manual&&manual.at<=now+300000&&now<manual.end&&manual.end===end?{...manual,source:'Your rotation confirmation'}:undefined;
 const game=progress?.inGame;
 const seen=[...(game?.questLogIds||[]).map(id=>({id,at:game!.at,source:'WoW addon · active archaeology quest',rank:3})),...(game?.data.offeredQuests||[]).map(q=>({...q,source:'WoW addon · offered archaeology quest',rank:2})),...(game?.data.questTurnIns||[]).map(q=>({...q,source:'WoW addon · archaeology turn-in',rank:1}))].filter(q=>findForQuest(q.id)&&q.at<=now&&(period!==null?q.at>=period:now<weeklyStart(q.at,settings.weeklyHour,settings.weeklyAnchor)+7*DAY)).sort((a,b)=>b.at-a.at||b.rank-a.rank)[0];
 const find=seen&&findForQuest(seen.id),expires=end||seen&&weeklyStart(seen.at,settings.weeklyHour,settings.weeklyAnchor)+7*DAY;
 if(seen&&find&&expires&&now<expires&&(!rotation||seen.at>=rotation.at)){
  const final=find.quests.at(-1)!.id,complete=!!game?.data.questTurnIns?.some(q=>q.id===final&&q.at<=now&&q.at>=(period??weeklyStart(now,settings.weeklyHour,settings.weeklyAnchor)));
  return {period,end,rotation:{reward:find.id==='eye'?'eye':find.id==='beacon'?'beacon':'other',findId:find.id,title:find.name,questIds:find.quests.map(q=>q.id),at:seen.at,end:expires,source:seen.source,complete}};
 }
 return {period,rotation,end};
}
export function activityEligibility(a:Activity,actor:string,records:Records,settings:Settings,progress:CharacterProgress[],now:number,difficulty?:string):GoalEligibility{
 if(isComplete(a,records))return result('complete','Every wanted toy from this activity is collected.','Choose another goal.');
 const ref=boundCharacter(settings,actor);if(!ref)return result('unknown','This character needs an exact Battle.net match.','Sync both characters. No addon is needed.',[],'sync');
 const p=progressFor(actor,settings,progress);const evidence:Evidence[]=[];
 if(a.druidOnly){const check=requirementsMet({classId:11,source:a.source},p);if(check.state!=='ready'){if(!(check.state==='unknown'&&check.check==='access'&&confirmed(records,confirmationKey('access',a.id,actor,settings),now)?.value===true))return check;}evidence.push(...check.evidence);}
 if(a.requirements){const check=requirementsMet(a.requirements,p);if(check.state!=='ready'){if(!(check.state==='unknown'&&check.check==='access'&&confirmed(records,confirmationKey('access',a.id,actor,settings),now)?.value===true))return check;}evidence.push(...check.evidence);}
 if(a.season&&(now<Date.parse(a.season.start)||now>=Date.parse(a.season.end)))return result('blocked','This seasonal window is not active.','Check the in-game event calendar.',evidence);
 if(a.toyRoute)return toyRouteEligibility(a,actor,settings,progress,now);
 const route=currentRoute(p?.inGame?.data,a.id,now);
 if(route)return result('ready',route.kind==='calendar'?'The game calendar reports the Darkmoon Faire open.':'The addon observed this activity’s NPC in your current phase.',a.id==='darkmoon'?'Visit Boomie Sparks and check your Darkmoon Prize Tickets before purchasing.':'Follow the route. NPC visibility does not establish a kill, remaining loot or solo success.',[...evidence,{source:route.kind==='calendar'?'WoW addon · game calendar':'WoW addon · visible NPC',detail:route.kind==='calendar'?'Active holiday observed; this check expires after five minutes.':`NPC ${route.npcId} observed; this check expires after five minutes.`,at:route.at}]);
 if(a.id==='darkmoon'){
  const closed=knownDarkmoonClosure(now);if(closed)return result('blocked',closed.reason,'Return when the game calendar reports the next Faire open.',[...evidence,{source:'Verified event window',detail:closed.source}]);
 }
 if(a.group==='archaeology'){
  const profession=requirementsMet({professionId:794,source:a.source},p);if(profession.state!=='ready'&&!(profession.state==='unknown'&&confirmed(records,confirmationKey('profession','794',actor,settings),now)?.value===true))return {...profession,check:profession.state==='unknown'?'archaeology':profession.check};evidence.push(...profession.evidence);
  const {rotation}=rotationFor(records,settings,now,p);if(!rotation)return result('unknown','The current archaeology quest has not been observed.','Speak with Dariness or pick up her quest, then reload. The addon identifies the reward automatically.',evidence,'archaeology');
  const matches=(a.id==='arch-eye'&&rotation.reward==='eye')||(a.id==='arch-beacon'&&rotation.reward==='beacon');if(!matches)return result('blocked','A different archaeology reward is active in this confirmed window.','Return when this reward is offered.',evidence);
  return result('ready','The profession and confirmed reward match this goal.','Complete the quest chain from Dariness.',[...evidence,{source:rotation.source,detail:rotation.title||rotation.reward,at:rotation.at}]);
 }
 if(a.uncertain){const c=confirmed(records,confirmationKey('availability',availabilityCheckId(a,records),actor,settings),now)||confirmed(records,confirmationKey('availability',a.id+'-'+String(records[`epoch:${a.group||a.id}`]||'initial'),actor,settings),now);if(!c)return result('unknown','A current game observation is still needed.',a.group==='arathi'||a.group==='darkshore'?'Target this rare in the BfA phase, then reload. The addon records sightings; a manual check is optional.':a.id==='darkmoon'?'Open the game calendar, then reload. The addon can report the active Faire.':'Check the event in game.',evidence,'availability');if(c.value!==true)return result('blocked','You marked this route unavailable for this character.','Check again when its phase changes.',evidence,'availability');evidence.push({source:'Your route availability check',detail:'Current access and phase checked together.',at:c.at});return result('ready','This route is available for this character.',a.steps[0]||'Follow your route.',evidence);}
 if(['pet-brd','pet-five'].includes(a.id)&&a.requirements)return result('ready','This character’s dungeon introductions are complete.','Prepare suitable level-25 pets and follow the challenge strategy. Roster strength is not measured.',evidence);
 // Ordinary open-world vendor/farm routes have no curated permanent unlock to confirm.
 if(['hallows-vendors','coin-farm'].includes(a.id))return result('ready','The seasonal source is active.','Follow the route and check the vendor or farm in game.',evidence);
 if(a.raid){
  const clear=p?.inGame?.data.raidClears?.find(r=>evidenceName(r.instance)===evidenceName(a.raid!.instance)&&evidenceName(r.encounter)===evidenceName(a.raid!.encounter)&&(!difficulty||raidDifficultyIds[difficulty]?.includes(r.difficultyId))&&r.at<=now);
  if(clear)return result('ready','The addon reports this boss defeated on this difficulty.','Entry is verified. Past clears may include groups; solo success is not measured.',[...evidence,{source:'WoW addon · saved boss kill',detail:`${a.raid.instance} · ${difficulty||'observed difficulty'} · ${a.raid.encounter}`,at:clear.at}]);
  const mode=p?.raidHistory?.data.find(m=>m.name.normalize('NFKC').toLowerCase()===a.raid!.instance.normalize('NFKC').toLowerCase()&&(!difficulty||m.difficultyName===difficulty)&&m.encounters.some(e=>e.name.toLowerCase().replace(/[’']/g,'')===a.raid!.encounter.toLowerCase().replace(/[’']/g,'')&&e.killCount>0&&e.lastKillAt>0&&e.lastKillAt<=now));
  if(mode)return result('ready','Blizzard reports a previous clear on this difficulty.','Repeat this farm if useful. Past clears can include groups; solo success is not measured.',[...evidence,{source:'Blizzard raid history',detail:`${mode.name} · ${mode.difficultyName} · ${a.raid.encounter}`,at:p?.raidHistory?.at}]);
  const instanceId=a.raid.instance==='The Nighthold'?1530:a.raid.instance==='Firelands'?720:0;
  const visit=p?.inGame?.data.instances.find(i=>i.instanceId===instanceId&&(!difficulty||raidDifficultyIds[difficulty]?.includes(i.difficultyId)));
  if(visit)return result('ready','The addon observed this character entering this difficulty.','Entry is verified. Try the farm when useful; completion and solo success are not measured.',[...evidence,{source:'WoW addon · instance entry',detail:`${a.raid.instance} · ${difficulty||'observed difficulty'}`,at:visit.at}]);
 }
 const access=confirmed(records,confirmationKey('access',a.id,actor,settings),now);
 if(records[unlockKey(a,actor,settings)]===true||access?.value===true){
  evidence.push({source:'Your permanent access confirmation',detail:'Entry and prerequisite access confirmed for this exact character.',at:access?.at});
  if(a.raid){const modes=difficulty?[difficulty]:(a.difficulties||['Run']);const ready=modes.find(d=>confirmed(records,confirmationKey('raid-ready',a.id+'-'+d.replaceAll(' ','-'),actor,settings),now)?.value===true);if(!ready)return result('unknown',`${difficulty||'Raid difficulty'} readiness has not been confirmed.`,'Confirm the difficulties you can complete on this character; level alone does not establish solo readiness.',evidence,'access');evidence.push({source:'Your difficulty confirmation',detail:`${ready} readiness confirmed for this character.`});}
  return result('ready','Access is confirmed for this character.',a.steps[0]||'Follow the source guide.',evidence);
 }
 const automaticAction=a.id==='arachnis'?'Target Arachnis in a garrison with Creepy Crawlers, then reload; the addon records the sighting.':undefined;
 return result('unknown',a.raid?'No entry or boss-clear evidence has been reported for this difficulty.':'This character’s access has not been observed.',a.raid?`Enter ${a.raid.instance} on the missing difficulty, then reload to record access. Solo success is not measured.`:automaticAction||a.prerequisite||'Confirm the prerequisites once.',evidence,'access');
}
export type ArgentStage='not-started'|'aspirant'|'valiant'|'champion'|'crusader';
export function argentProgress(actor:string,records:Records,settings:Settings,progress:CharacterProgress[],now:number){
 const p=progressFor(actor,settings,progress);const manualFaction=confirmed(records,confirmationKey('argent-faction','tournament',actor,settings),now)?.value;const faction=p?.profile.data?.faction||(['ALLIANCE','HORDE'].includes(String(manualFaction))?manualFaction as 'ALLIANCE'|'HORDE':undefined);const evidence:Evidence[]=[];const quests=questIds(p);
 const cities=argentCities.filter(c=>!faction||c.faction===faction);const done=cities.filter(c=>quests.has(c.challengeQuest));
 const cityConfirmation=confirmed(records,confirmationKey('argent-city','tournament',actor,settings),now);
 const selected=cities.find(c=>c.id===cityConfirmation?.value)||cities.find(c=>!quests.has(c.challengeQuest)&&(quests.has(c.laterQuest)||quests.has(c.valiantQuest)||quests.has(c.chargeQuest)))||cities.find(c=>c.raceIds.includes(p?.profile.data?.raceId||-1)&&!quests.has(c.challengeQuest))||cities.find(c=>!quests.has(c.challengeQuest))||cities[0];
 let stage:ArgentStage|undefined;
 if(p?.quests.data||p?.inGame?.data.questsAvailable||p?.inGame?.completedQuestIds.length){stage=done.length?'champion':ARGENT_ASPIRANT_CHALLENGES.some(q=>quests.has(q))||cities.some(c=>quests.has(c.valiantQuest)||quests.has(c.laterQuest)||quests.has(c.chargeQuest))?'valiant':ARGENT_INTROS.some(q=>quests.has(q))?'aspirant':'not-started';evidence.push({source:p.inGame?.data.questsAvailable?'Blizzard / in-game quest checkpoints':'Blizzard quest checkpoints',detail:`${done.length} city champion challenges completed.`,at:Math.max(p.quests.fetchedAt||0,p.inGame?.at||0)});}
 const manual=confirmed(records,confirmationKey('argent','tournament',actor,settings),now);
 const order:ArgentStage[]=['not-started','aspirant','valiant','champion','crusader'];
 if(manual&&order.includes(manual.value as ArgentStage)&&(!stage||order.indexOf(manual.value as ArgentStage)>order.indexOf(stage))){stage=manual.value as ArgentStage;evidence.push({source:'Your stage confirmation',detail:stage,at:manual.at});}
 const accountCrusader=p?.achievements.data?.some(a=>ARGENT_CRUSADER_ACHIEVEMENTS.includes(a.id));
 const rep=p?.reputations.data?.find(r=>r.id===1106);
 if(rep)evidence.push({source:'Blizzard reputations',detail:`Argent Crusade: ${rep.standing}${rep.max>0?` (${rep.value}/${rep.max})`:""}`,at:p?.reputations.fetchedAt});
 if(accountCrusader)evidence.push({source:'Blizzard achievements',detail:'An account-wide Crusader achievement is present; this alone does not prove this character’s daily access.',at:p?.achievements.fetchedAt});
 const city=selected?.name||'your city';
 const next=stage==='not-started'?`Visit the Argent Tournament Grounds and start the ${faction==='HORDE'?'Horde':faction==='ALLIANCE'?'Alliance':'faction'} introduction.`:stage==='aspirant'?`Finish the melee, charge and shield-breaker tutorials; collect 15 Aspirant’s Seals, then complete The Aspirant’s Challenge.`:stage==='valiant'?selected&&quests.has(selected.chargeQuest)?`Speak with Squire Danny, defeat the Argent Champion, and report to ${city}’s grand champion.`:`Do ${city} Valiant dailies and collect 25 Valiant’s Seals, then complete The Valiant’s Challenge.`:stage==='champion'?`${done.length&&!cities.some(c=>c.championQuest&&quests.has(c.championQuest))&&!manual?'Finish A Champion Rises and visit Justicar Mariel Trueheart; ':''}complete unlocked Champion dailies; ${selected&&!quests.has(selected.challengeQuest)?`continue ${city} Valiant progression next.`:'check your remaining collectible purchases.'}`:stage==='crusader'?`Complete your confirmed Crusader/Champion daily circuit and continue your remaining collectible goals.`:'Confirm your current Tournament stage once, or sync quest checkpoints.';
 const eligibility=!boundCharacter(settings,actor)?result('unknown','Character matching is needed.','Sync both characters.',evidence,'sync'):!stage||!faction?result('unknown','Tournament stage or faction needs confirmation.',next,evidence,'argent'):stage==='not-started'?result(manual?.value==='not-started'?'blocked':'unknown','The Tournament introduction was not reported completed. Confirm your current stage; quest history can omit checkpoints.',next,evidence,'argent'):result('ready',`${stage[0].toUpperCase()+stage.slice(1)} progression${selected?' · '+city:''}`,next,evidence,'argent');
 return {stage,faction,cities,selectedCity:selected,championCities:done.map(c=>c.name),accountCrusader:!!accountCrusader,eligibility};
}
export function routineEligibility(r:Routine,actor:string,records:Records,settings:Settings,progress:CharacterProgress[],now:number):GoalEligibility{
 if(r.profession){const preset=professionPresets.find(p=>p.id===r.profession!.presetId);if(preset)return professionEligibility(preset,actor,records,settings,progress,now);}
 if(actor==='warband')return result('ready','You selected this account-wide routine.','Complete the routine once for the Warband.');
 if(!boundCharacter(settings,actor))return result('unknown','This character needs an exact Battle.net match.','Sync both characters.',[],'sync');
 if(r.id==='argent-tournament')return argentProgress(actor,records,settings,progress,now).eligibility;
 if(r.id==='legion-archaeology'){
  const profession=requirementsMet({professionId:794,source:r.source},progressFor(actor,settings,progress));if(profession.state!=='ready'&&!(profession.state==='unknown'&&confirmed(records,confirmationKey('profession','794',actor,settings),now)?.value===true))return {...profession,check:profession.state==='unknown'?'archaeology':profession.check};
  const {rotation,end}=rotationFor(records,settings,now,progressFor(actor,settings,progress));if(!rotation)return result('unknown','The current archaeology quest has not been observed.','Speak with Dariness or pick up her quest, then reload; no reward confirmation is needed.',profession.evidence,'archaeology');
  return result('ready',`Current reward: ${rotation.title||(rotation.reward==='eye'?'Crystalline Eye of Undravius':rotation.reward==='beacon'?'Starlight Beacon':'another rare find')}`,rotation.complete?'The final quest turn-in is recorded for this window.':end?'Continue the detected quest chain before the window ends.':'Continue the detected quest chain. The game has not reported an exact window end yet.',[...profession.evidence,{source:rotation.source,detail:rotation.title||rotation.reward,at:rotation.at}]);
 }
 return result('ready','Your custom routine is assigned to this character.',r.steps[0]||'Follow your saved routine.');
}
