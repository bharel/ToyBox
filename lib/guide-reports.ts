import {db} from './server-sync';
export type GuideReport={version:1;id:string;revision?:number;profile?:string;guideId:string;stepId:string;createdAt:number;addonVersion:string;contentVersion:string;character:{guid:string;name:string;realm:string;region:string};note?:string;status?:'open'|'resolved'|'ignored';deleted?:boolean;context:Record<string,unknown>};
const idPattern=/^[\w:-]{1,240}$/,stepPattern=/^[\w:.-]{1,240}$/;
const contextKeys=new Set(['instruction','questId','quest','questFlag','turnIn','requirements','destination','dailyResetAt','weeklyResetAt','navigation','session','build','sources','recipe','reputation','currency']);
function safe(value:unknown,depth=0):unknown{
 if(depth>6)return undefined;if(value===null||typeof value==='boolean')return value;if(typeof value==='number')return Number.isFinite(value)?value:undefined;if(typeof value==='string')return value.slice(0,2000);
 if(Array.isArray(value))return value.slice(0,40).map(v=>safe(v,depth+1));if(value&&typeof value==='object'){const out:Record<string,unknown>={};for(const [k,v] of Object.entries(value).slice(0,60))if(!/token|password|secret|credential|chat|inventory|account/i.test(k))out[k]=safe(v,depth+1);return out;}return undefined;
}
export function parseGuideReport(value:unknown):GuideReport{
 const r=value as GuideReport,c=r?.character;
 if(!r||r.version!==1||typeof r.id!=='string'||!idPattern.test(r.id)||typeof r.guideId!=='string'||!stepPattern.test(r.guideId)||typeof r.stepId!=='string'||!stepPattern.test(r.stepId)||!Number.isSafeInteger(r.createdAt)||r.createdAt<1||r.createdAt>Math.floor(Date.now()/1000)+300||!c||typeof c.guid!=='string'||!/^Player-\d+-[\da-f]+$/i.test(c.guid)||![c.name,c.realm,c.region].every(x=>typeof x==='string'&&x.length>0&&x.length<=100)||typeof r.addonVersion!=='string'||typeof r.contentVersion!=='string'||r.profile!==undefined&&(typeof r.profile!=='string'||r.profile.length>150)||r.note!==undefined&&(typeof r.note!=='string'||r.note.length>2000)||!r.context||typeof r.context!=='object'||Array.isArray(r.context))throw Error('Invalid guide report. The previous reports were kept.');
 if(JSON.stringify(r).length>64000)throw Error('Guide report exceeds 64 KB.');
 const context=Object.fromEntries(Object.entries(r.context).filter(([k])=>contextKeys.has(k)).map(([k,v])=>[k,safe(v)]));
 if(r.revision!==undefined&&(!Number.isSafeInteger(r.revision)||r.revision<1))throw Error('Invalid report revision.');
 return {version:1,id:r.id,revision:r.revision||1,...(r.profile?{profile:r.profile}:{}),guideId:r.guideId,stepId:r.stepId,createdAt:r.createdAt,addonVersion:r.addonVersion.slice(0,40),contentVersion:r.contentVersion.slice(0,40),character:{guid:c.guid,name:c.name,realm:c.realm,region:c.region},...(r.note!==undefined?{note:r.note}:{}),status:'open',context};
}
const key=(id:string)=>'guide-report:v1:'+id;
export async function uploadGuideReports(userId:string,values:unknown,profile?:string){
 if(!Array.isArray(values)||values.length>20)throw Error('Upload at most twenty reports at once.');
 const reports=values.map(parseGuideReport);if(reports.some(r=>r.profile&&r.profile!==profile))throw Error('Reports belong to a different profile.');
 for(const report of reports){
  // A tombstone is retained so an offline retry cannot recreate a deleted report.
  await db().prepare('INSERT INTO sync_snapshots(user_id,key,source,payload,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,key) DO NOTHING').bind(userId,key(report.id),'Guide issue report',JSON.stringify(report),new Date().toISOString()).run();
  if(report.revision!>1)await changeGuideReport(userId,report.id,{note:report.note||'',revision:report.revision});
 }
 return {version:1,ack:reports.map(r=>r.id)};
}
export async function guideReports(userId:string){const rows=await db().prepare("SELECT payload FROM sync_snapshots WHERE user_id=? AND key LIKE 'guide-report:v1:%'").bind(userId).all<{payload:string}>();return rows.results.map(r=>JSON.parse(r.payload) as GuideReport).filter(r=>!r.deleted).sort((a,b)=>b.createdAt-a.createdAt);}
export async function changeGuideReport(userId:string,id:string,change:{status?:GuideReport['status'];note?:string;deleted?:boolean;revision?:number}){
 if(typeof id!=='string'||!idPattern.test(id)||change.status!==undefined&&!['open','resolved','ignored'].includes(change.status)||change.note!==undefined&&(typeof change.note!=='string'||change.note.length>2000)||change.revision!==undefined&&(!Number.isSafeInteger(change.revision)||change.revision<1))throw Error('Invalid report change.');
 for(let attempt=0;attempt<5;attempt++){
  const row=await db().prepare('SELECT payload FROM sync_snapshots WHERE user_id=? AND key=?').bind(userId,key(id)).first<{payload:string}>();if(!row){if(change.deleted){await db().prepare('INSERT INTO sync_snapshots(user_id,key,source,payload,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,key) DO NOTHING').bind(userId,key(id),'Guide issue report',JSON.stringify({version:1,id,revision:change.revision||1,deleted:true}),new Date().toISOString()).run();return {ok:true};}throw Error('Report not found.');}
  const old=JSON.parse(row.payload) as GuideReport;
  if(change.revision!==undefined&&(!Number.isSafeInteger(change.revision)||change.revision<1))throw Error('Invalid report revision.');
  if(change.revision!==undefined&&change.revision<=(old.revision||1))return {ok:true};
  if(old.deleted&&change.revision===undefined)return {ok:true};
  const next=old.deleted||change.deleted?{version:1,id,revision:change.revision||old.revision||1,deleted:true,createdAt:old.createdAt}:{...old,...change};
  const result=await db().prepare('UPDATE sync_snapshots SET payload=?,updated_at=? WHERE user_id=? AND key=? AND payload=?').bind(JSON.stringify(next),new Date().toISOString(),userId,key(id),row.payload).run();if(result.meta.changes)return {ok:true};
 }throw Error('Report changed concurrently; please retry.');
}
