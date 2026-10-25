import {Check,ArrowUpRight} from 'lucide-react';
import {addonImportCoverage,type AddonSnapshot} from '../lib/sync';
import type {Settings} from '../lib/planner';
export default function AddonImportStatus({addons,settings,actor='all',onDetails}:{addons:AddonSnapshot[];settings:Settings;actor?:string;onDetails?:()=>void}){
 const coverage=addonImportCoverage(addons,settings,actor);if(!coverage.length)return null;
 return <div className="addon-import-status" role="status" aria-label="Addon import status">
  {coverage.map(c=><div key={c.actor}><b><Check size={15}/>{c.name} addon export imported · {new Date(c.at).toLocaleString('en-GB',{timeZone:settings.timezone,month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</b>
   <p>{c.questFlags.toLocaleString('en-GB')} quest flags · {c.raidSaves} raid saves · {c.learnedRecipes} learned recipes · {c.cooldowns} cooldown observations</p>
   {!c.applied?<p>Saved, but not attached to this character’s current Battle.net identity. Sync both characters to check the match, then import this export again.</p>:c.cooldowns===0?<p>No profession cooldowns were captured. Open this character’s own profession window and its expansion recipe lists in game, then export again.</p>:<p>Captured evidence is applied. Routes that haven’t been observed can still need a check.</p>}
  </div>)}
  {onDetails&&<button className="text-button" onClick={onDetails}>View import details<ArrowUpRight size={13}/></button>}
 </div>;
}
