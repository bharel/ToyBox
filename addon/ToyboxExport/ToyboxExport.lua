-- Toybox Export: read-only collection/progress snapshots. No HTTP, automation, or clipboard access.
local ADDON_VERSION = "2.4.0"
local ARRAY = {}
local function array(t) return setmetatable(t or {}, ARRAY) end
local function isSecret(v) return issecretvalue and issecretvalue(v) end
local function escape(s)
  return '"' .. s:gsub('[%z\1-\31\\"]', function(c)
    local code = string.byte(c)
    if c == '"' then return '\\"' elseif c == '\\' then return '\\\\' end
    return string.format('\\u%04x', code)
  end) .. '"'
end
local function encode(v)
  if isSecret(v) then return "null" end
  local kind = type(v)
  if kind == "nil" then return "null"
  elseif kind == "boolean" then return v and "true" or "false"
  elseif kind == "number" then return (v == v and v ~= math.huge and v ~= -math.huge) and tostring(v) or "null"
  elseif kind == "string" then return escape(v)
  elseif kind ~= "table" then return "null" end
  local out = {}
  if getmetatable(v) == ARRAY then
    for _, value in ipairs(v) do out[#out+1] = encode(value) end
    return '[' .. table.concat(out, ',') .. ']'
  end
  local keys = {}
  for key in pairs(v) do if type(key) == "string" then keys[#keys+1] = key end end
  table.sort(keys)
  for _, key in ipairs(keys) do out[#out+1] = escape(key) .. ':' .. encode(v[key]) end
  return '{' .. table.concat(out, ',') .. '}'
end
local function safe(fn, ...)
  if type(fn) ~= "function" then return nil end
  local ok, value = pcall(fn, ...)
  if ok and not isSecret(value) then return value end
end
local function log(text) DEFAULT_CHAT_FRAME:AddMessage("|cffd9b875Toybox:|r " .. text) end
local function initDB()
  ToyboxExportDB = ToyboxExportDB or {}
  ToyboxExportDB.watched = ToyboxExportDB.watched or {}
  ToyboxExportDB.outbox = ToyboxExportDB.outbox or {}
end
-- Scope cached observations to the full in-game GUID, never to the main/alt slot.
local CHECKPOINTS={13667,13668,13828,13829,13837,13839,13835,13838,13672,13678,13679,13680,13684,13593,13718,13699,13702,13685,13703,13714,13713,13732,13688,13704,13715,13723,13733,13689,13706,13717,13725,13735,13690,13705,13716,13724,13734,13691,13707,13697,13726,13736,13693,13708,13719,13727,13737,13694,13709,13720,13728,13738,13695,13710,13721,13729,13739,13696,13711,13722,13731,13740,40857,41157,41171,41172,41173,34586,34378,45423,46291,54185,56491,58457}
local ARCHAEOLOGY_QUESTS={[41164]=true,[41165]=true,[41166]=true,[40857]=true,[41157]=true,[41158]=true,[41159]=true,[41802]=true,[41167]=true,[41168]=true,[41169]=true,[41161]=true,[41162]=true,[41163]=true,[41174]=true,[41175]=true,[41176]=true,[41180]=true,[41181]=true,[41182]=true,[41177]=true,[41178]=true,[41179]=true,[41183]=true,[41184]=true,[41185]=true,[41171]=true,[41172]=true,[41173]=true,[41189]=true,[41190]=true,[41191]=true,[41186]=true,[41187]=true,[41188]=true,[41192]=true,[41193]=true}
local CRAFT_SPELLS={139176,177054,169080,178242,447312,112996,177045,169081,178240}
local function characterCache()
  initDB()
  local guid=safe(UnitGUID,"player")
  if type(guid)~="string" or not guid:match("^Player%-%d+%-%x+$") then return nil end
  ToyboxExportDB.characters=ToyboxExportDB.characters or {}
  local c=ToyboxExportDB.characters[guid] or {instances={},recipes={}}
  ToyboxExportDB.characters[guid]=c
  return c,guid
end
-- Only actual visible NPCs establish a route. Never infer a phase from a zone name.
local ROUTE_NPCS={[96323]="arachnis",[142684]="kovork",[142682]="gong",[147845]="memento",[147435]="memento",[55278]="darkmoon"}
local function observeRoutes(cache,now)
  cache.routes=cache.routes or {}
  for _,unit in ipairs({"target","mouseover","npc"}) do
    local guid=safe(UnitGUID,unit)
    local npc=type(guid)=="string" and tonumber(guid:match("^Creature%-%d+%-%d+%-%d+%-%d+%-(%d+)%-"))
    local route=npc and ROUTE_NPCS[npc]
    local faction=safe(UnitFactionGroup,"player")
    local correctFaction=npc~=147845 and npc~=147435 or npc==147845 and faction=="Alliance" or npc==147435 and faction=="Horde"
    if route and correctFaction and safe(UnitIsDeadOrGhost,unit)==false and (route=="darkmoon" or safe(UnitCanAttack,"player",unit)==true) then
      cache.routes[route]={route=route,kind="npc",npcId=npc,at=now,expiresAt=now+300}
    end
  end
end
local function calendarKey(t)
  if type(t)~="table" then return nil end
  for _,key in ipairs({"year","month","monthDay","hour","minute"}) do if isSecret(t[key]) or type(t[key])~="number" then return nil end end
  return t.year*100000000+t.month*1000000+t.monthDay*10000+t.hour*100+t.minute
end
local function observeCalendar(cache,now)
  if not C_Calendar or not C_DateAndTime then return end
  local current=safe(C_DateAndTime.GetCurrentCalendarTime)
  local key=calendarKey(current);local month=safe(C_Calendar.GetMonthInfo,0)
  if not key or not month or isSecret(month.month) or isSecret(month.year) or type(month.month)~="number" or type(month.year)~="number" then return end
  local offset=(current.year-month.year)*12+current.month-month.month
  if offset<0 or offset>1 then return end -- Do not change the player's selected calendar month.
  local count=safe(C_Calendar.GetNumDayEvents,offset,current.monthDay)
  if type(count)~="number" or count>200 then return end
  for index=1,count do
    local event=safe(C_Calendar.GetDayEvent,offset,current.monthDay,index)
    if event and not isSecret(event.calendarType) and event.calendarType=="HOLIDAY" then
      local holiday=safe(C_Calendar.GetHolidayInfo,offset,current.monthDay,index)
      local name=holiday and not isSecret(holiday.name) and holiday.name
      local startKey=holiday and calendarKey(holiday.startTime);local endKey=holiday and calendarKey(holiday.endTime)
      -- Unrecognized/localized names and absent data remain unknown, never closed.
      if type(name)=="string" and name:lower()=="darkmoon faire" and startKey and endKey and startKey<=key and key<endKey then
        local remaining=300
        if holiday.endTime.year==current.year and holiday.endTime.month==current.month and holiday.endTime.monthDay==current.monthDay then
          remaining=math.min(remaining,((holiday.endTime.hour-current.hour)*60+holiday.endTime.minute-current.minute)*60-now%60)
        end
        if remaining>0 then cache.routes=cache.routes or {};cache.routes.darkmoon={route="darkmoon",kind="calendar",at=now,expiresAt=now+remaining} end
      end
    end
  end
end
local function observeGame()
  local cache=characterCache();if not cache then return end
  local now=GetServerTime()
  pcall(observeRoutes,cache,now);pcall(observeCalendar,cache,now)
  if GetInstanceInfo then
    local ok,_,kind,difficulty,_,_,_,_,instanceID=pcall(GetInstanceInfo)
    if ok and kind=="raid" and not isSecret(instanceID) and not isSecret(difficulty) and type(instanceID)=="number" and instanceID>0 and type(difficulty)=="number" and difficulty>0 then
      cache.instances[instanceID..":"..difficulty]={instanceId=instanceID,difficultyId=difficulty,at=now}
    end
  end
  -- Linked and guild recipe views must never become evidence for this player.
  if not C_TradeSkillUI or safe(C_TradeSkillUI.IsTradeSkillReady)~=true or safe(C_TradeSkillUI.IsTradeSkillLinked)==true or safe(C_TradeSkillUI.IsTradeSkillGuild)==true or safe(C_TradeSkillUI.IsTradeSkillGuildMember)==true or safe(C_TradeSkillUI.IsNPCCrafting)==true then return end
  for _,spellID in ipairs(CRAFT_SPELLS) do
    local info=safe(C_TradeSkillUI.GetRecipeInfo,spellID)
    if info and not isSecret(info.learned) and info.learned==true then
      local recipe={spellId=spellID,at=now}
      if not isSecret(info.skillLineAbilityID) and type(info.skillLineAbilityID)=="number" and info.skillLineAbilityID>0 then recipe.clientSkillLineAbilityId=info.skillLineAbilityID end
      if C_TradeSkillUI.GetRecipeCooldown then
        local ok,cooldown,_,charges,maxCharges=pcall(C_TradeSkillUI.GetRecipeCooldown,spellID)
        if ok and not isSecret(cooldown) and type(cooldown)=="number" and cooldown>=0 and cooldown<=30*86400 then recipe.cooldownSeconds=cooldown end
        if ok and not isSecret(charges) and not isSecret(maxCharges) and type(charges)=="number" and type(maxCharges)=="number" and charges>=0 and maxCharges>0 and charges<=maxCharges then recipe.charges=charges;recipe.maxCharges=maxCharges end
      end
      cache.recipes[spellID]=recipe
    end
  end
end
local function collectGame(snapshot)
  observeGame()
  local cache,guid=characterCache()
  if not cache then snapshot.warnings[#snapshot.warnings+1]="In-game character identity is unavailable; access observations were skipped.";return end
  snapshot.character.guid=guid
  snapshot.game={version=1,questsAvailable=snapshot.questFlagsAvailable==true,instances=array(),recipes=array(),offeredQuests=array(),routes=array(),questTurnIns=array(),questChecks=array()}
  for key,q in pairs(cache.turnIns or {}) do if snapshot.exportedAt-q.at<28*86400 then snapshot.game.questTurnIns[#snapshot.game.questTurnIns+1]=q else cache.turnIns[key]=nil end end
  table.sort(snapshot.game.questTurnIns,function(a,b) return a.at<b.at end)
  while #snapshot.game.questTurnIns>1000 do table.remove(snapshot.game.questTurnIns,1) end
  local watched={};for _,id in ipairs(CHECKPOINTS) do watched[id]=true end;for id in pairs(ARCHAEOLOGY_QUESTS) do watched[id]=true end;for id in pairs(cache.questMeta or {}) do watched[id]=true end
  for id in pairs(watched) do local done=C_QuestLog and safe(C_QuestLog.IsQuestFlaggedCompleted,id);if type(done)=="boolean" then snapshot.game.questChecks[#snapshot.game.questChecks+1]={id=id,completed=done,at=snapshot.exportedAt} end end
  if GetProfessions and GetProfessionInfo then
    local ok,p1,p2,p3,p4,p5,p6=pcall(GetProfessions)
    if ok then local entries={p1,p2,p3,p4,p5,p6};local rows=array();local complete=true
      for index=1,6 do if entries[index] then local good,name,_,skill,max,_,_,id=pcall(GetProfessionInfo,entries[index]);if good and not isSecret(id) and not isSecret(name) and not isSecret(skill) and not isSecret(max) and type(id)=="number" and type(name)=="string" and type(skill)=="number" and type(max)=="number" then rows[#rows+1]={id=id,name=name,skill=skill,max=max} else complete=false end end end
      if complete then snapshot.game.professions={at=snapshot.exportedAt,data=rows} end
    end
  end
  local remaining
  if C_UnitAuras then local aura=safe(C_UnitAuras.GetPlayerAuraBySpellID,233138);if aura and not isSecret(aura.expirationTime) and type(aura.expirationTime)=="number" and GetTime then remaining=aura.expirationTime-GetTime() end end
  for _,q in ipairs(snapshot.questLog or {}) do if ARCHAEOLOGY_QUESTS[q.id] and C_TaskQuest then local seconds=safe(C_TaskQuest.GetQuestTimeLeftSeconds,q.id);if type(seconds)=="number" and seconds>0 then remaining=seconds end end end
  if remaining and remaining>0 and remaining<=14*86400 then cache.archaeologyEndAt=snapshot.exportedAt+math.floor(remaining) end
  if cache.archaeologyEndAt and cache.archaeologyEndAt>snapshot.exportedAt then snapshot.game.archaeologyEndAt=cache.archaeologyEndAt end
  for _,route in pairs(cache.routes or {}) do if route.expiresAt>snapshot.exportedAt then snapshot.game.routes[#snapshot.game.routes+1]=route end end
  for id,at in pairs(cache.offers or {}) do snapshot.game.offeredQuests[#snapshot.game.offeredQuests+1]={id=id,at=at} end
  for _,visit in pairs(cache.instances) do snapshot.game.instances[#snapshot.game.instances+1]=visit end
  for _,recipe in pairs(cache.recipes) do snapshot.game.recipes[#snapshot.game.recipes+1]=recipe end
end
local function withToyFilters(callback)
  if not C_ToyBox or not C_ToyBox.GetNumFilteredToys then error("Toy Box APIs are unavailable.") end
  local old = {collected=C_ToyBox.GetCollectedShown(),uncollected=C_ToyBox.GetUncollectedShown(),unusable=C_ToyBox.GetUnusableShown(),sources={},expansions={},search=(ToyBox and ToyBox.searchString) or ""}
  for i=1,C_PetJournal.GetNumPetSources() do
    if not C_ToyBoxInfo or C_ToyBoxInfo.IsToySourceValid(i) then old.sources[i]=C_ToyBox.IsSourceTypeFilterChecked(i) end
  end
  for i=1,GetNumExpansions() do old.expansions[i]=C_ToyBox.IsExpansionTypeFilterChecked(i) end
  local function restore()
    C_ToyBox.SetCollectedShown(old.collected); C_ToyBox.SetUncollectedShown(old.uncollected); C_ToyBox.SetUnusableShown(old.unusable)
    for i,checked in pairs(old.sources) do C_ToyBox.SetSourceTypeFilter(i, checked) end
    for i,checked in pairs(old.expansions) do C_ToyBox.SetExpansionTypeFilter(i,checked) end
    C_ToyBox.SetFilterString(old.search)
    if C_ToyBox.ForceToyRefilter then C_ToyBox.ForceToyRefilter() end
  end
  local ok,err=pcall(function()
    C_ToyBox.SetCollectedShown(true); C_ToyBox.SetUncollectedShown(false); C_ToyBox.SetUnusableShown(true)
    C_ToyBox.SetAllSourceTypeFilters(true); C_ToyBox.SetAllExpansionTypeFilters(true); C_ToyBox.SetFilterString("")
    if C_ToyBox.ForceToyRefilter then C_ToyBox.ForceToyRefilter() end
    callback()
  end)
  local restored = pcall(restore)
  if not ok then error(err) end
  if not restored then error("Toy Box filters could not be restored. Check your collection filters.") end
end
local function collectToys(snapshot)
  snapshot.toys=array(); snapshot.ownedToyIds=array(); snapshot.toysComplete=false
  local seen={}
  local ok,err=pcall(function()
    withToyFilters(function()
      for i=1,C_ToyBox.GetNumFilteredToys() do
        local itemID=C_ToyBox.GetToyFromIndex(i)
        if type(itemID)=="number" and itemID>0 and not seen[itemID] and safe(PlayerHasToy,itemID) then
          seen[itemID]=true
          local _,name,icon=C_ToyBox.GetToyInfo(itemID)
          snapshot.ownedToyIds[#snapshot.ownedToyIds+1]=itemID
          snapshot.toys[#snapshot.toys+1]={itemId=itemID,name=name or ("Toy #"..itemID)}
        end
      end
      local expected=safe(C_ToyBox.GetNumLearnedDisplayedToys)
      if expected and expected>#snapshot.ownedToyIds then error("Some Toy Box data is still loading. Open Collections, wait a moment, and export again.") end
      snapshot.toysComplete=true
    end)
  end)
  if not ok then snapshot.toysComplete=false; snapshot.warnings[#snapshot.warnings+1]="Toy scan incomplete: "..tostring(err) end
end
local function collectRaids(snapshot,now)
  snapshot.raidLockouts=array()
  if not GetNumSavedInstances or not GetSavedInstanceInfo then
    snapshot.warnings[#snapshot.warnings+1]="Raid save APIs are unavailable."; return
  end
  for i=1,GetNumSavedInstances() do
    local name,instanceID,reset,difficulty,locked,extended,mostSig,isRaid,maxPlayers,difficultyName,numEncounters=GetSavedInstanceInfo(i)
    if isRaid and locked and type(reset)=="number" and reset>0 then
      local entry={name=name or "Unknown raid",difficultyId=difficulty or 0,difficultyName=difficultyName or "Unknown difficulty",resetAt=now+reset,encounters=array()}
      for j=1,(numEncounters or 0) do
        local boss,icon,killed=GetSavedInstanceEncounterInfo(i,j)
        entry.encounters[#entry.encounters+1]={name=boss or ("Boss "..j),killed=killed==true}
      end
      snapshot.raidLockouts[#snapshot.raidLockouts+1]=entry
    end
  end
end
local function collectQuests(snapshot)
  snapshot.questLog=array(); snapshot.completedQuestIds=array(); snapshot.watchedQuests=array()
  if not C_QuestLog then snapshot.warnings[#snapshot.warnings+1]="Quest APIs are unavailable.";return end
  local complete=safe(C_QuestLog.GetAllCompletedQuestIDs)
  snapshot.questFlagsAvailable=type(complete)=="table"
  complete=complete or {}
  local seen={}
  for _,id in ipairs(complete) do if type(id)=="number" and not seen[id] then snapshot.completedQuestIds[#snapshot.completedQuestIds+1]=id;seen[id]=true end end
  for _,id in ipairs(CHECKPOINTS) do if not seen[id] and safe(C_QuestLog.IsQuestFlaggedCompleted,id)==true then snapshot.completedQuestIds[#snapshot.completedQuestIds+1]=id;seen[id]=true end end
  local count=safe(C_QuestLog.GetNumQuestLogEntries) or 0
  local cache=characterCache();if cache then cache.questMeta=cache.questMeta or {} end
  for index=1,count do
    local info=safe(C_QuestLog.GetInfo,index)
    if info and not info.isHeader and info.questID and info.questID>0 then
      local objectives=array()
      for _,o in ipairs(safe(C_QuestLog.GetQuestObjectives,info.questID) or {}) do
        if not isSecret(o.text) and not isSecret(o.numFulfilled) and not isSecret(o.numRequired) then
          objectives[#objectives+1]={text=o.text or "",fulfilled=o.numFulfilled or 0,required=o.numRequired or 0,finished=o.finished==true}
        end
      end
      snapshot.questLog[#snapshot.questLog+1]={id=info.questID,title=info.title or ("Quest #"..info.questID),frequency=info.frequency or 0,complete=safe(C_QuestLog.IsComplete,info.questID)==true,objectives=objectives}
      if cache then cache.questMeta[info.questID]={title=info.title or ("Quest #"..info.questID),frequency=info.frequency or 0,at=GetServerTime()} end
    end
  end
  if cache then for id,meta in pairs(cache.questMeta) do if GetServerTime()-meta.at>28*86400 then cache.questMeta[id]=nil end end end
  local _,total=C_QuestLog.GetNumQuestLogEntries()
  if total and #snapshot.questLog<total then snapshot.warnings[#snapshot.warnings+1]="Some quest entries were not visible to the addon. Expand your quest headers and export again if anything is missing." end
  for id in pairs(ToyboxExportDB.watched) do
    snapshot.watchedQuests[#snapshot.watchedQuests+1]={id=id,completed=safe(C_QuestLog.IsQuestFlaggedCompleted,id)==true}
  end
end
local collectionCache
local function buildSnapshot(raidsFresh,reuseCollection)
  initDB()
  local now=GetServerTime()
  local _,class=UnitClass("player")
  local region=({[1]="US",[2]="KR",[3]="EU",[4]="TW",[5]="CN"})[safe(GetCurrentRegion) or 3] or "Unknown"
  local snapshot={format="toybox-addon-v1",version=1,addonVersion=ADDON_VERSION,exportedAt=now,character={name=UnitName("player"),realm=GetRealmName(),classFile=class or "UNKNOWN",region=region},warnings=array(),raidsFresh=raidsFresh==true}
  if C_DateAndTime then
    local weekly=safe(C_DateAndTime.GetSecondsUntilWeeklyReset)
    local daily=safe(C_DateAndTime.GetSecondsUntilDailyReset)
    if weekly and weekly>=0 then snapshot.weeklyResetAt=now+weekly end
    if daily and daily>=0 then snapshot.dailyResetAt=now+daily end
  end
  if not raidsFresh then snapshot.warnings[#snapshot.warnings+1]="Raid saves did not confirm a fresh server response. Re-export if they look stale." end
  if reuseCollection and collectionCache and collectionCache.toysComplete then
    snapshot.toys=collectionCache.toys;snapshot.ownedToyIds=collectionCache.ownedToyIds;snapshot.toysComplete=true
  else
    collectToys(snapshot)
    if snapshot.toysComplete then collectionCache={toys=snapshot.toys,ownedToyIds=snapshot.ownedToyIds,toysComplete=true} end
  end
  collectRaids(snapshot,now); collectQuests(snapshot); collectGame(snapshot)
  return snapshot
end
local function persistSnapshot(snapshot)
  local guid=snapshot.character.guid;if not guid then return false end
  do
    ToyboxExportDB.captureSequence=(ToyboxExportDB.captureSequence or 0)+1
    snapshot.capture={version=1,id=guid..":"..snapshot.exportedAt..":"..ToyboxExportDB.captureSequence,at=snapshot.exportedAt,sequence=ToyboxExportDB.captureSequence}
  end
  if ToyboxGuides then ToyboxGuides.Encode=encode;ToyboxGuides.Array=array;ToyboxGuides:CaptureSnapshot(snapshot);ToyboxGuides:DB().captures=ToyboxGuides:DB().captures or {};ToyboxGuides:DB().captures[guid]=snapshot.capture;snapshot.guides=ToyboxGuides:ExportGuides() end
  ToyboxExportDB.outbox[guid]=encode(snapshot)
  ToyboxExportDB.lastCapturedAt=snapshot.exportedAt;ToyboxExportDB.lastCapturedId=snapshot.capture.id
  ToyboxExportDB.lastError=nil
  return true
end

local window
local function showExport(snapshot)
  persistSnapshot(snapshot)
  local text=encode(snapshot)
  if not window then
    window=CreateFrame("Frame","ToyboxExportWindow",UIParent,"BasicFrameTemplateWithInset")
    window:SetSize(760,560);window:SetPoint("CENTER");window:SetMovable(true);window:EnableMouse(true);window:RegisterForDrag("LeftButton")
    window:SetScript("OnDragStart",window.StartMoving);window:SetScript("OnDragStop",window.StopMovingOrSizing);window:SetClampedToScreen(true)
    window.TitleText:SetText("Toybox · Export your collection")
    local label=window:CreateFontString(nil,"OVERLAY","GameFontHighlight");label:SetPoint("TOPLEFT",18,-40);label:SetPoint("TOPRIGHT",-18,-40);label:SetJustifyH("LEFT");label:SetText("Copy everything with Ctrl/Cmd+C, then paste it into Toybox → Game connection. No data is sent automatically.")
    local scroll=CreateFrame("ScrollFrame",nil,window,"UIPanelScrollFrameTemplate");scroll:SetPoint("TOPLEFT",18,-83);scroll:SetPoint("BOTTOMRIGHT",-38,45)
    local edit=CreateFrame("EditBox",nil,scroll);edit:SetMultiLine(true);edit:SetFontObject(ChatFontNormal);edit:SetWidth(690);edit:SetAutoFocus(false);edit:SetMaxLetters(0);edit:SetScript("OnEscapePressed",function() window:Hide() end);scroll:SetScrollChild(edit);window.edit=edit
    local button=CreateFrame("Button",nil,window,"UIPanelButtonTemplate");button:SetSize(130,24);button:SetPoint("BOTTOM",0,12);button:SetText("Select all");button:SetScript("OnClick",function() edit:SetFocus();edit:HighlightText() end)
    tinsert(UISpecialFrames,"ToyboxExportWindow")
  end
  window.edit:SetHeight(math.max(450,math.ceil(#text/90)*15));window.edit:SetText(text);window:Show();window.edit:SetFocus();window.edit:HighlightText()
  log(string.format("Export ready: %d toys, %d raid saves, %d quests. Copy to your private planner.",#snapshot.ownedToyIds,#snapshot.raidLockouts,#snapshot.questLog))
end
local eventFrame=CreateFrame("Frame")
local pending=false
local function finish(fresh)
  if not pending then return end
  pending=false
  local ok,result=pcall(buildSnapshot,fresh)
  if ok then showExport(result) else log("Export failed: "..tostring(result)) end
end
local scheduled=false
local lastAutomatic
local lastRaidAt=0
local lastRaidRequest=0
local shuttingDown=false
local function saveAutomatic()
  scheduled=false
  if InCombatLockdown and InCombatLockdown() then return end
  local ok,result=pcall(buildSnapshot,GetServerTime()-lastRaidAt<=300,true)
  if ok then lastAutomatic=result;persistSnapshot(result) else initDB();ToyboxExportDB.lastError="Automatic snapshot failed; previous snapshot kept." end
end
local function queueAutomatic()
  if scheduled or shuttingDown then return end
  scheduled=true
  if C_Timer and C_Timer.After then C_Timer.After(3,saveAutomatic) else scheduled=false end
end
local function requestRaidUpdate()
  local now=GetServerTime()
  if RequestRaidInfo and now-lastRaidRequest>=10 then lastRaidRequest=now;pcall(RequestRaidInfo) end
end
local events={"UPDATE_INSTANCE_INFO","GOSSIP_SHOW","PLAYER_LOGIN","PLAYER_ENTERING_WORLD","PLAYER_REGEN_ENABLED","PLAYER_LOGOUT","ADDONS_UNLOADING","ZONE_CHANGED_NEW_AREA","QUEST_LOG_UPDATE","QUEST_TURNED_IN","NEW_TOY_ADDED","TRADE_SKILL_SHOW","TRADE_SKILL_LIST_UPDATE","TRADE_SKILL_DATA_SOURCE_CHANGED","TRADE_SKILL_DETAILS_UPDATE","UNIT_SPELLCAST_SUCCEEDED","BOSS_KILL","PLAYER_TARGET_CHANGED","UPDATE_MOUSEOVER_UNIT","MERCHANT_SHOW","CALENDAR_UPDATE_EVENT_LIST"}
for _,event in ipairs(events) do
  if not C_EventUtils or not C_EventUtils.IsEventValid or C_EventUtils.IsEventValid(event) then eventFrame:RegisterEvent(event) end
end
eventFrame:SetScript("OnEvent",function(_,event,unit,_,spellID)
  if event=="QUEST_TURNED_IN" and type(unit)=="number" then
    local cache=characterCache();if cache then local now=GetServerTime();local meta=cache.questMeta and cache.questMeta[unit];local title=meta and meta.title or C_QuestLog and safe(C_QuestLog.GetTitleForQuestID,unit) or ("Quest #"..unit);local entry={id=unit,title=title,at=now,frequency=meta and meta.frequency or nil};
      if C_DateAndTime then local seconds=meta and meta.frequency==1 and safe(C_DateAndTime.GetSecondsUntilDailyReset) or meta and meta.frequency==2 and safe(C_DateAndTime.GetSecondsUntilWeeklyReset);if type(seconds)=="number" and seconds>0 then entry.resetAt=now+seconds end end
      cache.turnIns=cache.turnIns or {};cache.turnIns[unit..":"..now]=entry
    end
  end
  if event=="GOSSIP_SHOW" then local cache=characterCache();if cache then cache.offers=cache.offers or {};for _,q in ipairs((C_GossipInfo and safe(C_GossipInfo.GetAvailableQuests)) or {}) do if not isSecret(q.questID) and ARCHAEOLOGY_QUESTS[q.questID] then cache.offers[q.questID]=GetServerTime() end end end end
  if event=="PLAYER_LOGOUT" or event=="ADDONS_UNLOADING" then
    -- APIs can already be unloading here (saved bosses return zero encounters).
    -- Keep the last successful event capture with its actual capture timestamp.
    if not shuttingDown then shuttingDown=true;if lastAutomatic then persistSnapshot(lastAutomatic) else saveAutomatic() end end
    return
  end
  if event=="UNIT_SPELLCAST_SUCCEEDED" then
    if unit~="player" then return end
    local supported=false;for _,id in ipairs(CRAFT_SPELLS) do if spellID==id then supported=true end end
    if not supported then return end
  end
  if event=="NEW_TOY_ADDED" then collectionCache=nil end
  if event=="UPDATE_INSTANCE_INFO" then
    lastRaidAt=GetServerTime()
    if pending then C_Timer.After(0.2,function() finish(true) end) end
  else pcall(observeGame) end
  if event=="PLAYER_LOGIN" or event=="PLAYER_ENTERING_WORLD" or event=="BOSS_KILL" then
    if C_AddOns and C_AddOns.LoadAddOn then pcall(C_AddOns.LoadAddOn,"Blizzard_Collections") end
    requestRaidUpdate()
  end
  queueAutomatic()
end)
local function export()
  if InCombatLockdown and InCombatLockdown() then log("Wait until you leave combat, then export again.");return end
  if pending then log("Waiting for raid save information…");return end
  if C_AddOns and C_AddOns.LoadAddOn then C_AddOns.LoadAddOn("Blizzard_Collections") end
  pending=true
  if RequestRaidInfo then RequestRaidInfo() end
  C_Timer.After(2,function() finish(false) end)
  log("Refreshing raid saves and preparing your snapshot…")
end
SLASH_TOYBOXEXPORT1="/toybox"
SlashCmdList.TOYBOXEXPORT=function(msg)
  initDB()
  local command,arg=msg:match("^(%S*)%s*(.-)$")
  if command=="watch" or command=="unwatch" then
    local id=tonumber(arg)
    if not id or id<1 or id%1~=0 then log("Use /toybox watch <questID> or /toybox unwatch <questID>.");return end
    ToyboxExportDB.watched[id]=command=="watch" and true or nil
    log((command=="watch" and "Watching quest #" or "Stopped watching quest #")..id..". Export again to update the planner.")
  elseif command=="status" then initDB();log(ToyboxExportDB.lastCapturedAt and "Snapshots are captured automatically. Log out or /reload to save them for the companion." or "No automatic snapshot yet. Leave combat and open Collections, then /reload.")
  elseif command=="help" then log("/toybox opens Today. /toybox export copies a snapshot. /toybox library searches toys. /toybox settings changes guide preferences. /toybox watch <questID> watches a quest.")
  elseif command=="export" then export()
  elseif ToyboxGuides and ToyboxGuides:DispatchCommand(command,arg) then return
  else export() end
end
if ToyboxGuides then ToyboxGuides.Encode=encode;ToyboxGuides.Array=array end
-- Test surface: only installed by an explicit offline harness, never defined by the game addon.
if TOYBOX_TEST then TOYBOX_TEST.encode=encode;TOYBOX_TEST.array=array;TOYBOX_TEST.build=buildSnapshot;TOYBOX_TEST.observe=observeGame;TOYBOX_TEST.persist=persistSnapshot;TOYBOX_TEST.save=saveAutomatic end
