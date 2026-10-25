import {snapshots,readRecords} from './server-sync';
import {guideProfile} from './guide-profile';
import {sessionChecklist,toyGoals,allocateResources,type GuideDefinition,type SessionState} from './daily-session';
import type {GuideObservations} from './walkthrough';
import {recoveryView,leavingFindings,goalForecast} from './helpful-guidance';
import type {YieldRule} from './forecast';
import reliability from './data/reliability-runtime.json';
import data from './data/walkthrough-runtime.json';
export async function savedSession(userId:string,guid?:string){
 if(guid&&!/^Player-\d+-[\da-f]+$/i.test(guid))throw Error('Invalid character GUID.');
 const [snapshotsList,records,profile]=await Promise.all([snapshots(userId),readRecords(userId),guideProfile(userId)]);
 const roster=snapshotsList.filter(r=>r.key.startsWith('addon:')&&r.payload.guides?.observed?.timeUnit==='unix-seconds').sort((a,b)=>Number(b.payload.exportedAt)-Number(a.payload.exportedAt));
 const selected=guid?roster.find(r=>r.payload.character.guid===guid):roster.find(r=>r.payload.character.classFile==='PRIEST')||roster[0];
 if(!selected)return {version:1,character:null,checklist:[],goals:[],alts:{ready:[],unknown:[]},summary:{state:'nothing-ready',completed:0,deferred:0,unknown:0,remaining:0},observationStatus:'Open Toybox in WoW and reload to share your first session.'};
 const a=selected.payload,raw=a.guides.observed;raw.at=raw.at||a.guides.roster?.at||Math.floor(a.exportedAt/(a.exportedAt>1e12?1000:1));
 const state:GuideObservations={...raw,flags:raw.questFlags,guid:a.character.guid,region:a.character.region,class:a.character.classFile,skipped:a.guides.session?.skipped||raw.session?.skipped};
 const owned=new Set<number>(Object.entries(records).filter(([k,v])=>/^owned:item-\d+$/.test(k)&&v===true).map(([k])=>Number(k.slice(11))));
 for(const toy of a.toys||[])if(toy.itemId)owned.add(toy.itemId);
 const context={now:Math.floor(Date.now()/1000),owned,characters:roster.map(r=>({...r.payload.guides.observed,flags:r.payload.guides.observed.questFlags,guid:r.payload.character.guid,region:r.payload.character.region})) as GuideObservations[]},all=Object.values(data) as unknown as GuideDefinition[],session=(a.guides.session||raw.session) as SessionState|undefined;
 const ids=new Set(session?.guides||[]);for(const g of all)if(profile.values['follow:'+g.id]===true)ids.add(g.id);
 const selectedGuides=all.filter(g=>ids.has(g.id)&&profile.values['exclude:'+g.id]!==true&&(!g.engineering||profile.values['engineering:'+a.character.guid]===true));const checklist=sessionChecklist(selectedGuides,state,context,session);
 const summary={state:'planned-progress-finished',completed:checklist.filter(r=>r.state==='completed').length,deferred:checklist.filter(r=>r.state==='deferred').length,unknown:checklist.filter(r=>['unknown','cooling-down'].includes(r.state)).length,remaining:checklist.filter(r=>r.available).length};
 summary.state=summary.remaining?'active':summary.unknown||!checklist.length?'nothing-ready':'planned-progress-finished';
 const alts={ready:[] as object[],unknown:[] as object[]};
 const altGuides=all.filter(g=>selectedGuides.includes(g)||!g.aliasOf&&((g as GuideDefinition&{raid?:unknown}).raid||g.validation?.sourceChecked&&(g.requirements?.classId===11||(g.requirements?.classIds as number[]|undefined)?.includes(11))));
 for(const alternate of roster)if(alternate.payload.character.guid!==a.character.guid){const b=alternate.payload,bRaw=b.guides.observed;bRaw.at=bRaw.at||b.guides.roster?.at||Math.floor(b.exportedAt/(b.exportedAt>1e12?1000:1));const s:GuideObservations={...bRaw,flags:bRaw.questFlags,guid:b.character.guid,region:b.character.region,class:b.character.classFile,skipped:b.guides.session?.skipped||bRaw.session?.skipped};if(s.region!==state.region)continue;
  for(const op of sessionChecklist(altGuides.filter(g=>!g.engineering||profile.values['engineering:'+b.character.guid]===true),s,context,b.guides.session||bRaw.session))if(op.available){const row={...op,character:b.character,at:bRaw.at,reason:'An additional opportunity supported by this character’s saved observations; recheck at login.'};(bRaw.at&&context.now-bRaw.at<=300?alts.ready:alts.unknown).push(row);}
 }
 const selectedGuide=all.find(g=>g.id===raw.walkthrough?.selected),goals=toyGoals(all,state,context,profile.values),allocations=allocateResources(selectedGuides,state,context);
 for(const goal of goals)for(const route of goal.routes){const g=all.find(g=>g.id===route.guideId);if(g)Object.assign(route,{forecast:goalForecast(g,state,context,reliability.yields as YieldRule[],allocations[g.id]?allocations:undefined)});}
 const receipt=snapshotsList.find(r=>r.key==='capture-latest:v1:'+a.character.guid)?.payload,device=snapshotsList.filter(r=>r.key.startsWith('companion:device:')).map(r=>r.payload).sort((a,b)=>(b.lastSeenAt||0)-(a.lastSeenAt||0))[0];
 const sync={capture:a.capture,receipt:receipt&&{id:receipt.id,guid:receipt.guid,capturedAt:receipt.capturedAt,acceptedAt:receipt.acceptedAt,observedOnDiskAt:receipt.observedOnDiskAt,status:receipt.status},observed:device?.sync?.observations?.find((o:{guid:string})=>o.guid===a.character.guid),lastSeenAt:device?.lastSeenAt,runningVersion:device?.sync?.runningVersion,lastScanAt:device?.sync?.lastScanAt,error:device?.lastError,reportError:device?.sync?.reportError,revoked:!!device?.revokedAt};
 const savedNearby=(Array.isArray(a.guides.guidance?.nearby)?a.guides.guidance.nearby:[]).filter((row:{guideId?:string})=>all.some(g=>g.id===row?.guideId&&g.validation?.sourceChecked)).slice(0,10).map((row:{guideId:string;evidenceAt?:number;expiresAt?:number})=>({...row,saved:true,state:row.evidenceAt&&row.evidenceAt<=context.now&&context.now-row.evidenceAt<=300&&(!row.expiresAt||row.expiresAt>context.now)?'observed':'needs-checking'}));
 return {recovery:recoveryView(selectedGuide,state,context,session),leaveFindings:leavingFindings(selectedGuides,state,context,session,raw.walkthrough?.selected),nearby:savedNearby,sync,version:1,character:a.character,observedAt:raw.at,nextResetAt:state.dailyResetAt&&state.dailyResetAt>context.now?state.dailyResetAt:undefined,observationStatus:'Saved addon observations. Live steps update inside WoW; expired evidence is rechecked.',checklist,summary,session,goals,allocations,alts};
}
