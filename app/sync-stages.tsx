'use client';
export type CaptureAck={id:string;guid:string;capturedAt:number;acceptedAt?:number;observedOnDiskAt?:number;status?:string};
export type SyncStagesData={capture?:{id:string;at:number};receipt?:CaptureAck;observed?:{captureId?:string;capturedAt?:number;observedAt:number;fileWrittenAt?:number};lastSeenAt?:number;runningVersion?:string;lastScanAt?:number;error?:string;reportError?:string;revoked?:boolean};
const date=(at?:number)=>at?new Date(at).toLocaleString():'Not reported';
export function syncStageMessage(value:SyncStagesData,now=Date.now()){
 if(value.revoked)return 'Reconnect this companion to resume uploads.';
 if(value.error)return value.error;
 if(!value.lastSeenAt||now-value.lastSeenAt>=180000)return 'The companion is offline or has not reported recently. Progress remains saved locally.';
 if(value.observed?.captureId&&value.receipt?.id!==value.observed.captureId)return 'The companion saw a saved capture that has not been acknowledged as the latest accepted progress.';
 if(value.receipt?.acceptedAt)return 'The displayed saved capture was accepted. WoW may hold newer progress that has not been saved yet.';
 return 'Waiting for an acknowledged capture. Use /reload or log out normally so WoW can save it.';
}
export default function SyncStages({value}:{value:SyncStagesData}){return <details className="sync-stages"><summary>Capture → saved file → Toybox</summary><p>{syncStageMessage(value)}</p><ol><li><strong>Captured in WoW</strong><span>{date(value.capture?.at?value.capture.at*1000:value.observed?.capturedAt||value.receipt?.capturedAt)}</span><small>This is the last reported capture; current unsaved progress is visible only in game.</small></li><li><strong>Observed on disk</strong><span>{date(value.observed?.observedAt||value.receipt?.observedOnDiskAt)}</span><small>{value.observed?.fileWrittenAt?`File write time: ${date(value.observed.fileWrittenAt)}. `:''}The companion waits for the saved file to settle.</small></li><li><strong>Accepted by Toybox</strong><span>{date(value.receipt?.acceptedAt)}</span><small>{value.receipt?.id?'Acknowledged capture: '+value.receipt.id:'No capture acknowledgment yet.'}</small></li></ol><p className="hint">Companion {value.runningVersion||'version unknown'} · last scan {date(value.lastScanAt)}. A heartbeat confirms the companion is running; it does not establish fresh game progress.</p>{value.reportError&&<p className="hint">Guide report upload needs attention: {value.reportError}. Progress uploads are tracked separately.</p>}</details>}
