local G=ToyboxGuides
local legacyCondition=G.Condition
local function fresh(record,at,age) return record and type(record.at)=="number" and record.at<=at and at-record.at<=(age or 300) end
local function copy(row) local out={};for k,v in pairs(row or {}) do out[k]=v end;return out end
-- All predicates are interpreted data; downloaded or imported Lua is never evaluated.
function G:Condition(rule,c,depth)
 if type(rule)=="table" and rule.kind=="questTurnedInSince" then local start=c.activityStarts and c.activityStarts[rule.guideId];if not start then return nil end;for _,id in ipairs(rule.questIds or {}) do if (c.turnInRevisions and c.turnInRevisions[id] or 0)>(start.sequence or 0) then return true end end;return false end
 if type(rule)~="table" or (depth or 0)>16 then return nil end
 local at=self.Now();local kind=rule.kind
 if rule.all or rule.any then
  local unknown=false
  for _,r in ipairs(rule.all or rule.any) do local value=self:Condition(r,c,(depth or 0)+1)
   if rule.all and value==false then return false elseif rule.any and value==true then return true elseif value==nil then unknown=true end
  end
  if unknown then return nil end;return rule.all~=nil
 elseif rule.negate then local v=self:Condition(rule.negate,c,(depth or 0)+1);if v~=nil then return not v end;return nil
 elseif rule.atLeast then
  local yes,unknown=0,0;for _,r in ipairs(rule.rules or {}) do local v=self:Condition(r,c,(depth or 0)+1);if v==true then yes=yes+1 elseif v==nil then unknown=unknown+1 end end
  if yes>=rule.atLeast then return true elseif yes+unknown<rule.atLeast then return false end;return nil
 elseif kind=="faction" then if c.faction then return c.faction:lower()==rule.value:lower() end;return nil
 elseif kind=="class" then if c.class then return c.class==rule.value end;return nil
 elseif kind=="level" then if c.level then return c.level>=rule.value end;return nil
 elseif kind=="questOffered" then if c.offersAt and c.offersAt<=at and at-c.offersAt<=300 then return c.offers and c.offers[rule.questId]~=nil end;return nil
 elseif kind=="questInLog" then if c.questsAt and c.questsAt<=at and at-c.questsAt<=300 then return c.quests and c.quests[rule.questId]~=nil end;return nil
 elseif kind=="questReached" then
  local unknown=false
  for _,id in ipairs(rule.questIds or {}) do
   local log=self:Condition({kind="questInLog",questId=id},c,(depth or 0)+1)
   local finished=self:Condition({kind="questTurnedIn",questId=id,cadence=rule.cadence,scope=rule.scope,currentPeriodFlag=rule.currentPeriodFlag},c,(depth or 0)+1)
   if log==true or finished==true then return true elseif log==nil or finished==nil then unknown=true end
  end
  if unknown then return nil end;return false
 elseif kind=="itemEquipped" then if c.equipped and fresh(c.equipped,at) then return c.equipped.data[rule.itemId]==true end;return nil
 elseif kind=="auraStacks" then local a=c.auras and c.auras[rule.spellId];if fresh(a,at) then if a.expiresAt and a.expiresAt>0 and a.expiresAt<=at then return false end;return a.stacks>=(rule.quantity or 1) end;return nil
 elseif kind=="observedQuestSetComplete" then
  local set=c.questSets and c.questSets[rule.setId];local count=0;local unknown=false
  if not set or rule.requireCompleteScan and set.completeScan~=true or set.resetAt~=self:Period(c,rule.cadence) or set.resetAt<=at then return nil end
  local allowed;if rule.questIds then allowed={};for _,id in ipairs(rule.questIds) do allowed[id]=true end end
  for id in pairs(set.quests or {}) do if not allowed or allowed[id] then count=count+1;local value=self:Condition({kind="questTurnedIn",questId=id,cadence=rule.cadence,currentPeriodFlag=true},c,(depth or 0)+1);if value==false then return false elseif value==nil then unknown=true end end end
  if count==0 or unknown then return nil end;return true
 elseif kind=="evidenceUnavailable" then return nil
 elseif kind=="questObjectivesComplete" or kind=="questObjective" then
  if not c.questsAt or c.questsAt>at or at-c.questsAt>300 then return nil end
  local q=c.quests and c.quests[rule.questId];if not q then return nil end
  if kind=="questObjectivesComplete" then return q.complete end
  local o=q.objectives and q.objectives[rule.objectiveIndex];if not o then return nil end
  if rule.objectiveId and o.objectiveID~=rule.objectiveId then return nil end
  return o.finished==true or type(o.numFulfilled)=="number" and type(o.numRequired)=="number" and o.numFulfilled>=o.numRequired
 elseif kind=="questTurnedIn" then
  if rule.cadence=="daily" or rule.cadence=="weekly" then
   if rule.scope=="warband" then for _,alt in pairs(self:DB().characters) do if alt.region==c.region and self:InPeriod(alt.turnIns and alt.turnIns[rule.questId],alt,rule.cadence) then return true end end end
   if self:InPeriod(c.turnIns and c.turnIns[rule.questId],c,rule.cadence) then return true end
   local f=c.flags and c.flags[rule.questId]
   if rule.currentPeriodFlag and f and f.source=="current-client" and self:InPeriod(f.at,c,rule.cadence) then return f.value end
   return nil
  elseif rule.cadence=="fortnightly" then
   local finish=c.archaeology and c.archaeology.endAt;local value=c.turnIns and c.turnIns[rule.questId]
   if finish and finish>at and value and value>=finish-14*86400 and value<=at then return true end;return nil
  end
  if rule.scope=="warband" then for _,alt in pairs(self:DB().characters) do local f=alt.flags and alt.flags[rule.questId];if alt.region==c.region and f and f.value==true and type(f.at)=="number" and f.at<=at then return true end end end
  local f=c.flags and c.flags[rule.questId];if f and f.value==true and type(f.at)=="number" and f.at<=at then return true elseif fresh(f,at) then return f.value end;return nil
 elseif kind=="money" then local r=c.money;if fresh(r,at) then return r.quantity>=(rule.quantity or 1) end;return nil
 elseif kind=="merchantOffer" then local m=c.merchant;if not fresh(m,at) then return nil end;if rule.npcId and m.npcId~=rule.npcId then if m.npcId then return false end;return nil end;local offer=m.offers and m.offers[rule.itemId];if not offer then return false end;return offer.usable
 elseif kind=="recipeLearned" then
  local r=c.recipes and c.recipes[rule.spellId];if r and not r.invalidatedAt then return r.learned end;return nil
 elseif kind=="profession" then if c.professionsAt and c.professionsAt<=at and at-c.professionsAt<=300 then return c.professions and c.professions[rule.professionId]~=nil end;return nil
 elseif kind=="reputation" then
  local r=c.reputations and c.reputations[rule.factionId];if not fresh(r,at) then return nil end
  local value;if rule.metric=="renown" then value=r.renown elseif rule.metric=="reaction" then value=r.data and r.data.reaction elseif rule.metric=="friendshipRank" then value=r.friendshipRank elseif rule.metric==nil or rule.metric=="standing" then value=r.data and r.data.currentStanding end
  if type(value)=="number" then return value>=rule.value end;return nil
 elseif kind=="achievement" then
  local r=c.achievements and c.achievements[rule.achievementId];if not r then return nil end
  if rule.scope=="account" then return r.completed elseif rule.scope=="character" then return r.characterCompleted end;return nil
 elseif kind=="achievementCriterion" then
  local r=c.achievements and c.achievements[rule.achievementId];local criterion=r and r.criteria and r.criteria[rule.criteriaId]
  if criterion and (rule.scope=="account" or criterion.characterSpecific) then return criterion.completed end;return nil
 elseif kind=="archaeologyChain" then local a=c.archaeology;if a and a.at and a.at<=at and (a.endAt and a.endAt>at or not a.endAt and fresh(a,at)) then return a.id==rule.chainId end;return nil
 elseif kind=="interfaceObserved" then local o=c.interfaces and c.interfaces[rule.interface];if fresh(o,at) then if rule.npcId and o.npcId~=rule.npcId then if o.npcId then return false end;return nil end;return o.open end;return nil
 elseif kind=="missionState" then local state=self:MissionStatus(c,rule.missionId);if state and state~="unknown" then return state==rule.state end;return nil
 elseif kind=="location" then
  local map=self.Read(C_Map and C_Map.GetBestMapForUnit,"player");if not map then return nil end;if map~=rule.mapID then return false end
  local p=self.Read(C_Map.GetPlayerMapPosition,map,"player");if not p or type(p.x)~="number" or type(p.y)~="number" then return nil end
  return (p.x-rule.x)^2+(p.y-rule.y)^2<=(rule.radius or 0.006)^2
 end
 return legacyCondition(self,rule,c,depth)
