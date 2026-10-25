local G=ToyboxGuides
local function fresh(at) return type(at)=="number" and at<=G.Now() and G.Now()-at<=300 end
local function copy(v) if type(v)~="table" then return v end;local r={};for k,x in pairs(v) do r[k]=copy(x) end;return r end
local function any(list) return {any=list} end
function G:ActiveAction(g,c)
 g=g or self:Current();c=c or self:Character();if not g or not c then return end
 local rows=self:RawSteps(g,c);for _,row in ipairs(rows) do if row.id==c.viewStep then return row end end;return rows[c.cursor or 1] or rows[1]
end
function G:RecoveryOptions()
 local g,c=self:Current();if not g or not c or c.session and c.session.pending then return {} end
 local row=self:ActiveAction(g,c);if not row or row.endOfSteps then return {} end
 local options={{id="npc",label="NPC or object is missing"},{id="phase",label="Wrong phase or inaccessible area"},{id="objective",label="The objective doesn't match"}}
 if row.questId then table.insert(options,2,{id="quest",label="Quest is not offered"}) end
 if row.requires or row.itemId then options[#options+1]={id="item",label="Required item is missing"} end
 return options
end
function G:BeginRecovery(reason)
 local allowed=false;for _,option in ipairs(self:RecoveryOptions()) do if option.id==reason then allowed=true end end;if not allowed then return false end
 self:Refresh();local g,c=self:Current();local row=self:ActiveAction(g,c);if not row then return false end
 local recovery
 for _,branch in ipairs(row.recoveryCases or {}) do if branch.reason==reason and (not branch.when or self:Condition(branch.when,c)==true) then recovery=copy(branch);break end end
 if not recovery then
  local accept
  if row.questId then for _,node in ipairs(g.walkthrough and g.walkthrough.nodes or {}) do if node.questId==row.questId and node.kind=="accept" then accept=node;break end end end
  local missingQuest=row.questId and self:Condition({kind="questInLog",questId=row.questId},c)==false
  local text,destination,terminal=row.recovery and row.recovery.text,row.recovery and row.recovery.destination or row.destination,row.completeWhen
  if missingQuest and accept then text=accept.text;destination=accept.destination;terminal={kind="questInLog",questId=row.questId}
  elseif reason=="item" and row.requires then terminal=row.requires end
  if not text or text=="" then text=reason=="phase" and "Check the map and the source's phase requirements. Toybox has no verified phase repair for this instruction. Choose another activity or report the missing directions." or "Recheck the indicated NPC or interface. Toybox has no verified repair branch for this instruction; you can return, choose another activity or report it." end
  recovery={text=text,destination=destination,completeWhen=terminal,manual=true,authored=row.recovery~=nil or missingQuest and accept~=nil,sources=row.sources}
 end
 local session=self:EnsureSession(c);c.history[#c.history+1]={kind="recovery",previous=copy(session.recovery),guideId=g.id,stepId=row.id,activeStop=session.activeStop}
 while #c.history>500 do table.remove(c.history,1) end
 session.recovery={guideId=g.id,stepId=row.id,reason=reason,action=recovery,startedAt=self.Now(),returnStop=session.recovery and session.recovery.returnStop or session.activeStop or self:StopFor(g,row).id};c.viewStep=nil;c.cursor=1
 session.pending=nil;session.activeStop="recovery:"..g.id..":"..row.id;self:Changed();return true
end
function G:EndRecovery()
 local c=self:Character();local session=c and c.session;local r=session and session.recovery;if not r then return false end
 session.recovery=nil;session.activeStop=r.returnStop;c.selected=r.guideId;c.viewGuide=r.guideId;c.viewStep=r.stepId;c.cursor=1;self:Changed();return true
end
local display=G.DisplaySteps
function G:DisplaySteps(g,c)
 local session=self:EnsureSession(c);local recovery=session.recovery
 if recovery then
  local action=recovery.action
  if action.completeWhen and self:Condition(action.completeWhen,c)==true then session.recovery=nil;session.activeStop=recovery.returnStop;c.selected=recovery.guideId;c.viewGuide=recovery.guideId;c.viewStep=recovery.stepId;c.cursor=1;g=self:Guide(recovery.guideId) or g
  else local row=copy(action);row.id="recovery:"..recovery.guideId..":"..recovery.stepId..":"..recovery.reason;row.kind="observe";row.manual=true;row.available=true;row.recovering=true;row.stopId=session.activeStop;row.text="Recovery · "..row.text;return {row} end
 end
 if session.leaveCheck then return {{id=g.id..":leave-check",text="Before leaving this stop:\n"..table.concat(session.leaveCheck.labels,"\n"),kind="observe",available=false,endOfSteps=true,leaveCheck=true}} end
 return display(self,g,c)
end
local follow=G.FollowCurrentStep
function G:FollowCurrentStep(force)
 local g,c=self:Current();if c and c.session and c.session.recovery and not c.paused then
  local r=self:DisplaySteps(g,c)[1];if r and r.recovering then local key=r.id..":"..tostring(r.destination and r.destination.mapID);if (force or self.navigationStep~=key) and (force or not self.Navigation.manualOverride) then self.navigationStep=key;self.Navigation:Go(r.destination) end;return end
 end
 return follow(self,force)
end
local continue=G.Continue;function G:Continue() local c=self:Character();if c and c.session and c.session.recovery then if not c.paused then self:EndRecovery() end;return end;return continue(self) end
local back=G.Back;function G:Back() if self:EndRecovery() then return true end;return back(self) end
local skip=G.Skip;function G:Skip() if self:EndRecovery() then return end;return skip(self) end
local undo=G.Undo;function G:Undo()
 local c=self:Character();local h=c and c.history[#c.history];if h and h.kind=="recovery" then table.remove(c.history);local s=self:EnsureSession(c);s.recovery=h.previous;s.activeStop=h.activeStop;c.selected=h.guideId;c.viewGuide=h.guideId;c.viewStep=h.stepId;c.cursor=1;self:Changed();return end;return undo(self)
end
local relevant=G.RelevantQuest;function G:RelevantQuest(id,event) local c=self:Character();if c and c.session and c.session.recovery then return false end;return relevant(self,id,event) end
function G:LeaveFindings(c)
 c=c or self:Character();if not c or not c.session then return {} end
 local found={};local seen={};local stop=c.session.activeStop
 for _,op in ipairs(self:SessionChecklist()) do if op.stop.id==stop and op.questId and c.questsAt and fresh(c.questsAt) and c.quests and c.quests[op.questId] and c.quests[op.questId].complete==true and op.state~="completed" and not seen[op.id] then found[#found+1]={kind="turnin",id=op.id,label="Turn in "..op.label,op=op};seen[op.id]=true end end
 local guides={};for _,id in ipairs(c.session.guides) do local g=self:Guide(id);if g then guides[#guides+1]=g end end
 local allocations=self:ResourceAllocations(guides,c)
 for _,g in ipairs(guides) do for _,item in ipairs(g.rewards or {}) do
  if not self:Owned(item) then
   local bag=self:Condition({kind="itemCount",itemId=item},c)==true
   local row=self:ActiveAction(g,c);local same=row and self:StopFor(g,row).id==stop
   if bag and (same or c.selected==g.id) and not seen["toy:"..item] then found[#found+1]={kind="learn",id="toy:"..item,itemId=item,label="Learn "..(self.Read(C_Item and C_Item.GetItemNameByID,item) or "the received toy")};seen["toy:"..item]=true
   elseif same and g.npcId and fresh(c.merchant and c.merchant.at) and c.merchant.npcId==g.npcId and self:Condition({kind="merchantOffer",npcId=g.npcId,itemId=item},c)==true then
    local funded=true;for _,cost in ipairs(allocations[g.id] or {}) do if cost.shortfall==nil or cost.shortfall>0 then funded=false end end
    if funded and # (g.costs or {})>0 then found[#found+1]={kind="purchase",id="buy:"..item,guideId=g.id,label="Buy "..(self.Read(C_Item and C_Item.GetItemNameByID,item) or "the followed toy").." at this vendor"} end
   end
  end
 end end
 table.sort(found,function(a,b)return a.id<b.id end);return found
end
local nextStop=G.NextStop
function G:NextStop()
 local c=self:Character();if not c or not c.session or not c.session.pending then return false end
 local found=self:LeaveFindings(c);local ids={c.session.activeStop or ""};local labels={};for _,f in ipairs(found) do ids[#ids+1]=f.id;labels[#labels+1]="• "..f.label end
 local signature=table.concat(ids,"|");c.session.leaveSeen=c.session.leaveSeen or {}
 if #found>0 and not c.session.leaveSeen[signature] then c.session.leaveCheck={signature=signature,findings=found,labels=labels};self:Changed();return false end
 return nextStop(self)
end
function G:FinishHere()
 local c=self:Character();local check=c and c.session and c.session.leaveCheck;if not check then return end;c.session.leaveCheck=nil
 local f=check.findings[1];if f.op then
  local op=copy(f.op);local g=self:Guide(op.guideId);for _,node in ipairs(g and g.walkthrough and g.walkthrough.nodes or {}) do if node.kind=="turnin" and node.questId==op.questId and (not node.when or self:Condition(node.when,c)==true) and (not node.requires or self:Condition(node.requires,c)==true) then
   if c.skipped[node.id] then c.history[#c.history+1]={kind="skip",key=node.id,guideId=g.id,stepId=node.id,previous=c.skipped[node.id]};c.skipped[node.id]=nil;self.workRevision=(self.workRevision or 0)+1 end;op.stepId=node.id;break
  end end;self:SelectOpportunity(op) elseif f.itemId then self:SelectGoal(f.itemId) elseif f.guideId then self:Select(f.guideId) end;self:Changed()
end
function G:LeaveNow()
 local c=self:Character();local check=c and c.session and c.session.leaveCheck;if not check then return false end
 c.session.leaveSeen[check.signature]=true;c.session.leaveCheck=nil;local result=nextStop(self);self:Changed();return result
end
function G:TravelPreferences(c)
 c=c or self:Character();local intent=self:DB().intent;local guid=c and c.guid
 return {mode=guid and intent["travelMode:"..guid] or "fastest",guid=guid}
end
function G:NearbyIndex()
 if self.nearbyIndexPack==self.Pack.guides then return self.nearbyIndex end
 local index={};for _,g in ipairs(self.Pack.guides) do if not g.aliasOf and g.walkthrough and g.validation and g.validation.sourceChecked and g.validation.completePath~=false and g.walkthrough.includesPrerequisites~=false and #(g.rewards or {})>0 then
  local maps={};local points={g.destination};for _,node in ipairs(g.walkthrough.nodes) do if node.destination then points[#points+1]=node.destination end end
  for _,d in pairs(points) do if d and d.mapID and not maps[d.mapID] then maps[d.mapID]=true;index[d.mapID]=index[d.mapID] or {};index[d.mapID][#index[d.mapID]+1]={guide=g,destination=d} end end
 end end;self.nearbyIndex=index;self.nearbyIndexPack=self.Pack.guides;return index
end
function G:Nearby(c,force)
 c=c or self:Character();if not c then return {} end
 if not force and c.nearbyCache and c.nearbyCache.revision==self.workRevision and self.Now()-c.nearbyCache.at<10 then return c.nearbyCache.rows end
 local map=self.Read(C_Map and C_Map.GetBestMapForUnit,"player");local position=map and self.Read(C_Map and C_Map.GetPlayerMapPosition,map,"player");local session=self:EnsureSession(c);local rows={};local b=self.Navigation and self.Navigation:Backend()
 for _,entry in ipairs(self:NearbyIndex()[map] or {}) do local g=entry.guide
  if g.id~=c.selected and not (session.nearbyDismissed and session.nearbyDismissed[g.id]) and self:Eligibility(g,c)=="ready" then
   local row=self:RawSteps(g,c)[1];local d=row and row.destination or entry.destination;local same=row and self:StopFor(g,row).id==session.activeStop;local distance
   if position and d and d.mapID==map and b and b.TravelGraph and type(b.TravelGraph.DistanceProvider)=="function" then distance=self.Safe(b.TravelGraph.DistanceProvider,{mapID=map,x=position.x,y=position.y},d) end
   local method=(g.method or ""):lower();local dynamic=method:find("rare") or method:find("treasure") or method:find("drop") or g.season or g.rotating
   local source=g.npcId or g.facts and (g.facts.npcID or g.facts.creatureID or g.facts.objectID);local sighting=source and c.sightings and c.sightings[source]
   local observed=not dynamic or sighting and fresh(sighting.at) and sighting.active and sighting.mapID==map
   local planned={};local included=false;for _,id in ipairs(session.guides) do local guide=self:Guide(id);if guide then planned[#planned+1]=guide;if guide.id==g.id then included=true end end end;if not included then planned[#planned+1]=g end
   local followed=self:GuideIntent("followed",g.id);for _,item in ipairs(g.rewards or {}) do if self:DB().intent.followedToys and self:DB().intent.followedToys[item] then followed=true end end
   local funded=true;for _,cost in ipairs(self:ResourceAllocations(planned,c)[g.id] or {}) do if cost.shortfall==nil or cost.shortfall>0 then funded=false end end
   if row and row.kind~="learn" and row.available~=false and observed and funded and (same or type(distance)=="number" and distance>=0 and distance<=500) then rows[#rows+1]={guideId=g.id,label=g.title,destination=d,distance=distance,sameStop=same,at=self.Now(),followed=followed,guaranteed=g.outcome=="guaranteed-progress",deadline=self:Period(c,g.cadence),evidenceAt=sighting and sighting.at or c.at,expiresAt=sighting and sighting.at+300 or self:Period(c,g.cadence)} end
  end
 end
 table.sort(rows,function(a,b) if not not a.sameStop~=not not b.sameStop then return not not a.sameStop end;if not not a.followed~=not not b.followed then return not not a.followed end;if (a.deadline or math.huge)~=(b.deadline or math.huge) then return (a.deadline or math.huge)<(b.deadline or math.huge) end;if not not a.guaranteed~=not not b.guaranteed then return not not a.guaranteed end;return a.guideId<b.guideId end)
 local result={};local used={};for _,row in ipairs(rows) do local g=self:Guide(row.guideId);local key=g.sharedGroup or g.npcId and "vendor:"..g.npcId or row.guideId;if not used[key] then used[key]=true;result[#result+1]=row end end
 c.nearbyCache={rows=result,at=self.Now(),revision=self.workRevision};return result
end
function G:QueueNearby(id)
 local c=self:Character();local valid;for _,row in ipairs(self:Nearby(c,true)) do if row.guideId==id then valid=true end end;if not valid then return false end
 local s=self:EnsureSession(c);local exists=false;for _,value in ipairs(s.guides) do if value==id then exists=true end end;if not exists then s.guides[#s.guides+1]=id end
 s.nearbyDismissed=s.nearbyDismissed or {};s.nearbyDismissed[id]=true;self:Changed();return true
end
function G:DismissNearby(id) local c=self:Character();local s=self:EnsureSession(c);s.nearbyDismissed=s.nearbyDismissed or {};s.nearbyDismissed[id]=true;self:Changed() end
function G:ObserveSighting(unit)
 local c=self:Character();if not c then return end;c.unitSightings=c.unitSightings or {};local previous=c.unitSightings[unit];if previous and c.sightings and c.sightings[previous] then c.sightings[previous].active=false end;local guid=self.Read(UnitGUID,unit);local id=type(guid)=="string" and tonumber(guid:match("^[^-]+%-[^-]+%-[^-]+%-[^-]+%-[^-]+%-(%d+)%-"));if not c or not id then return end
 local map=self.Read(C_Map and C_Map.GetBestMapForUnit,"player");c.sightings=c.sightings or {};c.unitSightings[unit]=id;c.sightings[id]={active=self.Read(UnitIsDead,unit)==false,mapID=map,at=self.Now(),guid=guid}
end

local select=G.Select
function G:Select(id) local c=self:Character();if c then if c.session and c.session.recovery then c.session.activeStop=c.session.recovery.returnStop;c.session.recovery=nil end; c.activityStarts=c.activityStarts or {};c.activityStarts[id]={at=self.Now(),sequence=c.turnInSequence or 0} end;return select(self,id) end

-- Read only fixed native rewards; choice rewards are never added as guaranteed yield.
function G:ObserveRewardOffer(c)
 local id=self.Read(GetQuestID);if type(id)~="number" then return end
 local count=self.Read(GetNumQuestRewards);local currencies=self.Read(C_QuestInfoSystem and C_QuestInfoSystem.GetQuestRewardCurrencies,id)
 if type(count)~="number" and type(currencies)~="table" then return end
 local observed={at=self.Now(),items={},currencies={}}
 if type(count)=="number" and GetQuestItemInfo then for i=1,math.min(count,100) do
  local values={pcall(GetQuestItemInfo,"reward",i)};local quantity,item=values[4],values[7]
  if values[1] and not (issecretvalue and (issecretvalue(quantity) or issecretvalue(item))) and type(item)=="number" and type(quantity)=="number" and quantity>=0 then observed.items[item]=(observed.items[item] or 0)+quantity end
 end end
 for _,currency in ipairs(type(currencies)=="table" and currencies or {}) do
  local item=currency.currencyID;local amount=currency.totalRewardAmount
  if not (issecretvalue and (issecretvalue(item) or issecretvalue(amount))) and type(item)=="number" and type(amount)=="number" and amount>=0 then observed.currencies[item]=(observed.currencies[item] or 0)+amount end
 end
 c.rewardOffers=c.rewardOffers or {};c.rewardOffers[id]=observed
end
