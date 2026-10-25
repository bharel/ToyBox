import {db,blizzardGet,snapshot,saveSnapshot,readRecords,activitiesFor,recordStatements} from './server-sync';
import {settingsFrom,type Settings} from './planner';
import {characterScope,normalized,type Actor,type CharacterRef} from './characters';
import {relevantQuestIds,relevantAchievementIds,type CharacterProgress,type Source,type SyncRun} from './progression';
import {parseRaidHistory,raidAttemptUpdates,blizzardActor,type ApiProfile} from './raid-history';
import type {Character} from './sync';
export function characterRef(c:Character):CharacterRef{return {region:'EU',id:c.id,realmSlug:c.realmSlug,name:c.name,realm:c.realm,classId:c.classId};}
export function bindFromRoster(settings:Settings,characters:Character[]){
 const next:Settings={...settings,bindings:{...settings.bindings}};const errors:string[]=[];
 for(const actor of ['priest','druid'] as Actor[]){
  const realm=settings[actor==='priest'?'priestRealm':'druidRealm'];
  const matches=characters.filter(c=>normalized(c.name)===normalized(settings[actor])&&!!realm&&[normalized(c.realm),normalized(c.realmSlug)].includes(normalized(realm))&&c.classId===(actor==='priest'?5:11));
  if(matches.length===1)next.bindings![actor]=characterRef(matches[0]);else{delete next.bindings![actor];errors.push(`Could not uniquely match ${settings[actor]} and its realm in the EU account roster.`);}
 }
 return {settings:next,errors};
}
function rows(v:any,key:string){if(!Array.isArray(v?.[key]))throw Error(`Blizzard returned incomplete ${key} data.`);return v[key];}
export function normalizeProgress(kind:keyof Omit<CharacterProgress,'version'|'ref'|'updatedAt'>,data:any,tracked:number[],at=Date.now()):any{
 if(kind==='profile'){if(!Number.isInteger(data?.level)||!Number.isInteger(data?.character_class?.id))throw Error('Blizzard returned an incomplete character profile.');return {level:data.level,classId:data.character_class.id,raceId:data.race?.id,raceName:data.race?.name,faction:['ALLIANCE','HORDE'].includes(data.faction?.type)?data.faction.type:undefined,lastLoginAt:data.last_login_timestamp};}
 if(kind==='quests'){const qs=rows(data,'quests');if(qs.some((q:any)=>!Number.isInteger(q.id)||q.id<=0))throw Error('Blizzard returned invalid quest IDs.');return {completedIds:qs.map((q:any)=>Number(q.id)).filter((id:number)=>tracked.includes(id)),trackedIds:tracked,completedCount:qs.length};}
 if(kind==='reputations')return rows(data,'reputations').map((r:any)=>{if(!Number.isInteger(r.faction?.id)||!r.standing||!Number.isFinite(r.standing.raw))throw Error('Incomplete reputation standing.');return {id:r.faction.id,name:r.faction.name||`Faction ${r.faction.id}`,raw:r.standing.raw,value:r.standing.value||0,max:r.standing.max||0,standing:r.standing.name||String(r.standing.tier||''),accountWide:!!r.is_account_wide};});
 if(kind==='professions'){
  if(!Array.isArray(data?.primaries)&&!Array.isArray(data?.secondaries))throw Error('Blizzard returned incomplete professions.');
  return [...(data.primaries||[]),...(data.secondaries||[])].map((p:any)=>{
   if(!Number.isInteger(p.profession?.id))throw Error('Invalid profession.');
   const tiers=(p.tiers||[]).map((t:any)=>{if(!Number.isInteger(t.tier?.id)||typeof t.tier?.name!=='string')throw Error('Invalid profession tier.');const reported=Array.isArray(t.known_recipes);if(reported&&t.known_recipes.some((r:any)=>!Number.isInteger(r.id)||r.id<=0))throw Error('Invalid learned recipe.');return {id:t.tier.id,name:t.tier.name,skill:Number(t.skill_points)||0,max:Number(t.max_skill_points)||0,recipeStatus:reported?'reported':'unavailable',...(reported?{recipeFetchedAt:at,knownRecipes:[...new Map(t.known_recipes.map((r:any)=>[r.id,{id:r.id,...(typeof r.name==='string'?{name:r.name}: {})}])).values()]}:{})};});
   return {id:p.profession.id,name:p.profession.name||`Profession ${p.profession.id}`,skill:Math.max(p.skill_points||0,...tiers.map((t:any)=>t.skill)),max:Math.max(p.max_skill_points||0,...tiers.map((t:any)=>t.max)),tiersStatus:Array.isArray(p.tiers)?'reported':'unavailable',tiers};
  });
 }
 if(kind==='achievements')return rows(data,'achievements').filter((a:any)=>relevantAchievementIds.includes(Number(a.id||a.achievement?.id))&&Number(a.completed_timestamp)>0).map((a:any)=>({id:Number(a.id||a.achievement?.id),completedAt:Number(a.completed_timestamp)||0,name:a.achievement?.name||''}));
 throw Error('Unknown progression source.');
}
export function mergeSource<T>(previous:Source<T>|undefined,result:PromiseSettledResult<any>,normalizer:(value:any)=>T,at:number):Source<T>{
 try{if(result.status==='rejected')throw result.reason;return {status:'ok',data:normalizer(result.value),attemptedAt:at,fetchedAt:at};}
 catch(e){return {...previous,status:'unavailable',attemptedAt:at,error:e instanceof Error?e.message:'Blizzard data was unavailable.'};}
}
export async function syncCharacter(user:string,token:string,character:Character,settings:Settings,actor:Actor|null){
 const started=Date.now(),key=`profile:${character.id}:${character.realmSlug}`,previous=await snapshot<ApiProfile>(user,key),records=await readRecords(user);
 const tracked=[...new Set([...relevantQuestIds(),...activitiesFor(records).flatMap(a=>[...(a.questId?[a.questId]:[]),...(a.requirements?.questsAll||[]),...(a.requirements?.questsAny||[])])])];
 const base=`/profile/wow/character/${encodeURIComponent(character.realmSlug)}/${encodeURIComponent(character.name.toLowerCase())}`;
 const kinds=['profile','quests','reputations','professions','achievements'] as const;
 const paths=['','/quests/completed','/reputations','/professions','/achievements','/encounters/raids'];
 const responses=await Promise.allSettled(paths.map(p=>blizzardGet(base+p,token)));
 const progress={version:2,ref:characterRef(character),updatedAt:started} as CharacterProgress;
 kinds.forEach((kind,i)=>{(progress as any)[kind]=mergeSource<any>(previous?.progress?.[kind],responses[i],data=>(kind==='profile'&&Number(data.id)!==character.id?(()=>{throw Error('Profile identity did not match the bound character.');})():normalizeProgress(kind,data,tracked,started)),started);});
 // A partial professions document can update skill values without erasing successful recipe evidence.
 if(progress.professions.status==='ok'&&progress.professions.data)for(const p of progress.professions.data){const old=previous?.progress?.professions.data?.find(v=>v.id===p.id);if(p.tiersStatus==='unavailable'&&old?.tiers){p.tiers=old.tiers.map(t=>({...t,recipeStatus:'unavailable'}));}else for(const t of p.tiers||[]){const prior=old?.tiers?.find(v=>v.id===t.id);if(t.recipeStatus==='unavailable'&&prior?.knownRecipes){t.knownRecipes=prior.knownRecipes;t.recipeFetchedAt=prior.recipeFetchedAt;}}}
 if(progress.profile.data&&progress.profile.data.classId!==(character.classId||progress.profile.data.classId))throw Error('Character class changed during the sync; retry matching.');
 let raids=previous?.raids,raidsFetchedAt=previous?.raidsFetchedAt;const warnings=kinds.filter(k=>progress[k].status==='unavailable').map(k=>`${k}: ${progress[k].error} Saved successful data was kept.`);
 const updates:{key:string;value:unknown}[]=[];
 try{if(responses[5].status==='rejected')throw responses[5].reason;raids=parseRaidHistory(responses[5].value,Date.now());raidsFetchedAt=started;updates.push(...raidAttemptUpdates(raids,actor,records,settings,started,activitiesFor(records)));}catch(e){warnings.push(`Raid history: ${e instanceof Error?e.message:'Unavailable'}. Saved attempts were kept.`);}
 if(raids)progress.raidHistory={data:raids,at:raidsFetchedAt||started};
 const profile:ApiProfile={character,actor,updatedAt:started,completedQuestCount:progress.quests.data?.completedCount||previous?.completedQuestCount||0,raidCount:new Set(raids?.map(r=>r.instanceId)).size,raids,raidsFetchedAt,warnings,progress};
 // Old requests cannot replace a newer character snapshot. Attempts only add positive evidence.
 await db().batch([db().prepare("INSERT INTO sync_snapshots(user_id,key,source,payload,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at WHERE json_extract(sync_snapshots.payload,'$.updatedAt')<=?").bind(user,key,'Blizzard API',JSON.stringify(profile),new Date(started).toISOString(),started),...recordStatements(user,updates)]);
 return {profile,warnings,attempts:updates.length};
}
export async function acquireSync(user:string,automatic=false){
 const now=Date.now(),previous=await snapshot<SyncRun>(user,'sync:run');
 if(automatic&&Math.max(previous?.lastSuccessAt||0,previous?.startedAt||0)>now-30*60000)return null;
 const run:SyncRun={runId:crypto.randomUUID(),startedAt:now,leaseExpiresAt:now+120000,status:'running',lastSuccessAt:previous?.lastSuccessAt,errors:[]};
 const row=await db().prepare("INSERT INTO sync_snapshots(user_id,key,source,payload,updated_at) VALUES(?,'sync:run','Blizzard API',?,?) ON CONFLICT(user_id,key) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at WHERE COALESCE(json_extract(sync_snapshots.payload,'$.leaseExpiresAt'),0)<? RETURNING key").bind(user,JSON.stringify(run),new Date(now).toISOString(),now).first();
 return row?run:null;
}
export async function finishSync(user:string,run:SyncRun,errors:string[]){
 const now=Date.now();const finished:SyncRun={...run,errors,status:errors.length?'partial':'complete',finishedAt:now,leaseExpiresAt:0,lastSuccessAt:errors.length?run.lastSuccessAt:now};
 await db().prepare("UPDATE sync_snapshots SET payload=?,updated_at=? WHERE user_id=? AND key='sync:run' AND json_extract(payload,'$.runId')=?").bind(JSON.stringify(finished),new Date(now).toISOString(),user,run.runId).run();return finished;
}
