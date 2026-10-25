import data from './data/toy-activities.json';
import type {Activity} from './catalog';
import {boundCharacter,characterScope} from './characters';
import {turnedInThisPeriod,questPeriod} from './quest-progress';
import type {CharacterProgress,GoalEligibility} from './progression';
import type {Records,Settings} from './planner';

export const toyActivities=data.activities as Activity[];
export const TOY_ACTIVITIES_VERSION=data.version;
export const TOY_ACTIVITIES_CHECKED=data.checkedAt;
const ownProgress=(actor:string,settings:Settings,progress:CharacterProgress[])=>{const ref=boundCharacter(settings,actor);return ref?progress.find(p=>characterScope(p.ref)===characterScope(ref)):undefined;};
export function routeActors(a:Activity,actors:string[],settings:Settings,progress:CharacterProgress[]){
 if(!a.toyRoute?.warband||actors.length<2)return actors;
 // One reputation stop for the Warband, preferably on the main. An accepted
 // weekly on the assigned alt can make that character the useful choice.
 return [actors.find(actor=>ownProgress(actor,settings,progress)?.inGame?.questLogIds.some(id=>a.toyRoute!.questIds.includes(id)))||actors.find(actor=>actor==='priest')||actors[0]];
}
export function routeQuestDone(a:Activity,actor:string,settings:Settings,progress:CharacterProgress[],now:number){
 if(a.cadence!=='weekly'||!a.toyRoute?.questIds.length)return false;
 const actors=a.toyRoute.warband?['priest','druid']:[actor];
 return actors.some(who=>a.toyRoute!.questIds.some(id=>turnedInThisPeriod(id,'weekly',ownProgress(who,settings,progress),now,settings)));
}
export function toyRouteEligibility(a:Activity,actor:string,settings:Settings,progress:CharacterProgress[],now:number):GoalEligibility{
 const route=a.toyRoute!,p=ownProgress(actor,settings,progress),game=p?.inGame;
 const evidence:GoalEligibility['evidence']=[{source:'Verified toy route',detail:`Reviewed ${TOY_ACTIVITIES_CHECKED}. ${a.source}`}];
 const rep=route.reputation&&p?.reputations.data?.find(r=>r.id===route.reputation!.id);
 if(rep)evidence.push({source:'Blizzard reputations',detail:`${rep.name}: ${rep.standing}. Raw reputation is not converted into an assumed Renown rank.`,at:p?.reputations.fetchedAt});
 if(route.access==='public')return {state:'ready',reason:route.reputation?'A toy reward stop; purchases still depend on your unlocked rewards and materials.':'An ongoing in-game toy route is available to check.',nextAction:a.steps[0],evidence};
 const active=game&&game.at>=questPeriod('weekly',now,settings)&&game.at<=now&&game.questLogIds.some(id=>route.questIds.includes(id));
 const past=game?.data.questTurnIns?.find(q=>route.questIds.includes(q.id)&&q.at<=now);
 if(active||past){evidence.push({source:'WoW addon · quest evidence',detail:active?'The weekly quest is in this character’s current-period log.':'A previous dated turn-in establishes observed access; the current event or quest offer is checked in game.',at:active?game!.at:past!.at});return {state:'ready',reason:'This quest route has been observed on this character.',nextAction:a.steps[0],evidence};}
 return {state:'unknown',reason:route.kind==='craft'?'The recipe must be checked in this character’s Engineering window.':'The current quest or event offer has not been observed on this character.',nextAction:a.steps[0],evidence};
}
