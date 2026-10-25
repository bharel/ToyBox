import {catalogueToys} from './toy-catalogue';
import {env} from "cloudflare:workers";
import {catalog,type Activity} from "./catalog";
import {ownedUpdates,type SyncedToy,type AddonSnapshot,type ApiCollection} from "./sync";
import {validateRecord,type Records} from "./planner";
export const SITE_ORIGIN=(env.TOYBOX_SITE_ORIGIN||"https://toybox.example.invalid").replace(/\/$/,"");
export const REDIRECT_URI=SITE_ORIGIN+"/api/blizzard/callback";
export const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
export function db(){if(!env.DB)throw Error("Progress storage is unavailable. Try again shortly.");return env.DB;}
function bytes(s:string){return Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));}
function base64(b:Uint8Array){return btoa(String.fromCharCode(...b)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
export async function seal(value:unknown,aad:string){
 if(!env.BLIZZARD_TOKEN_KEY)throw Error("Secure connection storage is not configured.");
 const key=await crypto.subtle.importKey("raw",bytes(env.BLIZZARD_TOKEN_KEY),"AES-GCM",false,["encrypt"]);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const data=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:new TextEncoder().encode(aad)},key,new TextEncoder().encode(JSON.stringify(value)));
 return base64(iv)+"."+base64(new Uint8Array(data));
}
export async function unseal<T>(value:string,aad:string):Promise<T>{
 if(!env.BLIZZARD_TOKEN_KEY)throw Error("Secure connection storage is not configured.");
 const [iv,cipher]=value.split(".");
 const key=await crypto.subtle.importKey("raw",bytes(env.BLIZZARD_TOKEN_KEY),"AES-GCM",false,["decrypt"]);
 const data=await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(iv),additionalData:new TextEncoder().encode(aad)},key,bytes(cipher));
 return JSON.parse(new TextDecoder().decode(data));
}
export async function secret<T>(user:string,name:string):Promise<T|null>{const row=await db().prepare("SELECT encrypted FROM integration_secrets WHERE user_id=? AND name=?").bind(user,name).first<{encrypted:string}>();return row?unseal<T>(row.encrypted,user+":"+name):null;}
export async function saveSecret(user:string,name:string,value:unknown){const cipher=await seal(value,user+":"+name);await db().prepare("INSERT INTO integration_secrets(user_id,name,encrypted,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,name) DO UPDATE SET encrypted=excluded.encrypted,updated_at=excluded.updated_at").bind(user,name,cipher,new Date().toISOString()).run();}
export async function readRecords(user:string):Promise<Records>{const {results}=await db().prepare("SELECT key,value FROM planner_records WHERE user_id=?").bind(user).all<{key:string;value:string}>();return Object.fromEntries(results.map(r=>[r.key,JSON.parse(r.value)]));}
export function activitiesFor(records:Records):Activity[]{return [...catalog,...Object.entries(records).filter(([key,value])=>key.startsWith("custom:")&&validateRecord(key,value)).map(([,v])=>v as Activity)];}
export function recordStatements(user:string,updates:{key:string;value:unknown}[]){return updates.map(({key,value})=>db().prepare("INSERT INTO planner_records(user_id,key,value,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(user,key,JSON.stringify(value),new Date().toISOString()));}
export async function snapshots(user:string){return (await db().prepare("SELECT key,source,payload,updated_at FROM sync_snapshots WHERE user_id=?").bind(user).all<{key:string;source:string;payload:string;updated_at:string}>()).results.map(r=>({...r,payload:JSON.parse(r.payload)}));}
export async function snapshot<T>(user:string,key:string):Promise<T|null>{const row=await db().prepare("SELECT payload FROM sync_snapshots WHERE user_id=? AND key=?").bind(user,key).first<{payload:string}>();return row?JSON.parse(row.payload):null;}
export async function saveSnapshot(user:string,key:string,source:string,payload:unknown,updates:{key:string;value:unknown}[]=[]){
 await db().batch([db().prepare("INSERT INTO sync_snapshots(user_id,key,source,payload,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET source=excluded.source,payload=excluded.payload,updated_at=excluded.updated_at").bind(user,key,source,JSON.stringify(payload),new Date().toISOString()),...recordStatements(user,updates)]);
}
export async function saveToys(user:string,key:string,source:string,payload:ApiCollection){const records=await readRecords(user);await db().batch([db().prepare("INSERT INTO sync_snapshots(user_id,key,source,payload,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET source=excluded.source,payload=excluded.payload,updated_at=excluded.updated_at WHERE COALESCE(json_extract(sync_snapshots.payload,'$.exportedAt'),0)<=?").bind(user,key,source,JSON.stringify(payload),new Date().toISOString(),payload.exportedAt),...recordStatements(user,ownedUpdates(payload.toys,activitiesFor(records)))]);}
export function checkOrigin(request:Request){const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)throw Error("Invalid request origin.");}
export type ClientConfig={clientId:string;clientSecret:string};
export type Access={accessToken:string;expiresAt:number};
export async function tokenRequest(config:ClientConfig,params:URLSearchParams){
 const r=await fetch("https://oauth.battle.net/token",{method:"POST",headers:{Authorization:"Basic "+btoa(config.clientId+":"+config.clientSecret),"Content-Type":"application/x-www-form-urlencoded"},body:params,signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error(r.status===401?"Blizzard rejected these client credentials. Check the developer client ID and secret.":"Blizzard could not authorize the connection. Please reconnect and try again.");
 const d=await r.json() as {access_token?:string;expires_in?:number};if(!d.access_token||!Number.isFinite(d.expires_in))throw Error("Blizzard returned an unexpected token response.");return {accessToken:d.access_token,expiresAt:Date.now()+Number(d.expires_in)*1000};
}
export async function profileToken(user:string){const access=await secret<Access>(user,"access");if(!access||access.expiresAt<=Date.now())throw Error("Your Blizzard authorization has expired. Connect Battle.net again.");return access.accessToken;}
export async function blizzardGet(path:string,token:string,namespace="profile-eu"){
 if(!/^\/(profile|data)\//.test(path))throw Error("Invalid Blizzard endpoint.");
 const url=new URL("https://eu.api.blizzard.com"+path);url.searchParams.set("namespace",namespace);url.searchParams.set("locale","en_US");
 const r=await fetch(url,{headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(20000)});
 if(!r.ok){if(r.status===401||r.status===403)throw Error("Blizzard denied this profile request. Reconnect with WoW profile permission.");if(r.status===404)throw Error("Blizzard has no current data for this profile. Log into WoW, log out, and try again later.");if(r.status===429)throw Error("Blizzard is rate limiting requests. Wait a little before syncing again.");throw Error("Blizzard is temporarily unavailable. Try again later.");}return r.json() as Promise<any>;
}
export async function sha256(value:string){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,"0")).join("");}
export async function hydrateToys(user:string,token:string){
 const collection=await snapshot<ApiCollection>(user,"blizzard:toys");if(!collection)throw Error("Start a collection sync first.");
 const cache=(await db().prepare("SELECT toy_id,payload FROM toy_metadata").all<{toy_id:string;payload:string}>()).results;
 const lookup=new Map<number,SyncedToy>([...catalogueToys().filter(t=>t.toyId).map(t=>[t.toyId!,{toyId:t.toyId,itemId:t.itemId,name:t.name,icon:t.icon}] as [number,SyncedToy]),...cache.map(r=>[Number(r.toy_id),JSON.parse(r.payload) as SyncedToy] as [number,SyncedToy])]);
 const pending=collection.toys.filter(t=>!t.itemId&&!lookup.has(t.toyId!)).slice(0,16);
 const errors:string[]=[];const mapped:SyncedToy[]=[];
 // Sixteen mappings per request keeps the first full import within Worker subrequest limits.
 for(let start=0;start<pending.length;start+=4)await Promise.all(pending.slice(start,start+4).map(async t=>{
  try{const detail=await blizzardGet(`/data/wow/toy/${t.toyId}`,token,"static-eu");const itemId=Number(detail.item?.id);if(!Number.isInteger(itemId)||itemId<=0)throw Error("Toy metadata did not include an item ID.");let icon:string|undefined;
   try{const media=await blizzardGet(`/data/wow/media/item/${itemId}`,token,"static-eu");const url=media.assets?.find((a:any)=>a.key==="icon")?.value;if(typeof url==="string"&&url.startsWith("https://render.worldofwarcraft.com/"))icon=url;}catch{}
   const item={...t,itemId,icon};lookup.set(t.toyId!,item);mapped.push(item);
  }catch{errors.push(`Metadata for ${t.name} could not be loaded. Retry the sync to resume.`)}
 }));
 if(mapped.length)await db().batch(mapped.map(t=>db().prepare("INSERT INTO toy_metadata(toy_id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(toy_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at").bind(String(t.toyId),JSON.stringify(t),new Date().toISOString())));
 const latest=await snapshot<ApiCollection>(user,"blizzard:toys");if(latest&&latest.exportedAt>collection.exportedAt){collection.exportedAt=latest.exportedAt;collection.toys=latest.toys;}
 collection.toys=collection.toys.map(t=>lookup.has(t.toyId!)?{...t,...lookup.get(t.toyId!)}:t);collection.errors=errors;
 await saveToys(user,"blizzard:toys","Blizzard API",collection);
 const remaining=collection.toys.filter(t=>!t.itemId).length;
 return {remaining,total:collection.toys.length,mapped:collection.toys.length-remaining,errors};
}
