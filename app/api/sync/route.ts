import {claimCapture,finishCapture,retryCapture} from '../../../lib/sync-receipt';
import {importAddon,AddonImportError} from '../../../lib/import-addon';
import {observedProgress,addonCooldownUpdates} from '../../../lib/observed-progress';
import {relevantQuestIds} from '../../../lib/progression-content';
import {boundCharacter,characterScope} from '../../../lib/characters';
import {professionCooldownView} from '../../../lib/profession-cooldowns';
import {readCatalogue} from '../../../lib/server-catalogue';
import {catalogueView} from '../../../lib/toy-catalogue';
import {env} from "cloudflare:workers";
import {getChatGPTUser} from "../../chatgpt-auth";
import {json,secret,snapshots,snapshot,saveSnapshot,checkOrigin,readRecords,activitiesFor,REDIRECT_URI,type Access} from "../../../lib/server-sync";
import {parseAddon,mergeToys,ownedUpdates,addonAttemptUpdates,addonActor,type AddonSnapshot,type ApiCollection} from "../../../lib/sync";
import {eligibilityView} from "../../../lib/eligibility-view";
import {settingsFrom} from "../../../lib/planner";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const user=await getChatGPTUser();if(!user)return json({error:"Sign in with ChatGPT to connect your account."},401);
 try{
  const data=await snapshots(user.userId);
  if(new URL(request.url).searchParams.get("export")==="1")return json({format:"toybox-sync-backup-v2",snapshots:data.filter(s=>!s.key.startsWith("companion:")&&!s.key.startsWith("lease:")).map(s=>({key:s.key,source:s.source,payload:s.payload}))});
  const collection=data.find(d=>d.key==="blizzard:toys")?.payload as ApiCollection|undefined;
  const addons=data.filter(d=>d.key.startsWith("addon:")).map(d=>d.payload as AddonSnapshot);
  const records=await readRecords(user.userId),activities=activitiesFor(records),settings=settingsFrom(records);
  const profiles=data.filter(d=>d.key.startsWith("profile:")).map(d=>d.payload),progress=observedProgress(profiles,addons,settings);
  const questIds=new Set(activities.map(a=>a.questId).filter(Boolean));
  const toys=mergeToys([collection?.toys||[],...addons.map(a=>a.toys)]);
  const catalogue=await readCatalogue(),catalogueInfo=catalogueView(records,toys,catalogue||undefined,Date.now(),activities,progress);
  const config=await secret(user.userId,"config"),access=await secret<Access>(user.userId,"access");
  return json({captureReceipts:Object.fromEntries(data.filter(d=>d.key.startsWith('capture-latest:v1:')).map(d=>[d.payload.guid,{id:d.payload.id,guid:d.payload.guid,capturedAt:d.payload.capturedAt,observedOnDiskAt:d.payload.observedOnDiskAt,acceptedAt:d.payload.acceptedAt,status:d.payload.status}])),configured:!!config,connected:!!access&&access.expiresAt>Date.now(),expiresAt:access?.expiresAt,redirectUri:REDIRECT_URI,encryptionReady:!!env.BLIZZARD_TOKEN_KEY,catalogue,...(new URL(request.url).searchParams.get("catalogue")==="1"?{catalogueEntries:catalogueInfo.entries}:{}),catalogueCounts:catalogueInfo.counts,catalogueCoverage:catalogueInfo.coverage,toys,pendingMetadata:collection?.toys.filter(t=>!t.itemId).length||0,collectionSyncedAt:Math.max(collection?.exportedAt||0,...addons.map(a=>a.exportedAt)),characters:data.find(d=>d.key==="blizzard:characters")?.payload.characters||[],addonCharacters:addons.map(a=>({...a,completedQuestIds:a.completedQuestIds.filter(id=>questIds.has(id)),completedQuestCount:a.completedQuestIds.length})),profiles,progress,companion:{devices:data.filter(d=>d.key.startsWith("companion:device:")).map(d=>d.payload)},professionCooldowns:professionCooldownView(records,settings,progress,Date.now()),eligibility:eligibilityView(activities,records,settings,progress,Date.now()),syncRun:data.find(d=>d.key==="sync:run")?.payload});
 }catch{return json({error:"Connection data could not be loaded. Your planner progress is safe."},503)}
}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return json({error:"Sign in with ChatGPT before importing."},401);
 try{
  checkOrigin(request);const text=await request.text();if(text.length>2500000)return json({error:"The export exceeds 2.5 MB."},413);const body=JSON.parse(text);
  if(body.action==="addon"){
   parseAddon(body.payload);const claim=await claimCapture(user.userId,body.payload);
   if(claim?.receipt.status==='rejected')throw Error('This capture was rejected. Reload WoW to create a fresh snapshot.');
   if(claim?.replayed)return json({ok:true,ignored:true,receiptStatus:claim.receipt.status==='superseded'?'superseded':'already-present'});
   try{const result=await importAddon(user.userId,body.payload,body.actor);if(claim)await finishCapture(user.userId,claim.receipt,'accepted');return json(result);}catch(e){if(claim){if(e instanceof AddonImportError&&e.code==='stale_snapshot')await finishCapture(user.userId,claim.receipt,'superseded');else await retryCapture(user.userId,claim.receipt);}throw e;}
  }
  return json({error:"Unsupported import format. Use the Toybox addon export."},400);
 }catch(e){return json({error:e instanceof Error?e.message:"The addon export could not be imported."},e instanceof AddonImportError?e.status:400)}
}
