local G=ToyboxGuides
local function number(v) return type(v)=="number" and v==v and v or nil end
local function now() return G.Now() end
local function contains(t,v) for _,x in ipairs(t or {}) do if x==v then return true end end end
function G:Period(c,cadence)
 if cadence=="daily" then return c.dailyResetAt and c.dailyResetAt>now() and c.dailyResetAt or nil elseif cadence=="weekly" then return c.weeklyResetAt and c.weeklyResetAt>now() and c.weeklyResetAt or nil end
 if cadence=="fortnightly" and c.archaeology and c.archaeology.endAt and c.archaeology.endAt>now() then return c.archaeology.endAt end
end
function G:InPeriod(at,c,cadence)
 local reset=self:Period(c,cadence);local seconds=cadence=="daily" and 86400 or 604800
 return type(at)=="number" and reset and now()<reset and at>=reset-seconds and at<=now()
end
function G:Owned(itemID)
 self.ownedRead=self.ownedRead or {}
 if self.ownedRead[itemID]~=nil then return self.ownedRead[itemID] end
 local value=self.Read(PlayerHasToy,itemID)
 if value==true then self:DB().owned[itemID]=true end
 local owned=value==true or self:DB().owned[itemID]==true
 self.ownedRead[itemID]=owned;return owned
