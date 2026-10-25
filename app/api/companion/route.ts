import {guideProfile} from '../../../lib/guide-profile';
import {uploadGuideReports,changeGuideReport} from '../../../lib/guide-reports';
import {getChatGPTUser} from '../../chatgpt-auth';
import {json,checkOrigin} from '../../../lib/server-sync';
import {startPair,pairPreview,approvePair,pollPair,authenticateDevice,heartbeat,uploadSnapshot,revokeDevice,CompanionError} from '../../../lib/companion';
import {AddonImportError} from '../../../lib/import-addon';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const id=new URL(request.url).searchParams.get('pair');const proof=request.headers.get('X-Toybox-Pairing');if(proof)return json(await pollPair(id,proof));const user=await getChatGPTUser();if(!user)return json({error:'Sign in to connect your companion.'},401);return json(await pairPreview(id));}catch(e){return failure(e)}}
export async function POST(request:Request){try{
 checkOrigin(request);const text=await request.text();if(text.length>2600000)return json({error:'Snapshot exceeds 2.5 MB.'},413);const body=JSON.parse(text);
 if(body.action==='start')return json(await startPair(body.name,body.challenge));
 if(body.action==='approve'||body.action==='revoke'){const user=await getChatGPTUser();if(!user)return json({error:'Sign in to connect your companion.'},401);return json(body.action==='approve'?await approvePair(body.id,user.userId):await revokeDevice(body.id,user.userId));}
 const raw=request.headers.get('Authorization')?.replace(/^Bearer /,'')||'';const device=await authenticateDevice(raw);
 if(body.action==='guide-profile')return json(await guideProfile(device.userId,Array.isArray(body.capabilities)?body.capabilities:[],body.reportIds));
 if(body.action==='guide-reports'){const profile=await guideProfile(device.userId);return json(await uploadGuideReports(device.userId,body.reports,profile.profile));}
 if(body.action==='guide-report-change')return json(await changeGuideReport(device.userId,body.id,{revision:body.revision,...(body.deleted?{deleted:true}:{}),...(body.note!==undefined?{note:body.note}:{})}));
 if(body.action==='heartbeat')return json(await heartbeat(device,body.status,body.error,body.sync));
 if(body.action==='upload')return json(await uploadSnapshot(device,body.snapshot,body.disk));
 return json({error:'Unsupported companion request.'},400);
 }catch(e){return failure(e)}}
function failure(e:unknown){return json({error:e instanceof Error?e.message:'Companion request failed.'},e instanceof CompanionError||e instanceof AddonImportError?e.status:400)}
