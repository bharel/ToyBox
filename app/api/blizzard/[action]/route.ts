import {observedProgress} from '../../../../lib/observed-progress';
import {professionCooldownView} from '../../../../lib/profession-cooldowns';
import {refreshCatalogue} from '../../../../lib/server-catalogue';
import {getChatGPTUser} from "../../../chatgpt-auth";
import {db,json,secret,saveSecret,tokenRequest,checkOrigin,REDIRECT_URI,SITE_ORIGIN,sha256,profileToken,blizzardGet,saveSnapshot,saveToys,snapshot,hydrateToys,type ClientConfig,type Access} from "../../../../lib/server-sync";
import {readRecords,activitiesFor,snapshots} from "../../../../lib/server-sync";
import {settingsFrom} from "../../../../lib/planner";
import {blizzardActor} from "../../../../lib/raid-history";
import {bindFromRoster,characterRef,syncCharacter,acquireSync,finishSync} from "../../../../lib/server-progress";
import {eligibilityView} from "../../../../lib/eligibility-view";
import type {CharacterProgress} from "../../../../lib/progression";
import type {Actor} from "../../../../lib/characters";
import type {ApiCollection,Character,SyncedToy,AddonSnapshot} from "../../../../lib/sync";
export const dynamic="force-dynamic";
type Context={params:Promise<{action:string}>};
const back=(status:string)=>Response.redirect(SITE_ORIGIN+"/?blizzard="+status,302);
export async function GET(request:Request,context:Context){
 const user=await getChatGPTUser();if(!user)return json({error:"Sign in with ChatGPT first."},401);
 const {action}=await context.params;
 try{
  if(action==="connect"){
   const config=await secret<ClientConfig>(user.userId,"config");if(!config)return back("setup");
   const state=[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,"0")).join("");
   await db().prepare("DELETE FROM oauth_states WHERE user_id=? OR expires_at<?").bind(user.userId,new Date().toISOString()).run();
   await db().prepare("INSERT INTO oauth_states(hash,user_id,expires_at) VALUES(?,?,?)").bind(await sha256(state),user.userId,new Date(Date.now()+600000).toISOString()).run();
   const url=new URL("https://oauth.battle.net/authorize");url.searchParams.set("client_id",config.clientId);url.searchParams.set("redirect_uri",REDIRECT_URI);url.searchParams.set("response_type","code");url.searchParams.set("scope","wow.profile");url.searchParams.set("state",state);
   return Response.redirect(url.toString(),302);
  }
  if(action==="callback"){
   const url=new URL(request.url),state=url.searchParams.get("state");if(!state||!/^[a-f0-9]{64}$/.test(state))return back("state-error");
   const entry=await db().prepare("DELETE FROM oauth_states WHERE hash=? AND user_id=? AND expires_at>? RETURNING hash").bind(await sha256(state),user.userId,new Date().toISOString()).first();
   if(!entry)return back("state-error");if(url.searchParams.has("error"))return back("denied");
   const code=url.searchParams.get("code");if(!code||code.length>2000)return back("failed");
   const config=await secret<ClientConfig>(user.userId,"config");if(!config)return back("setup");
   const access=await tokenRequest(config,new URLSearchParams({grant_type:"authorization_code",code,redirect_uri:REDIRECT_URI}));
   await saveSecret(user.userId,"access",access);return back("connected");
  }
  return json({error:"Unknown connection action."},404);
 }catch{return action==="callback"?back("failed"):json({error:"The Blizzard connection could not be started. Check setup and try again."},400)}
}
export async function POST(request:Request,context:Context){
 const user=await getChatGPTUser();if(!user)return json({error:"Sign in with ChatGPT first."},401);
 try{
  checkOrigin(request);const {action}=await context.params;const raw=await request.text();if(raw.length>10000)return json({error:"Request is too large."},413);const body=raw?JSON.parse(raw):{};
  if(action==="configure"){
   if(typeof body.clientId!=="string"||typeof body.clientSecret!=="string"||!/^[a-zA-Z0-9_-]{12,200}$/.test(body.clientId)||!/^[a-zA-Z0-9_-]{12,200}$/.test(body.clientSecret))return json({error:"Enter the client ID and client secret from your Battle.net developer app."},400);
   const config={clientId:body.clientId,clientSecret:body.clientSecret};await tokenRequest(config,new URLSearchParams({grant_type:"client_credentials"}));
   await saveSecret(user.userId,"config",config);await db().prepare("DELETE FROM integration_secrets WHERE user_id=? AND name='access'").bind(user.userId).run();return json({ok:true});
  }
  if(action==="disconnect"){
   await db().prepare("DELETE FROM integration_secrets WHERE user_id=? AND name='access'").bind(user.userId).run();await db().prepare("DELETE FROM oauth_states WHERE user_id=?").bind(user.userId).run();return json({ok:true});
  }
  if(action==="catalogue"){return json({ok:true,catalogue:await refreshCatalogue(await profileToken(user.userId))});}
  if(action==="sync"){
   const token=await profileToken(user.userId);
   if(body.phase==="metadata")return json(await hydrateToys(user.userId,token));
   const data=await blizzardGet("/profile/user/wow/collections/toys",token);
   if(!Array.isArray(data.toys))throw Error("Blizzard did not return a valid toy collection. Your saved collection was kept.");
   const refs:SyncedToy[]=data.toys.map((r:any)=>({toyId:Number(r.toy?.id),name:String(r.toy?.name||"Unknown toy")})).filter((t:SyncedToy)=>Number.isInteger(t.toyId)&&Number(t.toyId)>0);
   if(data.toys.length&&refs.length!==data.toys.length)throw Error("Blizzard returned an unexpected toy format. Your saved collection was kept.");
   const collection:ApiCollection={format:"blizzard-toys-v1",exportedAt:Date.now(),toys:refs};await saveToys(user.userId,"blizzard:toys","Blizzard API",collection);
   let warning="";
   try{const account=await blizzardGet("/profile/user/wow",token);const characters:Character[]=(account.wow_accounts||[]).flatMap((a:any)=>(a.characters||[]).map((c:any)=>({id:c.id,name:c.name,realm:c.realm?.name||c.realm?.slug||"",realmSlug:c.realm?.slug||"",level:c.level||0,className:c.playable_class?.name,classId:c.playable_class?.id}))).filter((c:Character)=>typeof c.name==="string"&&c.realmSlug);await saveSnapshot(user.userId,"blizzard:characters","Blizzard API",{characters});}catch{warning="Your toys synced; Blizzard’s character list was unavailable."}
   const progress=await hydrateToys(user.userId,token);return json({...progress,warning});
  }
  if(action==="both"){
   const token=await profileToken(user.userId),run=await acquireSync(user.userId,body.automatic===true);if(!run)return json({busy:true,message:"A recent or active sync is already available. Your saved data is safe."});
   const errors:string[]=[];const progress:CharacterProgress[]=[];let attempts=0;
   try{
    const responses=await Promise.allSettled([blizzardGet("/profile/user/wow/collections/toys",token),blizzardGet("/profile/user/wow",token)]);
    if(responses[0].status==="fulfilled"){
     try{const data=responses[0].value;if(!Array.isArray(data.toys))throw Error("Invalid toy collection.");const previous=await snapshot<ApiCollection>(user.userId,"blizzard:toys");const cache=new Map(previous?.toys.map(t=>[t.toyId,t])||[]);const toys:SyncedToy[]=data.toys.map((r:any)=>{if(!Number.isInteger(r.toy?.id)||r.toy.id<=0)throw Error("Invalid toy entry.");return {...cache.get(r.toy.id),toyId:r.toy.id,name:String(r.toy.name||"Unknown toy")};});await saveToys(user.userId,"blizzard:toys","Blizzard API",{format:"blizzard-toys-v1",exportedAt:Date.now(),toys});}catch(e){errors.push("Toy collection was unavailable; your previous ownership was kept.");}
    }else errors.push("Toy collection was unavailable; your previous ownership was kept.");
    let characters:Character[]=[];
    if(responses[1].status==="fulfilled"){
     const account=responses[1].value;if(!Array.isArray(account.wow_accounts))errors.push("Account roster was invalid; saved character bindings were kept.");
     else{characters=account.wow_accounts.flatMap((a:any)=>(a.characters||[]).map((c:any)=>({id:c.id,name:c.name,realm:c.realm?.name||c.realm?.slug||"",realmSlug:c.realm?.slug||"",level:c.level||0,className:c.playable_class?.name,classId:c.playable_class?.id}))).filter((c:Character)=>Number.isInteger(c.id)&&typeof c.name==="string"&&c.realmSlug);await saveSnapshot(user.userId,"blizzard:characters","Blizzard API",{characters});}
    }else errors.push("Account roster was unavailable; cached characters were kept.");
    if(!characters.length)characters=(await snapshot<{characters:Character[]}>(user.userId,"blizzard:characters"))?.characters||[];
    const records=await readRecords(user.userId),bound=bindFromRoster(settingsFrom(records),characters);errors.push(...bound.errors);
    await saveSnapshot(user.userId,"bindings:v2","Blizzard API",{at:Date.now(),bindings:bound.settings.bindings},[{key:"settings",value:bound.settings}]);
    // Sequential characters keep the Worker request count bounded; each source is independent.
    for(const actor of ["priest","druid"] as Actor[]){const ref=bound.settings.bindings?.[actor];if(!ref)continue;const c=characters.find(c=>c.id===ref.id&&c.realmSlug===ref.realmSlug)!;try{const result=await syncCharacter(user.userId,token,c,bound.settings,actor);attempts+=result.attempts;progress.push(result.profile.progress!);errors.push(...result.warnings.map(w=>`${c.name}: ${w}`));}catch(e){errors.push(`${c.name}: ${e instanceof Error?e.message:"Sync unavailable"}`);}}
   }catch(e){errors.push(e instanceof Error?e.message:"Sync failed; cached progress was kept.");}
   const syncRun=await finishSync(user.userId,run,errors);const collection=await snapshot<ApiCollection>(user.userId,"blizzard:toys");const remaining=collection?.toys.filter(t=>!t.itemId).length||0;
   const records=await readRecords(user.userId),cached=await snapshots(user.userId),joined=observedProgress(cached.filter(d=>d.key.startsWith("profile:")).map(d=>d.payload),cached.filter(d=>d.key.startsWith("addon:")).map(d=>d.payload as AddonSnapshot),settingsFrom(records));return json({ok:true,attempts,syncRun,errors,remaining,total:collection?.toys.length||0,mapped:(collection?.toys.length||0)-remaining,characters:joined.map(p=>p.ref),progress:joined,professionCooldowns:professionCooldownView(records,settingsFrom(records),joined,Date.now()),eligibility:eligibilityView(activitiesFor(records),records,settingsFrom(records),joined,Date.now())});
  }
  if(action==="character"){
   const known=await snapshot<{characters:Character[]}>(user.userId,"blizzard:characters"),character=known?.characters.find(c=>c.id===body.id&&c.realmSlug===body.realmSlug);if(!character)return json({error:"Choose a character from your connected EU account."},400);
   const token=await profileToken(user.userId),run=await acquireSync(user.userId);if(!run)return json({busy:true});
   const settings=settingsFrom(await readRecords(user.userId));let actor=blizzardActor(character,settings);
   if(body.actor==="priest"||body.actor==="druid")actor=body.actor;
   if(actor&&character.classId!==(actor==="priest"?5:11)){await finishSync(user.userId,run,["Character class mismatch."]);return json({error:"Choose a character of the matching class."},400);}
   if(actor){settings[actor]=character.name;settings[actor==="priest"?"priestRealm":"druidRealm"]=character.realm;settings.bindings={...settings.bindings,[actor]:characterRef(character)};await saveSnapshot(user.userId,"bindings:v2","Blizzard API",{at:Date.now(),bindings:settings.bindings},[{key:"settings",value:settings}]);}
   try{const result=await syncCharacter(user.userId,token,character,settings,actor);await finishSync(user.userId,run,result.warnings.length?result.warnings:["Only one character was synced. Use Sync both characters for a complete refresh."]);const records=await readRecords(user.userId);return json({ok:true,warnings:result.warnings,attempts:result.attempts,actor,ref:result.profile.progress!.ref,progress:result.profile.progress,eligibility:eligibilityView(activitiesFor(records),records,settings,[result.profile.progress!],Date.now())});}catch(e){await finishSync(user.userId,run,[e instanceof Error?e.message:"Character sync failed."]);throw e;}
  }
  return json({error:"Unknown connection action."},404);
 }catch(e){return json({error:e instanceof Error?e.message:"Blizzard sync failed. Your existing progress was kept."},400)}
}
