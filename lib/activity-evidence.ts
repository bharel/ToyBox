import type {GameEvidence,RaidClear,RouteObservation} from './game-evidence';
// NPC identities from ATT's Retail Warfront / Darkmoon data. Arachnis: Wowhead 96323.
// A visible rare establishes a route observation, not a kill, loot entitlement or solo success.
export const routeNpcs:Record<RouteObservation['route'],number[]>={arachnis:[96323],kovork:[142684],gong:[142682],memento:[147845,147435],darkmoon:[55278]};
export const raidDifficultyIds:Record<string,number[]>={'Normal':[14,3,4],'Heroic':[15,5,6],'Mythic':[16],'Raid Finder':[17]};
export const evidenceName=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function knownDarkmoonClosure(now:number){
 const end=Date.parse('2026-10-31T00:00:00Z');
 return now>=Date.parse('2026-10-12T00:00:00Z')&&now<end?{source:'https://worldofwarcraft.blizzard.com/en-gb/news/10052474',expiresAt:end,reason:'The October Darkmoon Faire window has ended.'}:undefined;
}
export function validRouteObservation(r:RouteObservation,exportedAt:number){
 return !!r&&Object.hasOwn(routeNpcs,r.route)&&['npc','calendar'].includes(r.kind)&&Number.isFinite(r.at)&&Number.isFinite(r.expiresAt)&&r.at>0&&r.at<=exportedAt&&r.expiresAt>r.at&&r.expiresAt-r.at<=300000&&(r.kind==='calendar'?r.route==='darkmoon'&&r.npcId===undefined:routeNpcs[r.route].includes(r.npcId||0));
}
export function capturedRaidClears(a:{exportedAt:number;raidsFresh:boolean;raidLockouts:{name:string;difficultyId:number;encounters:{name:string;killed:boolean}[]}[]}):RaidClear[]{
 return a.raidsFresh?a.raidLockouts.flatMap(r=>r.encounters.filter(e=>e.killed).map(e=>({instance:r.name,difficultyId:r.difficultyId,encounter:e.name,at:a.exportedAt}))):[];
}
export function mergeRaidClears(before:RaidClear[]=[],after:RaidClear[]=[]){return [...new Map([...before,...after].map(r=>[`${evidenceName(r.instance)}:${r.difficultyId}:${evidenceName(r.encounter)}`,r])).values()];}
export function currentRoute(game:GameEvidence|undefined,route:string,now:number){return game?.routes?.filter(r=>r.route===route&&r.at<=now&&now<r.expiresAt).sort((a,b)=>b.at-a.at)[0];}
