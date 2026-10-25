"use client";
import {observedQuestRows} from '../lib/quest-progress';
import {progressFor,type CharacterProgress} from '../lib/progression';
import type {Records,Settings} from '../lib/planner';
import {routinesFrom,type Routine} from '../lib/routines';
type Base={progress:CharacterProgress[];settings:Settings;now:number};
export function QuestSteps({progress,settings,now,actor,questIds}:{actor:string;questIds:number[]}&Base){
 const p=progressFor(actor,settings,progress),game=p?.inGame;
 const quests=game?.questLog?.filter(q=>questIds.includes(q.id))||[];
 if(!quests.length)return null;
 return <div className="quest-steps"><b>In-game quest progress</b>{quests.map(q=><div key={q.id}><a href={`https://www.wowhead.com/quest=${q.id}`} target="_blank" rel="noreferrer">{q.title}</a><small>Last reported: {q.complete?'ready to turn in':'in progress'} · {new Date(game!.at).toLocaleString('en-GB',{timeZone:settings.timezone})}</small>{q.objectives?.map((o,i)=><p key={i}>{o.finished?'✓':'○'} {o.text} <span>{o.fulfilled}/{o.required}</span></p>)}</div>)}</div>;
}
export default function ObservedQuests(p:Base&{records:Records;disabled:boolean;actorFilter:string;filter:string;onChange:(updates:{key:string;value:unknown}[],message?:string)=>Promise<boolean>}){
 const rows=observedQuestRows(p.progress,p.settings,p.now).filter(q=>(p.actorFilter==='all'||q.actor===p.actorFilter)&&(p.filter==='all'||q.cadence===p.filter||p.filter==='fortnightly'&&q.cadence==='archaeology'));
 if(!rows.length)return null;
 const routines=routinesFrom(p.records),labels:Record<string,string>={'turned-in':'Turned in this period',ready:'Ready to turn in','in-progress':'In progress','turn-in-recorded':'Turn-in recorded · reset not established','not-reported':'Not reported this period'};
 async function track(q:typeof rows[number]){if(q.cadence!=='daily'&&q.cadence!=='weekly')return;const r:Routine={id:`custom-quest-${q.actor}-${q.id}`,title:q.title.slice(0,120),cadence:q.cadence,assignment:q.actor,priority:1,location:'Your quest route',why:'Detected in your quest log. Reported turn-ins complete this routine automatically.',steps:['Continue the quest objectives shown in game.'],source:`https://www.wowhead.com/quest=${q.id}`,custom:true,minutes:20,questIds:[q.id]};await p.onChange([{key:`routine:${r.id}`,value:r}],'Quest added to Today');}
 return <section className="observed-quests connection-card"><div className="eyebrow">AUTOMATIC GAME TRACKING</div><h2>Quest progress <small>· {rows.length}</small></h2><p>Reported dailies, weeklies and scheduled quests appear here without setup. Add the ones you want in Today; their turn-ins update automatically. Unseen quests are not assumed incomplete.</p><div className="observed-quest-list">{rows.map(q=><article key={`${q.actor}:${q.id}`}><div><a href={`https://www.wowhead.com/quest=${q.id}`} target="_blank" rel="noreferrer">{q.title}</a><small>{p.settings[q.actor]} · {q.cadence==='archaeology'?'Legion archaeology':q.cadence==='scheduled'?'Game scheduled':q.cadence} · {labels[q.state]}</small>{q.objectives.map((o,i)=><p key={i}>{o.finished?'✓':'○'} {o.text} <span>{o.fulfilled}/{o.required}</span></p>)}<small>{q.deadline?`Reset ${new Date(q.deadline).toLocaleString('en-GB',{timeZone:p.settings.timezone})}`:'Reset timing has not been reported.'}</small></div>{(q.cadence==='daily'||q.cadence==='weekly')&&!routines.some(r=>r.questIds?.includes(q.id)&&r.assignment===q.actor)&&<button className="secondary-button" disabled={p.disabled} onClick={()=>void track(q)}>Show in Today</button>}</article>)}</div></section>;
}
