import {catalog,type Activity} from './catalog';
import {attemptKey,weeklyStart,type Records,type Settings} from './planner';
import type {Character} from './sync';
import {boundCharacter} from './characters';
import type {CharacterProgress} from './progression';

export type RaidMode={instanceId:number;name:string;difficultyType:string;difficultyName:string;totalEncounters:number;encounters:{id:number;name:string;lastKillAt:number;killCount:number}[]};
export type ApiProfile={character:Character;updatedAt:number;completedQuestCount:number;raidCount:number;warnings:string[];raids?:RaidMode[];raidsFetchedAt?:number;actor?:'priest'|'druid'|null;progress?:CharacterProgress};
const norm=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const difficulties:Record<string,string>={NORMAL:'Normal',HEROIC:'Heroic',MYTHIC:'Mythic',LFR:'Raid Finder',RAID_FINDER:'Raid Finder',NORMAL_10:'10 Normal',NORMAL_25:'25 Normal',HEROIC_10:'10 Heroic',HEROIC_25:'25 Heroic'};
export function parseRaidHistory(data:unknown,now=Date.now()):RaidMode[]{
 if(!data||typeof data!=='object'||!Array.isArray((data as any).expansions))throw Error('Blizzard returned an unexpected raid response. Saved attempts were kept.');
 const raids:RaidMode[]=[];
 for(const expansion of (data as any).expansions){
  if(!Array.isArray(expansion.instances))throw Error('Blizzard returned an incomplete raid response. Saved attempts were kept.');
  for(const row of expansion.instances){
   if(typeof row.instance?.name!=='string'||!Array.isArray(row.modes))throw Error('Blizzard returned an incomplete raid entry. Saved attempts were kept.');
   for(const mode of row.modes){
    if(typeof mode.difficulty?.type!=='string'||!Array.isArray(mode.progress?.encounters))throw Error('Blizzard returned an incomplete difficulty entry. Saved attempts were kept.');
    const total=Number(mode.progress.total_count||0);
    if(!Number.isInteger(total)||total<0||total>200)throw Error('Blizzard returned an invalid raid size. Saved attempts were kept.');
    const encounters=mode.progress.encounters.map((e:any)=>{
     const at=Number(e.last_kill_timestamp||0),count=Number(e.completed_count||0);
     if(typeof e.encounter?.name!=='string'||!Number.isFinite(at)||at<0||at>now+300000||!Number.isInteger(count)||count<0)throw Error('Blizzard returned invalid boss history. Saved attempts were kept.');
     return {id:Number(e.encounter.id)||0,name:e.encounter.name,lastKillAt:at,killCount:count};
    });
    raids.push({totalEncounters:Math.max(encounters.length,total),instanceId:Number(row.instance.id)||0,name:row.instance.name,difficultyType:mode.difficulty.type,difficultyName:difficulties[mode.difficulty.type]||String(mode.difficulty.name||mode.difficulty.type),encounters});
   }
  }
 }
 return raids;
}
export function blizzardActor(c:Character,settings:Settings):'priest'|'druid'|null{
 for(const actor of ['priest','druid'] as const){
  if(norm(c.name)!==norm(settings[actor]))continue;
  const realm=settings[actor==='priest'?'priestRealm':'druidRealm'];
  if(realm&&norm(realm)!==norm(c.realm)&&norm(realm)!==norm(c.realmSlug))continue;
  if(c.classId&&c.classId!==(actor==='priest'?5:11))continue;
  return actor;
 }
 return null;
}
export function raidAttemptUpdates(raids:RaidMode[],actor:'priest'|'druid'|null,records:Records,settings:Settings,now:number,activities:Activity[]=catalog){
 if(!actor||!boundCharacter(settings,actor))return [];
 const reset=weeklyStart(now,settings.weeklyHour,settings.weeklyAnchor);
 const updates=new Map<string,{key:string;value:boolean}>();
 for(const a of activities){
  if(a.cadence!=='weekly'||!a.raid||(a.druidOnly&&actor!=='druid'))continue;
  for(const mode of raids){
   if(norm(mode.name)!==norm(a.raid.instance))continue;
   const difficulty=difficulties[mode.difficultyType];
   if(!difficulty||!a.difficulties?.includes(difficulty))continue;
   if(!mode.encounters.some(e=>norm(e.name)===norm(a.raid!.encounter)&&e.killCount>0&&e.lastKillAt>=reset&&e.lastKillAt<=now))continue;
   const matched=a.raid.sharedDifficulties?.includes(difficulty)?a.raid.sharedDifficulties:[difficulty];
   for(const d of matched)if(a.difficulties.includes(d)){const key=attemptKey(a,actor,d,now,records,settings);updates.set(key,{key,value:true});}
  }
 }
 return [...updates.values()];
}
