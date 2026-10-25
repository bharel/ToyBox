import type {CompanionDevice} from './companion';
import type {professionCooldownView} from './profession-cooldowns';
import type {PublicCatalogue,CatalogueCounts,CatalogueCoverage} from './toy-catalogue';
import type {EligibilityView} from "./eligibility-view";
import type {CharacterProgress,SyncRun} from "./progression";
import type {ApiProfile} from "./raid-history";
import {boundCharacter,characterScope,type CharacterRef} from "./characters";
import type {GameEvidence} from "./game-evidence";
import {validRouteObservation} from './activity-evidence';
import {parseQuestEvidence} from './quest-progress';
import {parseGuideSnapshot,type GuideSnapshot} from './guide-profile-data';
import {catalog,type Activity} from "./catalog";
import {attemptKey,cycleFor,actorsFor,defaultSettings,type Records,type Settings} from "./planner";
export type SyncedToy={itemId?:number;toyId?:number;name:string;icon?:string};
export type QuestSnapshot={id:number;title:string;frequency?:number;complete?:boolean;objectives?:{text:string;fulfilled:number;required:number;finished:boolean}[]};
export type AddonSnapshot={capture?:{version:1;id:string;at:number;sequence:number};guides?:GuideSnapshot;format:"toybox-addon-v1";version:number;exportedAt:number;character:{name:string;realm:string;classFile:string;region:string;guid?:string};binding?:CharacterRef;game?:GameEvidence;ownedToyIds:number[];toys:SyncedToy[];raidLockouts:{name:string;difficultyId:number;difficultyName:string;resetAt:number;encounters:{name:string;killed:boolean;id?:number}[]}[];questLog:QuestSnapshot[];completedQuestIds:number[];watchedQuests:{id:number;completed:boolean}[];weeklyResetAt?:number;dailyResetAt?:number;warnings:string[];toysComplete:boolean;raidsFresh:boolean;completedQuestCount?:number};
export type ApiCollection={format:"blizzard-toys-v1";exportedAt:number;toys:SyncedToy[];errors?:string[]};
export type Character={name:string;realm:string;realmSlug:string;id:number;level:number;className?:string;classId?:number};
export type SyncView={captureReceipts?:Record<string,import('./sync-receipt').SnapshotReceipt>;companion?:{devices:CompanionDevice[]};configured:boolean;connected:boolean;expiresAt?:number;redirectUri:string;encryptionReady:boolean;toys:SyncedToy[];pendingMetadata:number;collectionSyncedAt?:number;characters:Character[];addonCharacters:AddonSnapshot[];profiles:ApiProfile[];progress:CharacterProgress[];eligibility?:EligibilityView;professionCooldowns?:ReturnType<typeof professionCooldownView>;catalogue?:PublicCatalogue;catalogueCounts?:CatalogueCounts;catalogueCoverage?:CatalogueCoverage;syncRun?:SyncRun};
export const emptySync:SyncView={configured:false,connected:false,redirectUri:"",encryptionReady:false,toys:[],pendingMetadata:0,characters:[],addonCharacters:[],profiles:[],progress:[]};
export function ms(value:number){return value<1000000000000?value*1000:value}
const id=(x:unknown)=>Number.isInteger(x)&&Number(x)>0&&Number(x)<100000000;
const short=(x:unknown,max=200)=>typeof x==="string"&&x.length<=max;
export function parseAddon(value:unknown,now=Date.now()):AddonSnapshot {
 const a=value as AddonSnapshot;
 if(!a||a.format!=="toybox-addon-v1"||a.version!==1||!Number.isFinite(a.exportedAt)||ms(a.exportedAt)<1577836800000||ms(a.exportedAt)>now+300000)throw Error("This is not a supported Toybox addon export, or its timestamp is invalid.");
 if(!a.character||!short(a.character.name,60)||!a.character.name.trim()||!short(a.character.realm,80)||!short(a.character.classFile,30)||!short(a.character.region,10))throw Error("The export is missing a valid character.");
 if(typeof a.toysComplete!=="boolean"||typeof a.raidsFresh!=="boolean")throw Error("The export is missing scan completeness markers. Download the current addon.");
 if(!Array.isArray(a.ownedToyIds)||a.ownedToyIds.length>10000||!a.ownedToyIds.every(id)||!Array.isArray(a.toys)||a.toys.length>10000||!a.toys.every(t=>id(t.itemId)&&short(t.name)))throw Error("The toy list is invalid.");
 if(!Array.isArray(a.raidLockouts)||a.raidLockouts.length>500||!a.raidLockouts.every(r=>short(r.name)&&Number.isInteger(r.difficultyId)&&short(r.difficultyName)&&Number.isFinite(r.resetAt)&&ms(r.resetAt)>=1577836800000&&ms(r.resetAt)<=ms(a.exportedAt)+60*86400000&&Array.isArray(r.encounters)&&r.encounters.length<=100&&r.encounters.every(e=>short(e.name)&&typeof e.killed==="boolean")))throw Error("The raid lockout list is invalid.");
 // Preserve additional client frequency values without inventing a daily/weekly cadence.
 if(!Array.isArray(a.questLog)||a.questLog.length>1000||!a.questLog.every(q=>id(q.id)&&short(q.title,300)&&(q.frequency===undefined||Number.isInteger(q.frequency)&&q.frequency>=0&&q.frequency<=255)&&(q.complete===undefined||typeof q.complete==="boolean")&&Array.isArray(q.objectives)&&q.objectives.length<=50&&q.objectives.every(o=>short(o.text,1000)&&Number.isFinite(o.fulfilled)&&o.fulfilled>=0&&Number.isFinite(o.required)&&o.required>=0&&typeof o.finished==="boolean")))throw Error("The quest log is invalid.");
 if(!Array.isArray(a.completedQuestIds)||a.completedQuestIds.length>100000||!a.completedQuestIds.every(id)||!Array.isArray(a.watchedQuests)||a.watchedQuests.length>1000||!a.watchedQuests.every(q=>id(q.id)&&typeof q.completed==="boolean"))throw Error("The quest completion flags are invalid.");
 if(!Array.isArray(a.warnings)||a.warnings.length>50||!a.warnings.every(w=>short(w,500)))throw Error("The export warnings are invalid.");
 if([a.weeklyResetAt,a.dailyResetAt].some(n=>n!==undefined&&(!Number.isFinite(n)||ms(n)<ms(a.exportedAt)||ms(n)>ms(a.exportedAt)+8*86400000)))throw Error("The exported reset times are invalid.");
 if(a.character.guid!==undefined&&(!short(a.character.guid,100)||!/^Player-[0-9]+-[0-9A-Fa-f]+$/.test(a.character.guid)))throw Error("Invalid in-game character identity.");
 const questFields=a.game?parseQuestEvidence(a.game,a.exportedAt):{};
 if(a.capture){const r=a.capture;if(r.version!==1||typeof r.id!=="string"||!/^[\w:-]{1,240}$/.test(r.id)||!Number.isSafeInteger(r.at)||r.at<1||!Number.isSafeInteger(r.sequence)||r.sequence<1||!a.character.guid||r.id!==a.character.guid+":"+r.at+":"+r.sequence||Math.floor(ms(a.exportedAt)/1000)!==r.at)throw Error("Invalid capture identity.");}
 const guides=parseGuideSnapshot(a.guides,a.character);
 if(a.game?.routes!==undefined&&(!Array.isArray(a.game.routes)||a.game.routes.length>20||!a.game.routes.every(r=>r&&validRouteObservation({...r,at:ms(r.at),expiresAt:ms(r.expiresAt)},ms(a.exportedAt)))))throw Error('Invalid route observation. Update Toybox Export.');
 if(a.game?.raidClears!==undefined&&(!Array.isArray(a.game.raidClears)||a.game.raidClears.length>2000||!a.game.raidClears.every(r=>r&&short(r.instance)&&short(r.encounter)&&Number.isInteger(r.difficultyId)&&r.difficultyId>0&&r.difficultyId<=250&&Number.isFinite(r.at)&&ms(r.at)>=1577836800000&&ms(r.at)<=ms(a.exportedAt))))throw Error('Invalid raid access evidence.');
 if(a.game){const g=a.game,validAt=(at:number)=>Number.isFinite(at)&&ms(at)>=1577836800000&&ms(at)<=ms(a.exportedAt);if(!a.character.guid||g.version!==1||(g.permanentQuestIds!==undefined&&(!Array.isArray(g.permanentQuestIds)||g.permanentQuestIds.length>1000||!g.permanentQuestIds.every(id)))||(g.offeredQuests!==undefined&&(!Array.isArray(g.offeredQuests)||g.offeredQuests.length>100||!g.offeredQuests.every(q=>id(q.id)&&validAt(q.at))))||typeof g.questsAvailable!=="boolean"||!Array.isArray(g.instances)||g.instances.length>500||!g.instances.every(i=>id(i.instanceId)&&Number.isInteger(i.difficultyId)&&i.difficultyId>=1&&i.difficultyId<=250&&validAt(i.at))||!Array.isArray(g.recipes)||g.recipes.length>100||!g.recipes.every(r=>id(r.spellId)&&(r.blizzardRecipeId===undefined||id(r.blizzardRecipeId))&&(r.clientSkillLineAbilityId===undefined||id(r.clientSkillLineAbilityId))&&validAt(r.at)&&(r.cooldownSeconds===undefined||Number.isFinite(r.cooldownSeconds)&&r.cooldownSeconds>=0&&r.cooldownSeconds<=30*86400)&&(r.charges===undefined||Number.isInteger(r.charges)&&r.charges>=0&&r.charges<=20)&&(r.maxCharges===undefined||Number.isInteger(r.maxCharges)&&r.maxCharges>0&&r.maxCharges<=20)&&(r.charges===undefined||r.maxCharges!==undefined&&r.charges<=r.maxCharges)))throw Error("Invalid in-game evidence. Update Toybox Export and export again.");}
 const owned=new Set(a.ownedToyIds);if(a.toys.some(t=>!owned.has(t.itemId!))||(a.toysComplete&&new Set(a.toys.map(t=>t.itemId)).size!==owned.size))throw Error("The toy names and owned-item list do not match.");
 return {...a,guides,binding:undefined,...(a.game?{game:{...a.game,...questFields,...(a.game.routes?{routes:a.game.routes.map(r=>({...r,at:ms(r.at),expiresAt:ms(r.expiresAt)}))}:{}),...(a.game.raidClears?{raidClears:a.game.raidClears.map(r=>({...r,at:ms(r.at)}))}:{}),...(a.game.offeredQuests?{offeredQuests:a.game.offeredQuests.map(q=>({...q,at:ms(q.at)}))}:{}),instances:a.game.instances.map(i=>({...i,at:ms(i.at)})),recipes:a.game.recipes.map(r=>({...r,at:ms(r.at)}))}}:{}),exportedAt:ms(a.exportedAt),weeklyResetAt:a.weeklyResetAt?ms(a.weeklyResetAt):undefined,dailyResetAt:a.dailyResetAt?ms(a.dailyResetAt):undefined,raidLockouts:a.raidLockouts.map(r=>({...r,resetAt:ms(r.resetAt)})),ownedToyIds:[...new Set(a.ownedToyIds)]};
}
export function mergeToys(collections:SyncedToy[][]):SyncedToy[]{
 const map=new Map<string,SyncedToy>();
 for(const list of collections)for(const toy of list){const key=toy.itemId?`item:${toy.itemId}`:`toy:${toy.toyId}`;const previous=map.get(key);map.set(key,{...previous,...toy,name:/^Toy #\d+$/.test(toy.name)&&previous?previous.name:toy.name});}
 // Prefer item-resolved entries over earlier unresolved references to the same Blizzard toy.
 const resolved=new Set([...map.values()].filter(t=>t.itemId&&t.toyId).map(t=>t.toyId));
 return [...map.values()].filter(t=>t.itemId||!resolved.has(t.toyId)).sort((a,b)=>a.name.localeCompare(b.name));
}
export function ownedUpdates(toys:SyncedToy[],activities:Activity[]=catalog){const ids=new Set(toys.map(t=>t.itemId).filter(Boolean));return [...toys.filter(t=>t.itemId).map(t=>({key:`owned:item-${t.itemId}`,value:true})),...activities.flatMap(a=>a.rewards.filter(r=>r.itemId&&ids.has(r.itemId)).map(r=>({key:`owned:${r.id}`,value:true})))];}
const norm=(s:string)=>s.normalize("NFKC").toLocaleLowerCase().replaceAll("’", "'").replace(/[^\p{L}\p{N}]/gu,"");
export function addonActor(snapshot:AddonSnapshot,settings:Settings):"priest"|"druid"|null {
 if(snapshot.character.region!=="EU")return null;
 const actor=snapshot.character.classFile==="PRIEST"?"priest":snapshot.character.classFile==="DRUID"?"druid":null;
 if(!actor||norm(snapshot.character.name)!==norm(settings[actor]))return null;
 const realm=settings[actor==="priest"?"priestRealm":"druidRealm"];
 return realm&&norm(realm)!==norm(snapshot.character.realm)?null:actor;
}
export function addonImportCoverage(addons:AddonSnapshot[],settings:Settings,actorFilter='all'){
 return (['priest','druid'] as const).flatMap(actor=>{
  if(actorFilter!=='all'&&actorFilter!==actor)return [];
  const a=addons.filter(a=>addonActor(a,settings)===actor).sort((a,b)=>b.exportedAt-a.exportedAt)[0];if(!a)return [];
  const ref=boundCharacter(settings,actor),applied=!!(ref&&a.binding&&characterScope(ref)===characterScope(a.binding)),recipes=a.game?.recipes||[];
  return [{actor,name:a.character.name,realm:a.character.realm,at:a.exportedAt,applied,questFlags:a.completedQuestCount??a.completedQuestIds.length,raidSaves:a.raidLockouts.length,instanceVisits:a.game?.instances.length||0,learnedRecipes:recipes.length,cooldowns:recipes.filter(r=>r.cooldownSeconds!==undefined).length}];
 });
}
export function snapshotIsCurrent(snapshot:AddonSnapshot,cadence:"daily"|"weekly",now:number,settings:Settings=defaultSettings){
 if(snapshot.exportedAt>now+300000)return false;
 const reset=cadence==="weekly"?snapshot.weeklyResetAt:snapshot.dailyResetAt;
 if(reset)return now<reset;
 const activity={cadence} as Activity;
 return cycleFor(activity,snapshot.exportedAt,{},settings)===cycleFor(activity,now,{},settings);
}
export function questProgressFor(activity:Activity,addons:AddonSnapshot[],records:Records,settings:Settings,now:number){
 if(!activity.questId||!["daily","weekly"].includes(activity.cadence))return [];
 return addons.filter(a=>{const actor=addonActor(a,settings);return actor&&actorsFor(activity,records).includes(actor)}).map(snapshot=>{
  const quest=snapshot.questLog.find(q=>q.id===activity.questId);
  const watched=snapshot.watchedQuests.find(q=>q.id===activity.questId);
  const completed=watched?.completed===true||snapshot.completedQuestIds.includes(activity.questId!);
  const current=snapshotIsCurrent(snapshot,activity.cadence as "daily"|"weekly",now,settings);
  const state=completed?"turned-in":quest?.complete?"ready":quest?"in-progress":watched?"not-completed":"not-reported";
  return {snapshot,quest,current,state};
 }).sort((a,b)=>b.snapshot.exportedAt-a.snapshot.exportedAt);
}
export function addonAttemptUpdates(snapshot:AddonSnapshot,records:Records,settings:Settings=defaultSettings,activities:Activity[]=catalog){
 const actor=addonActor(snapshot,settings);
 if(!actor||!boundCharacter(settings,actor))return [];
 // Attribute an older export to its own reset schedule, even after a newer alt export.
 const capturedSettings={...settings,...(snapshot.weeklyResetAt?{weeklyAnchor:snapshot.weeklyResetAt}:{}),...(snapshot.dailyResetAt?{dailyAnchor:snapshot.dailyResetAt}:{})};
 const updates:{key:string;value:boolean}[]=[];
 const difficulty:Record<number,string>={14:"Normal",15:"Heroic",16:"Mythic",17:"Raid Finder"};
 for(const a of activities){
  if(snapshot.raidsFresh&&a.cadence==="weekly"&&a.difficulties)for(const raid of snapshot.raidLockouts){
   if(raid.resetAt<=snapshot.exportedAt)continue;
   const diff=difficulty[raid.difficultyId];
   if(!diff||!a.difficulties.includes(diff))continue;
   const bossName=a.id==="fandral"?"Majordomo Staghelm":a.id==="guldan"?"Gul'dan":null;
   if(bossName&&raid.encounters.some(e=>e.killed&&norm(e.name)===norm(bossName)))updates.push({key:attemptKey(a,actor,diff,snapshot.exportedAt,records,capturedSettings),value:true});
  }
  if(a.questId&&["weekly","daily"].includes(a.cadence)&&(snapshot.completedQuestIds.includes(a.questId)||snapshot.watchedQuests.some(q=>q.id===a.questId&&q.completed)))updates.push({key:attemptKey(a,actor,"Run",snapshot.exportedAt,records,capturedSettings),value:true});
 }
 return updates;
}
