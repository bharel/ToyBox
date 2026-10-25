import {blizzardGet,snapshot,saveSnapshot,db} from './server-sync';
import {catalogueToys,CATALOGUE_SOURCE,METADATA_TTL,type PublicCatalogue,type ToyRef} from './toy-catalogue';
import {parseToyDetails,type ToyDetails} from './toy-details';
const scope='public:toybox-catalogue:v1';
export const readCatalogue=()=>snapshot<PublicCatalogue>(scope,'catalogue');
export async function refreshCatalogue(token:string,now=Date.now()){
 const previous=await readCatalogue(),fresh=!!previous?.metadataAt&&!!previous.indexAt&&now-Math.min(previous.metadataAt,previous.indexAt)<METADATA_TTL;
 if(fresh&&!previous!.index.some(t=>!t.itemId))return previous;
 // Coordinate overlapping interactive syncs without touching private profile records.
 const lease=await db().prepare("INSERT INTO sync_snapshots(user_id,key,source,payload,updated_at) VALUES(?, 'lease', 'public metadata', ?, ?) ON CONFLICT(user_id,key) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at WHERE CAST(json_extract(sync_snapshots.payload,'$.expiresAt') AS INTEGER)<? RETURNING key").bind(scope,JSON.stringify({expiresAt:now+120000}),new Date(now).toISOString(),now).first();if(!lease)return previous;
 const next:PublicCatalogue={version:1,index:previous?.index.map(t=>({...t}))||[],indexAt:previous?.indexAt,metadataAt:previous?.metadataAt,lastAttemptAt:now,errors:[]};
 try{
  if(!fresh){
   const responses=await Promise.allSettled([blizzardGet('/data/wow/toy/index',token,'static-eu'),fetch(CATALOGUE_SOURCE,{signal:AbortSignal.timeout(15000)})]);
   try{if(responses[0].status!=='fulfilled')throw Error();const rows=responses[0].value.toys;if(!Array.isArray(rows)||!rows.length)throw Error();const known=new Map(catalogueToys(previous?.index).map(t=>[t.toyId,t]));const refs:ToyRef[]=rows.map((t:any)=>{if(!Number.isInteger(t.id)||t.id<=0)throw Error();const k=known.get(t.id);return {toyId:t.id,itemId:k?.itemId,name:String(t.name||k?.name||`Toy #${t.id}`),icon:k?.icon};});next.index=refs;next.indexAt=now;}catch{next.errors.push('Blizzard’s public toy index is unavailable; the last successful index was kept.');}
   try{if(responses[1].status!=='fulfilled'||!responses[1].value.ok)throw Error();const source=await responses[1].value.json();if(!Array.isArray(source)||source.length<10)throw Error();next.metadataAt=now;}catch{next.errors.push('Source refresh unavailable; versioned metadata was kept.');}
  }
  // Resolve at most twelve new identities; the next interactive sync resumes any remainder.
  await Promise.all(next.index.filter(t=>!t.itemId).slice(0,12).map(async t=>{try{const detail=await blizzardGet(`/data/wow/toy/${t.toyId}`,token,'static-eu');if(!Number.isInteger(detail.item?.id)||detail.item.id<=0)throw Error();t.itemId=detail.item.id;}catch{next.errors.push(`Toy #${t.toyId} awaits item metadata.`)}}));
  await saveSnapshot(scope,'catalogue','Public metadata',next);return next;
 }finally{await db().prepare("DELETE FROM sync_snapshots WHERE user_id=? AND key='lease'").bind(scope).run();}
}
export async function cachedToyDetails(itemId:number,now=Date.now()):Promise<ToyDetails>{
 const key=`item:${itemId}`,prior=await snapshot<ToyDetails>(scope,key);if(prior&&now-prior.retrievedAt<METADATA_TTL)return prior;
 try{const r=await fetch(`https://nether.wowhead.com/tooltip/item/${itemId}?dataEnv=1&locale=0`,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();const detail=parseToyDetails(itemId,await r.json(),now);if(!detail.text)throw Error();await saveSnapshot(scope,key,'Wowhead',detail);return detail;}catch{return prior?{...prior,error:'Wowhead is unavailable; showing the last successful details.'}:{itemId,retrievedAt:now,error:'Wowhead is unavailable. The ordinary item link still works.'};}
}
