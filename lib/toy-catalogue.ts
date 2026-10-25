import seed from './data/toys.json';
import {catalog,type Activity} from './catalog';
import {settingsFrom,type Records} from './planner';
import {rotationFor,type CharacterProgress} from './progression';
import {knownDarkmoonClosure} from './activity-evidence';
export type ToyRef={id?:string;itemId?:number;toyId?:number;name:string;icon?:string};
export type AcquisitionRoute={path:string[];notObtainable?:boolean;notReleased?:boolean;resale?:boolean;side?:string|number;obtainSide?:string|number;obtainClasses?:(string|number)[];info?:string};
export type CatalogueToy=ToyRef&{id:string;routes:AcquisitionRoute[];expansion:string;aliases:string[]};
export type RouteAvailability={state:'active'|'inactive'|'excluded'|'unknown';reason:string;source:string;checkedAt:string;validFrom?:number;expiresAt?:number};
export type AvailableToy=CatalogueToy&{availability:RouteAvailability;routeAvailability:RouteAvailability[];owned:boolean};
export type PublicCatalogue={version:1;index:ToyRef[];indexAt?:number;metadataAt?:number;lastAttemptAt?:number;errors:string[]};
export const CATALOGUE_SOURCE=seed.source;
export const CATALOGUE_REVISION=seed.revision;
export const CATALOGUE_RETRIEVED=seed.retrievedAt;
export const METADATA_TTL=24*60*60*1000;
const knownRotation=new Set([131717,131724,187185,187184,169303,174874,174873]);
export function routeAvailability(route:AcquisitionRoute,itemId:number|undefined,now:number,checkedAt=CATALOGUE_RETRIEVED):RouteAvailability{
 const base={source:CATALOGUE_SOURCE,checkedAt};const path=route.path.join(' / ');
 if(route.notReleased)return {...base,state:'excluded',reason:'Unreleased in the versioned source.'};
 if(route.notObtainable)return {...base,state:'excluded',reason:'No longer obtainable through this source.'};
 if(route.resale||/Promotion|Blizzard Store|Blizzcon|Esports|Mythic Dungeon Invitational|Arena World Championship/i.test(path))return {...base,state:'excluded',reason:'External promotion, store or resale source; outside your in-game catalogue.'};
 if(route.path[0]==='World Events'){
  const closed=route.path.includes('Darkmoon Faire')?knownDarkmoonClosure(now):undefined;
  if(closed)return {...base,...closed,state:'inactive'};
  if(route.path.includes("Hallow's End")){
   // The announcement gives calendar dates, not exact regional times. Only the interior is verified.
   const validFrom=Date.parse('2026-10-20T00:00:00Z'),expiresAt=Date.parse('2026-11-02T00:00:00Z');
   return {state:now>=validFrom&&now<expiresAt?'active':'unknown',reason:now>=validFrom&&now<expiresAt?'Hallow’s End is open in the confirmed 2026 window.':'Check the current Hallow’s End window in game.',source:'https://worldofwarcraft.blizzard.com/en-us/news/24310656',checkedAt:CATALOGUE_RETRIEVED,validFrom,expiresAt};
  }
  return {...base,state:'unknown',reason:'A current event or rotation window has not been verified.'};
 }
 if(knownRotation.has(itemId||0)||/Past Limited Time|Unknown|Limited Time|Fisherfriends|Withered Army Training|Maw Assaults|Warfront|Assault:|Events|Prey Drop|Phase Diving|The Zskera Vaults|Pre-Launch/i.test(path)||route.info)return {...base,state:'unknown',reason:'The current source window or rotation needs checking.'};
 return {...base,state:'active',reason:'An ongoing in-game acquisition route is listed in the versioned catalogue.'};
}
export function catalogueToys(index:ToyRef[]=[],owned:ToyRef[]=[],activities:Activity[]=catalog):CatalogueToy[]{
 const map=new Map<string,CatalogueToy>(),toyToKey=new Map<number,string>();
 for(const t of seed.toys){const key=`item-${t.itemId}`;map.set(key,{...t,id:key,expansion:t.routes[0]?.path[0]||'Needs checking',routes:t.routes as AcquisitionRoute[],aliases:[key]});toyToKey.set(t.toyId,key);}
 for(const t of [...index,...owned]){const key=t.itemId?`item-${t.itemId}`:toyToKey.get(t.toyId!)||`blizzard-${t.toyId}`;const oldKey=t.toyId?toyToKey.get(t.toyId):undefined;const prior=map.get(key)||(oldKey?map.get(oldKey):undefined);if(oldKey&&oldKey!==key)map.delete(oldKey);map.set(key,{...prior,...t,id:key,expansion:prior?.expansion||'Beyond source coverage',routes:prior?.routes||[],aliases:[...new Set([key,...(prior?.aliases||[])])]});if(t.toyId)toyToKey.set(t.toyId,key);}
 for(const a of activities)for(const t of a.rewards){const key=t.itemId?`item-${t.itemId}`:t.id,prior=map.get(key);map.set(key,{...prior,...t,id:key,expansion:prior?.expansion||a.expansion,routes:prior?.routes||[],aliases:[...new Set([...(prior?.aliases||[key]),t.id])]});}
 return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
export function ownsToy(toy:Pick<ToyRef,'id'|'itemId'|'toyId'>,records:Records,owned:ToyRef[]=[],aliases:string[]=[]){
 if(owned.some(t=>toy.itemId&&t.itemId===toy.itemId||toy.toyId&&t.toyId===toy.toyId))return true;
 return [toy.id,...aliases,toy.itemId?`item-${toy.itemId}`:undefined,toy.toyId?`blizzard-${toy.toyId}`:undefined].some(id=>id&&records[`owned:${id}`]===true);
}
export function catalogueView(records:Records,owned:ToyRef[],data:PublicCatalogue|undefined,now:number,activities:Activity[]=catalog,progress:CharacterProgress[]=[]){
 const settings=settingsFrom(records),rotation=[rotationFor(records,settings,now).rotation,...progress.map(p=>rotationFor(records,settings,now,p).rotation)].filter(Boolean).sort((a,b)=>b!.at-a!.at)[0];
 const toys=catalogueToys(data?.index,owned,activities),knownItems=new Set(toys.map(t=>t.itemId)),knownIds=new Set(toys.map(t=>t.toyId));
 for(const [key,value] of Object.entries(records)){if(value!==true)continue;const item=key.match(/^owned:item-(\d+)$/),toy=key.match(/^owned:blizzard-(\d+)$/);if(item&&!knownItems.has(Number(item[1]))){const itemId=Number(item[1]);toys.push({id:`item-${itemId}`,itemId,name:`Toy item #${itemId}`,aliases:[`item-${itemId}`],routes:[],expansion:'Beyond source coverage'});knownItems.add(itemId);}else if(toy&&!knownIds.has(Number(toy[1]))){const toyId=Number(toy[1]);toys.push({id:`blizzard-${toyId}`,toyId,name:`Toy #${toyId}`,aliases:[`blizzard-${toyId}`],routes:[],expansion:'Beyond source coverage'});knownIds.add(toyId);}}
 const entries:AvailableToy[]=toys.map(t=>{const routes=t.routes.map(r=>{if(rotation&&[131717,131724].includes(t.itemId||0)){const matches=t.itemId===(rotation.reward==='eye'?131724:rotation.reward==='beacon'?131717:0);return {state:matches?'active' as const:'inactive' as const,reason:matches?'Dated evidence identifies this reward in the current archaeology window.':'Dated evidence identifies a different reward for this window.',source:'https://worldofwarcraft.blizzard.com/en-gb/news/20307311',checkedAt:new Date(rotation.at).toISOString(),expiresAt:rotation.end};}return routeAvailability(r,t.itemId,now,data?.metadataAt?new Date(data.metadataAt).toISOString():undefined)});const availability=routes.find(r=>r.state==='active')||routes.find(r=>r.state==='unknown')||routes[0]||{state:'unknown' as const,reason:'Blizzard identifies this toy; its current acquisition route needs checking.',source:'https://us.forums.blizzard.com/en/blizzard/t/toys-and-heirlooms-apis/42252',checkedAt:CATALOGUE_RETRIEVED};return {...t,availability,routeAvailability:routes,owned:ownsToy(t,records,owned,t.aliases)};});
 const eligible=entries.filter(t=>t.availability.state==='active'),eligibleOwned=eligible.filter(t=>t.owned).length;
 return {entries,counts:{owned:entries.filter(t=>t.owned).length,obtainableNow:eligible.length,missingObtainable:eligible.length-eligibleOwned,ownedObtainable:eligibleOwned,percentage:eligible.length?Math.round(eligibleOwned/eligible.length*100):0,needsChecking:entries.filter(t=>t.availability.state==='unknown').length},coverage:{metadataToys:seed.toys.length,indexToys:data?.index.length||0,knownToys:entries.length,withoutSource:entries.filter(t=>!t.routes.length).length,revision:CATALOGUE_REVISION,source:CATALOGUE_SOURCE,metadataAt:data?.metadataAt||Date.parse(CATALOGUE_RETRIEVED),indexAt:data?.indexAt,stale:!data?.metadataAt||now-data.metadataAt>=METADATA_TTL,errors:data?.errors||[]}};
}

const classNames:Record<number,string>={1:'Warrior',2:'Paladin',3:'Hunter',4:'Rogue',5:'Priest',6:'Death Knight',7:'Shaman',8:'Mage',9:'Warlock',10:'Monk',11:'Druid',12:'Demon Hunter',13:'Evoker'};
export function acquisitionRestrictions(r:AcquisitionRoute){const faction=(s:string|number)=>s==='A'?'Alliance':s==='H'?'Horde':String(s);return [r.obtainSide?`Acquired by ${faction(r.obtainSide)} characters.`:'',r.side?`${faction(r.side)} variant.`:'',r.obtainClasses?`Acquired by ${r.obtainClasses.map(id=>classNames[Number(id)]||String(id)).join(', ')} characters.`:''].filter(Boolean).join(' ');}

export type CatalogueCounts=ReturnType<typeof catalogueView>['counts'];
export type CatalogueCoverage=ReturnType<typeof catalogueView>['coverage'];
