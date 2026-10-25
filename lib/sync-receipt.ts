import {db,snapshot,saveSnapshot,sha256} from './server-sync';
export type SnapshotReceipt={version:1;id:string;guid:string;capturedAt:number;sequence:number;observedOnDiskAt?:number;fileWrittenAt?:number;acceptedAt?:number;status:'processing'|'accepted'|'superseded'|'rejected';digest:string;attemptedAt:number};
export function captureIdentity(payload:unknown){const a=payload as {capture?:{version:number;id:string;at:number;sequence:number};character?:{guid?:string};exportedAt?:number};
 if(!a?.capture)return undefined;const r=a.capture;if(r.version!==1||typeof r.id!=='string'||!/^[\w:-]{1,240}$/.test(r.id)||!Number.isSafeInteger(r.sequence)||r.sequence<1||!Number.isSafeInteger(r.at)||r.at<1||r.at>Date.now()/1000+300||!a.character?.guid||r.id!==a.character.guid+':'+r.at+':'+r.sequence||Math.floor(Number(a.exportedAt)/(Number(a.exportedAt)>1e12?1000:1))!==r.at)throw Error('Invalid capture identity. Your previous progress was kept.');return {id:r.id,guid:a.character.guid,capturedAt:r.at*1000,sequence:r.sequence};
}
function canonical(value:unknown,depth=0):string{if(depth>64)throw Error('Capture nesting exceeds the supported format.');if(Array.isArray(value))return '['+value.map(v=>canonical(v,depth+1)).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k],depth+1)).join(',')+'}';return JSON.stringify(value)??'null';}
const key=(id:string)=>'capture-receipt:v1:'+id;
export async function claimCapture(userId:string,payload:unknown,disk?:unknown){
 const capture=captureIdentity(payload);if(!capture)return undefined;const digest=await sha256(canonical(payload)),at=Date.now(),observation=disk as {observedAt?:number;fileWrittenAt?:number;captureId?:string;guid?:string}|undefined;
 const valid=observation?.captureId===capture.id&&observation.guid===capture.guid&&typeof observation.observedAt==='number'&&observation.observedAt<=at+300000&&observation.observedAt>=capture.capturedAt;
 const receipt:SnapshotReceipt={version:1,...capture,digest,attemptedAt:at,status:'processing',...(valid?{observedOnDiskAt:observation!.observedAt,fileWrittenAt:typeof observation!.fileWrittenAt==='number'&&observation!.fileWrittenAt<=at+300000?observation!.fileWrittenAt:undefined}:{})};
 const inserted=await db().prepare('INSERT INTO sync_snapshots(user_id,key,source,payload,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,key) DO NOTHING').bind(userId,key(capture.id),'Snapshot receipt',JSON.stringify(receipt),new Date().toISOString()).run();
 if(inserted.meta.changes)return {receipt,replayed:false};
 const old=(await snapshot<SnapshotReceipt>(userId,key(capture.id)))!;if(old.digest!==digest)throw Error('This capture identity was reused for different data. Reload WoW to create a fresh capture.');
 if(old.status==='processing'){if(at-old.attemptedAt<300000)throw Error('This capture is still being processed. Retry shortly.');
  const changed=await db().prepare('UPDATE sync_snapshots SET payload=?,updated_at=? WHERE user_id=? AND key=? AND payload=?').bind(JSON.stringify(receipt),new Date().toISOString(),userId,key(capture.id),JSON.stringify(old)).run();if(!changed.meta.changes)throw Error('Capture changed concurrently. Retry shortly.');return {receipt,replayed:false};}
 return {receipt:old,replayed:true};
}
export async function finishCapture(userId:string,receipt:SnapshotReceipt,status:SnapshotReceipt['status']){
 const result={...receipt,status,...(status==='accepted'?{acceptedAt:Date.now()}:{})};await saveSnapshot(userId,key(receipt.id),'Snapshot receipt',result);
 if(status==='accepted'){
  await db().prepare('INSERT INTO sync_snapshots(user_id,key,source,payload,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at WHERE COALESCE(json_extract(sync_snapshots.payload,\'$.capturedAt\'),0)<? OR (json_extract(sync_snapshots.payload,\'$.capturedAt\')=? AND COALESCE(json_extract(sync_snapshots.payload,\'$.sequence\'),0)<=?)').bind(userId,'capture-latest:v1:'+receipt.guid,'Snapshot receipt',JSON.stringify(result),new Date().toISOString(),receipt.capturedAt,receipt.capturedAt,receipt.sequence).run();
 }return result;
}
export async function captureAcknowledgements(userId:string){const rows=await db().prepare("SELECT payload FROM sync_snapshots WHERE user_id=? AND key LIKE 'capture-latest:v1:%'").bind(userId).all<{payload:string}>();return Object.fromEntries(rows.results.slice(0,100).map(r=>{const v=JSON.parse(r.payload) as SnapshotReceipt;return [v.guid,{id:v.id,guid:v.guid,capturedAt:v.capturedAt,sequence:v.sequence,observedOnDiskAt:v.observedOnDiskAt,acceptedAt:v.acceptedAt,status:v.status}];}));}

export async function retryCapture(userId:string,receipt:SnapshotReceipt){await db().prepare("DELETE FROM sync_snapshots WHERE user_id=? AND key=? AND payload=?").bind(userId,key(receipt.id),JSON.stringify(receipt)).run();}
