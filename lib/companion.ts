import {parseAddon} from './sync';
import {db,snapshot,saveSnapshot,seal,unseal,sha256} from './server-sync';
import {importAddon,AddonImportError} from './import-addon';
import {claimCapture,finishCapture,retryCapture} from './sync-receipt';
export const COMPANION_SCOPE='__toybox_companion_v1__';
export type CompanionDevice={id:string;name:string;createdAt:number;lastSeenAt?:number;lastUploadAt?:number;status?:string;lastError?:string;revokedAt?:number;characters?:{name:string;realm:string;at:number}[];sync?:{version:1;runningVersion?:string;lastScanAt?:number;observations?:{guid:string;captureId?:string;capturedAt?:number;observedAt:number;fileWrittenAt?:number}[];reportError?:string}};
type DeviceSecret=CompanionDevice&{userId:string;tokenHash:string};
type Pair={id:string;name:string;challenge:string;createdAt:number;expiresAt:number;userId?:string;deviceId?:string;tokenHash?:string;encryptedToken?:string};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f-]{36}$/.test(v);
export class CompanionError extends Error{constructor(message:string,public status=400){super(message)}}
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
function publicDevice(d:DeviceSecret):CompanionDevice{const {userId,tokenHash,...view}=d;return view;}
export async function startPair(name:unknown,challenge:unknown){
 if(typeof name!=='string'||name.length>60||!name.trim()||typeof challenge!=='string'||!/^[a-f0-9]{64}$/.test(challenge))throw new CompanionError('Invalid companion pairing request.');
 const now=Date.now(),p:Pair={id:crypto.randomUUID(),name:name.replace(/[\x00-\x1f]/g,'').trim(),challenge,createdAt:now,expiresAt:now+10*60000};
 await saveSnapshot(COMPANION_SCOPE,`pair:${p.id}`,'Companion pairing',p);
 return {id:p.id,expiresAt:p.expiresAt};
}
async function pair(id:unknown){if(!uuid(id))throw new CompanionError('Invalid connection link.');const p=await snapshot<Pair>(COMPANION_SCOPE,`pair:${id}`);if(!p||p.expiresAt<=Date.now())throw new CompanionError('This connection link expired. Start pairing again.',410);return p;}
export async function pairPreview(id:unknown){const p=await pair(id);return {id:p.id,name:p.name,expiresAt:p.expiresAt,approved:!!p.userId};}
export async function approvePair(id:unknown,userId:string){
 const p=await pair(id);if(p.userId)throw new CompanionError('This connection has already been approved.',409);
 const raw=token(),tokenHash=await sha256(raw),device:DeviceSecret={id:crypto.randomUUID(),name:p.name,createdAt:Date.now(),userId,tokenHash,status:'Connecting'};
 const approved={...p,userId,deviceId:device.id,tokenHash,encryptedToken:await seal(raw,`companion-pair:${p.id}`)},now=new Date().toISOString();
 const results=await db().batch([
  db().prepare('UPDATE sync_snapshots SET payload=?,updated_at=? WHERE user_id=? AND key=? AND payload=?').bind(JSON.stringify(approved),now,COMPANION_SCOPE,`pair:${p.id}`,JSON.stringify(p)),
  db().prepare("INSERT INTO sync_snapshots(user_id,key,source,payload,updated_at) SELECT ?,?,'Companion authorization',?,? WHERE EXISTS(SELECT 1 FROM sync_snapshots WHERE user_id=? AND key=? AND json_extract(payload,'$.tokenHash')=?)").bind(COMPANION_SCOPE,`device:${tokenHash}`,JSON.stringify(device),now,COMPANION_SCOPE,`pair:${p.id}`,tokenHash),
  db().prepare("INSERT INTO sync_snapshots(user_id,key,source,payload,updated_at) SELECT ?,?,'Companion status',?,? WHERE EXISTS(SELECT 1 FROM sync_snapshots WHERE user_id=? AND key=? AND json_extract(payload,'$.tokenHash')=?)").bind(userId,`companion:device:${device.id}`,JSON.stringify(publicDevice(device)),now,COMPANION_SCOPE,`pair:${p.id}`,tokenHash),
 ]);
 if(!results[0].meta.changes)throw new CompanionError('This link was already used. Start pairing again.',409);
 return publicDevice(device);
}
export async function pollPair(id:unknown,secret:string){const p=await pair(id);if(!/^[a-f0-9]{64}$/.test(secret)||await sha256(secret)!==p.challenge)throw new CompanionError('Invalid pairing proof.',401);if(!p.userId)return {pending:true};if(!p.encryptedToken)throw new CompanionError('This connection was already claimed. Start pairing again.',410);return {pending:false,deviceId:p.deviceId,token:await unseal<string>(p.encryptedToken,`companion-pair:${p.id}`)};}
export async function authenticateDevice(raw:string){if(!/^[a-f0-9]{64}$/.test(raw))throw new CompanionError('Connect this companion to Toybox again.',401);const hash=await sha256(raw),d=await snapshot<DeviceSecret>(COMPANION_SCOPE,`device:${hash}`);if(!d||d.revokedAt)throw new CompanionError('This companion connection was revoked. Connect it again.',401);return d;}
async function saveDevice(d:DeviceSecret){await db().batch([
 db().prepare("UPDATE sync_snapshots SET payload=?,updated_at=? WHERE user_id=? AND key=? AND json_extract(payload,'$.revokedAt') IS NULL").bind(JSON.stringify(d),new Date().toISOString(),COMPANION_SCOPE,`device:${d.tokenHash}`),
 db().prepare("UPDATE sync_snapshots SET payload=?,updated_at=? WHERE user_id=? AND key=? AND json_extract(payload,'$.revokedAt') IS NULL").bind(JSON.stringify(publicDevice(d)),new Date().toISOString(),d.userId,`companion:device:${d.id}`),
]);}
export async function heartbeat(d:DeviceSecret,status:unknown,error:unknown,sync?:unknown){const states:Record<string,string>={watching:'Watching for saved game data',waiting:'Waiting for WoW to save a snapshot',retrying:'Retrying an upload','needs-connection':'Connection needs attention'};d.sync=parseCompanionSync(sync)||d.sync;d.lastSeenAt=Date.now();d.status=states[String(status)]||states.watching;d.lastError=typeof error==='string'?error.slice(0,240):undefined;await saveDevice(d);await db().prepare("UPDATE sync_snapshots SET payload=json_remove(payload,'$.encryptedToken') WHERE user_id=? AND key LIKE 'pair:%' AND json_extract(payload,'$.deviceId')=? AND json_extract(payload,'$.encryptedToken') IS NOT NULL").bind(COMPANION_SCOPE,d.id).run();return {ok:true};}
export async function uploadSnapshot(d:DeviceSecret,payload:unknown,disk?:unknown){
 parseAddon(payload);const claim=await claimCapture(d.userId,payload,disk);if(claim?.replayed){if(claim.receipt.status==='rejected')throw new CompanionError('This capture was rejected. Reload WoW to create a fresh snapshot.');return {ok:true,ignored:true,receipt:claim.receipt,receiptStatus:claim.receipt.status==='superseded'?'superseded':'already-present'};}
 let result;
 try{result=await importAddon(d.userId,payload);}catch(e){if(e instanceof AddonImportError&&e.code==='stale_snapshot'){const receipt=claim&&await finishCapture(d.userId,claim.receipt,'superseded');return {ok:true,ignored:true,reason:'A newer snapshot is already saved.',receipt,receiptStatus:'superseded'};}if(claim){if(e instanceof AddonImportError&&e.code!=='import_busy')await finishCapture(d.userId,claim.receipt,'rejected');else await retryCapture(d.userId,claim.receipt);}throw e;}
 const a=payload as {character:{name:string;realm:string};exportedAt:number};const at=a.exportedAt<1e12?a.exportedAt*1000:a.exportedAt;
 d.lastSeenAt=Date.now();d.lastUploadAt=d.lastSeenAt;d.status='Connected';d.lastError=undefined;d.characters=[...(d.characters||[]).filter(c=>c.name!==a.character.name||c.realm!==a.character.realm),{name:a.character.name,realm:a.character.realm,at}].slice(-100);await saveDevice(d);
 const receipt=claim&&await finishCapture(d.userId,claim.receipt,'accepted');return {...result,uploadedAt:d.lastUploadAt,receipt,receiptStatus:receipt?'accepted':undefined};
}
export function parseCompanionSync(value:unknown):CompanionDevice['sync']{
 const s=value as NonNullable<CompanionDevice['sync']>;if(!s||s.version!==1)return undefined;const now=Date.now();const time=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=now+300000?v:undefined;
 return {version:1,runningVersion:typeof s.runningVersion==='string'?s.runningVersion.slice(0,40):undefined,lastScanAt:time(s.lastScanAt),reportError:typeof s.reportError==='string'?s.reportError.slice(0,240):undefined,observations:(Array.isArray(s.observations)?s.observations:[]).slice(0,100).filter(r=>r&&/^Player-\d+-[\da-f]+$/i.test(r.guid)&&time(r.observedAt)).map(r=>({guid:r.guid,captureId:typeof r.captureId==='string'&&/^[\w:-]{1,240}$/.test(r.captureId)?r.captureId:undefined,capturedAt:time(r.capturedAt),observedAt:r.observedAt,fileWrittenAt:time(r.fileWrittenAt)}))};
}
export async function revokeDevice(id:unknown,userId:string){
 if(!uuid(id))throw new CompanionError('Invalid companion.');
 const stored=await db().prepare("SELECT key,payload FROM sync_snapshots WHERE user_id=? AND key LIKE 'device:%' AND json_extract(payload,'$.userId')=? AND json_extract(payload,'$.id')=?").bind(COMPANION_SCOPE,userId,id).first<{key:string;payload:string}>();
 if(!stored)throw new CompanionError('Companion not found.',404);const d:DeviceSecret={...JSON.parse(stored.payload),revokedAt:Date.now(),status:'Disconnected'};
 await saveSnapshot(COMPANION_SCOPE,stored.key,'Companion authorization',d);await saveSnapshot(userId,`companion:device:${id}`,'Companion status',publicDevice(d));return {ok:true};
}
