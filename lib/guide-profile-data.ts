export type TravelMode='fastest'|'conserve'|'ordinary';
export type GuidePreferenceValue=boolean|number|TravelMode;
export type GuideOperation={id:string;key:string;value:GuidePreferenceValue};
export type GuideRosterEntry={guid:string;name:string;realm:string;region:string;classFile:string;at?:number};
export type GuideSnapshot={version:1;profile?:string;revision:number;operations:GuideOperation[];roster:GuideRosterEntry;capabilities?:string[];coverage?:Record<string,number>;observed?:unknown;guidance?:unknown;sync?:unknown;session?:unknown;diagnostic?:{version:string}};
export type GuideProfile={version:1;profile:string;revision:number;values:Record<string,GuidePreferenceValue>;ack:string[];roster:GuideRosterEntry[];capabilities?:string[];reportAck?:Record<string,number>;captureAck?:Record<string,{id:string;guid:string;capturedAt:number;sequence?:number;observedOnDiskAt?:number;acceptedAt?:number;status:string}>};
export function validGuideIntent(key:string,value:unknown):value is GuidePreferenceValue{
 if(key.length>160)return false;
 if(/^travelMode:Player-\d+-[\da-f]+$/i.test(key))return ['fastest','conserve','ordinary'].includes(String(value))&&typeof value==='string';
 if(/^noTravel(Item|Spell):Player-\d+-[\da-f]+:\d+$/i.test(key))return typeof value==='boolean';
 if(key==='budget')return Number.isInteger(value)&&Number(value)>=5&&Number(value)<=240;
 if(key==='scale')return typeof value==='number'&&value>=.7&&value<=1.5;
 if(['autoQuests','autoGossip','autoFlights','locked','includeSolo','includeGroup','includePvP','checklistExpanded'].includes(key))return typeof value==='boolean';
 const m=key.match(/^(follow|exclude|priority|engineering|followToy):([\w-]+)$/);if(!m)return false;
 return m[1]==='priority'?Number.isInteger(value)&&Number(value)>=1&&Number(value)<=3:typeof value==='boolean';
}
export function parseGuideSnapshot(value:unknown,character:{guid?:string;name:string;realm:string;region:string;classFile:string}):GuideSnapshot|undefined{
 if(value===undefined)return undefined;const g=value as GuideSnapshot;
 const r=g?.roster;
 if(typeof r?.guid!=='string'||!/^Player-[0-9]+-[0-9A-Fa-f]+$/.test(r.guid)||g?.version!==1||g.profile!==undefined&&(typeof g.profile!=='string'||g.profile.length>150)||!Number.isSafeInteger(g.revision)||g.revision<0||!r||r.guid!==character.guid||r.name!==character.name||r.realm!==character.realm||r.region!==character.region||r.classFile!==character.classFile||!Array.isArray(g.operations)||g.operations.length>2000||!g.operations.every(o=>o&&typeof o.id==='string'&&o.id.length<=240&&/^[\w:-]+$/.test(o.id)&&typeof o.key==='string'&&validGuideIntent(o.key,o.value)))throw Error('Invalid Toybox guide profile. Your previous data was kept.');
 if(g.observed!==undefined&&JSON.stringify(g.observed).length>800000)throw Error('Guide observations are too large.');
 if(g.guidance!==undefined&&JSON.stringify(g.guidance).length>64000)throw Error("Guidance observations are too large.");
 if(g.guidance!==undefined){const guidance=g.guidance as {nearby?:unknown};if(!guidance||typeof guidance!=='object'||Array.isArray(guidance)||guidance.nearby!==undefined&&(!Array.isArray(guidance.nearby)||guidance.nearby.length>10||!guidance.nearby.every((v:unknown)=>{const r=v as {guideId?:string;label?:string;evidenceAt?:number;expiresAt?:number};return r&&typeof r.guideId==='string'&&/^[\w-]{1,240}$/.test(r.guideId)&&typeof r.label==='string'&&r.label.length<=500&&[r.evidenceAt,r.expiresAt].every(t=>t===undefined||typeof t==='number'&&Number.isFinite(t)&&t>0);})))throw Error('Invalid nearby observations.');}
 if(g.session!==undefined&&(!g.session||typeof g.session!=='object'||JSON.stringify(g.session).length>150000))throw Error('Guide session is too large or invalid.');
 if(g.session){const s=g.session as {version?:number;guides?:unknown;seen?:unknown;farm?:unknown};if(s.version!==undefined&&s.version!==1||s.guides!==undefined&&(!Array.isArray(s.guides)||s.guides.length>500||!s.guides.every(id=>typeof id==='string'&&id.length<=240))||[s.seen,s.farm].some(v=>v!==undefined&&(!v||typeof v!=='object'||Array.isArray(v))))throw Error('Invalid temporary guide session. The previous snapshot was kept.');}
 return {version:1,profile:g.profile,revision:g.revision,roster:{guid:r.guid,name:r.name,realm:r.realm,region:r.region,classFile:r.classFile,...(r.at!==undefined?{at:r.at}:{})},operations:g.operations.map(o=>({id:o.id,key:o.key,value:o.value})),...(Array.isArray(g.capabilities)?{capabilities:g.capabilities.filter(v=>typeof v==='string'&&v.length<50).slice(0,10)}:{}),...(g.coverage?{coverage:g.coverage}:{}),...(g.observed?{observed:g.observed}:{}),...(g.session?{session:g.session}:{}),...(g.guidance?{guidance:g.guidance}:{}),...(g.sync?{sync:g.sync}:{}),...(g.diagnostic?{diagnostic:g.diagnostic}:{})};
}