end
function G:ConditionEvidence(rule,c)
 return {value=self:Condition(rule,c),observedAt=c.at,scope=rule and rule.scope or "character",source="game observations"}
end
function G:DailySession(g,c,rows)
 for _,set in ipairs(g.walkthrough.dailySets or {}) do
  local collection=c.quests and c.quests[set.collectionQuestId]
  if collection then
   local session={resourceId=set.resourceId,fullSetYield=set.fullSetYield,yieldSources=set.yieldSources,rows={},done=0,total=#set.groups,resetAt=self:Period(c,"daily"),label=set.label}
   local count,total=0,0
   for _,o in ipairs(collection.objectives or {}) do count=count+(o.numFulfilled or 0);total=total+(o.numRequired or 0) end
   if collection.complete or total>0 and count>=total then
    for _,row in ipairs(rows) do if row.questId==set.collectionQuestId then session.rows[#session.rows+1]=row end end
    return #session.rows>0 and session or nil
   end
   session.progress={count=count,total=total,counters=count.."/"..total.." "..set.target}
   local observed=c.questsAt and fresh({at=c.questsAt},self.Now())
   for _,group in ipairs(set.groups) do
    local finished,selected=false,nil
    for _,id in ipairs(group.questIds) do
     if self:Condition({kind="questTurnedIn",questId=id,cadence="daily",currentPeriodFlag=true},c)==true then finished=true end
     if c.quests[id] then selected=id end
    end
    -- A quest still in the live log takes precedence over a contradictory flag.
    if selected then finished=false end
    if not selected then for _,id in ipairs(group.questIds) do if self:Condition({kind="questOffered",questId=id},c)==true then selected=id;break end end end
    if finished then session.done=session.done+1 else
     local found=false
     if observed and selected then for _,row in ipairs(rows) do if row.questId==selected then session.rows[#session.rows+1]=row;found=true end end end
     if not found then
      local accept
      for _,node in ipairs(g.walkthrough.nodes) do if node.kind=="accept" and node.questId==(selected or group.questIds[1]) then accept=node;break end end
      if accept then
       local row=copy(accept);row.id=g.id..":"..set.id..":"..group.id..":offers";row.kind="observe";row.questId=nil;row.manual=nil;row.available=true
       row.text=not observed and "Open your quest log to refresh today's Tournament quests." or #group.questIds>1 and "Speak to the marked daily questgiver and accept the weapon-retrieval daily offered today. Only one of the three alternatives is needed." or accept.text
       local continued=c.continued and c.continued[g.id]
       if not self:Skipped(c,row.id) and not (continued and continued[row.id] and continued[row.id]>self.Now()) then session.rows[#session.rows+1]=row end
      end
     end
    end
   end
   table.sort(session.rows,function(a,b)
    local rank={turnin=0,objective=1,accept=2,observe=3};local ar,br=rank[a.kind] or 4,rank[b.kind] or 4
    if ar~=br then return ar<br end
    return a.id<b.id
   end)
   session.waiting=observed and session.done==session.total and session.total>0
   if session.waiting then session.rows={{id=g.id..":"..set.id..":reset",kind="observe",available=false,endOfSteps=true,text="Today's "..(set.stage or "Valiant").." dailies are complete. Return after the daily reset for the next set; your seals carry over."}} end
   for _,row in ipairs(session.rows) do row.longTermProgress=session.progress;row.dailyProgress=session.done.."/"..session.total.." dailies turned in today" end
   return session
  end
 end
end
function G:ProgressActivities(g,c)
 local config=g.walkthrough.progressActivities;if not config then return end
 local q=c.quests and c.quests[config.collectionQuestId];if not q or q.complete then return end
 local count,total=0,0;for _,o in ipairs(q.objectives or {}) do count=count+(o.numFulfilled or 0);total=total+(o.numRequired or 0) end
 local progress={count=count,total=total,counters=count.."/"..total.." "..config.label,carryText="progress within this weekly quest"}
 local excluded={[config.collectionQuestId]=true};for _,id in ipairs(config.excludeQuestIds or {}) do excluded[id]=true end
 local rows={};local at=self.Now();local freshLog=c.questsAt and fresh({at=c.questsAt},at)
 if freshLog and c.repTasksAt and fresh({at=c.repTasksAt},at) then
  for id,task in pairs(c.repTasks and c.repTasks[config.factionId] or {}) do
   local active=c.quests[id];local returned=c.turnIns and c.turnIns[id]
   if not excluded[id] and (not task.expiresAt or task.expiresAt>at) and (not task.active or active) and (not task.isTask or task.eligible==true or active) and not (returned and returned>=c.repTasksAt and returned<=at) then
    local row={id=g.id..":progress:"..id,questId=id,kind=active and active.complete and not task.isTask and "turnin" or "objective",available=true,observedActivity=true,sources={config.source},destination=task.destination,longTermProgress=progress}
    row.text=(row.kind=="turnin" and "Turn in " or "Complete ")..(active and active.title or task.title or "quest #"..id).." for "..config.label.."."
    if active then
     local parts={};local n,d=0,0;for _,o in ipairs(active.objectives or {}) do if not o.finished then parts[#parts+1]=o.text or "";n=n+(o.numFulfilled or 0);d=d+(o.numRequired or 0) end end
     if #parts>0 then row.counters=table.concat(parts," · ");row.count=n;row.total=d end
     local map,x,y=self.Safe(C_QuestLog and C_QuestLog.GetNextWaypoint,id);if type(map)=="number" and type(x)=="number" and type(y)=="number" then row.destination={mapID=map,x=x,y=y,label=active.title} end
    end
    if not self:Skipped(c,row.id) then rows[#rows+1]=row end
   end
  end
 end
 table.sort(rows,function(a,b) if a.kind~=b.kind then return a.kind=="turnin" end;return a.questId<b.questId end)
 if #rows==0 then rows={{id=g.id..":progress:observe",kind="observe",available=true,text="Open the Zaralek Cavern map and check currently available Loamm Niffen reputation quests. No additional eligible activity is established by the saved observations; your weekly reputation progress is kept.",destination=config.destination,longTermProgress=progress,sources={config.source}}} end
 for _,row in ipairs(rows) do row.progressSummary="Available reputation activities · "..(#rows==1 and rows[1].kind=="observe" and "not established" or tostring(#rows)) end
 return rows
end
function G:GraphState(g,c)
 local graph=g.walkthrough;if not graph or graph.version~=2 then return nil end
 local result={rows={},byId={},complete=false};local at=self.Now()
 for _,node in ipairs(graph.nodes or {}) do if (node.kind=="learn" or node.acquisitionRecovery) and node.requires and self:Condition(node.requires,c)==true and self:Condition(node.completeWhen,c)~=true then local row=copy(node);row.available=true;result.rows={row};return result end end
 if graph.completeWhen and self:Condition(graph.completeWhen,c)==true then result.complete=true;return result end
 local continued=c.continued and c.continued[g.id] or {}
 local function passed(id,visiting)
  if result.byId[id]~=nil then return result.byId[id] end
  local node=graph.nodeIndex and graph.nodeIndex[id];if not node then for _,v in ipairs(graph.nodes) do if v.id==id then node=v;break end end end
  if not node or visiting[id] then return false end;visiting[id]=true
  local enabled=not node.when or self:Condition(node.when,c)~=false
  local complete=node.completeWhen and self:Condition(node.completeWhen,c)==true
  local viewed=continued[id] and continued[id]>at or self:Skipped(c,id)
  local value=not enabled or complete or viewed
  result.byId[id]=value;visiting[id]=nil;return value
 end
 for _,node in ipairs(graph.nodes or {}) do passed(node.id,{}) end
 for _,node in ipairs(graph.nodes or {}) do
  if not result.byId[node.id] then
   local branch=node.when and self:Condition(node.when,c)
   local dependencies=true;for _,id in ipairs(node.after or {}) do if not result.byId[id] then dependencies=false end end
   if node.afterAny then local any=false;for _,id in ipairs(node.afterAny) do if result.byId[id] then any=true end end;dependencies=dependencies and any end
   if dependencies and not (node.hideWhenUnknown and branch==nil) then
    local row=copy(node);local requirements=node.requires and self:Condition(node.requires,c)
    row.available=branch~=nil or not node.when;row.available=row.available and (not node.requires or requirements==true)
    if node.when and branch==nil then row.text=node.unknownText or node.recovery and node.recovery.text or "Visit the indicated NPC or interface to observe the available branch.";row.kind="observe" end
    if node.requires and requirements~=true then
     row.text=node.recovery and node.recovery.text or "Follow the prerequisite action first, then return here.";row.kind="observe";row.destination=node.recovery and node.recovery.destination or row.destination
    end
    local q=node.questId and c.quests and c.quests[node.questId]
    if q then
     row.questTitle=q.title
     if node.kind=="objective" then
      local parts={};local count,total=0,0
      for i,o in ipairs(q.objectives or {}) do if not o.finished and (not node.objectiveIndex or node.objectiveIndex==i) then parts[#parts+1]=o.text or "";count=count+(o.numFulfilled or 0);total=total+(o.numRequired or 0) end end
      if #parts>0 then row.counters=table.concat(parts," · ");row.count=count;row.total=total end
     end
     if node.nativeWaypoint and not node.objectiveIndex and (node.kind=="objective" or node.kind=="turnin") then
      local map,x,y=self.Safe(C_QuestLog and C_QuestLog.GetNextWaypoint,node.questId)
      if type(map)=="number" and type(x)=="number" and type(y)=="number" then row.destination={mapID=map,x=x,y=y,label=q.title} end
     end
    end
    if node.auraSpellId then local aura=c.auras and c.auras[node.auraSpellId];if fresh(aura,at) then row.counters="Symbols: "..aura.stacks.."/"..node.auraStacksRequired end end
    result.rows[#result.rows+1]=row
   end
  end
 end
 local session=self:DailySession(g,c,result.rows)
 if session then result.rows=session.rows;result.dailySession=session end
 local activities=self:ProgressActivities(g,c);if activities then result.rows=activities end
 return result
end
function G:CycleWaypoint()
 local g,c=self:Current();if not g then return end;local row=self:Steps(g,c)[c.cursor or 1]
 if row and row.waypoints and #row.waypoints>0 then c.waypointChoices=c.waypointChoices or {};c.waypointChoices[row.id]=(c.waypointChoices[row.id] or 1)%#row.waypoints+1;self:FollowCurrentStep(true);self:Changed() end
end
local legacySteps=G.Steps
function G:Steps(g,c)
 if not g.walkthrough then return legacySteps(self,g,c) end
 local result=self:GraphState(g,c)
 local rows=result.rows
 if #rows==0 then rows={{id=g.id..":waiting",kind="observe",available=false,endOfSteps=true,text=result.complete and "This opportunity is complete. Choose another activity." or g.walkthrough.emptyText or "No more eligible steps right now. Choose another activity, or use Back or Undo to revisit skipped steps. Your progress has not been marked complete."}} end
 local ending=c.browseEnd and c.browseEnd[g.id]
 if ending then
  if ending.signature==self:StepSignature(rows) then return {{id=g.id..":browse-end",kind="observe",available=false,endOfSteps=true,text="No more eligible steps right now. Choose another activity, or use Back or Undo to revisit skipped steps. Your progress has not been marked complete."}} end
  c.browseEnd[g.id]=nil
 end
 return rows
end
local legacyEligibility=G.Eligibility
function G:Eligibility(g,c)
 if g.aliasOf then return "excluded","This source shares the walkthrough "..g.aliasOf.."." end
 local state,reason,ready=legacyEligibility(self,g,c)
 if not g.walkthrough or not c or state=="owned" or state=="excluded" or state=="upcoming" then return state,reason,ready end
 local graph=self:GraphState(g,c)
 if g.catchUp and c.professionTiers and fresh(c.professionTiers,self.Now()) then
  local learned=false;for _,tier in ipairs(c.professionTiers.data or {}) do if tier.professionID==g.catchUp.skillLineId or tier.skillLineID==g.catchUp.skillLineId then learned=true end end
  if not learned then return "blocked","Learn "..g.expansion.." Engineering before looking for its catch-up orders." end
  local knowledge=c.knowledge and c.knowledge[g.catchUp.skillLineId];if fresh(knowledge,self.Now()) and knowledge.remaining==0 then return "done","The game currently reports no remaining catch-up knowledge for this tier." end
 end
 if graph.complete then return "done",g.walkthrough.completionText or "The route's final action is confirmed for its applicable period." end
 if graph.dailySession and graph.dailySession.waiting then return "upcoming","Today's Tournament dailies are complete. Your seals carry over; the next set opens at the daily reset.",graph.dailySession.resetAt end
 if g.walkthrough.opportunityCompleteWhen and self:Condition(g.walkthrough.opportunityCompleteWhen,c)==true then
  local received=false;for _,id in ipairs(g.rewards or {}) do if self:Condition({kind="itemCount",itemId=id,quantity=1},c)==true then received=true end end
  if not received then local reset=self:Period(c,g.cadence);return reset and "upcoming" or "done","This opportunity is used until its observed reset; learning the toy is tracked separately.",reset end
 end
 if state=="done" and g.raid then return state,reason,ready end
 -- An intermediate quest never completes a graph. Keep its authored prerequisite actions usable.
 local first=graph.rows[1]
 if state=="done" then state="observe" end
 if state=="blocked" then return state,reason,ready end
 if g.validation and not g.validation.sourceChecked then
  local active=first and (first.observedActivity or first.observedAcquisition and first.available or first.kind=="learn" and first.available or first.questId and c.questsAt and c.questsAt<=self.Now() and self.Now()-c.questsAt<=300 and c.quests and c.quests[first.questId])
  if not active then return "observe",g.validation.gaps and g.validation.gaps[1] or "Some route details still need source review." end
 end
 if first and first.available then return "ready",first.reason or "A source-checked next action is available." end
 return state,reason,ready
end
function G:Continue()
 local g,c=self:Current();if not g then return end
 local rows=self:Steps(g,c);local index=c.cursor or 1;local row=rows[index];if not row or row.endOfSteps or row.available==false or not row.manual or c.paused then return end
 c.continued=c.continued or {};c.continued[g.id]=c.continued[g.id] or {}
 local key=g.id.."\031"..row.id
 c.history[#c.history+1]={kind="continue",key=key,guideId=g.id,stepId=row.id,previous=c.continued[g.id][row.id]}
 while #c.history>500 do table.remove(c.history,1) end
 c.continued[g.id][row.id]=self:Period(c,g.cadence) or self.Now()+86400;self:AdvanceStep(g,c,rows,index);self:Changed()
end
function G:RelevantQuest(id,event)
 local g,c=self:Current();if not g or not c then return false end
 if c.session and c.session.pending then return false end
 if not g.walkthrough then for _,q in ipairs(g.questIds or {}) do if q==id then return true end end;return false end
 local rows=self:Steps(g,c);local row=rows[c.cursor or 1]
 if not row or not row.available or row.manualOnly or row.questId~=id then return false end
 return event=="QUEST_DETAIL" and row.kind=="accept" or event~="QUEST_DETAIL" and row.kind=="turnin"
end
function G:Instruction(row,c)
 local value=row.text
 value=value:gsub("quest #(%d+)",function(id)
  local q=tonumber(id);local name=c.quests and c.quests[q] and c.quests[q].title or self.Read(C_QuestLog and C_QuestLog.GetTitleForQuestID,q)
  if name then return name end
  self.requestedQuestNames=self.requestedQuestNames or {};if not self.requestedQuestNames[q] then self.requestedQuestNames[q]=true;self.Safe(C_QuestLog and C_QuestLog.RequestLoadQuestByID,q) end
  return "quest #"..id
 end)
 return value:gsub("NPC #(%d+)",function(id) return c.npcNames and c.npcNames[tonumber(id)] or "NPC #"..id end)
end
