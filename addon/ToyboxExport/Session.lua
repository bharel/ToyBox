local G=ToyboxGuides
local rawSteps=G.Steps
local legacyCurrent=G.Current
local function contains(list,id) for _,value in ipairs(list or {}) do if value==id then return true end end end
local function fresh(at) return type(at)=="number" and at<=G.Now() and G.Now()-at<=300 end
function G:RawSteps(g,c) return rawSteps(self,g,c) end
function G:Guide(id) if self.guideIndexPack~=self.Pack.guides then self.guideIndex={};for _,g in ipairs(self.Pack.guides) do self.guideIndex[g.id]=g end;self.guideIndexPack=self.Pack.guides end;return self.guideIndex[id] end
function G:Current() local c=self:Character();if not c then return end;local g=c.selected and self:Guide(c.selected);if g and g.aliasOf then g=self:Guide(g.aliasOf);if g then c.selected=g.id end end;if g then return g,c end;local current=legacyCurrent(self);return current,c end
function G:StopFor(g,row)
 local d=row and row.destination
 return {id=row and row.stopId or d and ("map:"..d.mapID..":"..string.format("%.5f:%.5f",d.x,d.y)) or "activity:"..g.id,label=row and row.stopLabel or d and d.label or g.zone or g.title,destination=d}
