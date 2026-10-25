import type {CharacterProgress} from './progression';
import type {Routine} from './routines';
import {boundCharacter,characterScope} from './characters';
import {dailyStart,weeklyStart,DAY,type Records,type Settings} from './planner';
import {findForQuest} from './legion-archaeology';
import type {GameEvidence} from './game-evidence';
export function parseQuestEvidence(g:GameEvidence,exportedAt:number):Partial<GameEvidence>{
 const ms=(n:number)=>n<1e12?n*1000:n,at=ms(exportedAt),validAt=(n:number)=>Number.isFinite(n)&&ms(n)>=1577836800000&&ms(n)<=at,id=(n:number)=>Number.isInteger(n)&&n>0&&n<1e8;
 function check<T>(value:T[]|undefined,max:number,test:(v:T)=>boolean,message:string){if(value!==undefined&&(!Array.isArray(value)||value.length>max||!value.every(test)))throw Error(message);}
 check(g.questTurnIns,1000,q=>!!q&&id(q.id)&&typeof q.title==='string'&&q.title.length<=300&&validAt(q.at)&&(q.frequency===undefined||Number.isInteger(q.frequency)&&q.frequency>=0&&q.frequency<=255)&&(q.resetAt===undefined||Number.isFinite(q.resetAt)&&ms(q.resetAt)>ms(q.at)&&ms(q.resetAt)<=ms(q.at)+15*DAY),'Invalid dated quest turn-ins.');
 check(g.questChecks,5000,q=>!!q&&id(q.id)&&typeof q.completed==='boolean'&&validAt(q.at),'Invalid quest checkpoint evidence.');
 if(g.archaeologyEndAt!==undefined&&(!Number.isFinite(g.archaeologyEndAt)||ms(g.archaeologyEndAt)<=at||ms(g.archaeologyEndAt)>at+14*DAY+300000))throw Error('Invalid archaeology timer.');
 if(g.professions!==undefined){if(!g.professions||!validAt(g.professions.at)||!Array.isArray(g.professions.data))throw Error('Invalid in-game profession evidence.');check(g.professions.data,20,p=>!!p&&id(p.id)&&typeof p.name==='string'&&p.name.length<=200&&Number.isFinite(p.skill)&&Number.isFinite(p.max)&&p.skill>=0&&p.max>=p.skill,'Invalid in-game profession evidence.');}
 return {...(g.questTurnIns?{questTurnIns:g.questTurnIns.map(q=>({...q,at:ms(q.at),...(q.resetAt?{resetAt:ms(q.resetAt)}:{})}))}:{}),...(g.questChecks?{questChecks:g.questChecks.map(q=>({...q,at:ms(q.at)}))}:{}),...(g.archaeologyEndAt?{archaeologyEndAt:ms(g.archaeologyEndAt)}:{}),...(g.professions?{professions:{...g.professions,at:ms(g.professions.at)}}:{})};
}
export function questPeriod(cadence:'daily'|'weekly',now:number,settings:Settings){return cadence==='daily'?dailyStart(now,settings.dailyHour,settings.dailyAnchor):weeklyStart(now,settings.weeklyHour,settings.weeklyAnchor);}
export function turnedInThisPeriod(id:number,cadence:'daily'|'weekly',p:CharacterProgress|undefined,now:number,settings:Settings){
 const start=questPeriod(cadence,now,settings),end=start+(cadence==='daily'?DAY:7*DAY),game=p?.inGame;
 const frequency=cadence==='daily'?1:2,repeatable=game?.questLog?.some(q=>q.id===id&&q.frequency===frequency)||game?.data.questTurnIns?.some(q=>q.id===id&&q.frequency===frequency);
 return !!game&&(game.data.questTurnIns?.some(q=>q.id===id&&q.at>=start&&q.at<=now&&(!q.resetAt||now<q.resetAt))||repeatable&&game.at>=start&&game.at<=now&&now<end&&(game.data.questChecks?.some(q=>q.id===id&&q.completed&&q.at>=start)||game.completedQuestIds.includes(id)));
}
export function linkedRoutineDone(r:Routine,actor:string,progress:CharacterProgress[],settings:Settings,now:number,records:Records={}){
 const ref=boundCharacter(settings,actor),p=ref&&progress.find(p=>characterScope(p.ref)===characterScope(ref));
 if(r.id==='legion-archaeology'&&p?.inGame){const timer=p.inGame.data.archaeologyEndAt,anchor=Number(records['routine-anchor:legion-archaeology']),end=timer&&timer>now?timer:anchor&&anchor<=now?anchor+(Math.floor((now-anchor)/(14*DAY))+1)*14*DAY:undefined,start=end?end-14*DAY:weeklyStart(now,settings.weeklyHour,settings.weeklyAnchor);return !!p.inGame.data.questTurnIns?.some(q=>q.at>=start&&q.at<=now&&findForQuest(q.id)?.quests.at(-1)?.id===q.id);}
 return !!p&&!!r.questIds?.length&&r.cadence!=='fortnightly'&&r.questIds.every(id=>turnedInThisPeriod(id,r.cadence as 'daily'|'weekly',p,now,settings));
}
export function observedQuestRows(progress:CharacterProgress[],settings:Settings,now:number){
 return (['priest','druid'] as const).flatMap(actor=>{
  const ref=boundCharacter(settings,actor),p=ref&&progress.find(p=>characterScope(p.ref)===characterScope(ref));if(!p?.inGame)return [];
  const game=p.inGame,ids=new Set([...game.questLog?.filter(q=>q.frequency===1||q.frequency===2||q.frequency===3||findForQuest(q.id)).map(q=>q.id)||[],...game.data.questTurnIns?.filter(q=>now-q.at<14*DAY&&(q.frequency===1||q.frequency===2||q.frequency===3||findForQuest(q.id))).map(q=>q.id)||[]]);
  return [...ids].map(id=>{const q=game.questLog?.find(q=>q.id===id),event=game.data.questTurnIns?.filter(q=>q.id===id).sort((a,b)=>b.at-a.at)[0],frequency=q?.frequency??event?.frequency,cadence=findForQuest(id)?'archaeology':frequency===1?'daily':frequency===2?'weekly':'scheduled',archEnd=cadence==='archaeology'&&game.data.archaeologyEndAt&&game.data.archaeologyEndAt>now?game.data.archaeologyEndAt:undefined,start=archEnd?archEnd-14*DAY:questPeriod(cadence==='daily'?'daily':'weekly',now,settings),fresh=game.at>=start&&game.at<=now;
   const done=cadence==='daily'||cadence==='weekly'?turnedInThisPeriod(id,cadence,p,now,settings):!!event&&event.at<=now&&(!!archEnd&&event.at>=start||!!event.resetAt&&now<event.resetAt);
   return {id,actor,title:q?.title||event?.title||`Quest #${id}`,cadence,state:done?'turned-in':q&&fresh?q.complete?'ready':'in-progress':event&&cadence!=='daily'&&cadence!=='weekly'?'turn-in-recorded':'not-reported',objectives:q&&fresh?q.objectives||[]:[],at:q?game.at:event?.at,deadline:cadence==='daily'||cadence==='weekly'?questPeriod(cadence,now,settings)+(cadence==='daily'?DAY:7*DAY):archEnd||event?.resetAt};
  });
 });
}
