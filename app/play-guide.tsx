"use client";
import {useEffect,useRef,useState} from 'react';
import {ArrowRight,ArrowUpRight,Check,Compass,MapPin,SlidersHorizontal,ExternalLink,Leaf,ChevronLeft,BookOpen} from 'lucide-react';
import {playGuide,type GuideStep} from '../lib/play-guide';
import {todayPreferences} from '../lib/today';
import {boundCharacter} from '../lib/characters';
import {safeUrl,type Records,type Settings} from '../lib/planner';
import type {CharacterProgress} from '../lib/progression';
import type {Activity} from '../lib/catalog';
import {QuestSteps} from './quest-progress';
import {rotationFor,progressFor} from '../lib/progression';
import {ToyLink} from './toy-link';
import {catalogueToys} from '../lib/toy-catalogue';

export function GuideWindowLink(){return <a className="guide-window-link" href="/?guide=1" onClick={e=>{const w=window.open('/?guide=1','toybox-guide','popup=yes,width=440,height=760,resizable=yes,scrollbars=yes');if(w&&!w.closed){w.opener=null;e.preventDefault();}}}><ExternalLink size={15}/>Open small window</a>}
type Props={activities:Activity[];records:Records;settings:Settings;progress:CharacterProgress[];now:number;disabled:boolean;compact:boolean;syncBusy:string;hasCompanion:boolean;onChange:(updates:{key:string;value:unknown}[],message?:string)=>Promise<boolean>;onDetails:()=>void;onConnection:()=>void};
export default function PlayGuide(p:Props){
 const {records,settings,progress,now}=p,{steps,more,plan}=playGuide(p.activities,records,settings,progress,now),prefs=todayPreferences(records);
 const [moreFilter,setMoreFilter]=useState('weekly');
 const [visited,setVisited]=useState<string[]>([]),[selected,setSelected]=useState(''),[options,setOptions]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[undo,setUndo]=useState<{key:string;value:unknown}[]|null>(null);const pending=useRef(false),title=useRef<HTMLHeadingElement>(null),previous=useRef('');
 const remaining=steps.filter(s=>!visited.includes(s.key)),library=[...steps.filter(s=>s.unit.activity?.toyRoute),...more].filter(s=>!visited.includes(s.key)),current=[...remaining,...library].find(s=>s.key===selected)||remaining[0];
 const extraChoices=library.filter(s=>moreFilter==='all'||(moreFilter==='weekly'?s.unit.activity?.toyRoute?.kind==='weekly-reputation':s.unit.activity?.toyRoute?.kind!=='weekly-reputation'));
 useEffect(()=>{if(previous.current&&previous.current!==current?.key)title.current?.focus();previous.current=current?.key||'';},[current?.key]);
 function next(){if(current){const extra=more.some(s=>s.key===current.key),index=extraChoices.findIndex(s=>s.key===current.key),following=extra?extraChoices.slice(index+1).find(s=>s.key!==current.key):undefined;setVisited(v=>[...v,current.key]);setSelected(following?.key||'');}}
 function back(){const key=visited.at(-1);if(key){setVisited(v=>v.slice(0,-1));setSelected(key);}}
 async function finish(s:GuideStep){if(pending.current)return;pending.current=true;setSaving(true);setError('');const before=s.unit.completionKeys.map(key=>({key,value:records[key]??null}));try{if(await p.onChange(s.unit.completionKeys.map(key=>({key,value:true})),s.unit.activity?'Activity recorded':'Routine completed')){setUndo(before);setSelected('');}else setError('Could not save that completion. Please try again.');}finally{pending.current=false;setSaving(false);}}
 async function preferences(value:{minutes?:number;actor?:string}){await p.onChange([{key:'plan-prefs:today',value:{...prefs,...value}}]);}
 const u=current?.unit,actor=u?.actor==='warband'?'Warband':u?settings[u.actor as 'priest'|'druid']:undefined,ref=u&&boundCharacter(settings,u.actor);
 const questIds=u?.routine?.id==='legion-archaeology'?rotationFor(records,settings,now,progressFor(u.actor,settings,progress)).rotation?.questIds||[]:u?.routine?.questIds||u?.activity?.toyRoute?.questIds||[];
 const snapshot=progressFor(u?.actor||'priest',settings,progress)?.inGame;
 return <section className="play-guide" aria-label="Play guide">
  <div className="guide-topline"><span><Compass size={18}/>TOYBOX GUIDE</span>{!p.compact&&<GuideWindowLink/>}{p.compact&&<a href="/?view=today" className="guide-window-link" aria-label="Open full planner"><ArrowUpRight size={17}/>Planner</a>}</div>
  <div className="guide-intro"><span className="guide-kicker">A LITTLE PROGRESS, AT YOUR PACE</span><h1>Just the next step.</h1><p>You play. Toybox keeps track.</p></div>
  {current&&u?<article className="guide-focus" aria-labelledby="guide-step-title" key={current.key}>
   <div className="guide-actor">{u.actor!=='warband'&&<img src={`/icons/classicon_${u.actor==='druid'?'druid':'priest'}.jpg`} alt=""/>}<span>{actor}{ref&&<small> · {ref.realm}</small>}</span><span className="guide-step-label">{current.mode==='play'?'UP NEXT':current.mode==='observe'?'IN GAME':'NEXT UNLOCK'}</span></div>
   <h2 id="guide-step-title" ref={title} tabIndex={-1}>{current.title}</h2>
   <p className="guide-place"><MapPin size={15}/>{u.location}{u.difficulty&&u.difficulty!=='Run'?` · ${u.difficulty}`:''}</p>
   {u.activity?.toyRoute?.reputation&&<p className="guide-rep-purpose">{u.activity.toyRoute.kind==='weekly-reputation'?'Weekly progress':'Toy rewards'} · {u.activity.toyRoute.reputation.name}</p>}
   <ol className="guide-instructions">{current.steps.map((s,i)=><li key={i}>{s}</li>)}</ol>
   {u.activity?.toyRoute&&u.rewards.length>0&&<div className="guide-toy-targets"><small>FOR YOUR TOY BOX</small>{u.rewards.slice(0,2).map(r=><ToyLink key={r.id} toy={catalogueToys().find(t=>t.itemId===r.itemId)||r}/>)}{u.rewards.length>2&&<span>More missing rewards in Details</span>}</div>}
   {u.profession?.match.variant&&<p className="guide-materials"><b>Bring</b> {u.profession.match.variant.ingredients.join(' · ')}</p>}
   {current.mode==='observe'&&<p className="guide-soft-note">{u.activity?.toyRoute?(u.activity.toyRoute.kind==='craft'?'Check the recipe in your profession window.':'Check the current offer in game.'):'No form to fill in. New game evidence will update this step.'}</p>}
   <div className="guide-actions">{current.manualCompletion?<><button className="primary-button" disabled={p.disabled||saving} onClick={()=>void finish(current)}><Check size={17}/>{saving?'Saving…':'Done'}</button><button className="text-button" onClick={next}>Do this later</button></>:<button className="primary-button" onClick={next}>Next activity<ArrowRight size={17}/></button>}{visited.length>0&&<button className="text-button" onClick={back}><ChevronLeft size={14}/>Previous</button>}</div>
   {error&&<p className="form-error" role="alert">{error}</p>}
   <details className="guide-extra"><summary><BookOpen size={14}/>Details, if you need them</summary>
    {current.automatic&&<p>Completion updates from reported game progress after logout or /reload. “Next activity” only moves the guide forward.</p>}
    {current.mode!=='play'&&<p>{u.eligibility.reason} This step does not mark access as verified.</p>}
    {u.profession?.match.variant?.tools.length? <p><b>Tools:</b> {u.profession.match.variant.tools.join(' · ')}</p>:null}
    {(u.routine||u.activity?.toyRoute?.questIds.length)&&<QuestSteps actor={u.actor} questIds={questIds} progress={progress} settings={settings} now={now}/>}
    {u.rewards.length>0&&<p><b>Working toward:</b> {u.rewards.map(r=>r.name).join(' · ')}</p>}
    {u.eligibility.evidence.map((e,i)=><p key={i}>{e.source}: {e.detail}</p>)}
    {u.activity?.toyRoute?.notes&&<p>{u.activity.toyRoute.notes}</p>}
    {u.activity?.toyRoute&&ref&&u.completionKeys.length>0&&<div className="guide-manual-visit"><p>If the game did not report your completed visit, you can record it here. This does not mark a toy owned or verify access.</p><button className="text-button" disabled={p.disabled||saving} onClick={()=>void finish(current)}>I finished this activity</button></div>}
    {snapshot&&<p>Last game snapshot: {new Date(snapshot.at).toLocaleString('en-GB',{timeZone:settings.timezone})}</p>}
    {safeUrl(current.source)&&<a href={current.source} target="_blank" rel="noopener noreferrer">Open the source guide<ArrowUpRight size={13}/></a>}
   </details>
  </article>:<div className="guide-clear"><span className="guide-clear-icon"><Leaf size={30}/></span><h2 ref={title} tabIndex={-1}>{visited.length?'Enjoy the adventure.':'A quiet moment.'}</h2><p>{visited.length?'You’ve reached the end of this short list. Skipped activities stay in your planner.':plan.upcoming.length?'Your next crafts are cooling down. They’ll return when ready.':'There’s nothing ready on this short list. Your other goals are in the planner.'}</p>{visited.length>0&&<button className="secondary-button" onClick={()=>{setVisited([]);setSelected('')}}><ChevronLeft size={15}/>Return to the list</button>}</div>}
  {undo&&<div className="guide-undo" role="status">Completion saved. <button className="text-button" disabled={p.disabled||saving} onClick={async()=>{if(await p.onChange(undo,'Completion undone'))setUndo(null)}}>Undo</button></div>}
  {remaining.length>1&&<details className="guide-queue"><summary>Choose another activity</summary>{remaining.map(s=><button key={s.key} className={s.key===current?.key?'active':''} onClick={()=>setSelected(s.key)}>{s.title}{s.unit.difficulty&&s.unit.difficulty!=='Run'?` · ${s.unit.difficulty}`:''}<small>{s.unit.actor==='warband'?'Warband':settings[s.unit.actor as 'priest'|'druid']}</small><ArrowRight size={14}/></button>)}</details>}
  {library.length>0&&<details className="guide-more"><summary>More toy activities</summary><p>Keep going when you feel like it. These stops can exceed your daily time budget.</p><div className="guide-more-filters" aria-label="More activity types">{[['weekly','Weekly rep'],['toys','Toy stops'],['all','All']].map(([id,label])=><button key={id} className={moreFilter===id?'active':''} aria-pressed={moreFilter===id} onClick={()=>setMoreFilter(id)}>{label}</button>)}</div><div className="guide-more-list">{extraChoices.map(s=><button key={s.key} className={s.key===current?.key?'active':''} onClick={()=>setSelected(s.key)}><span><b>{s.title}{s.unit.difficulty&&s.unit.difficulty!=='Run'?` · ${s.unit.difficulty}`:''}</b><small>{s.unit.location}</small><em>{s.unit.rewards.slice(0,2).map(r=>r.name).join(' · ')}</em></span><ArrowRight size={15}/></button>)}{!extraChoices.length&&<p>Nothing missing in this group right now. Try another group or check your full planner.</p>}</div></details>}
  <div className="guide-foot"><p><span className={p.hasCompanion?'guide-status-dot':''}/>{p.syncBusy?'Updating your game progress…':p.hasCompanion?'Progress syncs after logout or /reload.':'Saved game progress updates this guide.'}</p><div><button className="text-button" aria-expanded={options} onClick={()=>setOptions(!options)}><SlidersHorizontal size={14}/>Preferences</button><button className="text-button" onClick={p.onDetails}>Full planner<ArrowUpRight size={13}/></button></div></div>
  {options&&<div className="guide-options"><label>Play with<select aria-label="Guide character" value={prefs.actor} disabled={p.disabled} onChange={e=>void preferences({actor:e.target.value})}><option value="all">Both characters</option><option value="priest">{settings.priest}</option><option value="druid">{settings.druid}</option></select></label><label>Time available<select aria-label="Guide time budget" value={prefs.minutes} disabled={p.disabled} onChange={e=>void preferences({minutes:Number(e.target.value)})}>{[...new Set([15,30,60,prefs.minutes])].sort((a,b)=>a-b).map(n=><option key={n} value={n}>{n} minutes</option>)}</select></label><button className="text-button" onClick={p.onConnection}>Game connection<ArrowUpRight size={13}/></button>{!p.compact&&<a className="guide-window-link" href="/?guide=1">Compact view in this tab<ArrowRight size={13}/></a>}<p>Timers, reset dates and access evidence remain in the full planner. Manual corrections are optional.</p></div>}
 </section>;
}
