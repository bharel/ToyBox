import {ScrollText,Clock3} from "lucide-react";
import type {Activity} from "../lib/catalog";
import type {Records,Settings} from "../lib/planner";
import {questProgressFor,type AddonSnapshot} from "../lib/sync";

export default function QuestEvidence({activity,addons,records,settings,now}:{activity:Activity;addons:AddonSnapshot[];records:Records;settings:Settings;now:number}){
 if(!activity.questId||!["weekly","daily"].includes(activity.cadence))return null;
 const evidence=questProgressFor(activity,addons,records,settings,now);
 const captured=(at:number)=>new Intl.DateTimeFormat(undefined,{timeZone:settings.timezone,month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(at);
 const labels:Record<string,string>={"turned-in":"Turned in at export",ready:"Ready to turn in", "in-progress":"In progress at export","not-completed":"Not completed at export","not-reported":"Quest not reported"};
 return <div className="detail-section quest-evidence"><h3><ScrollText size={16}/>In-game quest progress <small>#{activity.questId}</small></h3>
  {!evidence.length&&<p className="hint">Import an addon export for your assigned character to see objectives here. The character name and realm must match Settings.</p>}
  {evidence.map(({snapshot,quest,current,state})=><div className={`quest-evidence-card ${current?"":"snapshot-stale"}`} key={`${snapshot.character.region}:${snapshot.character.realm}:${snapshot.character.name}`}>
   <div className="quest-evidence-title"><b>{snapshot.character.name}<small>{snapshot.character.realm}</small></b><span>{current?labels[state]:"Previous reset"}</span></div>
   <p className="quest-capture"><Clock3 size={11}/>Captured {captured(snapshot.exportedAt)}{!current&&" · Re-export to check this reset."}</p>
   {quest?.objectives?.map((o,i)=><div className="evidence-objective" key={i}><div><span>{o.text}</span><b>{o.finished?"✓":`${o.fulfilled}/${o.required}`}</b></div>{o.required>0&&<progress aria-label={o.text} value={Math.max(0,Math.min(o.fulfilled,o.required))} max={o.required}/>}</div>)}
   {current&&state==="ready"&&<p className="hint">Objectives are complete. The attempt is marked automatically after the addon reports the quest as turned in.</p>}
  </div>)}
  <p className="hint">For a quest outside your log, run <code>/toybox watch {activity.questId}</code> before your next export. Only reported turn-ins mark an attempt; toy ownership is tracked separately.</p>
 </div>
}
