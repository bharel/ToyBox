import {validCooldownEvent} from './cooldown-types';
import {professionPresets} from './profession-presets';
import {actorScope,validCharacterRef,type CharacterRef,type Actor} from "./characters";
import type { Activity, Assignment, Cadence } from "./catalog";
export type Records = Record<string, unknown>;
export type Settings = { priest: string; druid: string; priestRealm?: string; druidRealm?: string; timezone: string; weeklyHour: number; dailyHour: number; weeklyAnchor?: number; dailyAnchor?: number; resetObservedAt?: number; bindings?: Partial<Record<Actor,CharacterRef>> };
export const defaultSettings: Settings = { priest:"Priest",druid:"Druid",priestRealm:"",druidRealm:"",timezone:"UTC",weeklyHour:4,dailyHour:4 };
export const DAY = 86400000;
export function settingsFrom(records: Records): Settings { return {...defaultSettings,...(records.settings as Partial<Settings> || {})}; }
export function weeklyStart(now: number, hour = 4, anchor?:number) {
  if(anchor&&Number.isFinite(anchor))return anchor+Math.floor((now-anchor)/(7*DAY))*7*DAY;
  const d = new Date(now); d.setUTCHours(hour,0,0,0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay()+4)%7));
  if(d.getTime()>now)d.setUTCDate(d.getUTCDate()-7);
  return d.getTime();
}
export function dailyStart(now: number, hour = 4, anchor?:number) {
  if(anchor&&Number.isFinite(anchor))return anchor+Math.floor((now-anchor)/DAY)*DAY;
  const d = new Date(now); d.setUTCHours(hour,0,0,0);
  if(d.getTime()>now)d.setUTCDate(d.getUTCDate()-1);
  return d.getTime();
}
export function cycleFor(activity: Activity, now: number, records: Records, settings: Settings) {
  if(activity.group==="archaeology"){
    const anchor=Number(records['routine-anchor:legion-archaeology']);
    return anchor&&anchor<=now?String(anchor+Math.floor((now-anchor)/(14*DAY))*14*DAY):'unconfirmed';
  }
  if(activity.cadence==="weekly")return String(weeklyStart(now,settings.weeklyHour,settings.weeklyAnchor));
  if(activity.cadence==="daily")return String(dailyStart(now,settings.dailyHour,settings.dailyAnchor));
  if(activity.cadence==="control"||activity.cadence==="rotation")return String(records[`epoch:${activity.group||activity.id}`]||"initial");
  return "permanent";
}
export function nextReset(cadence: Cadence, now:number,settings:Settings) {
  if(cadence==="weekly")return weeklyStart(now,settings.weeklyHour,settings.weeklyAnchor)+7*DAY;
  if(cadence==="daily")return dailyStart(now,settings.dailyHour,settings.dailyAnchor)+DAY;
  return null;
}
export function assignmentFor(activity:Activity,records:Records):Assignment {
  if(activity.druidOnly)return "druid";
  return (records[`assignment:${activity.id}`] as Assignment)||activity.assignment;
}
export function actorsFor(activity:Activity,records:Records) {
  const a = assignmentFor(activity,records); return a==="both"?["priest","druid"]:[a];
}
export function attemptKey(activity:Activity,actor:string,difficulty:string,now:number,records:Records,settings:Settings) {
  return `attempt2:${activity.id}:${actorScope(settings,actor)||"unbound-"+actor}:${difficulty.replaceAll(" ","-")}:${cycleFor(activity,now,records,settings)}`;
}
export function unlockKey(activity:Activity,actor:string,settings:Settings){return `unlock2:${activity.id}:${actorScope(settings,actor)||"unbound-"+actor}`;}
export function isComplete(activity:Activity,records:Records) { return activity.rewards.every(r=>(records[`owned:${r.id}`]===true||!!r.itemId&&records[`owned:item-${r.itemId}`]===true)); }
export function isSnoozed(activity:Activity,records:Records,now:number) { return Number(records[`snooze:${activity.id}`]||0)>now; }
export function availabilityKey(activity:Activity,now:number,records:Records,settings:Settings) {
  const period = activity.cadence==="control"||activity.cadence==="rotation"?cycleFor(activity,now,records,settings):dailyStart(now,settings.dailyHour,settings.dailyAnchor);
  return `availability:${activity.id}:${period}`;
}
export function availability(activity:Activity,records:Records,now:number,settings:Settings):"ready"|"check"|"inactive" {
  if(activity.season && (now<Date.parse(activity.season.start)||now>=Date.parse(activity.season.end)))return "inactive";
  if(activity.uncertain) {
    const status=records[availabilityKey(activity,now,records,settings)];
    const checkedAt=Number(records[`availability-time:${activity.id}`]||0);
    if(!checkedAt||now-checkedAt>DAY)return "check";
    if(status==="ready"||status==="inactive")return status;
    return "check";
  }
  return "ready";
}
export function attempted(activity:Activity,records:Records,now:number,settings:Settings) {
  if(activity.cadence==="once"||activity.cadence==="repeatable")return false;
  return actorsFor(activity,records).every(actor=>(activity.difficulties||["Run"]).every(d=>!!records[attemptKey(activity,actor,d,now,records,settings)]));
}
export function safeUrl(value:string) { try { const u=new URL(value);return u.protocol==="https:"?u.toString():"";}catch{return "";} }
export function validateRecord(key:string,value:unknown) {
  if(!/^(owned|attempt|unlock|assignment|snooze|availability|availability-time|epoch|custom|note|pin|routine|routine-config|routine-anchor|routine-done|routine-note|routine-retired|attempt2|unlock2|routine-done2|confirm2|rotation2|plan-prefs|profession-enabled2|profession-retired2|cooldown2):[a-zA-Z0-9:_-]{1,230}$/.test(key)&&key!=="settings")return false;
  if(value===null)return true;
  if(key.startsWith('profession-enabled2:')||key.startsWith('profession-retired2:'))return /^profession-(enabled|retired)2:[a-z0-9-]+:eu_[a-z0-9-]+_[1-9][0-9]*$/.test(key)&&professionPresets.some(p=>p.id===key.split(':')[1])&&typeof value==='boolean';
  if(key.startsWith('cooldown2:')){if(!/^cooldown2:[a-z0-9-]+:eu_[a-z0-9-]+_[1-9][0-9]*:[a-zA-Z0-9-]+$/.test(key)||!validCooldownEvent(value)||(value.recordedAt||value.at)>Date.now()+300000||key.split(':')[3]!==value.id)return false;const preset=professionPresets.find(p=>p.id===key.split(':')[1]),variant=preset?.variants.find(v=>v.id===value.variant);if(!variant)return false;if(value.kind==='use')return value.charges===undefined&&value.readyAt===undefined&&value.nextRechargeAt===undefined;return variant.timing.kind==='charges'?value.charges!==undefined&&value.charges<=variant.timing.maxCharges&&value.readyAt===undefined&&(value.charges<variant.timing.maxCharges||value.nextRechargeAt===undefined):value.readyAt!==undefined&&value.charges===undefined&&value.nextRechargeAt===undefined;}

  if(/^(attempt2|unlock2|routine-done2|confirm2):/.test(key)&&key.includes(":unbound-"))return false;
  if(key.startsWith("attempt2:")&&key.endsWith(":unconfirmed"))return false;
  if(key.startsWith("attempt2:")||key.startsWith("unlock2:")||key.startsWith("routine-done2:"))return typeof value==="boolean";
  if(key==="plan-prefs:today"){
    const p=value as {minutes:number;actor:string};return !!p&&Number.isInteger(p.minutes)&&p.minutes>=5&&p.minutes<=240&&["all","priest","druid"].includes(p.actor);
  }
  if(key.startsWith("confirm2:")){
    const c=value as {value:boolean|string;at:number;expiresAt?:number};return !!c&&(typeof c.value==="boolean"||(typeof c.value==="string"&&c.value.length<=120))&&Number.isFinite(c.at)&&c.at>=1577836800000&&(c.expiresAt===undefined||(Number.isFinite(c.expiresAt)&&c.expiresAt>c.at));
  }
  if(key.startsWith("rotation2:")){
    const r=value as {reward:string;title?:string;at:number;end:number};return !!r&&["eye","beacon","other"].includes(r.reward)&&(r.title===undefined||(typeof r.title==="string"&&r.title.length<=150))&&Number.isFinite(r.at)&&Number.isFinite(r.end)&&r.end>r.at;
  }
  if(value===undefined)return false;
  if(JSON.stringify(value).length>14000)return false;
  if(key.startsWith("routine-done:")||key.startsWith("routine-retired:"))return typeof value==="boolean";
  if(key.startsWith("routine-note:"))return typeof value==="string"&&value.length<=4000;
  if(key.startsWith("routine-anchor:"))return typeof value==="number"&&Number.isFinite(value)&&value>=1577836800000;
  if(key.startsWith("routine:")||key.startsWith("routine-config:")){
    const r=value as {timing?:unknown;profession?:unknown;questIds?:number[];id:string;title:string;cadence:string;assignment:string;priority:number;location:string;why:string;steps:string[];source:string;custom?:boolean;minutes?:number};
    const keyId=key.slice(key.indexOf(":")+1);
    return !!r&&r.timing===undefined&&r.profession===undefined&&r.id===keyId&&/^[a-z0-9-]{1,90}$/.test(r.id)&&(key.startsWith("routine-config:")||(r.id.startsWith("custom-")&&r.custom===true))&&typeof r.title==="string"&&!!r.title.trim()&&r.title.length<=120
      &&["daily","weekly","fortnightly"].includes(r.cadence)&&["priest","druid","both","warband"].includes(r.assignment)
      &&Number.isInteger(r.priority)&&r.priority>=0&&r.priority<=2&&typeof r.location==="string"&&r.location.length<=150
      &&typeof r.why==="string"&&r.why.length<=1500&&Array.isArray(r.steps)&&r.steps.length<=20&&r.steps.every(s=>typeof s==="string"&&s.length<=500)
      &&typeof r.source==="string"&&(!r.source||!!safeUrl(r.source))&&(r.questIds===undefined||(Array.isArray(r.questIds)&&r.questIds.length>0&&r.questIds.length<=100&&r.questIds.every(id=>Number.isInteger(id)&&id>0)&&r.assignment!=="warband"&&r.cadence!=="fortnightly"))&&(r.custom===undefined||typeof r.custom==="boolean")&&(r.minutes===undefined||(Number.isInteger(r.minutes)&&r.minutes>0&&r.minutes<=1440));
  }
  if(key==="settings") {
    if(!value||typeof value!=="object"||Array.isArray(value))return false;
    const s=value as Settings;
    if(s.bindings!==undefined&&(!s.bindings||typeof s.bindings!=="object"||Array.isArray(s.bindings)||Object.entries(s.bindings).some(([role,ref])=>!["priest","druid"].includes(role)||!validCharacterRef(ref))))return false;
    if(typeof s.priest!=="string"||!s.priest.trim()||s.priest.length>40||typeof s.druid!=="string"||!s.druid.trim()||s.druid.length>40)return false;
    if(!Number.isInteger(s.weeklyHour)||s.weeklyHour<0||s.weeklyHour>23||!Number.isInteger(s.dailyHour)||s.dailyHour<0||s.dailyHour>23)return false;
    if([s.weeklyAnchor,s.dailyAnchor,s.resetObservedAt].some(n=>n!==undefined&&(!Number.isFinite(n)||n<1577836800000)))return false;
    if([s.priestRealm,s.druidRealm].some(v=>v!==undefined&&(typeof v!=="string"||v.length>80)))return false;
    try { new Intl.DateTimeFormat("en",{timeZone:s.timezone}).format(); } catch {return false;}
    return typeof s.timezone==="string";
  }
  if(key.startsWith("custom:")) {
    const a=value as Activity;
    if(a?.toyRoute!==undefined)return false; // Curated source rules are seed metadata, not imported executable policy.
    return !!a&&a.id===key.slice(7)&&/^custom-[a-z0-9-]+$/.test(a.id)&&typeof a.title==="string"&&a.title.length>0&&a.title.length<=120&&["weekly","daily","rotation","control","once","repeatable"].includes(a.cadence)&&["priest","druid","both"].includes(a.assignment)&&typeof a.expansion==="string"&&typeof a.zone==="string"&&typeof a.description==="string"&&Array.isArray(a.steps)&&a.steps.every(s=>typeof s==="string")&&Array.isArray(a.rewards)&&a.rewards.length>0&&a.rewards.length<25&&a.rewards.every(r=>typeof r.id==="string"&&/^[a-z0-9-]+$/.test(r.id)&&typeof r.name==="string")&&typeof a.source==="string"&&(!a.source||!!safeUrl(a.source))&&a.custom===true
      &&typeof a.kind==="string"&&typeof a.prerequisite==="string"&&typeof a.reason==="string"&&typeof a.checked==="string"
      &&typeof a.color==="string"&&["teal","purple","blue","green","gold","orange","pink"].includes(a.color)
      &&typeof a.icon==="string"&&Number.isFinite(a.minutes)&&a.minutes>0&&a.minutes<=1440&&Number.isInteger(a.priority)&&a.priority>=0&&a.priority<=3
      &&(a.group===undefined||(typeof a.group==="string"&&/^[a-z0-9-]+$/.test(a.group)))
      &&(a.difficulties===undefined||(Array.isArray(a.difficulties)&&a.difficulties.length>0&&a.difficulties.length<=12&&a.difficulties.every(d=>typeof d==="string"&&/^[a-zA-Z0-9 -]{1,40}$/.test(d))))
      &&(a.questId===undefined||(Number.isInteger(a.questId)&&a.questId>0))
      &&(a.raid===undefined||(!!a.raid&&typeof a.raid.instance==="string"&&a.raid.instance.length<=150&&typeof a.raid.encounter==="string"&&a.raid.encounter.length<=150&&(a.raid.sharedDifficulties===undefined||(Array.isArray(a.raid.sharedDifficulties)&&a.raid.sharedDifficulties.every(d=>typeof d==="string"&&!!a.difficulties?.includes(d))))))
      &&(a.requirements===undefined||validRequirements(a.requirements))
      &&a.season===undefined&&(a.druidOnly===undefined||typeof a.druidOnly==="boolean")&&(a.uncertain===undefined||typeof a.uncertain==="boolean");
  }
  if(key.startsWith("owned:")||key.startsWith("attempt:")||key.startsWith("unlock:")||key.startsWith("pin:"))return typeof value==="boolean";
  if(key.startsWith("assignment:"))return ["priest","druid","both"].includes(value as string);
  if(key.startsWith("snooze:")||key.startsWith("availability-time:"))return typeof value==="number"&&Number.isFinite(value)&&value>=0;
  if(key.startsWith("availability:"))return ["ready","inactive","check"].includes(value as string);
  if(key.startsWith("epoch:"))return typeof value==="string"&&/^[a-zA-Z0-9-]{1,50}$/.test(value);
  if(key.startsWith("note:"))return typeof value==="string"&&value.length<=4000;
  return false;
}

function validRequirements(r:NonNullable<Activity['requirements']>){
 const ids=(v:unknown)=>v===undefined||(Array.isArray(v)&&v.length<=50&&v.every(n=>Number.isSafeInteger(n)&&n>0));
 return !!r&&typeof r.source==='string'&&!!safeUrl(r.source)&&(r.minLevel===undefined||(Number.isInteger(r.minLevel)&&r.minLevel>0&&r.minLevel<=1000))&&(r.classId===undefined||(Number.isInteger(r.classId)&&r.classId>0&&r.classId<100))&&(r.professionId===undefined||(Number.isInteger(r.professionId)&&r.professionId>0))&&ids(r.questsAll)&&ids(r.questsAny)&&(r.reputation===undefined||(Number.isInteger(r.reputation.id)&&r.reputation.id>0&&Number.isFinite(r.reputation.raw)));
}