end
function G:EnsureSession(c)
 local session=c.session
 if not session or session.version~=1 or session.resetAt and session.resetAt<=self.Now() then
  session={version=1,createdAt=self.Now(),resetAt=c.dailyResetAt,guides={},seen={},farm={},spent=0,reservedNonFarm=0};c.session=session
  for _,entry in ipairs(self:Plan().today) do
   for _,guide in ipairs(entry.grouped or {entry.guide}) do if not contains(session.guides,guide.id) then session.guides[#session.guides+1]=guide.id end end
   if not self:IsOpenFarm(entry.guide) then session.reservedNonFarm=session.reservedNonFarm+(entry.guide.minutes or 10)*60 end
  end
 end
 if c.selected and not contains(session.guides,c.selected) then session.guides[#session.guides+1]=c.selected end
 return session
end
function G:Checklist(g,c)
 local guideState=self:Eligibility(g,c);if guideState=="excluded" then return {} end
 local session=self:EnsureSession(c);local rows=self:RawSteps(g,c);local byQuest={};local others={}
 for _,row in ipairs(rows) do
  if not row.endOfSteps then
   local key=row.questId and ("quest:"..row.questId) or row.id
   local old=byQuest[key]
   if not old or row.available and not old.available then byQuest[key]=row end
  end
 end
 session.seen[g.id]=session.seen[g.id] or {}
 for key,row in pairs(byQuest) do
  session.seen[g.id][key]={questId=row.questId,stepId=row.id,label=row.questTitle or row.questId and self.Read(C_QuestLog and C_QuestLog.GetTitleForQuestID,row.questId) or row.text,cadence=row.cadence or g.cadence,stop=self:StopFor(g,row)}
 end
 for key,seen in pairs(session.seen[g.id]) do
  local row=byQuest[key];local q=seen.questId and c.quests and c.quests[seen.questId]
  local state="unknown";local eligible=row and row.available~=false
  if seen.questId then
   local done=self:Condition({kind="questTurnedIn",questId=seen.questId,cadence=seen.cadence,currentPeriodFlag=true},c)
   if done==true then state="completed" elseif self:Skipped(c,seen.stepId) then state="deferred"
   elseif fresh(c.questsAt) and q then state=q.complete and (row and row.kind=="objective" and "objectives-finished" or "ready-turnin") or "accepted"
   elseif eligible then state="available" end
  else
   local complete
   if g.walkthrough then for _,node in ipairs(g.walkthrough.nodes) do if node.id==seen.stepId and node.completeWhen then complete=self:Condition(node.completeWhen,c)==true end end end
   if complete then state="completed" elseif self:Skipped(c,seen.stepId) then state="deferred" elseif eligible then state="available" end
  end
  local eligibility,reason,readyAt=self:Eligibility(g,c)
  if eligibility=="owned" or eligibility=="done" then if seen.questId and state~="completed" then state="deferred";eligible=false else state="completed" end elseif eligibility=="upcoming" then state="cooling-down" elseif eligibility=="blocked" or eligibility=="observe" or eligibility=="unknown" then state="unknown" end
  local block=session.farm[g.id];if block and block.elapsed>=block.duration and state~="completed" then state="deferred";eligible=false;reason="The planned farming block is finished; ownership is unchanged." end
  others[#others+1]={id=g.id..":"..key,guideId=g.id,questId=seen.questId,stepId=row and row.id or seen.stepId,label=q and q.title or seen.label,state=state,selectable=eligible and state~="completed" and state~="deferred" and state~="cooling-down" or false,available=eligible and state~="completed" and state~="deferred" and state~="cooling-down" and state~="unknown" or false,stop=row and self:StopFor(g,row) or seen.stop,reason=reason,readyAt=readyAt,count=row and row.count,total=row and row.total}
 end
 table.sort(others,function(a,b) local rank={['ready-turnin']=1,['objectives-finished']=2,accepted=3,available=4,unknown=5,deferred=6,['cooling-down']=7,completed=8};if rank[a.state]~=rank[b.state] then return rank[a.state]<rank[b.state] end;if a.stop.id~=b.stop.id then return a.stop.id<b.stop.id end;return a.id<b.id end)
 return others
end
function G:SessionChecklist()
 local c=self:Character();if not c then return {} end;local session=self:EnsureSession(c);local list={};local used={}
 for _,id in ipairs(session.guides) do local g=self:Guide(id);if g then for _,op in ipairs(self:Checklist(g,c)) do
  local key=op.questId and (c.guid..":"..op.questId) or op.state=="unknown" and ("inspect:"..op.stop.id..":"..op.label) or op.id
  if not used[key] then used[key]=true;list[#list+1]=op end
 end end end
 return list
end
function G:SelectOpportunity(op)
 local c=self:Character();local g=op and self:Guide(op.guideId);if not c or not g then return false end
 local rows=self:RawSteps(g,c);for i,row in ipairs(rows) do if row.id==op.stepId and row.available~=false then
  local session=self:EnsureSession(c);session.recovery=nil;session.leaveCheck=nil;session.pending=nil;session.activeStop=self:StopFor(g,row).id
  c.selected=g.id;c.cursor=i;c.viewGuide=g.id;c.viewStep=row.id;self:EnsureSession(c);self:Changed();return true
 end end
 return false
end
function G:NextSessionAction(c,current)
 local session=self:EnsureSession(c)
 for _,id in ipairs(session.guides) do if id~=current then local g=self:Guide(id);if g then
  local status=self:Eligibility(g,c)
  if status=="ready" then for index,row in ipairs(self:RawSteps(g,c)) do if row.available~=false and not row.endOfSteps then return g,row,index end end end
 end end end
end
function G:DisplaySteps(g,c)
 local session=self:EnsureSession(c);local rows=self:RawSteps(g,c);local index=c.cursor or 1
 local state=self:Eligibility(g,c)
 local farm=self:FarmBlock(g,c)
 if farm and state~="owned" and state~="done" and farm.elapsed>=farm.duration and not self.Safe(InCombatLockdown) then return {{id=g.id..":farm-end",kind="observe",endOfSteps=true,farmEnded=true,available=false,text="Your planned farming block is finished. Choose another activity or start another block. The toy remains a goal until it is learned."}} end
 local wanted=session.pending and session.pending.guideId==g.id and session.pending.stepId or c.viewGuide==g.id and c.viewStep
 if wanted then for i,row in ipairs(rows) do if row.id==wanted then index=i;break end end end
 index=math.min(index,#rows);local row=rows[index]
 if state=="done" or state=="owned" or state=="upcoming" or not row or row.endOfSteps then
  local nextGuide,nextRow,nextIndex=self:NextSessionAction(c,g.id)
  if nextGuide then session.pending={guideId=nextGuide.id,stepId=nextRow.id,index=nextIndex,stop=self:StopFor(nextGuide,nextRow)}
  else session.pending=nil;return rows end
 else
  local stop=self:StopFor(g,row)
  if not session.activeStop then session.activeStop=stop.id end
  if stop.id~=session.activeStop then session.pending={guideId=g.id,stepId=row.id,index=index,stop=stop} else session.pending=nil;c.cursor=index;return rows end
 end
 local pending=session.pending
 return {{id=g.id..":next-stop",kind="observe",endOfSteps=true,stopTransition=true,available=false,text="Ready to move on.\nNext: "..(pending.stop.label or "the next activity")..". Select Next stop when you're ready.",nextAction=pending.stepId}}
end
function G:ResolveCurrent()
 local c=self:Character();local g=c and c.selected and self:Guide(c.selected);if not g or not c.session or c.paused then return end
 local state=self:Eligibility(g,c)
 if state=="done" or state=="owned" or state=="upcoming" then local nextGuide,row,index=self:NextSessionAction(c,g.id)
  if nextGuide and self:StopFor(nextGuide,row).id==c.session.activeStop then c.selected=nextGuide.id;c.cursor=index;c.viewGuide=nextGuide.id;c.viewStep=row.id;c.session.pending=nil end
 end
end
function G:NextStop()
 local c=self:Character();local pending=c and c.session and c.session.pending;if not pending then return false end
 local g=self:Guide(pending.guideId);if not g then return false end
 local rows=self:RawSteps(g,c);for i,row in ipairs(rows) do if row.id==pending.stepId and row.available~=false and not row.endOfSteps then
  c.selected=g.id;c.cursor=i;c.viewGuide=g.id;c.viewStep=row.id;c.session.activeStop=self:StopFor(g,row).id;c.session.pending=nil;self:Changed();return true
 end end
 c.session.pending=nil;self:Changed();return false
end
function G:TravelAllowed(g,c,row)
 local session=c.session;if not session then return true end
 return not session.pending and self:StopFor(g,row).id==session.activeStop
end
function G:ReplanSession()
 local c=self:Character();if not c then return end;c.session=nil;c.selected=nil;c.viewStep=nil;c.cursor=1;self.dirty=true;self:Changed()
end
function G:IsOpenFarm(g)
 return not g.raid and not g.trackingQuestId and not (g.walkthrough and g.walkthrough.opportunityCompleteWhen) and g.cadence=="repeatable" and g.outcome=="random-drop"
end
function G:FarmBlock(g,c)
 if not self:IsOpenFarm(g) then return end
 local s=self:EnsureSession(c);local block=s.farm[g.id]
 if not block then
  local reserved=0;for _,other in pairs(s.farm) do reserved=reserved+math.max(0,other.duration-other.elapsed) end
  local seconds=math.max(0,math.min(600,(self:DB().intent.budget or 30)*60-(s.spent or 0)-(s.reservedNonFarm or 0)-reserved))
  block={duration=seconds,elapsed=0};s.farm[g.id]=block
 end
 return block
end
function G:TickSession(dt)
 local c=self:Character();if not c or not c.session then return end
 local g=c.selected and self:Guide(c.selected);if not g or c.paused or self.Safe(UnitIsAFK,"player") then return end
 if c.session and c.session.pending then return end
 local state=self:Eligibility(g,c);if state~="ready" then return end
 local row=self:RawSteps(g,c)[c.cursor or 1];if not row or row.available==false or row.kind~="kill" and row.kind~="loot" and row.kind~="objective" then return end
 local block=self:FarmBlock(g,c);if block and block.elapsed<block.duration then
  local used=math.min(dt,block.duration-block.elapsed);block.elapsed=block.elapsed+used;c.session.spent=(c.session.spent or 0)+used
 end
end
function G:AnotherFarmBlock()
 local g,c=self:Current();if not g or not self:IsOpenFarm(g) then return end
 local s=self:EnsureSession(c);s.farm[g.id]={duration=600,elapsed=0};self:Changed()
end
function G:SessionSummary()
 local c=self:Character();if not c then return {state="nothing-ready",completed=0,deferred=0,unknown=0,remaining=0} end
 local list=self:SessionChecklist();local out={state="planned-progress-finished",completed=0,deferred=0,unknown=0,remaining=0}
 for _,op in ipairs(list) do if op.state=="completed" then out.completed=out.completed+1 elseif op.state=="deferred" then out.deferred=out.deferred+1 elseif op.available then out.remaining=out.remaining+1 else out.unknown=out.unknown+1 end end
 if out.remaining>0 then out.state="active" elseif out.unknown>0 or #list==0 then out.state="nothing-ready" end
 for _,op in ipairs(list) do if op.readyAt and op.readyAt>self.Now() then out.readyAt=math.min(out.readyAt or op.readyAt,op.readyAt) end end
 if c.dailyResetAt and c.dailyResetAt>self.Now() then out.nextResetAt=c.dailyResetAt end
 return out
end
function G:AltOpportunities()
 local active=self:Character();local result={ready={},unknown={}};if not active then return result end
 local candidates={};for _,id in ipairs(self:EnsureSession(active).guides) do candidates[id]=true end
 for id,value in pairs(self:DB().intent.followed or {}) do if value then candidates[id]=true end end
 for _,g in ipairs(self.Pack.guides) do local req=g.requirements or {};if not g.aliasOf and (g.raid or (req.classId==11 or contains(req.classIds,11)) and g.validation and g.validation.sourceChecked) then candidates[g.id]=true end end
 for guid,c in pairs(self:DB().characters) do if guid~=active.guid and c.region==active.region then
  local freshCharacter=fresh(c.at)
  for id in pairs(candidates) do local g=self:Guide(id);if g then local state,reason=self:Eligibility(g,c)
   if state=="ready" or state=="observe" or state=="unknown" then
    local activeState=self:Eligibility(g,active);local druid=g.requirements and (g.requirements.classId==11 or contains(g.requirements.classIds,11))
    local preferredMain=c.class=="PRIEST"
    if state~="ready" or not freshCharacter then result.unknown[#result.unknown+1]={guid=guid,name=c.name,realm=c.realm,guideId=id,at=c.at,reason="Log in to recheck this character's available opportunity."}
    elseif activeState~="ready" or druid or preferredMain or g.raid then result.ready[#result.ready+1]={guid=guid,name=c.name,realm=c.realm,guideId=id,at=c.at,reason=druid and "Confirmed Druid opportunity" or preferredMain and "Preferred main has an eligible opportunity" or reason} end
   end
  end end
 end end
 table.sort(result.ready,function(a,b)return a.guid..a.guideId<b.guid..b.guideId end);return result
end
function G:GoalPaths(itemId)
 local c=self:Character();local paths={};if not c then return paths end
 for _,g in ipairs(self.Pack.guides) do if not g.aliasOf and contains(g.rewards,itemId) then
  local state,reason=self:Eligibility(g,c);local rows=self:RawSteps(g,c);local row=rows[1]
  paths[#paths+1]={guide=g,state=state,reason=reason,next=row,received=self:Condition({kind="itemCount",itemId=itemId},c)==true,sourceChecked=g.validation and g.validation.sourceChecked and g.validation.completePath~=false and g.walkthrough and g.walkthrough.includesPrerequisites~=false,owned=self:Owned(itemId)}
 end end
 table.sort(paths,function(a,b)
  if a.received~=b.received then return a.received end
  local rank={ready=1,observe=2,unknown=3,blocked=4,upcoming=5,done=6,owned=7,excluded=8};if (rank[a.state] or 9)~=(rank[b.state] or 9) then return (rank[a.state] or 9)<(rank[b.state] or 9) end
  local followed=self:DB().intent.followed;if followed[a.guide.id]~=followed[b.guide.id] then return followed[a.guide.id]==true end
  if a.sourceChecked~=b.sourceChecked then return a.sourceChecked==true end
  return a.guide.id<b.guide.id
 end)
 return paths
end
function G:SelectGoal(itemId)
 local paths=self:GoalPaths(itemId);local path=paths[1];if not path or path.owned then return false end
 local nextGuide=path.next and path.next.linkedGuideId
 if nextGuide and self:Guide(nextGuide) then return self:Select(nextGuide) end
 return self:Select(path.guide.id)
end
function G:GoalTargets()
 if self.goalTargetRevision==self.workRevision and self.goalTargetCache then return self.goalTargetCache end
 local targets={};for itemId,enabled in pairs(self:DB().intent.followedToys or {}) do if enabled and not self:Owned(itemId) then
  local best=self:GoalPaths(itemId)[1];if best then targets[best.guide.id]=true;if best.next and best.next.linkedGuideId then targets[best.next.linkedGuideId]=true end end
 end end
 self.goalTargetRevision=self.workRevision;self.goalTargetCache=targets;return targets
end
local guideIntent=G.GuideIntent
function G:GuideIntent(kind,id)
 local explicit=guideIntent(self,kind,id);if explicit~=nil or kind~="followed" then return explicit end
 return self:GoalTargets()[id] or false
end
function G:PlanningGuides(c)
 local candidates={};for _,g in ipairs(self.Pack.guides) do
  local include=not g.metadataRoute or g.essential or g.validation and g.validation.sourceChecked or self:GuideIntent("followed",g.id)
  if not include then for _,id in ipairs(g.questIds or {}) do if c.quests and c.quests[id] then include=true;break end end end
  if not include and g.system=="reputation" then include=c.repTasks and c.repTasks[g.factionId] and next(c.repTasks[g.factionId])~=nil end
  if include and not g.aliasOf then candidates[#candidates+1]=g end
 end;return candidates
end
function G:ResourceAllocations(guides,c)
 c=c or self:Character();local balances={};local out={}
 for _,g in ipairs(guides) do local costs={};for _,cost in ipairs(g.costs or {}) do
  local kind,id,required=cost[1],cost[2],cost[3];if kind=="g" then required=id;id=0 end
  local observation=kind=="c" and c.currencies[id] or kind=="i" and c.inventory or kind=="g" and c.money
  local amount=observation and (kind=="i" and observation.data[id] or observation.quantity)
  local scope=kind=="c" and observation and observation.isAccountWide==true and "warband" or kind=="c" and observation and observation.isAccountTransferable==true and "transferable-character" or "character-observed"
  local key=(scope=="warband" and (c.region or "unknown")..":warband" or c.guid)..":"..kind..":"..id
  if balances[key]==nil then balances[key]=fresh(observation and observation.at) and (amount or 0) or false end
  local available=balances[key];local reserved=type(available)=="number" and math.min(available,required or 0) or nil
  if reserved then balances[key]=available-reserved end
  costs[#costs+1]={key=key,scope=scope,required=required,observed=fresh(observation and observation.at) and amount or nil,allocated=reserved,shortfall=reserved and required-reserved or nil,at=observation and observation.at}
 end;out[g.id]=costs end;return out
end
