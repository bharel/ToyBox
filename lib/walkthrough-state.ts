import {readRecords,snapshots} from './server-sync';
import {walkthroughSteps,type GuideObservations,type Walkthrough} from './walkthrough';
type Definition={id:string;title:string;source?:string;validation:{sourceChecked:boolean;playtested:boolean;gaps:string[]};walkthrough:Walkthrough};
export async function savedWalkthrough(userId:string,id:string,guid?:string){
 if(!/^[\w-]{1,160}$/.test(id)||guid&&!/^Player-\d+-[\da-f]+$/i.test(guid))throw Error('Invalid guide or character.');
 const library=(await import('./data/walkthrough-runtime.json')).default as unknown as Record<string,Definition>;
 const aliases=(await import('./data/guide-library.json')).default.aliases as Record<string,string>;
 let canonical=id;for(let depth=0;aliases[canonical]&&depth<8;depth++)canonical=aliases[canonical];
 const guide=library[canonical];if(!guide)throw Error('This route does not yet have a walkthrough.');
 const [records,rows]=await Promise.all([readRecords(userId),snapshots(userId)]);
 const roster=rows.filter(r=>r.key.startsWith('addon:')&&r.payload.character?.guid);
 const candidates=roster.filter(r=>!guid||r.payload.character.guid===guid);
 candidates.sort((a,b)=>Number(b.payload.exportedAt||0)-Number(a.payload.exportedAt||0));
 const selected=guid?candidates[0]:candidates.find(r=>r.payload.character.classFile==='PRIEST'&&r.payload.character.region==='EU')||candidates[0];
 if(!selected)return {...guide,steps:guide.walkthrough.nodes,character:null,observationStatus:'No addon observations for this character yet.'};
 const snapshot=selected.payload,raw=snapshot.guides?.observed;
 if(!raw||raw.timeUnit!=='unix-seconds')return {...guide,steps:guide.walkthrough.nodes,character:snapshot.character,observationStatus:'This older snapshot has no walkthrough observations. The next addon reload can supply them.'};
 const state:GuideObservations={...raw,guid:snapshot.character.guid,region:snapshot.character.region,class:snapshot.character.classFile,flags:raw.questFlags};
 const owned=new Set<number>(Object.entries(records).filter(([k,v])=>/^owned:item-\d+$/.test(k)&&v===true).map(([k])=>Number(k.slice('owned:item-'.length))));
 const characters=roster.filter(r=>r.payload.guides?.observed?.timeUnit==='unix-seconds').map(r=>({...r.payload.guides.observed,flags:r.payload.guides.observed.questFlags,region:r.payload.character.region,guid:r.payload.character.guid} as GuideObservations));
 const result=walkthroughSteps(guide.walkthrough,guide.id,state,{now:Math.floor(Date.now()/1000),owned,characters});
 return {...guide,steps:result.rows,complete:result.complete,dailySession:result.dailySession,character:snapshot.character,observedAt:snapshot.exportedAt,observationStatus:'Saved addon observations. Live counters and unavailable observations are refreshed inside WoW.'};
}
