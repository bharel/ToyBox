import {db,snapshot,snapshots,readRecords} from './server-sync';
import {settingsFrom} from './planner';
import {boundCharacter,characterScope,normalized} from './characters';
import pack from './data/guide-library.json';
const engineeringPresets=new Set(['jard','engineering-secrets','gearspring','invent']);
import {captureAcknowledgements} from './sync-receipt';
import {validGuideIntent,type GuideOperation,type GuideProfile,type GuideSnapshot} from './guide-profile-data';
const key='guides:profile:v1';
async function storedGuideProfile(userId:string):Promise<GuideProfile>{
 const old=await snapshot<GuideProfile>(userId,key);if(old)return old;
 const value:GuideProfile={version:1,profile:crypto.randomUUID(),revision:0,values:{budget:30},ack:[],roster:[]};
 const records=await readRecords(userId),settings=settingsFrom(records),oldSnapshots=await snapshots(userId);
 const budget=records['plan-prefs:today'] as {minutes?:number}|undefined;if(budget?.minutes&&validGuideIntent('budget',budget.minutes))value.values.budget=budget.minutes;
 for(const [key,pinned] of Object.entries(records))if(key.startsWith('pin:')&&pinned===true)for(const guide of pack.guides)if(guide.id===key.slice(4)||guide.id.startsWith(key.slice(4)+'--'))value.values['follow:'+guide.id]=true;
 for(const row of oldSnapshots.filter(s=>s.key.startsWith('addon:'))){
  const a=row.payload,c=a.character;
  if(!c||typeof c.guid!=='string'||!/^Player-[0-9]+-[0-9A-Fa-f]+$/.test(c.guid)||!c.name||!c.realm||!c.region||!c.classFile)continue;
  value.roster.push({guid:c.guid,name:c.name,realm:c.realm,region:c.region,classFile:c.classFile,at:a.exportedAt});
  for(const actor of ['priest','druid']){const ref=boundCharacter(settings,actor);if(ref&&a.binding&&characterScope(a.binding)===characterScope(ref)&&ref.region===c.region&&normalized(ref.name)===normalized(c.name)&&normalized(ref.realm)===normalized(c.realm)){
   const scope=characterScope(ref);if(Object.entries(records).some(([key,enabled])=>key.startsWith('profession-enabled2:')&&engineeringPresets.has(key.split(':')[1])&&key.endsWith(':'+scope)&&enabled===true))value.values['engineering:'+c.guid]=true;
  }}
 }
 value.roster=[...new Map(value.roster.map(c=>[c.guid,c])).values()].slice(-100);
 await db().prepare('INSERT INTO sync_snapshots(user_id,key,source,payload,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,key) DO NOTHING').bind(userId,key,'Guide preferences',JSON.stringify(value),new Date().toISOString()).run();
 return (await snapshot<GuideProfile>(userId,key))!;
}
export async function guideProfile(userId:string,capabilities?:string[],reportIds?:string[]):Promise<GuideProfile>{
 const value=structuredClone(await storedGuideProfile(userId));
 if(capabilities){
  const session=capabilities.includes('session-v1');
  if(!session)for(const k of Object.keys(value.values))if(k==='checklistExpanded'||k.startsWith('followToy:'))delete value.values[k];
  if(!capabilities.includes('guidance-v1'))for(const k of Object.keys(value.values))if(/^(travelMode|noTravelItem|noTravelSpell):/.test(k))delete value.values[k];
  value.capabilities=capabilities.filter(v=>['session-v1','reports-v1','guidance-v1','sync-receipts-v1'].includes(v));
  if(capabilities.includes('sync-receipts-v1'))value.captureAck=await captureAcknowledgements(userId);
  if(capabilities.includes('reports-v1')){value.reportAck={};for(const id of (Array.isArray(reportIds)?reportIds:[]).slice(0,20))if(typeof id==='string'&&/^[\w:-]{1,240}$/.test(id)){const row=await snapshot<{revision?:number}>(userId,'guide-report:v1:'+id);if(row)value.reportAck[id]=row.revision||1;}}
 }
 return value;
}
export async function updateGuideProfile(userId:string,operations:GuideOperation[],guide?:GuideSnapshot){
 if(!Array.isArray(operations)||operations.length>2000||!operations.every(o=>o&&typeof o.id==='string'&&o.id.length<=240&&/^[\w:-]+$/.test(o.id)&&typeof o.key==='string'&&validGuideIntent(o.key,o.value)))throw Error('Invalid guide preferences.');
 for(let retry=0;retry<5;retry++){
  const current=await guideProfile(userId);
  if(guide?.profile&&guide.profile!==current.profile)throw Error('This addon belongs to a different connected profile.');
  const next:GuideProfile=structuredClone(current),seen=new Set(current.ack);
  let changed=false;
  for(const op of operations)if(!seen.has(op.id)){next.values[op.key]=op.value;seen.add(op.id);next.ack.push(op.id);changed=true;}
  if(guide&&JSON.stringify(next.roster.find(r=>r.guid===guide.roster.guid))!==JSON.stringify(guide.roster)){next.roster=[...next.roster.filter(r=>r.guid!==guide.roster.guid),guide.roster].slice(-100);changed=true;}
  if(!changed)return current;
  // Keep acknowledgement history, rather than reapplying an old offline edit.
  if(next.ack.length>100000)throw Error('Guide history needs compaction before accepting more changes.');
  next.revision++;
  const result=await db().prepare('UPDATE sync_snapshots SET payload=?,updated_at=? WHERE user_id=? AND key=? AND payload=?').bind(JSON.stringify(next),new Date().toISOString(),userId,key,JSON.stringify(current)).run();
  if(result.meta.changes)return next;
 }
 throw Error('Guide preferences changed concurrently. Please retry.');
}
