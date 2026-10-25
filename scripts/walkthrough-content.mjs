import {catalogueContent} from './catalogue-content.mjs';
import {readFileSync} from 'node:fs';
import {reliabilityContent} from './reliability-content.mjs';
import {sessionContent} from './session-content.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const authored=read('lib/data/walkthrough-authoring.json');
const priority=read('lib/data/priority-guide-facts.json');
const extra=read('lib/data/walkthrough-extra-facts.json');
const progression=read('lib/data/walkthrough-progression-facts.json');
const batch=read('lib/data/walkthrough-batch-facts.json');
const recipes=read('lib/data/toy-recipe-facts.json');
const maps={GRIZZLY_HILLS:116,HOWLING_FJORD:117,ICECROWN:118,BOREAN_TUNDRA:114,DRAGONBLIGHT:115,ZULDRAK:121,THE_STORM_PEAKS:120,CRYSTALSONG_FOREST:127,LEGION_THE_UNDERBELLY:628,LEGION_DALARAN:627,AZSUNA:630,STORMHEIM:634,VALSHARAH:641,HIGHMOUNTAIN:650,SURAMAR:680,THE_WAKING_SHORES:2022,OHNAHRAN_PLAINS:2023,THE_AZURE_SPAN:2024,THALDRASZUS:2025,VALDRAKKEN:2112,ZARALEK_CAVERN:2133};
const destination=d=>d&&(d.mapID||maps[d.mapKey])&&Number.isFinite(d.x)&&Number.isFinite(d.y)?{mapID:d.mapID||maps[d.mapKey],x:d.x,y:d.y,...(d.label?{label:d.label}:{})}:undefined;
const any=(...rules)=>({any:rules.flat().filter(Boolean)}),all=(...rules)=>({all:rules.flat().filter(Boolean)});
const owned=id=>({kind:'toyOwned',itemId:id});
const inLog=id=>({kind:'questInLog',questId:id});
const done=(id,cadence='once',scope='character',flag=false)=>({kind:'questTurnedIn',questId:id,cadence,scope,...(flag?{currentPeriodFlag:true}:{})});
const bag=id=>({kind:'itemCount',itemId:id,quantity:1});
const title=q=>q.title||`quest #${q.id||q.questID}`;
function point(r){if(!r)return undefined;if(Array.isArray(r.coord)&&r.coord.length===3)return {mapID:r.coord[2],x:r.coord[0]/100,y:r.coord[1]/100};for(const [id,points] of Object.entries(r.coords||{}))if(Array.isArray(points)&&Array.isArray(points[0])&&Number(id)>0)return {mapID:Number(id),x:points[0][0]/100,y:points[0][1]/100};}
function normalRule(rule){if(!rule)return undefined;const out={...rule};if(out.scope==='account'&&out.kind==='questTurnedIn')out.scope='warband';if(out.kind==='achievement'&&!out.scope)out.scope='account';if(out.kind==='currentPeriodFlag'){out.kind='questTurnedIn';out.currentPeriodFlag=true;out.cadence='weekly';}delete out.period;if(out.all)out.all=out.all.map(normalRule);if(out.any)out.any=out.any.map(normalRule);return out;}
function recovery(q){return {text:`If ${title(q)} is missing, speak to its indicated giver and check the preceding stage. If abandoned, accept it again; completed permanent stages are retained.`,destination:destination(q.accept?.destination)};}
function questNodes(q,{cadence='once',scope='character',prefix='quest',after,when,downstream=[],instructions,flag=false,hideWhenUnknown=false}={}){
 const id=q.id||q.questID,finish=done(id,cadence,scope,flag),seen=any(finish,downstream.length?{kind:'questReached',questIds:downstream,cadence,scope,currentPeriodFlag:flag}:undefined);
 const sources=[q.source].filter(Boolean),base=`${prefix}:q${id}`,pin=destination(q.accept?.destination)||point(q),action=instructions||q.actionInstructions||[];
 const firstIsAccept=/^(Accept|Take) |^Use .* to accept /i.test(action[0]||''),lastIsTurnIn=/^(Turn|Return|Bring) /i.test(action.at(-1)||'');
 const objectiveText=action.filter((_,i)=>!(i===0&&firstIsAccept)&&!(i===action.length-1&&lastIsTurnIn)).join(' ');
 const baseNode={questId:id,cadence,sources,recovery:recovery({...q,title:title(q)}),...(when?{when,hideWhenUnknown}:{}),...(after?{after}:{}),reason:`Progress through ${title(q)}.`};
 const accept={...baseNode,id:base+':accept',kind:'accept',text:action[0]?.startsWith('Accept ')?action[0]:`Accept ${title(q)}${q.accept?.npcId?` from NPC #${q.accept.npcId}`:q.accept?.objectId?` from the wanted poster (object #${q.accept.objectId})`:q.qgs?.[0]?` from NPC #${q.qgs[0]}`:''}.`,destination:pin,completeWhen:any(inLog(id),seen)};
 if(q.qss?.length){accept.text=`Use the quest-starting item from your bags to accept ${title(q)}.`;accept.itemId=q.qss[0];}
 const objectives=(q.objectives||[]).filter(o=>o.index&&o.destination);
 const middle=objectives.length?objectives.map(o=>({...baseNode,id:base+':objective-'+o.index,kind:'objective',objectiveIndex:o.index,text:objectiveText||`Objective: ${o.title?.replace(/^0\/\d+ /,'')||title(q)}.`,requires:inLog(id),nativeWaypoint:true,destination:destination(o.destination),completeWhen:any(seen,{kind:'questObjective',questId:id,objectiveIndex:o.index}),after:[accept.id]})):[{...baseNode,id:base+':objective',kind:'objective',text:objectiveText||`Complete the live objectives for ${title(q)}. Use its quest-map markers; the counters below update as you progress.`,requires:inLog(id),nativeWaypoint:true,completeWhen:any(seen,{kind:'questObjectivesComplete',questId:id}),after:[accept.id]}];
 const turnIn={...baseNode,id:base+':turnin',kind:'turnin',text:lastIsTurnIn?action.at(-1):`Turn in ${title(q)} at the completed quest's map marker.`,nativeWaypoint:true,requires:{kind:'questObjectivesComplete',questId:id},completeWhen:seen,after:middle.map(n=>n.id)};
 if(q.turnIn?.evidence?.startsWith('explicit'))turnIn.destination=destination(q.turnIn.destination);
 return [accept,...middle,turnIn];
}
function validation(g,nodes,gaps=[],routeIds=[]){
 g.walkthrough={version:2,contentVersion:'2.2.0',nodes,routeIds,includesPrerequisites:true,...g.walkthrough};
 g.validation={sourceChecked:!gaps.length,playtested:false,automated:false,reviewedAt:'2026-10-24',gaps};
 g.coverage=gaps.length?'partial-walkthrough':'walkthrough';g.coverageGaps=gaps;
 // Metadata provenance remains separate from actual walkthrough quality.
 return g;
}
const safeText=s=>String(s||'').replace(/\|c[0-9a-f]{8}|\|r/g,'').trim();
export function compileWalkthroughs({guides,toys,att}){
 const byId=new Map(guides.map(g=>[g.id,g])),toyMap=new Map(toys.map(t=>[t.itemId,t]));
 const sourceFor=r=>`https://github.com/ATTWoWAddon/AllTheThings/blob/${att.release}/db/Standard/Categories/${r.category}.lua`;
 const canonical=new Map(),audit=[];
 const entityPin=(kind,id)=>{const variants=att.entities?.[`${kind}:${id}`]||[];return variants.length===1?point(variants[0]):undefined;};
 for(const g of guides){
  if(!g.metadataRoute||!g.facts)continue;
  const r=g.facts,lineage=r.lineage||[],local=r.localFacts||{},source=sourceFor(r);
  const nearest=kind=>[...lineage].reverse().find(a=>a.kind===kind);
  const npc=nearest('NPC'),object=nearest('Object'),encounter=nearest('Encounter'),instance=nearest('Instance'),quest=nearest('Quest')||nearest('CharacterUnlockQuest'),recipe=nearest('Recipe'),mission=nearest('GarrisonMission');
  const desc=lineage.map(a=>a.description).filter(Boolean).join(' ');
  const pin=object?point(object)||entityPin('objectID',object.objectID):npc?point(npc)||entityPin('npcID',npc.npcID):point(r);
  const rawCost=local.cost;
  const cost=typeof rawCost==='number'?[['g',rawCost]]:Array.isArray(rawCost)?(typeof rawCost[0]==='string'?[rawCost]:rawCost):[];
  const prerequisites=local.sourceQuests||r.sourceQuests||[];
  const gaps=[];
  if(prerequisites.length)gaps.push(`Prerequisite relation for quest IDs ${prerequisites.join(', ')} needs a complete branch walkthrough.`);
  if(r.minReputation)gaps.push(`Faction ${r.minReputation[0]} progression to ${r.minReputation[1]} needs its connected activity/unlock walkthrough.`);
  if(r.requireSkill)gaps.push(`Profession ${r.requireSkill} unlock/recipe requirements need a connected walkthrough.`);
  if(/requires|require |only |must |summon|puzzle|pickpocket|interact|speak|talk to|order hall|campaign|rank|renown|combination| points|after|before/i.test(desc))gaps.push('Source-specific interaction, phase or prerequisite mechanics need authored actions.');
  if(desc&&!gaps.some(v=>v.includes('mechanics')))gaps.push('Detailed source mechanics need original authored actions before this route qualifies as complete.');
  let nodes=[],method;
  const reward=toyMap.get(r.itemId)?.name||`toy item #${r.itemId}`,learn={id:g.id+':learn',kind:'learn',text:`Use ${reward} from your bags to learn the toy.`,requires:bag(r.itemId),completeWhen:owned(r.itemId),sources:[source],recovery:{text:'If the toy is absent, check bags, bank and mail. Completing an activity or receiving a reward does not establish ownership.'}};
  if(npc&&cost.length){
   method='vendor';g.npcId=npc.npcID;g.costs=cost;g.destination=pin;
   if(!pin)gaps.push(`Vendor NPC ${npc.npcID} has no verified destination.`);
   if(cost.some(c=>Array.isArray(c)&&c[0]!=='g'))gaps.push('The vendor price is known; its required item/currency acquisition activities still need connected walkthroughs.');
   if(cost.length>1&&/rank|points|combination|any |either| or /i.test(desc)){g.costs=[];gaps.push('Price alternatives need an explicit cost choice; do not add every alternative together.');}
   nodes=[{id:g.id+':vendor',kind:'purchase',text:`Buy ${reward} from vendor NPC #${npc.npcID}. Check the displayed price and make the purchase yourself.`,destination:pin,completeWhen:any(bag(r.itemId),owned(r.itemId)),sources:[source],recovery:{text:'If the vendor does not sell it, check the listed faction, profession and quest prerequisites. Stock and costs are observed; Toybox never buys it for you.'}},learn];
  }else if(object){
   method='treasure';g.destination=pin;g.trackingQuestId=object.questID;g.questIds=[];
   if(!pin)gaps.push(`Object ${object.objectID} has no verified destination.`);
   nodes=[{id:g.id+':treasure',kind:'loot',text:`Open treasure object #${object.objectID} at the marked location and loot ${reward}.`,destination:pin,completeWhen:any(bag(r.itemId),owned(r.itemId)),sources:[source],recovery:{text:`If the object is absent, check the source's phase or prerequisites.${object.questID?` Hidden tracking quest ${object.questID} records the treasure; it is not a quest to accept.`:''}`}},learn];
  }else if(npc&&!encounter&&!quest&&!mission&&!recipe&&!cost.length){
   method='rare';g.destination=pin;g.questIds=[];g.trackingQuestId=npc.questID;
   if(!pin)gaps.push(`NPC ${npc.npcID} has no verified location.`);
   nodes=[{id:g.id+':defeat',kind:'loot',text:`Defeat NPC #${npc.npcID} at the marked location and loot for ${reward}. Repeat only while eligible; a kill does not prove the toy dropped.`,destination:pin,completeWhen:any(bag(r.itemId),owned(r.itemId)),sources:[source],recovery:{text:'If the enemy is absent, its spawn time is unknown. Check phase or summoning details; choose another activity while waiting.'}},learn];
  }else if(quest&&!r.achievementID){
   method='quest';const path=[],seen=new Set(),stack=new Set();
   const visit=id=>{
    if(seen.has(id))return;if(stack.has(id)){gaps.push(`Quest prerequisite cycle at ${id} requires source review.`);return;}stack.add(id);
    const variants=att.questVariants?.[String(id)]||[],matching=variants.filter(v=>!r.r||!v.r||v.r===r.r);
    const q=matching[0]||att.quests[String(id)];
    if(!q){gaps.push(`Quest ${id} has no source action record.`);stack.delete(id);return;}
    const predecessors=q.sourceQuests||[q.sourceQuest].filter(Boolean);
    if(predecessors.length>1&&q.sourceQuestNumRequired===undefined)gaps.push(`Quest ${id}: AND/OR semantics for ${predecessors.join(', ')} are not established.`);
    else for(const p of predecessors)visit(p);
    path.push({...q,id,source,accept:{npcId:q.qgs?.[0],destination:point(q)}});seen.add(id);stack.delete(id);
   };visit(quest.questID);
   if(!path.length)gaps.push(`Quest ${quest.questID} has no resolved action sequence.`);
   for(let i=0;i<path.length;i++){
    const q=path[i],prior=q.sourceQuests||[q.sourceQuest].filter(Boolean);
    if(!q.actionInstructions?.length)gaps.push(`Quest ${q.id} has live objective tracking, but its source-specific objective instructions and recovery have not been authored.`);
    if(!q.accept.destination&&!q.qss?.length)gaps.push(`Quest ${q.id} acceptance location is not established.`);
    if(q.qss?.length)gaps.push(`Starter item ${q.qss.join('/')} for quest ${q.id} needs its acquisition route.`);
    const when=prior.length?any(inLog(q.id),{kind:'questOffered',questId:q.id},q.sourceQuestNumRequired===1?any(prior.map(id=>done(id))):q.sourceQuestNumRequired===prior.length||prior.length===1?all(prior.map(id=>done(id))):{kind:'evidenceUnavailable'}):undefined;
    const cadence=priority.archaeology.some(chain=>chain.questIds.includes(q.id))?'fortnightly':q.isWeekly?'weekly':q.isDaily?'daily':'once';
    nodes.push(...questNodes(q,{prefix:g.id,when,hideWhenUnknown:!!when,downstream:path.slice(i+1).map(v=>v.id),cadence,flag:cadence!=='once'}));
   }
   nodes.push(learn);g.questIds=path.map(q=>q.id);
   // The relationship is no longer a generic unresolved prerequisite list.
   const generic=gaps.findIndex(v=>v.startsWith('Prerequisite relation'));if(generic>=0)gaps.splice(generic,1);
  }else if(recipe||r.category==='Craftables'){
   method='crafting';const variants=recipes.recipeSpells.filter(v=>v.productItemId===r.itemId);
   const spellIds=variants.map(v=>v.craftingSpellId);if(recipe?.recipeID&&!spellIds.includes(recipe.recipeID))spellIds.push(recipe.recipeID);
   if(!spellIds.length)gaps.push(`Toy ${r.itemId} has no verified crafting spell.`);
   gaps.push(`Recipe acquisition and specialization unlocks for toy ${r.itemId} need a connected walkthrough.`);
   g.recipeSpellIds=spellIds;g.recipeIdNamespace='client-crafting-spell';g.materialAlternatives=variants;
   nodes=[{id:g.id+':recipe',kind:'observe',text:`Open the profession recipe list and find ${reward}. Switch expansion tiers and clear filters if needed.`,completeWhen:any(spellIds.map(spellId=>({kind:'recipeLearned',spellId}))),sources:[source,recipes.source],recovery:{text:'A profession category does not prove this character knows the recipe. Check its source before spending materials.'}},{id:g.id+':craft',kind:'craft',text:`Review the learned recipe's materials and tools, then craft ${reward} yourself. Reagent qualities are alternatives within a slot, not cumulative costs.`,requires:any(spellIds.map(spellId=>({kind:'recipeLearned',spellId}))),completeWhen:any(bag(r.itemId),owned(r.itemId)),sources:[source,recipes.source]},learn];
  }else if(mission){
   method='mission';g.questIds=[];
   gaps.push(`Mission ${mission.missionID} table unlock, follower and mission-appearance prerequisites need authored steps.`);
   nodes=[{id:g.id+':table',kind:'observe',text:`Open this character's mission table and inspect toy mission #${mission.missionID}.`,sources:[source],completeWhen:any({kind:'missionState',missionId:mission.missionID,state:'available'},{kind:'missionState',missionId:mission.missionID,state:'upcoming'},{kind:'missionState',missionId:mission.missionID,state:'collect'})},{id:g.id+':mission',kind:'mission',text:`Choose followers and launch mission #${mission.missionID} yourself when it is available. Return to collect the completed mission's reward.`,completeWhen:any(bag(r.itemId),owned(r.itemId)),sources:[source],recovery:{text:'Missing mission data is not proof the mission is unavailable. Inspect its table; Toybox never launches missions or spends resources.'}},learn];
  }else if(instance&&encounter){
   method='instance';g.questIds=[];const entrance=point(instance)||entityPin('instanceID',instance.instanceID);
   const modes=r.difficulties||[r.difficultyID].filter(x=>[1,2,3,4,5,6,7,14,15,16,17,23,24,33].includes(x));
   if(!entrance)gaps.push(`Instance ${instance.instanceID} entrance is not established.`);
   if(!modes.length)gaps.push(`Difficulty group ${r.difficultyID||'unknown'} has no verified selectable difficulties.`);
   gaps.push(`Encounter ${encounter.encounterID} needs verified interior directions and any encounter-specific requirements.`);
   g.validDifficultyIds=modes;g.instanceId=instance.instanceID;g.encounterId=encounter.encounterID;
   nodes=[{id:g.id+':entrance',kind:'travel',text:`Travel to instance #${instance.instanceID}. Choose an eligible difficulty yourself before entering.`,destination:entrance,manual:true,sources:[source]},{id:g.id+':boss',kind:'loot',text:`Reach encounter #${encounter.encounterID}${encounter.npcID?` (NPC #${encounter.npcID})`:''}, defeat it and loot for ${reward}.`,completeWhen:any(bag(r.itemId),owned(r.itemId)),sources:[source],recovery:{text:'Check the observed boss/difficulty lockout. Unknown solo capability and drop percentages remain unknown.'}},learn];
  }
  if(!nodes.length){audit.push({guideId:g.id,itemId:r.itemId,category:r.category,reason:quest?'Quest source requires explicit prerequisite branches and action destinations.':recipe?'Crafted source requires learned recipe, materials and unlock walkthrough.':mission?'Mission source requires table unlock, mission prerequisites and observed availability.':`Acquisition relationship (${r.category}) needs a specific authored walkthrough.`});continue;}
  const key=JSON.stringify([r.itemId,method,object?.objectID,npc?.npcID,instance?.instanceID,encounter?.encounterID,r.r,r.c,cost,r.difficulties||r.difficultyID]);
  const existing=canonical.get(key);if(existing){g.aliasOf=existing.id;g.walkthrough=existing.walkthrough;g.validation=existing.validation;g.coverage=existing.coverage;continue;}canonical.set(key,g);
  g.walkthrough={version:2,contentVersion:'2.2.0',nodes,completeWhen:owned(r.itemId),routeIds:[g.id],includesPrerequisites:!gaps.length};validation(g,nodes,gaps,[g.id]);
  if(method==='quest'){
   const q=att.quests[String(quest.questID)],cadence=priority.archaeology.some(chain=>chain.questIds.includes(quest.questID))?'fortnightly':q?.isWeekly?'weekly':q?.isDaily?'daily':undefined;
   if(cadence){g.cadence=cadence;g.walkthrough.opportunityCompleteWhen=done(quest.questID,cadence,'character',cadence!=='fortnightly');}
  }
  if(g.trackingQuestId&&['daily','weekly'].includes(g.cadence))g.walkthrough.opportunityCompleteWhen=done(g.trackingQuestId,g.cadence,'character',true);
 }
 // Original curated sequences, including non-quest interactions and mailed rewards.
 for(const r of [...authored.routes,...extra.routes,...progression.routes,...batch.routes]){
  const existing=guides.find(g=>g.rewards?.length===1&&g.rewards[0]===r.itemId&&!g.metadataRoute&&(!g.authoredSourceId||g.authoredSourceId===r.id));
  const id=existing?.id||`walkthrough-${r.id}`;
  const sources=(r.sourceIds||[]).map(s=>[...(authored.sources||[]),...(extra.sources||[]),...(progression.sources||[]),...(batch.sources||[])].find(v=>v.id===s)?.url).filter(Boolean);
  if(r.source)sources.push(r.source);
  if(!sources.length&&r.sources)sources.push(...r.sources.map(v=>typeof v==='string'?v:v.url).filter(Boolean));
  const nodes=[];
  const complete=normalRule(r.finalCompletion)||owned(r.itemId);
  for(const step of r.steps||[]){
   const pin=destination(step.destination)||destination(step.fallbackDestination)||destination(r.destination);
   const base={id:id+':'+step.id,kind:step.kind,text:safeText(step.text),destination:pin,sources:step.sources||sources,completeWhen:normalRule(step.completeOn)||(step.kind==='travel'&&pin?{kind:'location',...pin}:undefined),...(step.when?{when:normalRule(step.when)}:{}),...(step.requires?{requires:normalRule(step.requires)}:{}),...(step.materials?{materials:step.materials}:{}),...(step.itemId?{itemId:step.itemId}:{}),...(step.craftingSpellId?{craftingSpellId:step.craftingSpellId}:{}),...(step.recovery?{recovery:{text:step.recovery,destination:pin}}:{}),...(step.details?{details:step.details}:{})};
   if(step.kind==='quest'&&step.questIds?.length){
    for(let index=0;index<step.questIds.length;index++){
     const qid=step.questIds[index],itemId=r.alternativeStart?.itemIds?.[index];
     const q={...(att.quests[String(qid)]||{}),id:qid,title:'Lost Mail',source:sources[0],actionInstructions:['Use your copy of Lost Mail to accept the quest.',step.text,'Turn in Lost Mail to Madam Goya at the quest-map marker.']};
     nodes.push(...questNodes(q,{prefix:id,when:any(inLog(qid),{kind:'questOffered',questId:qid},itemId?bag(itemId):undefined),hideWhenUnknown:true,downstream:r.questIds.filter(v=>!step.questIds.includes(v))}));
    }
   }else if(step.kind==='quest'&&step.questId){
    const q={...(att.quests[String(step.questId)]||{}),coord:undefined,coords:undefined,id:step.questId,title:step.questTitle||`quest #${step.questId}`,source:sources[0],accept:{destination:pin},actionInstructions:[`Accept ${step.questTitle||`quest #${step.questId}`}.`,step.text,`Turn in ${step.questTitle||`quest #${step.questId}`} using its completed quest map marker.`]};
    nodes.push(...questNodes(q,{prefix:id,downstream:r.questIds?.slice(r.questIds.indexOf(step.questId)+1)}));
   }else if(step.auraSpellId&&step.waypoints?.length){
    nodes.push({...base,id:base.id+':symbols',text:'Touch the six glowing symbol pylons. Use Next pin to move between their locations; the live aura counter establishes when all six are collected.',waypoints:step.waypoints.map(destination).filter(Boolean),auraSpellId:step.auraSpellId,auraStacksRequired:step.auraStacksRequired,completeWhen:any({kind:'auraStacks',spellId:step.auraSpellId,quantity:step.auraStacksRequired},bag(r.itemId),owned(r.itemId))});
    nodes.push({...base,text:'Enter the Syntactic Vault cave, activate the glowing object and loot the cube.',requires:any({kind:'auraStacks',spellId:step.auraSpellId,quantity:step.auraStacksRequired},bag(r.itemId),owned(r.itemId)),recovery:{text:'Collect six Runic Syllables first. If aura data is unavailable, check the buff in game and continue the interaction yourself.',destination:pin}});
   }else nodes.push({...base,questId:step.questId,nativeWaypoint:step.destination?.kind==='liveQuestWaypoint',manual:!base.completeWhen,...(step.waypoints?{waypoints:step.waypoints.map(destination).filter(Boolean)}:{})});
  }
  // Later observed stages and possession can short-circuit lost introductory instructions.
  for(let i=0;i<nodes.length;i++){
   const n=nodes[i];n.completeWhen=any(n.completeWhen,complete);
   if(i)n.after=[nodes[i-1].id];
  }
  const g=existing||{id,title:r.title,zone:nodes.find(n=>n.destination)?.destination?.label||'Toy walkthrough',expansion:'Retail',method:'Quest and interaction',cadence:'once',minutes:20,rewards:[r.itemId],requirements:{},questIds:r.questIds||[],source:sources[0],steps:nodes,playStyle:'solo',outcome:'guaranteed-progress'};
  for(const key of ['requirements','playStyle','cadence','outcome','minutes','engineering','persistent','costs','materialAlternatives','recipeSpellIds','recipeIdNamespace','expansion','method','details'])if(r[key]!==undefined)g[key]=structuredClone(r[key]);
  const gaps=[...new Set([...(r.coverageGaps||[]),...(r.unresolved||[]).filter(x=>typeof x==='string'&&/prerequisite|not established|not verified|unknown unlock|not specified|not.*covered|absent.*quest/i.test(x))])];
  validation(g,nodes,gaps);g.walkthrough.completeWhen=complete;g.walkthrough.routeIds=[];g.metadataRoute=false;g.authored=true;g.authoredSourceId=r.id;
  if(!existing){guides.push(g);byId.set(g.id,g);} else Object.assign(existing,g);
  // Exact source route matching: only the same source relationship is replaced, never every route of a toy.
  for(const candidate of guides.filter(v=>v.metadataRoute&&v.rewards?.includes(r.itemId))){
   const f=candidate.facts;
   const relation=r.sourceRouteId&&candidate.id===r.sourceRouteId||r.terminalAchievementId&&f?.achievementID===r.terminalAchievementId||r.steps?.some(s=>s.objectId&&s.objectId===f?.objectID)||r.sourceFacts?.objectID&&r.sourceFacts.objectID===f?.objectID||r.sourceFacts?.npcID&&r.sourceFacts.npcID===f?.npcID||r.sourceFacts?.craftingSpellId&&f?.recipeID===r.sourceFacts.craftingSpellId||r.sourceFacts?.category==='Craftables'&&f?.category==='Craftables'||r.id==='stored-wisdom-device'&&f?.category==='Secrets'||r.id==='zandalari-effigy-barter'&&f?.category==='Zones'||r.itemId===200636&&f?.category==='Craftables';
   if(relation){candidate.aliasOf=g.id;g.walkthrough.routeIds.push(candidate.id);}
  }
 }
 // Fortnightly archaeology: select only the observed chain; never require all thirteen.
 const archaeology=byId.get('legion-archaeology');if(archaeology){
  const nodes=[{id:archaeology.id+':observe',kind:'observe',text:'Speak to Dariness the Learned in Legion Dalaran and accept the archaeology quest she currently offers.',destination:{mapID:627,x:.404,y:.24,label:'Dariness the Learned'},sources:[priority.archaeology[0].quests[0].source],completeWhen:any(priority.archaeology.flatMap(a=>a.questIds.map(inLog))),manual:true}];
  for(const chain of priority.archaeology){const when={kind:'archaeologyChain',chainId:chain.id};for(let i=0;i<chain.quests.length;i++)nodes.push(...questNodes(chain.quests[i],{prefix:archaeology.id+':'+chain.id,cadence:'fortnightly',when,hideWhenUnknown:true,downstream:chain.questIds.slice(i+1)}));}
  validation(archaeology,nodes,[]);archaeology.persistent=true;archaeology.walkthrough.completeWhen=any(priority.archaeology.map(a=>all({kind:'archaeologyChain',chainId:a.id},done(a.questIds.at(-1),'fortnightly'))));archaeology.walkthrough.includesPrerequisites=true;
 }
 // Tournament stages are selected from offered/active quests; unknown candidates are hidden.
 const argent=byId.get('argent-tournament');if(argent){
  const source=priority.argent.questFacts[0].source,nodes=[];
  for(const side of ['Alliance','Horde']){
   const starter=priority.argent.questFacts.find(q=>q.id===(side==='Alliance'?13667:13668));
   nodes.push({id:argent.id+':observe-'+side.toLowerCase(),kind:'observe',text:`Visit the ${side} Tournament pavilion. Take the introduction, city training or Champion dailies offered to this character. The guide selects the offered stage automatically.`,when:{kind:'faction',value:side},destination:destination(starter?.accept?.destination)||{mapID:118,x:side==='Alliance'?.762:.76,y:side==='Alliance'?.194:.243},sources:[source],completeWhen:any(argent.questIds.flatMap(q=>[inLog(q),{kind:'questOffered',questId:q}]))});
  }
  for(const q of priority.argent.questFacts){
   const when=any(inLog(q.id),{kind:'questOffered',questId:q.id});
   // Shared source groups carry daily flags that local quest records omit.
   const cadence=q.repeatingFields.isDaily||att.quests[String(q.id)]?.isDaily?'daily':'once';
   const template=priority.argent.actionTemplates.find(t=>t.matchingQuestIds?.includes(q.id)||t.matchingQuestTitle&&q.title.toLowerCase().startsWith(t.matchingQuestTitle.toLowerCase()));
   const friendly={...q,title:q.title.replace(/ \([AH]\)/g,'')};
   const block=questNodes(friendly,{prefix:argent.id,cadence,when,hideWhenUnknown:true,flag:cadence==='daily',instructions:template?.instructions});
   if(q.title.startsWith("The Valiant's Charge")||q.title.toLowerCase().startsWith('up to the challenge')){
    const city=priority.argent.cities.find(c=>c.chargeQuestId===q.id);
    for(const n of block.filter(n=>n.kind==='turnin'))n.manualOnly=true;
    for(const n of block.filter(n=>n.kind==='objective')){
     n.collectionTarget=q.title.startsWith("The Valiant's Charge")?"Valiant's Seals":"Aspirant's Seals";
     n.collectionHint=city?`Complete the ${city.city} dailies at the ${city.faction} pavilion. Keep this collection quest in your log.`:'Complete the offered Aspirant dailies. Keep this collection quest in your log.';
     n.destination=destination(q.accept?.destination);if(n.destination)n.destination.label=city?city.city+' daily questgivers':'Tournament daily questgivers';
     n.nativeWaypoint=false;
    }
   }
   for(const n of block)if(n.kind==='accept'||n.kind==='turnin'){n.stopId='argent-pavilion-'+(q.title.includes('(H)')?'horde':'alliance');n.stopLabel='Tournament pavilion';}
   nodes.push(...block);
  }
  validation(argent,nodes,[]);argent.walkthrough.includesPrerequisites=true;argent.persistent=true;
  // The seal collection spans days. Each city has three fixed dailies and one
  // offer-selected weapon daily; alternatives are one opportunity, never three.
  argent.walkthrough.dailySets=priority.argent.cities.map(city=>{
   const label=({Stormwind:'Stormwind City',Exodar:'The Exodar',"Sen'jin":'Darkspear Trolls',Silvermoon:'Silvermoon City'})[city.city]||city.city;
   const quests=priority.argent.questFacts.filter(q=>q.repeatingFields.isDaily&&q.title.includes(`(${city.faction==='Alliance'?'A':'H'}) (${label}, Valiant)`));
   const families=[['melee','The Grand Melee'],['training',"A Valiant's Field Training"],['gates',"At The Enemy's Gates"],['weapon','A Blade Fit For A Champion','A Worthy Weapon','The Edge Of Winter']];
   return {id:'valiant-'+city.chargeQuestId,collectionQuestId:city.chargeQuestId,stage:'Valiant',label:city.city+' Valiant dailies',target:"Valiant's Seals",groups:families.map(([id,...titles])=>({id,questIds:quests.filter(q=>titles.some(t=>q.title.toLowerCase().startsWith(t.toLowerCase()))).map(q=>q.id)}))};
  });
  for(const branch of priority.argent.branchRules.filter(b=>b.aspirantCollectionQuestId)){
   const alliance=branch.faction==='Alliance';
   argent.walkthrough.dailySets.push({id:'aspirant-'+branch.aspirantCollectionQuestId,collectionQuestId:branch.aspirantCollectionQuestId,stage:'Aspirant',label:branch.faction+' Aspirant dailies',target:"Aspirant's Seals",groups:[{id:'training',questIds:[alliance?13671:13676]},{id:'reins',questIds:[alliance?13625:13677]},{id:'weapon',questIds:alliance?[13666,13669,13670]:[13673,13674,13675]}]});
  }
 }
 // Explicit weekly terminals prevent prerequisites or one poster from finishing an entire set.
 for(const r of priority.reputation){const g=byId.get(r.id);if(!g)continue;const nodes=[],sources=r.quests.map(q=>q.source).filter(Boolean);
  const unlock=r.unlockGraph||{},introductions=unlock.nodes||unlock.introductoryQuests||[unlock.introductoryQuest].filter(Boolean);
  const weeklyIds=r.quests.filter(q=>q.repeatingFields.isWeekly).map(q=>q.id);
  const alreadyEligible=any(weeklyIds.flatMap(id=>[inLog(id),{kind:'questOffered',questId:id},done(id,'weekly',r.scope==='account'?'warband':'character',true)]));
  for(let i=0;i<introductions.length;i++){
   const intro=introductions[i],raw=intro.compiledSupportingFacts||att.quests[String(intro.id)]||{};
   const q={...raw,...intro,accept:{npcId:intro.acceptNpcId||raw.qgs?.[0],destination:destination(intro.acceptCoordinate)||point(raw)}};
   const required=intro.requires?.allQuestTurnedIn||intro.requires?.anyQuestTurnedIn||intro.rawFields?.sourceQuests||[];
   const prerequisite=intro.requires?.anyQuestTurnedIn?any(required.map(id=>done(id))):all(required.map(id=>done(id)));
   const when=all({negate:alreadyEligible},any(inLog(intro.id),{kind:'questOffered',questId:intro.id},prerequisite));
   nodes.push(...questNodes(q,{prefix:g.id+':unlock',when,hideWhenUnknown:true,downstream:introductions.slice(i+1).map(q=>q.id)}));
  }
  if(r.id==='rep-expedition-posters'){
   nodes.push({id:g.id+':posters',kind:'observe',text:'Inspect the wanted posters at Dragonscale Basecamp. Take each available weekly; completed posters disappear until the next reset.',destination:destination(r.quests[0]?.accept?.destination),sources,completeWhen:any(r.quests.flatMap(q=>[inLog(q.id),{kind:'questOffered',questId:q.id}])),manual:true});
   for(const q of r.quests)nodes.push(...questNodes(q,{prefix:g.id,cadence:'weekly',when:any(inLog(q.id),{kind:'questOffered',questId:q.id}),hideWhenUnknown:true,flag:true}));
   g.questSetId=g.id;g.questSetQuestIds=r.quests.map(q=>q.id);g.walkthrough={completeWhen:{kind:'observedQuestSetComplete',setId:g.id,cadence:'weekly',questIds:g.questSetQuestIds},completionText:'All observed wanted quests are turned in for this week. Inspect other posters to discover any additional offers.'};
  }else if(r.quests.length){
   const instructions=r.id==='rep-soridormi-weekly'?r.actionInstructions.slice(1,4):r.actionInstructions;
   for(const q of r.quests.filter(q=>q.repeatingFields.isWeekly))nodes.push(...questNodes(q,{prefix:g.id,cadence:'weekly',scope:r.scope==='account'?'warband':'character',instructions,flag:true}));
   g.walkthrough={completeWhen:normalRule({...r.terminal,cadence:'weekly',currentPeriodFlag:true})};
  }else{
   const ids=r.terminalOpportunities?.map(x=>x.questId)||[r.terminal.questId];
   nodes.push({id:g.id+':event',kind:'objective',text:r.actionInstructions.join(' '),nativeEventMap:g.id==='rep-maruuk-hunt'?2023:2022,sources:[`https://github.com/ATTWoWAddon/AllTheThings/tree/${att.release}/.contrib/.db/standard`],completeWhen:all(ids.map(id=>done(id,'weekly','character',true))),recovery:{text:'If the event is inactive, choose another activity. The current event location and schedule are observed in game; no fixed countdown is assumed.'}});
   g.questIds=[...new Set([...(g.questIds||[]),...ids])];g.walkthrough={completeWhen:all(ids.map(id=>done(id,'weekly','character',true)))};
  }
  g.warband=r.scope==='account';g.scope=g.warband?'warband':'character';g.factionId=r.factionId;
  // Remaining prerequisite chains are explicit coverage gaps, not implied by a Renown number.
  const gaps=r.unlockQuestId?[`Complete prerequisite quest ${r.unlockQuestId} and its campaign branch before this weekly can be offered.`]:r.renownRequirement?[`Faction ${r.factionId} introduction and Renown ${r.renownRequirement} progression need a connected prerequisite subguide.`]:[];
  validation(g,nodes,gaps);g.walkthrough.includesPrerequisites=!!introductions.length;
  if(r.id==='rep-niffen-weekly')g.walkthrough.progressActivities={collectionQuestId:r.terminal.questId,factionId:r.factionId,mapID:2133,label:'Loamm Niffen reputation',excludeQuestIds:g.questIds,source:r.quests[0].source,destination:destination(r.quests[0].accept?.destination)};
 }
 // Every learned cooldown keeps its distinct timing implementation and observation workflow.
 for(const g of guides.filter(v=>v.variants)){
  const source=g.source,nodes=[{id:g.id+':recipes',kind:'observe',text:`Open your own ${g.expansion} Engineering recipes and select ${g.title}.`,completeWhen:any(g.variants.map(v=>({kind:'recipeLearned',spellId:v.spellId}))),sources:[source],recovery:{text:'If the recipe is missing, switch expansion tiers and clear recipe filters. Skill level alone does not prove the recipe is learned.'}},{id:g.id+':craft',kind:'craft',text:`Craft ${g.title} when its observed cooldown is ready. Gather the listed materials and tools first; use the in-game Craft button yourself.`,sources:[source],manual:true,details:g.steps.map(s=>s.text).join('\n')}];
  for(const n of nodes){n.stopId="engineering-station";n.stopLabel="Engineering crafting station";}
  validation(g,nodes,[]);g.walkthrough.includesPrerequisites=false;
 }
 // Engineering quest records retain their actual expansion/recipe context; no level inference.
 for(const q of priority.engineering.questFacts){const g=byId.get('engineering-quest-'+q.id);if(!g||!q.accept?.destination)continue;
  const cadence=q.repeatingFields.isWeekly?'weekly':q.repeatingFields.isDaily?'daily':q.repeatingFields.repeatable?'repeatable':'once';
  const nodes=questNodes(q,{prefix:g.id,cadence,flag:cadence==='weekly'||cadence==='daily'}),gaps=q.predecessorQuestIds?.length?[`Engineering prerequisite chain ${q.predecessorQuestIds.join(', ')} needs full branch walkthrough.`]:[];
  validation(g,nodes,gaps);g.walkthrough.completeWhen=done(q.id,cadence,'character',cadence==='weekly'||cadence==='daily');g.walkthrough.includesPrerequisites=false;
 }
 for(const t of priority.engineering.uniqueTreasures||[]){
  const id='engineering-knowledge-'+t.collectionQuestFlagId,pin=destination(t.destination),conflict=(priority.engineering.coordinateConflicts||[]).some(v=>JSON.stringify(v).includes(String(t.collectionQuestFlagId)));
  const nodes=[{id:id+':collect',kind:'loot',text:t.instructions,destination:conflict?undefined:pin,sources:[t.source],completeWhen:any(done(t.collectionQuestFlagId),bag(t.itemId)),recovery:{text:conflict?'The sources disagree on this pin. Use the observed treasure vignette or the in-game map instead.':'Check the correct Engineering expansion tier. A treasure tracking flag records collection; it does not establish knowledge spent or a recipe learned.'}}];
  const g={id,title:t.name,zone:t.expansion+' Engineering treasure',expansion:t.expansion,method:'Engineering knowledge',engineering:true,requirements:{professionId:202},cadence:'once',persistent:true,rewards:[],minutes:3,questIds:[t.collectionQuestFlagId],source:t.source,steps:nodes,playStyle:'solo',outcome:'guaranteed-progress'};
  validation(g,nodes,conflict?['Treasure coordinates conflict between sources; destination needs observation.']:[]);g.walkthrough.completeWhen=any(done(t.collectionQuestFlagId),bag(t.itemId));guides.push(g);
 }
 for(const r of priority.engineering.catchUp.rules){
  const id='engineering-catchup-'+r.skillLineId,sources=priority.engineering.catchUp.sourceReferences.map(s=>s.url),nodes=[{id:id+':orders',kind:'observe',text:`Open ${r.expansion} Engineering at a crafting station and inspect Patron Orders. Choose an order offering the knowledge item, review its materials and costs, and craft it yourself.`,sources,manual:true,recovery:{text:'The observed catch-up currency estimates remaining knowledge, not guaranteed orders or a weekly order cap. Missing or restricted currency data stays unknown.'}}];
  const g={id,title:r.expansion+' Engineering catch-up',zone:'Engineering crafting station',expansion:r.expansion,method:'Engineering knowledge',system:'engineering-catchup',catchUp:r,engineering:true,requirements:{professionId:202},cadence:'repeatable',persistent:true,rewards:[],minutes:10,source:sources[0],questIds:[],steps:nodes,playStyle:'solo',outcome:'guaranteed-progress'};validation(g,nodes,[]);guides.push(g);
 }
 const sessionBatch=sessionContent(guides,{questNodes,validateGraph});
 const reliable=reliabilityContent(guides,{questNodes,validateGraph}),catalogueBatch=catalogueContent(guides,{validateGraph});
 for(const g of guides){
  if(!g.validation)g.validation={sourceChecked:false,playtested:false,automated:false,gaps:[audit.find(a=>a.guideId===g.id)?.reason||'Detailed actions and prerequisites have not been validated.']};
  if(g.walkthrough){
   const ids=new Set(g.questIds||[]);const watch=r=>{if(!r||typeof r!=='object')return;if(r.questId)ids.add(r.questId);if(r.kind==='questReached')for(const id of r.questIds||[])ids.add(id);for(const v of r.all||r.any||r.rules||[])watch(v);if(r.negate)watch(r.negate);};
   watch(g.walkthrough.completeWhen);watch(g.walkthrough.opportunityCompleteWhen);for(const n of g.walkthrough.nodes){if(n.questId)ids.add(n.questId);watch(n.when);watch(n.requires);watch(n.completeWhen);}g.questIds=[...ids];
   validateGraph(g.walkthrough,g.id);
  }
 }
 return {audit,catalogueReviews:catalogueBatch.reviews,yields:reliable.yields,dailyYieldSets:reliable.dailyYieldSets,systems:{engineering:{catchUp:priority.engineering.catchUp.rules}},sources:[...catalogueBatch.sources,...reliable.sources,...sessionBatch.sources,...(authored.sources||[]),...(extra.sources||[]),...(progression.sources||[]),...(batch.sources||[]),...priority.engineering.catchUp.sourceReferences,{name:'ATT toy recipe reagent relationships',url:recipes.source,revision:recipes.sourceRevision,sha256:recipes.sha256,license:'MIT'},...priority.sources.map(s=>({...s,license:'MIT',use:'factual import'}))]};
}
const predicates=new Set(['toyOwned','questInLog','questOffered','questReached','questTurnedIn','questObjectivesComplete','questObjective','itemCount','itemEquipped','currency','recipeLearned','profession','reputation','achievement','achievementCriterion','archaeologyChain','interfaceObserved','missionState','location','faction','class','level','evidenceUnavailable','auraStacks','observedQuestSetComplete','merchantOffer','money','questTurnedInSince']);
function validateRule(r,id,depth=0){if(!r||typeof r!=='object'||depth>16)throw Error(`${id}: invalid condition`);if(r.all||r.any||r.rules){const list=r.all||r.any||r.rules;if(!Array.isArray(list))throw Error(`${id}: invalid condition group`);if(r.atLeast!==undefined&&(!Number.isInteger(r.atLeast)||r.atLeast<0||r.atLeast>list.length))throw Error(`${id}: impossible prerequisite cardinality`);for(const child of list)validateRule(child,id,depth+1);}else if(r.negate)validateRule(r.negate,id,depth+1);else if(!predicates.has(r.kind))throw Error(`${id}: unsupported condition ${r.kind}`);}
export function validateGraph(graph,id){
 if(graph.version!==2||!Array.isArray(graph.nodes)||!graph.nodes.length)throw Error(`${id}: empty/unsupported walkthrough`);
 const byId=new Map();for(const n of graph.nodes){if(byId.has(n.id))throw Error(`${id}: duplicate step ${n.id}`);if(!n.text?.trim()||!n.kind||!n.sources?.length)throw Error(`${id}: missing instruction or evidence ${n.id}`);byId.set(n.id,n);
  if(n.destination&&(!Number.isInteger(n.destination.mapID)||n.destination.mapID<=0||![n.destination.x,n.destination.y].every(v=>Number.isFinite(v)&&v>=0&&v<=1)))throw Error(`${id}: invalid destination ${n.id}`);
  if(!n.completeWhen&&!n.manual)throw Error(`${id}: missing completion/review rule ${n.id}`);
  for(const rule of [n.when,n.requires,n.completeWhen].filter(Boolean))validateRule(rule,n.id);
 }
 if(graph.completeWhen)validateRule(graph.completeWhen,id);
 for(const set of graph.dailySets||[]){
  if(!set.id||!set.collectionQuestId||!set.groups?.length)throw Error(`${id}: invalid daily set`);
  const seen=new Set();for(const group of set.groups){if(!group.questIds?.length)throw Error(`${id}: empty daily group ${group.id}`);for(const questId of group.questIds){if(seen.has(questId)||!graph.nodes.some(n=>n.kind==='accept'&&n.questId===questId))throw Error(`${id}: invalid daily quest ${questId}`);seen.add(questId);}}
 }
 const visiting=new Set(),visited=new Set();function visit(n){if(visiting.has(n.id))throw Error(`${id}: dependency cycle ${n.id}`);if(visited.has(n.id))return;visiting.add(n.id);for(const dep of [...(n.after||[]),...(n.afterAny||[])]){if(!byId.has(dep))throw Error(`${id}: missing dependency ${dep}`);visit(byId.get(dep));}visiting.delete(n.id);visited.add(n.id);}for(const n of graph.nodes)visit(n);
}
