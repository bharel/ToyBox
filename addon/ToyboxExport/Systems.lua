local G=ToyboxGuides
function G:Source(c,key,available)
 c.sources=c.sources or {};local previous=c.sources[key] or {}
 c.sources[key]={available=available,attemptedAt=self.Now(),fetchedAt=available and self.Now() or previous.fetchedAt}
end
function G:ObserveSystems(c)
 local money=self.Read(GetMoney);if type(money)=="number" then c.money={quantity=money,at=self.Now()} end
 if c.interfaces and c.interfaces.merchant and c.interfaces.merchant.open then
  local count=self.Read(GetMerchantNumItems)
  if type(count)=="number" then local offers={};for i=1,math.min(count,300) do
   local link=self.Read(GetMerchantItemLink,i);local id=type(link)=="string" and tonumber(link:match("item:(%d+)"))
   if id then local info=self.Read(function() if C_MerchantFrame and C_MerchantFrame.GetItemInfo then return C_MerchantFrame.GetItemInfo(i) elseif GetMerchantItemInfo then local _,_,price,_,_,usable=GetMerchantItemInfo(i);return {price=price,isUsable=usable} end end);offers[id]={usable=info and info.isUsable,price=info and info.price} end
  end;c.merchant={at=self.Now(),npcId=c.interfaces.merchant.npcId,offers=offers} end
 end
 c.achievements=c.achievements or {}
 if not self.achievementWatch then
  self.achievementWatch={}
  local function watch(rule) if type(rule)~="table" then return end;if rule.achievementId then self.achievementWatch[rule.achievementId]=true end;for _,r in ipairs(rule.all or rule.any or rule.rules or {}) do watch(r) end;if rule.negate then watch(rule.negate) end end
  for _,g in ipairs(self.Pack.guides) do if g.facts and g.facts.achievementID then self.achievementWatch[g.facts.achievementID]=true end;if g.walkthrough then watch(g.walkthrough.completeWhen);for _,n in ipairs(g.walkthrough.nodes) do watch(n.completeWhen);watch(n.when);watch(n.requires) end end end
 end
 if not c.achievementsAt or self.Now()-c.achievementsAt>=30 then c.achievementsAt=self.Now();for id in pairs(self.achievementWatch) do
  local _,_,_,done=self.Read(GetAchievementInfo,id)
  if type(done)=="boolean" then
   local characterCompleted
   -- wasEarnedByMe is return 13 (14 after pcall's success flag).
   if type(GetAchievementInfo)=="function" then local values={pcall(GetAchievementInfo,id)};if values[1] and not (issecretvalue and issecretvalue(values[14])) and type(values[14])=="boolean" then characterCompleted=values[14] end end
   c.achievements[id]={completed=done,characterCompleted=characterCompleted,at=self.Now()}
  end
 end end
 local current=self:Current()
 if current and current.walkthrough and C_UnitAuras and C_UnitAuras.GetPlayerAuraBySpellID then
  c.auras=c.auras or {}
  for _,node in ipairs(current.walkthrough.nodes) do if node.auraSpellId then
   local ok,value=pcall(C_UnitAuras.GetPlayerAuraBySpellID,node.auraSpellId)
   if ok and not (issecretvalue and issecretvalue(value)) then
    local aura=self.Read(function() return value end)
    if value==nil then c.auras[node.auraSpellId]={stacks=0,at=self.Now()} elseif aura and type(aura.applications)=="number" then c.auras[node.auraSpellId]={stacks=aura.applications,at=self.Now(),expiresAt=aura.expirationTime} end
   end
  end end
 end
 if c.professionTiers and c.professionTiers.at and self.Now()-c.professionTiers.at<300 then
  c.knowledge=c.knowledge or {}
  for _,rule in ipairs(self.Pack.systems and self.Pack.systems.engineering and self.Pack.systems.engineering.catchUp or {}) do
   local learned=false;for _,tier in ipairs(c.professionTiers.data or {}) do if tier.professionID==rule.skillLineId or tier.skillLineID==rule.skillLineId then learned=true end end
   if learned then local value=self.Read(C_CurrencyInfo and C_CurrencyInfo.GetCurrencyInfo,rule.hiddenCurrencyId)
    local earned=value and (value.useTotalEarnedForMaxQty and value.totalEarned or value.quantity)
    if value and type(value.maxQuantity)=="number" and value.maxQuantity>0 and type(earned)=="number" then c.knowledge[rule.skillLineId]={remaining=math.max(0,value.maxQuantity-earned),at=self.Now(),sourceCurrencyId=rule.hiddenCurrencyId,meaning="potential catch-up knowledge; not guaranteed orders"} end
   end
  end
 end
 local seals=self.Read(C_CurrencyInfo and C_CurrencyInfo.GetCurrencyInfo,241)
 if seals then c.currencies[241]={name=seals.name,quantity=seals.quantity,isAccountWide=seals.isAccountWide,isAccountTransferable=seals.isAccountTransferable,at=self.Now()} end
 -- Reading today's calendar never changes the selected month.
 if C_Calendar and C_DateAndTime then
  local current=self.Read(C_DateAndTime.GetCurrentCalendarTime);local month=self.Read(C_Calendar.GetMonthInfo,0)
  if current and month and current.year and current.month and month.year and month.month then
   local offset=(current.year-month.year)*12+current.month-month.month
   if offset>=0 and offset<=1 then
    local count=self.Read(C_Calendar.GetNumDayEvents,offset,current.monthDay)
    if type(count)=="number" then local holidays={};for i=1,math.min(count,100) do local event=self.Read(C_Calendar.GetDayEvent,offset,current.monthDay,i);if event and event.calendarType=="HOLIDAY" then local holiday=self.Read(C_Calendar.GetHolidayInfo,offset,current.monthDay,i);if holiday then holidays[#holidays+1]=holiday end end end;c.calendar={at=self.Now(),holidays=holidays} end
   end
  end
 end
 local best,bestAt
 for _,find in ipairs(self.Pack.archaeology or {}) do for _,quest in ipairs(find.quests) do
  if c.quests and c.quests[quest.id] then best=find;bestAt=self.Now()
  elseif c.offers and c.offers[quest.id] and self.Now()-c.offers[quest.id]<300 and (not bestAt or c.offers[quest.id]>bestAt) then best=find;bestAt=c.offers[quest.id] end
 end end
 if best then c.archaeology={id=best.id,name=best.name,itemId=best.itemId,at=bestAt,endAt=c.archaeologyEndAt and c.archaeologyEndAt>self.Now() and c.archaeologyEndAt or nil} end
 self:ObserveReputationTasks(c)
end
function G:ObserveGuideQuestSet(c,id)
 if not self.questSetWatch then
  self.questSetWatch={};for _,g in ipairs(self.Pack.guides) do if g.questSetId then for _,qid in ipairs(g.questSetQuestIds or g.questIds or {}) do
   self.questSetWatch[qid]=self.questSetWatch[qid] or {};self.questSetWatch[qid][#self.questSetWatch[qid]+1]={id=g.questSetId,cadence=g.cadence}
  end end end
 end
 for _,binding in ipairs(self.questSetWatch[id] or {}) do
  local reset=self:Period(c,binding.cadence)
  if reset and reset>self.Now() then
   c.questSets=c.questSets or {};local set=c.questSets[binding.id]
   if not set or set.resetAt~=reset then set={resetAt=reset,quests={}};c.questSets[binding.id]=set end
   set.quests[id]=self.Now();set.at=self.Now()
  end
 end
end
function G:ObserveReputationTasks(c)
 if c.repTasksAt and self.Now()-c.repTasksAt<60 then return end
 local maps={};local current=self.Read(C_Map and C_Map.GetBestMapForUnit,"player");if current then maps[current]=true end
 local factions={};for _,g in ipairs(self.Pack.guides) do if g.system=="reputation" then factions[g.factionId]=true;for _,map in ipairs(g.mapIds or {}) do maps[map]=true end end end
 local quests={};for id,q in pairs(c.quests or {}) do quests[id]={id=id,title=q.title,active=true} end
 for map in pairs(maps) do for _,q in ipairs(self.Read(C_TaskQuest and (C_TaskQuest.GetQuestsOnMap or C_TaskQuest.GetQuestsForPlayerByMapID),map) or {}) do
  local id=q.questId or q.questID
  if id then
   local title=self.Read(C_QuestLog and C_QuestLog.GetTitleForQuestID,id) or ("World quest #"..id)
   local remaining=self.Read(C_TaskQuest.GetQuestTimeLeftSeconds,id)
   quests[id]={id=id,title=title,isTask=true,eligible=self.Read(C_TaskQuest.IsActive,id),destination=type(q.x)=="number" and type(q.y)=="number" and {mapID=map,x=q.x,y=q.y,label=title} or nil,expiresAt=type(remaining)=="number" and self.Now()+remaining or nil}
  end
 end end
 local found={};local success=false
 for faction in pairs(factions) do found[faction]={};for id,q in pairs(quests) do
  local awards=self.Read(C_QuestLog and C_QuestLog.DoesQuestAwardReputationWithFaction,id,faction)
  if awards~=nil then success=true end
  if awards==true then found[faction][id]=q end
 end end
 if success then c.repTasks=found;c.repTasksAt=self.Now() end
 self:Source(c,"reputationTasks",success)
end
function G:Title(g,c)
 if g.system=="reputation" then local info=self.Read(C_Reputation and C_Reputation.GetFactionDataByID,g.factionId);if info and info.name then return info.name.." · toy progression" end end
 if g.id:match('^engineering%-quest%-') then local qid=g.questIds[1];local title=c and c.quests and c.quests[qid] and c.quests[qid].title or self.Read(C_QuestLog and C_QuestLog.GetTitleForQuestID,qid);if title then return "Engineering · "..title end end
 if g.title:match("^Collect Toy item") and g.rewards and g.rewards[1] then local title=self.Read(C_Item and C_Item.GetItemNameByID,g.rewards[1]);if title then return "Collect "..title end end
 return g.title
end
function G:Location(g)
 local dest=g.destination;if dest then local map=self.Read(C_Map and C_Map.GetMapInfo,dest.mapID);if map and map.name then return map.name..(g.npcId and (" · NPC "..g.npcId) or "") end end
 return g.zone
end
function G:MissionStatus(c,missionID)
 for _,tableData in pairs(c.missions or {}) do
  local age=type(tableData.at)=="number" and self.Now()-tableData.at
  if age and age>=0 then
   for _,m in ipairs(tableData.running or {}) do if m.missionID==missionID then local readyAt=m.missionEndTime or type(m.timeLeftSeconds)=="number" and tableData.at+m.timeLeftSeconds;if readyAt and readyAt>self.Now() then return "upcoming",m.name,readyAt elseif age<=300 then return "collect",m.name,readyAt end end end
   if age<=300 then for _,m in ipairs(tableData.available or {}) do if m.missionID==missionID then return "available",m.name end end end
  end
 end
 return "unknown"
end
function G:Preparation(plan)
 local c=self:Character();local costs={};local guides={}
 for _,u in ipairs(plan.today) do
  for _,guide in ipairs(u.grouped or {u.guide}) do if not guides[guide.id] then
   guides[guide.id]=true
   for _,cost in ipairs(guide.costs or {}) do if type(cost)=="table" then
    local kind,id,quantity=cost[1],cost[2],cost[3]
    if kind=="g" then quantity=id;id=0 end
    if (kind=="i" or kind=="c" or kind=="g") and type(quantity)=="number" and quantity>0 then local key=kind..":"..id;costs[key]=costs[key] or {kind=kind,id=id,required=0};costs[key].required=costs[key].required+quantity end
   end end
  end end
 end
 for _,r in pairs(costs) do
  if r.kind=="i" then r.available=c.inventory and c.inventory.data and c.inventory.data[r.id];r.at=c.inventory and c.inventory.at
  elseif r.kind=="c" then r.available=c.currencies[r.id] and c.currencies[r.id].quantity;r.at=c.currencies[r.id] and c.currencies[r.id].at
  else r.available=self.Read(GetMoney);r.at=self.Now() end
 end
 return costs
end
