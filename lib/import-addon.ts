import {updateGuideProfile} from './guide-profile';
import {addonCooldownUpdates} from './observed-progress';
import {capturedRaidClears,mergeRaidClears} from './activity-evidence';
import {archaeologyQuestIds} from './legion-archaeology';
import {DAY} from './planner';
import {relevantQuestIds} from './progression-content';
import {boundCharacter,characterScope} from './characters';
import {db,snapshot,saveSnapshot,readRecords,activitiesFor} from './server-sync';
import {parseAddon,mergeToys,ownedUpdates,addonAttemptUpdates,addonActor,type AddonSnapshot} from './sync';
import {settingsFrom} from './planner';
export class AddonImportError extends Error {constructor(message:string,public status=400,public code='invalid_snapshot'){super(message)}}
export async function importAddon(userId:string,payload:unknown,actor?:string){
 parseAddon(payload);
 const lease={id:crypto.randomUUID(),expiresAt:Date.now()+60000};
 const held=await db().prepare("INSERT INTO sync_snapshots(user_id,key,source,payload,updated_at) VALUES(?,'lease:addon-import','Import coordination',?,?) ON CONFLICT(user_id,key) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at WHERE CAST(json_extract(sync_snapshots.payload,'$.expiresAt') AS INTEGER)<? RETURNING key").bind(userId,JSON.stringify(lease),new Date().toISOString(),Date.now()).first();
 if(!held)throw new AddonImportError('Another game import is running. Try again in a moment.',409,'import_busy');
 try{return await applyAddon(userId,payload,actor)}finally{await db().prepare("DELETE FROM sync_snapshots WHERE user_id=? AND key='lease:addon-import' AND json_extract(payload,'$.id')=?").bind(userId,lease.id).run()}
}
async function applyAddon(userId:string,payload:unknown,actor?:string){
   const a=parseAddon(payload),key=`addon:${a.character.region}:${a.character.realm.toLowerCase()}:${a.character.name.toLowerCase()}`;
   const previous=await snapshot<AddonSnapshot>(userId,key);if(!a.toysComplete&&previous){a.toys=mergeToys([previous.toys,a.toys]);a.ownedToyIds=[...new Set([...previous.ownedToyIds,...a.ownedToyIds])];}if(previous&&(previous.exportedAt>a.exportedAt||previous.exportedAt===a.exportedAt&&previous.character.guid===a.character.guid&&(previous.capture?.sequence||0)>(a.capture?.sequence||0)))throw new AddonImportError("A newer export for this character is already saved. Export again in WoW.",409,"stale_snapshot");
   const records=await readRecords(userId),settings=settingsFrom(records),activities=activitiesFor(records);
   if(actor==="priest"||actor==="druid"){
    if(a.character.region!=="EU")throw new AddonImportError("This planner tracks EU characters. Keep your current names to import this collection.");
    if((actor==="priest"&&a.character.classFile!=="PRIEST")||(actor==="druid"&&a.character.classFile!=="DRUID"))throw new AddonImportError("The chosen planner character does not match the exported class.");
    settings[actor as "priest"|"druid"]=a.character.name;
    settings[actor==="priest"?"priestRealm":"druidRealm"]=a.character.realm;
   }
   if(a.character.region==="EU"&&a.exportedAt>=(settings.resetObservedAt||0)){
    if(a.weeklyResetAt)settings.weeklyAnchor=a.weeklyResetAt;
    if(a.dailyResetAt)settings.dailyAnchor=a.dailyResetAt;
    if(a.weeklyResetAt||a.dailyResetAt)settings.resetObservedAt=a.exportedAt;
   }
   const matched=addonActor(a,settings);if(matched&&a.game)a.binding=boundCharacter(settings,matched)||undefined;
   const sameEvidence=!!(previous?.binding&&a.binding&&previous.character.guid===a.character.guid&&characterScope(previous.binding)===characterScope(a.binding));
   const freshRecipes=a.game?.recipes.filter(r=>!sameEvidence||r.at>(previous?.game?.recipes.find(p=>p.spellId===r.spellId)?.at||0))||[];
   const cooldowns=previous?.exportedAt===a.exportedAt?[]:addonCooldownUpdates({...a,...(a.game?{game:{...a.game,recipes:freshRecipes}}:{})},records,settings);
   if(a.game){
    const old=sameEvidence?previous?.game:undefined;
    const merge=<T,>(before:T[],after:T[],key:(v:T)=>string)=>[...new Map([...before,...after].map(v=>[key(v),v])).values()];
    const permanent=new Set(relevantQuestIds().filter(id=>!archaeologyQuestIds.includes(id)));
    a.game.permanentQuestIds=[...new Set([...(old?.permanentQuestIds||[]).filter(id=>permanent.has(id)),...a.completedQuestIds.filter(id=>permanent.has(id))])];
    a.game.recipes=merge(old?.recipes||[],a.game.recipes,r=>String(r.spellId));
    a.game.instances=merge(old?.instances||[],a.game.instances,i=>`${i.instanceId}:${i.difficultyId}`);
    a.game.offeredQuests=merge(old?.offeredQuests||[],a.game.offeredQuests||[],q=>String(q.id));
    const before=mergeRaidClears(old?.raidClears,sameEvidence&&previous?capturedRaidClears(previous):[]);
    a.game.raidClears=mergeRaidClears(before,mergeRaidClears(a.game.raidClears,capturedRaidClears(a)));
    // Expired observations stay expired; a new upload never re-dates them.
    a.game.routes=merge(old?.routes||[],a.game.routes||[],r=>r.route).filter(r=>r.expiresAt>a.exportedAt);
    a.game.questTurnIns=merge(old?.questTurnIns||[],a.game.questTurnIns||[],q=>`${q.id}:${q.at}`).filter(q=>a.exportedAt-q.at<28*DAY).slice(-1000);
    a.game.questChecks=merge(old?.questChecks||[],a.game.questChecks||[],q=>String(q.id));
    if(!a.game.professions&&old?.professions)a.game.professions=old.professions;
    if(!a.game.archaeologyEndAt&&old?.archaeologyEndAt&&old.archaeologyEndAt>a.exportedAt)a.game.archaeologyEndAt=old.archaeologyEndAt;
   }
   if(a.guides)await updateGuideProfile(userId,a.guides.operations,a.guides);
   const updates=[...cooldowns,...ownedUpdates(a.toys,activities),...addonAttemptUpdates(a,records,settings,activities),...(a.game?.archaeologyEndAt?[{key:'routine-anchor:legion-archaeology',value:a.game.archaeologyEndAt-14*DAY}]:[]),{key:"settings",value:settings}];
   await saveSnapshot(userId,key,"WoW addon",a,updates);
   return {ok:true,toys:a.ownedToyIds.length,attempts:updates.filter(u=>u.key.startsWith("attempt2:")).length,character:a.character.name,evidenceMatched:!!a.binding,cooldownObservations:cooldowns.length};
}
