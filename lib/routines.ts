import type {CooldownTiming} from './cooldown-types';
import type {CharacterProgress} from './progression';
import {professionOpportunities} from './profession-cooldowns';
import {actorScope} from './characters';
import {DAY,dailyStart,weeklyStart,type Records,type Settings} from './planner';
import {linkedRoutineDone} from './quest-progress';
export type Routine={id:string;title:string;cadence:'daily'|'weekly'|'fortnightly';assignment:'priest'|'druid'|'both'|'warband';priority:0|1|2;location:string;why:string;steps:string[];source:string;questIds?:number[];custom?:boolean;minutes?:number;timing?:CooldownTiming;profession?:{presetId:string;professionId:number;variantId?:string;recipeId?:number;spellId?:number}};
export const routineSeeds:Routine[]=[
 {id:'argent-tournament',title:'Argent Tournament / Argent Crusade dailies',cadence:'daily',assignment:'priest',priority:0,minutes:20,location:'Icecrown · Argent Tournament Grounds',why:'A long progression chain. Missing a daily turn-in delays your next unlock and collectible purchases.',steps:['Complete the Aspirant, Valiant or Champion dailies available at your current stage.','Turn in today’s quests; record your stage and next unlock in the progress note.','Champion and Crusader options depend on this character’s unlocks. Keep this routine until you finish your Tournament goals.'],source:'https://worldofwarcraft.blizzard.com/en-gb/news/23507736'},
 {id:'legion-archaeology',title:'Legion archaeology rare quest',cadence:'fortnightly',assignment:'priest',priority:0,minutes:35,location:'Broken Isles Dalaran · Dariness the Learned',why:'One rare quest window every two weeks. Missing a wanted reward can mean waiting through the rotation.',steps:['The addon identifies the reward from Dariness’s offered quest or your active quest chain.','Follow the quest objectives shown below. An in-game quest or archaeology aura can provide the exact window end.','The final reported turn-in completes this routine automatically. Toy ownership is checked separately.'],source:'https://worldofwarcraft.blizzard.com/en-gb/news/20307311'},
];
export function routinesFrom(records:Records,settings?:Settings,progress:CharacterProgress[]=[],now=Date.now()):Routine[]{
 const customs=Object.entries(records).filter(([k,v])=>k.startsWith('routine:')&&v&&typeof v==='object').map(([,v])=>v as Routine);
 return [...routineSeeds,...customs,...(settings?professionOpportunities(records,settings,progress,now).filter(o=>o.enabled&&!o.retired).map(o=>o.routine):[])].map(r=>r.profession?r:({...r,...(records[`routine-config:${r.id}`] as Partial<Routine>||{})}));
}
export function routineActors(r:Routine){return r.assignment==='both'?['priest','druid']: [r.assignment];}
export function routinePeriod(r:Routine,now:number,records:Records,settings:Settings):number|null{
 if(r.cadence==='daily')return dailyStart(now,settings.dailyHour,settings.dailyAnchor);
 if(r.cadence==='weekly')return weeklyStart(now,settings.weeklyHour,settings.weeklyAnchor);
 const anchor=Number(records[`routine-anchor:${r.id}`]);
 if(!anchor||!Number.isFinite(anchor)||anchor>now)return null;
 return anchor+Math.floor((now-anchor)/(14*DAY))*14*DAY;
}
export function routineReset(r:Routine,now:number,records:Records,settings:Settings){const start=routinePeriod(r,now,records,settings);return start===null?null:start+(r.cadence==='daily'?DAY:r.cadence==='weekly'?7*DAY:14*DAY);}
export function routineKey(r:Routine,actor:string,now:number,records:Records,settings:Settings){const period=routinePeriod(r,now,records,settings);return period===null?null:`routine-done2:${r.id}:${actorScope(settings,actor)||"unbound-"+actor}:${r.cadence}:${period}`;}
export function routineDone(r:Routine,now:number,records:Records,settings:Settings,progress:CharacterProgress[]=[]){return routineActors(r).every(actor=>{const key=routineKey(r,actor,now,records,settings);return !!key&&records[key]===true||linkedRoutineDone(r,actor,progress,settings,now,records);});}
// The date is a game-calendar UTC reset day, independent of browser timezone or DST.
export function fortnightAnchor(date:string,now:number,settings:Settings){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Choose the actual start date of the current window.');
 const day=Date.parse(date+'T00:00:00Z');
 if(!Number.isFinite(day)||new Date(day).toISOString().slice(0,10)!==date)throw Error('Choose a valid date.');
 const observed=weeklyStart(now,settings.weeklyHour,settings.weeklyAnchor);
 const time=((observed%DAY)+DAY)%DAY;
 const anchor=day+time;
 if(new Date(day).getUTCDay()!==3)throw Error('EU Legion archaeology windows start on a Wednesday reset.');
 if(anchor>now||now-anchor>=14*DAY)throw Error('Choose the Wednesday that started the current two-week window, within the last 14 days.');
 return anchor;
}
