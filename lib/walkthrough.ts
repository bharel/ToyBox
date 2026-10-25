/** Data-only walkthrough interpreter. Times are Unix seconds, matching the addon. */
export type Truth = boolean | null;
export type Destination = {mapID:number;x:number;y:number;label?:string;interior?:boolean;directions?:string};
export type Condition = {kind?:string;all?:Condition[];any?:Condition[];negate?:Condition;atLeast?:number;rules?:Condition[];[key:string]:unknown};
export type GuideNode = {id:string;kind:string;text:string;questId?:number;objectiveIndex?:number;when?:Condition;requires?:Condition;completeWhen?:Condition;after?:string[];afterAny?:string[];destination?:Destination;nativeWaypoint?:boolean;manual?:boolean;acquisitionRecovery?:boolean;hideWhenUnknown?:boolean;unknownText?:string;recovery?:{text:string;destination?:Destination};sources:string[]};
type DailySet={id:string;collectionQuestId:number;stage?:string;label:string;target:string;groups:{id:string;questIds:number[]}[]};
type ProgressActivities={collectionQuestId:number;factionId:number;mapID:number;label:string;excludeQuestIds:number[];source:string;destination?:Destination};
export type Walkthrough = {version:2;contentVersion:string;nodes:GuideNode[];completeWhen?:Condition;includesPrerequisites?:boolean;routeIds:string[];dailySets?:DailySet[];progressActivities?:ProgressActivities};
type Timed={at:number};
type Quest={title?:string;complete?:boolean;objectives?:{text?:string;finished?:boolean;numFulfilled?:number;numRequired?:number;objectiveID?:number}[]};
export type GuideObservations = {guid?:string;region?:string;faction?:string;class?:string;level?:number;at?:number;questsAt?:number;quests?:Record<number,Quest>;offersAt?:number;offers?:Record<number,number>;flags?:Record<number,Timed&{value:boolean;source?:string}>;turnIns?:Record<number,number>;dailyResetAt?:number;weeklyResetAt?:number;inventory?:Timed&{data:Record<number,number>};equipped?:Timed&{data:Record<number,boolean>};currencies?:Record<number,Timed&{quantity:number;isAccountWide?:boolean;isAccountTransferable?:boolean}>;recipes?:Record<number,{learned?:boolean;invalidatedAt?:number}>;professionsAt?:number;professions?:Record<number,unknown>;reputations?:Record<number,Timed&{renown?:number;friendshipRank?:number;data?:{currentStanding?:number;reaction?:number}}>;achievements?:Record<number,Timed&{completed?:boolean;characterCompleted?:boolean;criteria?:Record<number,{completed:boolean;characterSpecific?:boolean}>}>;archaeology?:Timed&{id:string;endAt?:number};interfaces?:Record<string,Timed&{open:boolean}>;skipped?:Record<string,number>;continued?:Record<string,Record<string,number>>;missions?:Record<number,Timed&{available?:{missionID:number;name?:string}[];running?:{missionID:number;missionEndTime?:number;timeLeftSeconds?:number}[]}>};
export type GuideContext={now:number;owned:ReadonlySet<number>;characters?:GuideObservations[];location?:Destination};
const fresh=(at:number|undefined,now:number)=>at!==undefined&&at<=now&&now-at<=300;
function inPeriod(at:number|undefined,s:GuideObservations,cadence:string,now:number){const end=cadence==='daily'?s.dailyResetAt:s.weeklyResetAt;return at!==undefined&&end!==undefined&&end>now&&at<=now&&at>=end-(cadence==='daily'?86400:604800);}
export function evaluateCondition(r:Condition|undefined,s:GuideObservations,c:GuideContext,depth=0):Truth{
 if(!r||depth>16)return null;
 const sub=(v:Condition)=>evaluateCondition(v,s,c,depth+1);
 if(r.all||r.any){const values=(r.all||r.any||[]).map(sub);if(r.all&&values.includes(false))return false;if(r.any&&values.includes(true))return true;return values.includes(null)?null:!!r.all;}
 if(r.negate){const v=sub(r.negate);return v===null?null:!v;}
 if(r.atLeast!==undefined){const values=(r.rules||[]).map(sub),yes=values.filter(v=>v===true).length,unknown=values.filter(v=>v===null).length;return yes>=r.atLeast?true:yes+unknown<r.atLeast?false:null;}
 const n=(key:string)=>Number(r[key]),str=(key:string)=>String(r[key]);
 switch(r.kind){
 case 'questTurnedInSince':{const raw=s as GuideObservations&{activityStarts?:Record<string,{sequence:number}>;turnInRevisions?:Record<number,number>};const start=raw.activityStarts?.[str('guideId')];return start?(r.questIds as number[]||[]).some(id=>(raw.turnInRevisions?.[id]||0)>start.sequence):null;}
 case 'toyOwned':return c.owned.has(n('itemId'));
 case 'faction':return s.faction?s.faction.toLowerCase()===str('value').toLowerCase():null;
 case 'class':return s.class?s.class===r.value:null;
 case 'level':return s.level===undefined?null:s.level>=n('value');
 case 'questInLog':return fresh(s.questsAt,c.now)?!!s.quests?.[n('questId')]:null;
 case 'questOffered':return fresh(s.offersAt,c.now)?s.offers?.[n('questId')]!==undefined:null;
 case 'questReached':{const values=((r.questIds||[]) as number[]).map(id=>{
  const a=sub({kind:'questInLog',questId:id}),b=sub({kind:'questTurnedIn',questId:id,cadence:r.cadence,scope:r.scope,currentPeriodFlag:r.currentPeriodFlag});return a===true||b===true?true:a===null||b===null?null:false;
 });return values.includes(true)?true:values.includes(null)?null:false;}
 case 'itemEquipped':return fresh(s.equipped?.at,c.now)?s.equipped?.data[n('itemId')]===true:null;
 case 'evidenceUnavailable':return null;
 case 'auraStacks':{const aura=(s as GuideObservations&{auras?:Record<number,{stacks:number;at:number;expiresAt?:number}>}).auras?.[n('spellId')];return fresh(aura?.at,c.now)?!(aura!.expiresAt&&aura!.expiresAt>0&&aura!.expiresAt<=c.now)&&aura!.stacks>=Number(r.quantity??1):null;}
 case 'observedQuestSetComplete':{const set=(s as GuideObservations&{questSets?:Record<string,{resetAt:number;completeScan?:boolean;quests:Record<number,number>}>}).questSets?.[str('setId')],end=r.cadence==='daily'?s.dailyResetAt:s.weeklyResetAt;if(!set||r.requireCompleteScan&&set.completeScan!==true||set.resetAt!==end||set.resetAt<=c.now)return null;const ids=Object.keys(set.quests).filter(id=>!r.questIds||(r.questIds as number[]).includes(Number(id)));if(!ids.length)return null;const values=ids.map(id=>sub({kind:'questTurnedIn',questId:Number(id),cadence:r.cadence,currentPeriodFlag:true}));return values.includes(false)?false:values.includes(null)?null:true;}
 case 'questObjectivesComplete':case 'questObjective':{
  if(!fresh(s.questsAt,c.now))return null;const q=s.quests?.[n('questId')];if(!q)return null;
  if(r.kind==='questObjectivesComplete')return q.complete??null;
  const o=q.objectives?.[n('objectiveIndex')-1];if(!o||r.objectiveId!==undefined&&o.objectiveID!==r.objectiveId)return null;
  return o.finished===true||o.numFulfilled!==undefined&&o.numRequired!==undefined&&o.numFulfilled>=o.numRequired;
 }
 case 'questTurnedIn':{
  const id=n('questId'),cadence=str('cadence');
  if(cadence==='daily'||cadence==='weekly'){
   if(r.scope==='warband'&&c.characters?.some(alt=>alt.region===s.region&&inPeriod(alt.turnIns?.[id],alt,cadence,c.now)))return true;
   if(inPeriod(s.turnIns?.[id],s,cadence,c.now))return true;
   const f=s.flags?.[id];return r.currentPeriodFlag&&f?.source==='current-client'&&inPeriod(f.at,s,cadence,c.now)?f.value:null;
  }
  if(cadence==='fortnightly'){const end=s.archaeology?.endAt,at=s.turnIns?.[id];return end&&end>c.now&&at!==undefined&&at<=c.now&&at>=end-14*86400?true:null;}
  if(r.scope==='warband'&&c.characters?.some(alt=>alt.region===s.region&&alt.flags?.[id]?.value===true&&alt.flags[id].at<=c.now))return true;
  const f=s.flags?.[id];return f?.value===true&&f.at<=c.now?true:fresh(f?.at,c.now)?f?.value??null:null;
 }
 case 'itemCount':return fresh(s.inventory?.at,c.now)?(s.inventory?.data[n('itemId')]??0)>=Number(r.quantity??1):null;
 case 'currency':{const v=s.currencies?.[n('currencyId')];return fresh(v?.at,c.now)?v!.quantity>=Number(r.quantity??1):null;}
 case 'money':{const v=(s as GuideObservations&{money?:Timed&{quantity:number}}).money;return fresh(v?.at,c.now)?v!.quantity>=Number(r.quantity??1):null;}
 case 'merchantOffer':{const m=(s as GuideObservations&{merchant?:Timed&{npcId?:number;offers:Record<number,{usable?:boolean}>}}).merchant;if(!fresh(m?.at,c.now))return null;if(r.npcId&&m!.npcId!==r.npcId)return m!.npcId?false:null;const offer=m!.offers[n('itemId')];return offer?offer.usable??null:false;}
 case 'recipeLearned':{const v=s.recipes?.[n('spellId')];return v&&!v.invalidatedAt?v.learned??null:null;}
 case 'profession':return fresh(s.professionsAt,c.now)?!!s.professions?.[n('professionId')]:null;
 case 'reputation':{const v=s.reputations?.[n('factionId')],value=r.metric==='renown'?v?.renown:r.metric==='reaction'?v?.data?.reaction:r.metric==='friendshipRank'?v?.friendshipRank:r.metric===undefined||r.metric==='standing'?v?.data?.currentStanding:undefined;return fresh(v?.at,c.now)&&value!==undefined?value>=n('value'):null;}
 case 'achievement':{const v=s.achievements?.[n('achievementId')];return r.scope==='account'?v?.completed??null:r.scope==='character'?v?.characterCompleted??null:null;}
 case 'achievementCriterion':{const v=s.achievements?.[n('achievementId')]?.criteria?.[n('criteriaId')];return v&&(r.scope==='account'||v.characterSpecific)?v.completed:null;}
 case 'archaeologyChain':{const a=s.archaeology;return a&&a.at<=c.now&&(a.endAt?a.endAt>c.now:fresh(a.at,c.now))?a.id===r.chainId:null;}
 case 'interfaceObserved':{const v=s.interfaces?.[str('interface')] as (Timed&{open:boolean;npcId?:number})|undefined;return fresh(v?.at,c.now)?r.npcId&&v!.npcId!==r.npcId?(v!.npcId?false:null):v!.open:null;}
 case 'location':{const p=c.location;return p?p.mapID===r.mapID&&(p.x-n('x'))**2+(p.y-n('y'))**2<=Number(r.radius??.006)**2:null;}
 case 'missionState':{
  for(const v of Object.values(s.missions||{})){
   if(v.at>c.now)continue;
   const running=v.running?.find(m=>m.missionID===r.missionId);if(running){const end=running.missionEndTime??(running.timeLeftSeconds===undefined?undefined:v.at+running.timeLeftSeconds);if(end&&end>c.now)return r.state==='upcoming';if(fresh(v.at,c.now))return r.state==='collect';}
   if(fresh(v.at,c.now)&&v.available?.some(m=>m.missionID===r.missionId))return r.state==='available';
  }return null;
 }
 default:return null;
 }
}
type LiveRow=GuideNode&{available:boolean;counters?:string;count?:number;total?:number;longTermProgress?:{count:number;total:number;counters:string;carryText?:string};dailyProgress?:string;progressSummary?:string};
export function dailySession(graph:Walkthrough,guideId:string,s:GuideObservations,c:GuideContext,rows:LiveRow[]){
 for(const set of graph.dailySets||[]){
  const collection=s.quests?.[set.collectionQuestId];if(!collection)continue;
  const count=(collection.objectives||[]).reduce((sum,o)=>sum+(o.numFulfilled||0),0),total=(collection.objectives||[]).reduce((sum,o)=>sum+(o.numRequired||0),0);
  if(collection.complete||total>0&&count>=total){const terminal=rows.filter(row=>row.questId===set.collectionQuestId);return terminal.length?{rows:terminal,done:0,total:set.groups.length,waiting:false,resetAt:s.dailyResetAt,label:set.label}:undefined;}
  const progress={count,total,counters:`${count}/${total} ${set.target}`},observed=fresh(s.questsAt,c.now);let done=0;const selectedRows:LiveRow[]=[];
  for(const group of set.groups){
   let finished=group.questIds.some(id=>evaluateCondition({kind:'questTurnedIn',questId:id,cadence:'daily',currentPeriodFlag:true},s,c)===true);
   let selected=group.questIds.find(id=>!!s.quests?.[id]);if(selected)finished=false;
   selected??=group.questIds.find(id=>evaluateCondition({kind:'questOffered',questId:id},s,c)===true);
   if(finished){done++;continue;}
   const active=observed&&selected?rows.filter(row=>row.questId===selected):[];
   if(active.length){selectedRows.push(...active);continue;}
   const accept=graph.nodes.find(n=>n.kind==='accept'&&n.questId===(selected||group.questIds[0]));if(!accept)continue;
   const id=`${guideId}:${set.id}:${group.id}:offers`;
   if((s.skipped?.[id]??0)<=c.now&&(s.continued?.[guideId]?.[id]??0)<=c.now)selectedRows.push({...accept,id,kind:'observe',questId:undefined,manual:undefined,available:true,text:!observed?"Open your quest log to refresh today's Tournament quests.":group.questIds.length>1?'Speak to the marked daily questgiver and accept the weapon-retrieval daily offered today. Only one of the three alternatives is needed.':accept.text});
  }
  const ranks:Record<string,number>={turnin:0,objective:1,accept:2,observe:3};selectedRows.sort((a,b)=>(ranks[a.kind]??4)-(ranks[b.kind]??4)||a.id.localeCompare(b.id,'en'));
  const waiting=observed&&done===set.groups.length&&done>0;
  if(waiting)selectedRows.splice(0,selectedRows.length,{id:`${guideId}:${set.id}:reset`,kind:'observe',available:false,text:`Today's ${set.stage||'Valiant'} dailies are complete. Return after the daily reset for the next set; your seals carry over.`,sources:[]});
  for(const row of selectedRows){row.longTermProgress=progress;row.dailyProgress=`${done}/${set.groups.length} dailies turned in today`;}
  return {rows:selectedRows,done,total:set.groups.length,waiting,resetAt:s.dailyResetAt,label:set.label,progress};
 }
}
export function progressActivities(graph:Walkthrough,guideId:string,s:GuideObservations,c:GuideContext):LiveRow[]|undefined{
 const config=graph.progressActivities,q=config&&s.quests?.[config.collectionQuestId];if(!config||!q||q.complete)return;
 const tasks=s as GuideObservations&{repTasksAt?:number;repTasks?:Record<number,Record<number,{title?:string;active?:boolean;isTask?:boolean;eligible?:boolean;expiresAt?:number;destination?:Destination}>>};
 const count=(q.objectives||[]).reduce((n,o)=>n+(o.numFulfilled||0),0),total=(q.objectives||[]).reduce((n,o)=>n+(o.numRequired||0),0);
 const progress={count,total,counters:`${count}/${total} ${config.label}`,carryText:'progress within this weekly quest'},excluded=new Set([config.collectionQuestId,...config.excludeQuestIds]);
 const rows:LiveRow[]=[];
 if(fresh(s.questsAt,c.now)&&fresh(tasks.repTasksAt,c.now))for(const [key,task] of Object.entries(tasks.repTasks?.[config.factionId]||{})){
  const id=Number(key),active=s.quests?.[id],returned=s.turnIns?.[id];
  if(excluded.has(id)||task.expiresAt!==undefined&&task.expiresAt<=c.now||task.active&&!active||task.isTask&&task.eligible!==true&&!active||returned!==undefined&&returned>=tasks.repTasksAt!&&returned<=c.now)continue;
  const turnIn=active?.complete&&!task.isTask;
  const row:LiveRow={id:`${guideId}:progress:${id}`,questId:id,kind:turnIn?'turnin':'objective',available:true,sources:[config.source],destination:task.destination,longTermProgress:progress,text:`${turnIn?'Turn in':'Complete'} ${active?.title||task.title||'quest #'+id} for ${config.label}.`};
  if(active){const objectives=(active.objectives||[]).filter(o=>!o.finished);if(objectives.length){row.counters=objectives.map(o=>o.text||'').join(' · ');row.count=objectives.reduce((n,o)=>n+(o.numFulfilled||0),0);row.total=objectives.reduce((n,o)=>n+(o.numRequired||0),0);}}
  if((s.skipped?.[row.id]??0)<=c.now)rows.push(row);
 }
 rows.sort((a,b)=>a.kind===b.kind?a.questId!-b.questId!:a.kind==='turnin'?-1:1);
 if(!rows.length)rows.push({id:`${guideId}:progress:observe`,kind:'observe',available:true,text:'Open the Zaralek Cavern map and check currently available Loamm Niffen reputation quests. No additional eligible activity is established by the saved observations; your weekly reputation progress is kept.',destination:config.destination,longTermProgress:progress,sources:[config.source]});
 for(const row of rows)row.progressSummary=`Available reputation activities · ${rows.length===1&&rows[0].kind==='observe'?'not established':rows.length}`;
 return rows;
}
export function walkthroughSteps(graph:Walkthrough,guideId:string,s:GuideObservations,c:GuideContext){
 const learn=graph.nodes.find(n=>(n.kind==='learn'||n.acquisitionRecovery)&&n.requires&&evaluateCondition(n.requires,s,c)===true&&evaluateCondition(n.completeWhen,s,c)!==true);if(learn)return {complete:false,rows:[{...learn,available:true,counters:undefined as string|undefined,count:undefined as number|undefined,total:undefined as number|undefined}]};
 if(graph.completeWhen&&evaluateCondition(graph.completeWhen,s,c)===true)return {complete:true,rows:[]};
 const passed:Record<string,boolean>={};
 for(const n of graph.nodes)passed[n.id]=(!!n.when&&evaluateCondition(n.when,s,c)===false)||(!!n.completeWhen&&evaluateCondition(n.completeWhen,s,c)===true)||(s.skipped?.[n.id]??0)>c.now||(s.continued?.[guideId]?.[n.id]??0)>c.now;
 const rows=graph.nodes.filter(n=>!passed[n.id]&&!(n.hideWhenUnknown&&evaluateCondition(n.when,s,c)===null)&&(n.after||[]).every(id=>passed[id])&&(!n.afterAny||n.afterAny.some(id=>passed[id]))).map(n=>{
  const branch=n.when?evaluateCondition(n.when,s,c):true,requirements=n.requires?evaluateCondition(n.requires,s,c):true;
  const row={...n,available:branch!==null&&requirements===true,counters:undefined as string|undefined,count:undefined as number|undefined,total:undefined as number|undefined};
  if(branch===null){row.kind='observe';row.text=n.unknownText||n.recovery?.text||'Visit the indicated NPC or interface to observe the available branch.';}
  if(n.requires&&requirements!==true){row.kind='observe';row.text=n.recovery?.text||'Follow the prerequisite action first, then return here.';row.destination=n.recovery?.destination||n.destination;}
  const q=n.questId?s.quests?.[n.questId]:undefined;
  if(q&&n.kind==='objective'){const objectives=(q.objectives||[]).filter((o,i)=>!o.finished&&(!n.objectiveIndex||n.objectiveIndex===i+1));if(objectives.length){row.counters=objectives.map(o=>o.text||'').join(' · ');row.count=objectives.reduce((a,o)=>a+(o.numFulfilled||0),0);row.total=objectives.reduce((a,o)=>a+(o.numRequired||0),0);}}
  return row;
 });const session=dailySession(graph,guideId,s,c,rows);return {complete:false,rows:progressActivities(graph,guideId,s,c)||session?.rows||rows,dailySession:session};
}