end
function G:Refresh()
 local c=self:Character();if not c then return end
 local at=now();c.at=at;c.level=self.Read(UnitLevel,"player");c.faction=self.Read(UnitFactionGroup,"player") or c.faction
 local daily=self.Read(C_DateAndTime and C_DateAndTime.GetSecondsUntilDailyReset)
 local weekly=self.Read(C_DateAndTime and C_DateAndTime.GetSecondsUntilWeeklyReset)
 if number(daily) and daily>0 then c.dailyResetAt=at+daily end
 if number(weekly) and weekly>0 then c.weeklyResetAt=at+weekly end
 local total=self.Read(C_QuestLog and C_QuestLog.GetNumQuestLogEntries)
 if self.Source then self:Source(c,"quests",type(total)=="number") end
 if number(total) then
  local quests={};for i=1,math.min(total,1000) do
   local q=self.Read(C_QuestLog.GetInfo,i)
   if q and q.questID and not q.isHeader then
    local objectives=self.Read(C_QuestLog.GetQuestObjectives,q.questID)
    quests[q.questID]={id=q.questID,title=q.title,frequency=q.frequency,complete=self.Read(C_QuestLog.IsComplete,q.questID)==true,objectives=objectives or {}}
   end
  end;c.quests=quests;c.questsAt=at
  if self.ObserveGuideQuestSet then for id in pairs(quests) do self:ObserveGuideQuestSet(c,id) end end
 end
 c.flags=c.flags or {};c.reputations=c.reputations or {};c.currencies=c.currencies or {}
 self.watched=self.watched or {};self.repWatch=self.repWatch or {}
 if not self.watchBuilt then for _,g in ipairs(self.Pack.guides) do for _,id in ipairs(g.questIds or {}) do self.watched[id]=true end;local r=g.requirements and g.requirements.reputation;if r then self.repWatch[r.id]=true end;if g.goalReputation then self.repWatch[g.goalReputation.factionId]=true end end;self.watchBuilt=true end
 if not c.flagsAt or at-c.flagsAt>=3 then c.flagsAt=at;for id in pairs(self.watched) do local value=self.Read(C_QuestLog and C_QuestLog.IsQuestFlaggedCompleted,id);if type(value)=="boolean" then c.flags[id]={value=value,at=at,source="current-client"} end end end
 if not c.reputationsAt or at-c.reputationsAt>=10 then c.reputationsAt=at;for id in pairs(self.repWatch) do
  local f=self.Read(C_Reputation and C_Reputation.GetFactionDataByID,id)
  local renown=self.Read(C_MajorFactions and C_MajorFactions.GetMajorFactionData,id)
  local friendship=self.Read(C_GossipInfo and C_GossipInfo.GetFriendshipReputation,id);local ranks=friendship and friendship.friendshipFactionID==id and self.Read(C_GossipInfo and C_GossipInfo.GetFriendshipReputationRanks,id)
  if f or renown or ranks then c.reputations[id]={data=f,renown=renown and renown.renownLevel,friendshipRank=ranks and ranks.currentLevel,at=at} end
 end end
 c.professions=c.professions or {}
 if GetProfessions and GetProfessionInfo then
  local ok,p1,p2,p3,p4,p5,p6=pcall(GetProfessions);local indices=ok and {p1,p2,p3,p4,p5,p6} or {};local profs={};local complete=ok
  for _,index in pairs(indices) do
   -- GetProfessionInfo returns many values; keep IDs distinct from recipe IDs.
   local ok,pname,_,pskill,pmax,_,_,pid=pcall(GetProfessionInfo,index)
   if ok and type(pid)=="number" and type(pname)=="string" then profs[pid]={name=pname,skill=pskill,max=pmax,at=at} else complete=false end
  end
  if complete then
   for oldID in pairs(c.professions) do if not profs[oldID] then
    for _,r in pairs(c.recipes or {}) do if r.professionId==oldID then r.invalidatedAt=at end end
    for _,guide in ipairs(self.Pack.guides) do if guide.requirements and guide.requirements.professionId==oldID then
     for _,v in ipairs(guide.variants or {}) do local r=c.recipes and c.recipes[v.spellId];if r then r.invalidatedAt=at end end
     for _,id in ipairs(guide.recipeSpellIds or {}) do local r=c.recipes and c.recipes[id];if r then r.invalidatedAt=at end end
    end end
   end end
   c.professions=profs;c.professionsAt=at
  end
  if self.Source then self:Source(c,"professions",complete) end
 end
 c.inventory=c.inventory or {};local counts={}
 if C_Container and C_Container.GetContainerNumSlots then
  local complete=true
  for bag=0,5 do local slots=self.Read(C_Container.GetContainerNumSlots,bag)
   if type(slots)~="number" then complete=false end
   if type(slots)=="number" then for slot=1,math.min(slots,100) do local item=self.Read(C_Container.GetContainerItemInfo,bag,slot);if item and type(item.itemID)=="number" and type(item.stackCount)=="number" then counts[item.itemID]=(counts[item.itemID] or 0)+item.stackCount end end end
  end;if complete then c.inventory={data=counts,at=at,scope="bags"} end;if self.Source then self:Source(c,"inventory",complete) end
 end
 if type(GetInventoryItemID)=="function" then local equipped={};for slot=1,19 do local id=self.Read(GetInventoryItemID,"player",slot);if type(id)=="number" then equipped[id]=true end end;c.equipped={data=equipped,at=at} end
 local watchedCurrency={}
 for _,g in ipairs(self.Pack.guides) do
  for _,cost in ipairs(type(g.costs)=="table" and g.costs or {}) do if type(cost)=="table" and cost[1]=="c" and not watchedCurrency[cost[2]] then watchedCurrency[cost[2]]=true;local info=self.Read(C_CurrencyInfo and C_CurrencyInfo.GetCurrencyInfo,cost[2]);if info then c.currencies[cost[2]]={quantity=info.quantity,name=info.name,isAccountWide=info.isAccountWide,isAccountTransferable=info.isAccountTransferable,at=at} end end end
 end
 local cache=ToyboxExportDB.characters and ToyboxExportDB.characters[c.guid]
 if cache then
  for _,q in pairs(cache.turnIns or {}) do c.turnIns[q.id]=math.max(c.turnIns[q.id] or 0,q.at) end
  c.archaeologyEndAt=cache.archaeologyEndAt or c.archaeologyEndAt
  c.recipes=c.recipes or {}
  for spellID,r in pairs(cache.recipes or {}) do
   if type(r.at)=="number" and (not c.recipes[spellID] or r.at>(c.recipes[spellID].at or 0)) then c.recipes[spellID]={learned=true,spellId=spellID,clientSkillLineAbilityId=r.clientSkillLineAbilityId or r.blizzardRecipeId,at=r.at,readyAt=type(r.cooldownSeconds)=="number" and r.at+r.cooldownSeconds or nil,charges=r.charges,maxCharges=r.maxCharges,observed=true,source="legacy-exporter"} end
  end
 end
 c.recipes=c.recipes or {}
 local own=C_TradeSkillUI and self.Read(C_TradeSkillUI.IsTradeSkillReady)==true and self.Read(C_TradeSkillUI.IsTradeSkillLinked)~=true and self.Read(C_TradeSkillUI.IsTradeSkillGuild)~=true and self.Read(C_TradeSkillUI.IsTradeSkillGuildMember)~=true and self.Read(C_TradeSkillUI.IsNPCCrafting)~=true
 if self.Source then self:Source(c,"recipes",own==true) end
 if own and (not c.recipeScanAt or at-c.recipeScanAt>=2) then
  c.recipeScanAt=at
  local tiers=self.Read(C_TradeSkillUI.GetChildProfessionInfos)
  local baseProfession=self.Read(C_TradeSkillUI.GetBaseProfessionInfo)
  if tiers then c.professionTiers={data=tiers,at=at} end
  local ids=self.Read(C_TradeSkillUI.GetAllRecipeIDs) or {}
  local wanted={};for _,id in ipairs(ids) do wanted[id]=true end
  -- Enumerated recipes belong to the open, owned profession context. Querying an
  -- unrelated recipe while another profession is open can yield misleading absence.
  for id in pairs(wanted) do
   local info=self.Read(C_TradeSkillUI.GetRecipeInfo,id)
   if info and type(info.learned)=="boolean" then
    local profession=self.Read(C_TradeSkillUI.GetProfessionInfoByRecipeID,id)
    local r={learned=info.learned,spellId=id,clientSkillLineAbilityId=info.skillLineAbilityID,skillLineID=profession and profession.professionID,professionId=baseProfession and baseProfession.professionID,at=at}
    local selected=self:Current();local relevant=selected and (selected.recipeSpellIds or selected.variants)
    if info.learned and relevant then for _,value in ipairs(relevant) do local spell=type(value)=="table" and value.spellId or value;if spell==id then r.schematic=self.Read(C_TradeSkillUI.GetRecipeSchematic,id,false) end end end
    local seconds,_,charges,maxCharges=self.Read(C_TradeSkillUI.GetRecipeCooldown,id)
    if number(seconds) and seconds>=0 then r.readyAt=at+seconds;r.observed=true end
    if number(charges) and number(maxCharges) and charges<=maxCharges then r.charges=charges;r.maxCharges=maxCharges end
    c.recipes[id]=r
   end
  end
 end
 -- Optional systems retain only actual client responses, never guessed missions.
 if C_Garrison and C_Garrison.GetAvailableMissions and c.missionPanelOpen then
  c.missions=c.missions or {};for _,kind in ipairs({1,2,4,22,123}) do
   local available=self.Read(C_Garrison.GetAvailableMissions,kind);local running=self.Read(C_Garrison.GetInProgressMissions,kind)
   if available and running and (#available>0 or #running>0 or kind==c.missionFollowerType) then c.missions[kind]={available=available,running=running,at=at} end
  end
 end
 if self.RecordObservation then self:RecordObservation("refresh",c) end
 if self.ObserveSystems then self:ObserveSystems(c) end
 self.workRevision=(self.workRevision or 0)+1;self.dirty=true
end
function G:QuestDone(c,id,g)
 if g.warband then for guid,alt in pairs(self:DB().characters) do if guid~=c.guid and alt.region==c.region and self:InPeriod(alt.turnIns[id],alt,g.cadence) then return true end end end
 if g.cadence=="daily" or g.cadence=="weekly" then
  if self:InPeriod(c.turnIns[id],c,g.cadence) then return true end
  local f=c.flags and c.flags[id]
  return (g.hiddenRewardFlag or g.currentPeriodFlag) and f and f.source=="current-client" and f.value and self:InPeriod(f.at,c,g.cadence) or false
 end
 if g.cadence and g.cadence~="once" then return false end
 return c.flags and c.flags[id] and c.flags[id].value or false
end
function G:Missing(g)
 local missing={};for _,id in ipairs(g.rewards or {}) do if not self:Owned(id) then missing[#missing+1]=id end end;return missing
end
function G:Cooldown(c,variant)
 local r=c.recipes and c.recipes[variant.spellId]
 if not r or not r.learned or r.invalidatedAt and r.invalidatedAt>=(r.at or 0) then return {state="unknown"} end
 local override=c.cooldownOverrides and c.cooldownOverrides[variant.spellId]
 if override and override.at>=(r.at or 0) then r=override end
 local last=c.uses[variant.spellId];local readyAt=r.readyAt;local timing=variant.timing
 if timing.kind=="elapsed" and last and last>=(r.at or 0) then readyAt=last+timing.durationMs/1000 end
 if timing.kind=="daily" and last and self:InPeriod(last,c,"daily") and last>=(r.at or 0) then readyAt=c.dailyResetAt end
 if timing.kind=="charges" and r.charges==nil then return {state="unknown"} end
 if timing.kind=="charges" and r.charges~=nil then
  local charges,max=r.charges,r.maxCharges or timing.maxCharges;local recharge=timing.durationMs/1000
  local nextAt=charges<max and r.readyAt or nil
  local function recover(untilAt)
   if nextAt and nextAt<=untilAt then local gain=math.min(max-charges,1+math.floor((untilAt-nextAt)/recharge));charges=charges+gain;nextAt=charges<max and nextAt+gain*recharge or nil end
  end
  for _,use in ipairs(c.useHistory and c.useHistory[variant.spellId] or {}) do
   if use>(r.at or 0) then recover(use);charges=math.max(0,charges-1);nextAt=nextAt or use+recharge end
  end
  recover(now());return {state=charges>0 and "ready" or "upcoming",charges=charges,maxCharges=max,readyAt=charges==0 and nextAt or nil,nextRechargeAt=nextAt,estimated=true}
 end
 return {state=readyAt and (readyAt<=now() and "ready" or "upcoming") or "unknown",readyAt=readyAt,estimated=last and last>=(r.at or 0) or false}
end
function G:Eligibility(g,c)
 if not c then return "unknown","Character data is loading." end
 local req=g.requirements or {}
 local classes=req.classIds or (req.classId and {req.classId})
 if classes and not contains(classes,({WARRIOR=1,PALADIN=2,HUNTER=3,ROGUE=4,PRIEST=5,DEATHKNIGHT=6,SHAMAN=7,MAGE=8,WARLOCK=9,MONK=10,DRUID=11,DEMONHUNTER=12,EVOKER=13})[c.class]) then return "blocked","A different class is required." end
 local level=req.level or req.minLevel
 if level and c.level and c.level<level then return "blocked","Reach level "..level.."." end
 if req.professionId and c.professionsAt and not c.professions[req.professionId] then return "blocked","Learn the required profession before following this route." end
 if req.faction and c.faction and req.faction:lower()~=c.faction:lower() then return "blocked","This is the other faction's route." end
 if #self:Missing(g)==0 and #(g.rewards or {})>0 and not g.persistent and not g.engineering then return "owned","All target toys are already owned." end
 if g.season and g.season.endAt and now()>=g.season.endAt then return "upcoming","This seasonal farming route is outside its reviewed window." end
 if g.season and g.season.startAt and now()<g.season.startAt then return "upcoming","This seasonal route opens in a future window.",g.season.startAt end
 if g.raid and c.raidLockouts then
  local modes={Normal={[3]=true,[4]=true,[14]=true},Heroic={[5]=true,[6]=true,[15]=true},Mythic={[16]=true},["Raid Finder"]={[7]=true,[17]=true}}
  local function norm(s) return (s or ""):lower():gsub("[^%w]","") end
  for _,r in ipairs(c.raidLockouts) do if r.resetAt>now() and norm(r.name)==norm(g.raid.instance) and (modes[g.difficulty] or {})[r.difficultyId] then for _,boss in ipairs(r.encounters or {}) do if boss.killed and norm(boss.name)==norm(g.raid.encounter) then return "done","This boss is already looted on this difficulty until the observed reset." end end end end
 end
 if g.facts and g.facts.missionID and self.MissionStatus then local state,title,readyAt=self:MissionStatus(c,g.facts.missionID);if state=="upcoming" then return "upcoming",(title or "Mission").." is running. Return to the table when ready.",readyAt end end
 if g.system=="archaeology" and c.archaeology and c.archaeology.endAt and c.archaeology.endAt>now() then
  for _,find in ipairs(self.Pack.archaeology or {}) do if find.id==c.archaeology.id then local final=find.quests[#find.quests];local at=c.turnIns[final.id];if at and at<=now() and at>=c.archaeology.endAt-14*86400 then return "done","This archaeology chain is turned in for the observed window." end end end
 end
 local d=self:DB();if self:GuideIntent("excluded",g.id) then return "excluded","Excluded from this profile." end
 if g.engineering and not (d.intent.engineering and d.intent.engineering[c.guid]) then return "excluded","Enable Engineering for this character in Settings." end
 local snooze=c.snoozed[g.id];if snooze and snooze>now() then return "upcoming","Snoozed until "..date("%c",snooze) end
 if g.variants then
  local learned=false;local ready=false;local earliest
  for _,v in ipairs(self:Variants(g,c)) do local r=c.recipes and c.recipes[v.spellId]
   if r and r.learned and not r.invalidatedAt then
    learned=true
    local status=self:Cooldown(c,v);local readyAt=status.readyAt
    if status.state=="ready" then ready=true end
    if readyAt and readyAt>now() then earliest=math.min(earliest or readyAt,readyAt) end
   end
  end
  if learned and not ready and earliest then return "upcoming","Cooldown ready at "..date("%c",earliest),earliest end
  if not learned then return "unknown","Open your own Engineering recipes to check learned recipes." end
  if not ready then return "unknown","Check the current cooldown in Engineering." end
 end
 if g.questIds and #g.questIds>0 and g.cadence~="fortnightly" and (not g.metadataRoute or g.engineering) and g.system~="argent" then
  local done=false;for _,id in ipairs(g.questIds) do if self:QuestDone(c,id,g) then done=true end end
  if done then return "done","This opportunity is complete for its current period." end
 end
 local rep=req.reputation
 if rep and (rep.raw or rep.value) then
  if rep.kind=="unestablished" then return "unknown","Open the reward vendor to check the exact reputation or Renown requirement." end
  local f=c.reputations and c.reputations[rep.id]
  if not f then return "unknown","Visit the reputation panel or questgiver to check access." end
  local value=rep.kind=="renown" and f.renown or f.data and f.data.currentStanding
  if not value then return "unknown","Check the required reputation or Renown rank in game." end
  if value<(rep.raw or rep.value) then return "blocked","Continue the required reputation grind." end
 end
 if g.variants then return "ready","A learned cooldown craft is available." end
 if g.system=="reputation" and c.repTasksAt and now()-c.repTasksAt<300 then for id,q in pairs(c.repTasks and c.repTasks[g.factionId] or {}) do if (not q.expiresAt or q.expiresAt>now()) and (not q.active or c.quests and c.quests[id]) and (not q.isTask or q.eligible==true or c.quests and c.quests[id]) then return "ready","Observed quests award this toy-related reputation." end end end
 if g.questIds and #g.questIds>0 then
  for _,id in ipairs(g.questIds) do if c.quests and c.quests[id] then return "ready","Continue the quest already in your log." end end
  return "observe","Check the current offer at the questgiver." end
 return "observe","Follow the directions and check this character's requirements in game."
end
function G:Steps(g,c)
 local rows={};local any=false
 local state=self:Eligibility(g,c)
 if state=="blocked" and g.requirements and g.requirements.reputation then
  rows[#rows+1]={id=g.id..":standing",text="Build the required standing first. Choose the related faction's toy progression guide to find observed reputation tasks.",kind="prerequisite"}
 end
 local questIds={};local used={};for _,id in ipairs(g.questIds or {}) do used[id]=true;questIds[#questIds+1]=id end
 if g.system=="reputation" and c.repTasksAt and now()-c.repTasksAt<300 then for id,q in pairs(c.repTasks and c.repTasks[g.factionId] or {}) do
  if not used[id] then questIds[#questIds+1]=id end
  if not (c.quests and c.quests[id]) and (not q.expiresAt or q.expiresAt>now()) and (not q.isTask or q.eligible==true) then rows[#rows+1]={id=g.id..":worldquest:"..id,text="Complete "..q.title.." for reputation progress.",kind="objective",questId=id,destination=q.destination};any=true end
 end end
 for _,id in ipairs(questIds) do
  local q=c.quests and c.quests[id]
  if q then
   any=true
   if q.complete then rows[#rows+1]={id=g.id..":turnin:"..id,text="Turn in "..(q.title or ("quest #"..id))..".",kind="turnin",questId=id,destination=g.destination}
   else
    local map,x,y=self.Safe(C_QuestLog and C_QuestLog.GetNextWaypoint,id)
    local dest=type(map)=="number" and type(x)=="number" and type(y)=="number" and {mapID=map,x=x,y=y,label=q.title} or nil
    for i,o in ipairs(q.objectives or {}) do if not o.finished then rows[#rows+1]={id=g.id..":objective:"..id..":"..i,text=o.text or "Follow the quest objective.",questId=id,objective=i,count=o.numFulfilled,total=o.numRequired,kind="objective",destination=dest} end end
    if #rows==0 then rows[#rows+1]={id=g.id..":quest:"..id,text="Continue "..(q.title or ("quest #"..id)).." in your quest log.",questId=id,kind="objective"} end
   end
  end
 end
 if not any and g.system=="argent" and self.Pack.argent then
  local cities={};local champion=false;local valiant
  for _,city in ipairs(self.Pack.argent.cities) do if city.faction:lower()==(c.faction or ""):lower() then
   local function done(id) return c.flags[id] and c.flags[id].value end
   if done(city.challengeQuest) or done(city.championQuest) then champion=true;cities[#cities+1]=city.name elseif done(city.valiantQuest) or done(city.laterQuest) then valiant=city.name end
  end end
  if champion then rows[#rows+1]={id=g.id..":champion",text="Collect the Champion dailies offered to this character. Confirmed city progress: "..table.concat(cities,", ")..". Complete and turn in their objectives; save Champion's Seals for missing toys."}
  elseif valiant then rows[#rows+1]={id=g.id..":valiant",text="Continue "..valiant.." Valiant training. Take the offered dailies and work toward the city challenge."}
  else rows[#rows+1]={id=g.id..":introduction",text="Speak to your faction's Tournament questgiver. Accept the introduction or Aspirant challenge offered to this character; the next step updates when the quest enters your log."} end
 end
 if not any and #rows==0 then for _,s in ipairs(g.steps or {}) do
  if not s.completeWhen or not self.Condition or self:Condition(s.completeWhen,c)~=true then
   local row={};for key,value in pairs(s) do row[key]=value end
   if row.questId then row.text="Speak to the questgiver for "..(self.Read(C_QuestLog and C_QuestLog.GetTitleForQuestID,row.questId) or ("quest #"..row.questId))..". Take the offered branch; the current objectives appear automatically." end
   rows[#rows+1]=row
  end
 end end
 local kept={};for _,row in ipairs(rows) do if not self:Skipped(c,row.id) then kept[#kept+1]=row end end;rows=kept
 if #rows==0 then rows[1]={id=g.id..":observe",text="Check the next quest or reward offered in game. Skipped steps have not been marked complete."} end
 if rows[1] and not rows[1].destination and rows[1].kind~="objective" then rows[1].destination=g.destination end
 return rows
end
function G:Skipped(c,id)
 local s=c.skipped[id];return s and s>now()
end
function G:Plan()
 local c=self:Character();local d=self:DB();local plan={today={},more={},upcoming={},done={},blocked={},minutes=0,budget=d.intent.budget or 30,alts={}}
 if not c then return plan end
 if self.cachedPlan and self.cachedPlan.guid==c.guid and not self.dirty and now()-self.cachedPlan.at<60 then return self.cachedPlan.value end
 local rows={}
 for _,g in ipairs(self.PlanningGuides and self:PlanningGuides(c) or self.Pack.guides) do
  local state,reason,readyAt=self:Eligibility(g,c)
  local u={guide=g,state=state,reason=reason,readyAt=readyAt,deadline=g.system=="archaeology" and c.archaeologyEndAt and c.archaeologyEndAt>now() and c.archaeologyEndAt or self:Period(c,g.cadence),essential=g.essential or g.engineering and g.variants and state=="ready",followed=self:GuideIntent("followed",g.id),priority=self:GuideIntent("priorities",g.id) or (self:GuideIntent("followed",g.id) and 1 or g.engineering and not g.variants and 3 or 2)}
  local style=g.playStyle;local styleExcluded=style=="solo" and d.intent.includeSolo==false or style=="group" and d.intent.includeGroup==false or style=="pvp" and d.intent.includePvP==false
  if styleExcluded then state="excluded" end
  if state=="upcoming" then plan.upcoming[#plan.upcoming+1]=u elseif state=="done" or state=="owned" then plan.done[#plan.done+1]=u elseif state=="blocked" then plan.blocked[#plan.blocked+1]=u elseif state~="excluded" then if (g.metadataRoute or g.validation and not g.validation.sourceChecked) and state~="ready" and not u.essential and not u.followed then plan.more[#plan.more+1]=u else rows[#rows+1]=u end end
 end
 table.sort(rows,function(a,b)
  if not not a.essential~=not not b.essential then return not not a.essential end
  if a.essential and b.essential and (a.deadline or math.huge)~=(b.deadline or math.huge) then return (a.deadline or math.huge)<(b.deadline or math.huge) end
  if a.priority~=b.priority then return a.priority<b.priority end
  if (a.deadline or math.huge)~=(b.deadline or math.huge) then return (a.deadline or math.huge)<(b.deadline or math.huge) end
  if a.guide.outcome~=b.guide.outcome then return a.guide.outcome=="guaranteed-progress" end
  if a.guide.zone~=b.guide.zone then return a.guide.zone<b.guide.zone end
  return a.guide.id<b.guide.id
 end)
 local purchases={}
 if self.ResourceAllocations then for _,u in ipairs(rows) do if u.state=="ready" and u.guide.goalPath and u.guide.costs and #u.guide.costs>0 then
  local nextAction=self:RawSteps(u.guide,c)[1];if nextAction and (nextAction.kind=="purchase" or nextAction.observedAcquisition) then purchases[#purchases+1]=u.guide end
 end end end
 local reservations=self.ResourceAllocations and self:ResourceAllocations(purchases,c) or {}
 local seen={}
 for _,u in ipairs(rows) do
  local funded=true;for _,cost in ipairs(reservations[u.guide.id] or {}) do if cost.shortfall==nil or cost.shortfall>0 then funded=false end end
  if not funded then u.state="blocked";u.reason="The combined preparation list reserves this balance for an earlier purchase. Gather the remaining resources before buying this toy.";u.preparation=reservations[u.guide.id];plan.blocked[#plan.blocked+1]=u else
  local group=u.guide.sharedGroup or u.guide.id
  if not u.guide.raid then for _,id in ipairs(u.guide.questIds or {}) do if c.quests and c.quests[id] then group="quest:"..id;break end end end
  if u.guide.costs and u.guide.npcId and u.guide.destination and not group:match('^quest:') then group="vendor:"..u.guide.npcId..":"..u.guide.destination.mapID end
  if not seen[group] then
   seen[group]=u;u.grouped={u.guide}
   if u.essential or plan.minutes+(u.guide.minutes or 10)<=plan.budget then plan.today[#plan.today+1]=u;plan.minutes=plan.minutes+(u.guide.minutes or 10) else plan.more[#plan.more+1]=u end
  else local first=seen[group];first.grouped[#first.grouped+1]=u.guide end
  end
 end
 for guid,alt in pairs(d.characters) do if guid~=c.guid then plan.alts[#plan.alts+1]={guid=guid,name=alt.name,realm=alt.realm,at=alt.at} end end
 plan.overrun=math.max(0,plan.minutes-plan.budget);self.dirty=false;self.cachedPlan={guid=c.guid,at=now(),value=plan};return plan
end
function G:CaptureSnapshot(snapshot)
 local c=self:Character();if not c or c.guid~=snapshot.character.guid then return end
 if snapshot.raidsFresh then c.raidLockouts=snapshot.raidLockouts;c.raidAt=snapshot.exportedAt end
 self.dirty=true
end
function G:Current()
 local c=self:Character();if not c then return end
 for _,g in ipairs(self.Pack.guides) do if g.id==c.selected then if g.aliasOf then for _,target in ipairs(self.Pack.guides) do if target.id==g.aliasOf then c.selected=target.id;c.cursor=1;return target,c end end end;return g,c end end
 local plan=self:Plan();local u=plan.today[1] or plan.more[1]
 if u then c.selected=u.guide.id;return u.guide,c end
end
function G:Select(id)
 for _,g in ipairs(self.Pack.guides) do if g.id==id then local c=self:Character();if c then c.selected=id;c.cursor=1;if c.session then c.session.pending=nil end;self:Changed();if self.Navigation and not self.DisplaySteps then local row=self:Steps(g,c)[1];self.Navigation:Go(row and row.destination) end;return true end end end
end
function G:StepSignature(rows)
 local values={};for _,row in ipairs(rows) do values[#values+1]=row.id..":"..tostring(row.available) end;return table.concat(values,"|")
end
function G:ViewStep(g,c,rows,index)
 c.cursor=index;c.viewGuide=g.id;c.viewStep=rows[index] and rows[index].id
end
function G:AdvanceStep(g,c,previous,index)
 c.browseEnd=c.browseEnd or {};c.browseEnd[g.id]=nil
 local rows=self:Steps(g,c);local current=previous[index];local selected
 local order={};for i,node in ipairs(g.walkthrough and g.walkthrough.nodes or {}) do order[node.id]=i end
 if current and order[current.id] and not (g.walkthrough and g.walkthrough.dailySets) then
  for i,row in ipairs(rows) do if row.available~=false and not row.endOfSteps and order[row.id] and order[row.id]>order[current.id] then selected=i;break end end
 else
  for nextIndex=index+1,#previous do
   for i,row in ipairs(rows) do if row.id==previous[nextIndex].id and row.available~=false and not row.endOfSteps then selected=i;break end end
   if selected then break end
  end
  if not selected then for i=index,#rows do local row=rows[i];if row.id~=(current and current.id) and row.available~=false and not row.endOfSteps then selected=i;break end end end
 end
 if selected then self:ViewStep(g,c,rows,selected);return true end
 c.browseEnd[g.id]={signature=self:StepSignature(rows),at=now()};c.cursor=1;c.viewGuide=g.id;c.viewStep=g.id..":browse-end"
 return false
end
local function browseLease(c,h)
 if h.kind=="skip" then return c.skipped[h.key] end
 if h.kind=="continue" then return c.continued and c.continued[h.guideId] and c.continued[h.guideId][h.stepId] end
end
local function belongs(h,g)
 return (h.kind=="skip" or h.kind=="continue") and (h.guideId==g.id or not h.guideId and h.key and h.key:sub(1,#g.id+1)==g.id..":")
end
function G:CanBack(g,c,rows)
 rows=rows or self:Steps(g,c)
 for i=(c.cursor or 1)-1,1,-1 do if rows[i] and rows[i].available~=false and not rows[i].endOfSteps then return true end end
 for i=#c.history,1,-1 do local h=c.history[i];if belongs(h,g) and (browseLease(c,h) or 0)>now() then return true end end
 return false
end
function G:RestoreBrowse(c,h,g)
 if c.session then c.session.pending=nil end
 if h.kind=="continue" then if c.continued and c.continued[h.guideId] then c.continued[h.guideId][h.stepId]=h.previous end else c.skipped[h.key]=h.previous end
 local id=h.guideId or g and g.id
 if c.browseEnd and id then c.browseEnd[id]=nil end
 c.cursor=1;c.viewGuide=id;c.viewStep=h.stepId or h.key
 if g then local rows=self:Steps(g,c);for i,row in ipairs(rows) do if row.id==c.viewStep then c.cursor=i;break end end end
end
function G:Back()
 local g,c=self:Current();if not g then return false end
 local rows=self:Steps(g,c)
 for i=(c.cursor or 1)-1,1,-1 do if rows[i].available~=false and not rows[i].endOfSteps then self:ViewStep(g,c,rows,i);self:Changed();return true end end
 for i=#c.history,1,-1 do local h=c.history[i]
  if belongs(h,g) and (browseLease(c,h) or 0)>now() then table.remove(c.history,i);self:RestoreBrowse(c,h,g);self:Changed();return true end
 end
 return false
end
function G:Skip()
 local g,c=self:Current();if not g then return end
 local rows=self:Steps(g,c);local index=c.cursor or 1;local s=rows[index];if not s or s.endOfSteps or c.paused then return end
 c.history[#c.history+1]={kind="skip",key=s.id,guideId=g.id,stepId=s.id,previous=c.skipped[s.id]};while #c.history>500 do table.remove(c.history,1) end
 c.skipped[s.id]=self:Period(c,g.cadence) or now()+86400;self:AdvanceStep(g,c,rows,index);self:Changed()
end
function G:Undo()
 local c=self:Character();if not c then return end
 local h=table.remove(c.history);if not h then return end
 if h.kind=="report" then local r=self:DB().reports and self:DB().reports[h.key];if r then r.deleted=true;r.revision=(r.revision or 1)+1 end;self:Changed();return end
 if h.kind=="continue" or h.kind=="skip" then
  local g=self:Current();if h.guideId then for _,guide in ipairs(self.Pack.guides) do if guide.id==h.guideId then g=guide;c.selected=guide.id;break end end end
  self:RestoreBrowse(c,h,g);self:Changed();return
 end
 local target=h.kind=="skip" and c.skipped or h.kind=="use" and c.uses or h.kind=="cooldown" and c.cooldownOverrides or c.overrides
 target[h.key]=h.previous;if h.kind=="use" and c.useHistory and c.useHistory[h.key] then for i=#c.useHistory[h.key],1,-1 do if c.useHistory[h.key][i]==h.time then table.remove(c.useHistory[h.key],i);break end end end;self:Changed()
end
function G:Use(spellID,at)
 local c=self:Character();at=number(at) or now();if not c or at>now() or at<now()-30*86400 then return false end
 c.useHistory=c.useHistory or {};c.useHistory[spellID]=c.useHistory[spellID] or {}
 for _,usedAt in ipairs(c.useHistory[spellID]) do if usedAt==at then return false end end
 c.history[#c.history+1]={kind="use",key=spellID,previous=c.uses[spellID],time=at};c.uses[spellID]=math.max(c.uses[spellID] or 0,at);table.insert(c.useHistory[spellID],at);table.sort(c.useHistory[spellID])
 while #c.useHistory[spellID]>500 do table.remove(c.useHistory[spellID],1) end
 while #c.history>500 do table.remove(c.history,1) end
 local selected=self:Current();if selected and selected.variants then for _,v in ipairs(selected.variants) do if v.spellId==spellID and self:Eligibility(selected,c)=="upcoming" then c.selected=nil;c.cursor=1 end end end
 self:Changed();return true
end

function G:Variants(g,c)
 local charged
 for _,v in ipairs(g.variants or {}) do if c.recipes and c.recipes[v.spellId] and c.recipes[v.spellId].learned and not c.recipes[v.spellId].invalidatedAt and v.timing.kind=="charges" then charged=v end end
 return charged and {charged} or g.variants or {}
end
function G:AdjustCooldown(spellID,readyIn,charges,maxCharges)
 local c=self:Character();if not c or not c.recipes or not c.recipes[spellID] or not c.recipes[spellID].learned then return false end
 if type(readyIn)~="number" or readyIn<0 or readyIn>7*86400 or charges~=nil and (type(charges)~="number" or charges%1~=0 or charges<0 or charges>(maxCharges or 3)) then return false end
 c.cooldownOverrides=c.cooldownOverrides or {};c.history[#c.history+1]={kind="cooldown",key=spellID,previous=c.cooldownOverrides[spellID]}
 c.cooldownOverrides[spellID]={learned=true,readyAt=self.Now()+readyIn,charges=charges,maxCharges=maxCharges,at=self.Now(),manual=true}
 self:Changed();return true
end
