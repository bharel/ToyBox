local G=ToyboxGuides
local frame=CreateFrame("Frame");local queued=false;local elapsed=0;local observedElapsed=0
local function relevant(questID,event)
 if G.RelevantQuest then return G:RelevantQuest(questID,event) end
 local g=G:Current();if not g then return false end
 for _,id in ipairs(g.questIds or {}) do if id==questID then return true end end
 return false
end
function G:Convenience(event)
 local c=self:Character();if not c or c.paused or G.Safe(InCombatLockdown) then return end
 local intent=self:DB().intent
 if event=="TAXIMAP_OPENED" and intent.autoFlights and self.Navigation.ownsBackend then
  local b=self.Navigation:Backend();local nodes=b and b.FlightKnowledge and G.Read(b.FlightKnowledge.WindowNodes,b.FlightKnowledge)
  local slot=nodes and b.TaxiMark and G.Safe(b.TaxiMark.Target,nodes)
  if slot and G.Safe(TaxiNodeCost,slot)==0 then G.Safe(TakeTaxiNode,slot) elseif slot then self.Navigation.message="The marked flight has a fare. Choose it yourself to spend gold." end
  return
 end
 if event=="GOSSIP_SHOW" and intent.autoGossip then
  local candidates={}
  for _,q in ipairs(G.Read(C_GossipInfo and C_GossipInfo.GetAvailableQuests) or {}) do if relevant(q.questID,"QUEST_DETAIL") then candidates[#candidates+1]={id=q.questID,accept=true} end end
  for _,q in ipairs(G.Read(C_GossipInfo and C_GossipInfo.GetActiveQuests) or {}) do if relevant(q.questID,"QUEST_COMPLETE") and q.isComplete then candidates[#candidates+1]={id=q.questID} end end
  if #candidates==1 then local q=candidates[1];G.Safe(q.accept and C_GossipInfo.SelectAvailableQuest or C_GossipInfo.SelectActiveQuest,q.id);return end
 end
 if intent.autoQuests==false then return end
 local id=G.Safe(GetQuestID)
 local noCurrencyCost=false
 if C_QuestOffer and C_QuestOffer.GetQuestRequiredCurrencyInfo then local ok,cost=pcall(C_QuestOffer.GetQuestRequiredCurrencyInfo,1);noCurrencyCost=ok and cost==nil end
 if event=="QUEST_DETAIL" and relevant(id,event) then
  -- Costs must be known to be zero; nil is not permission to spend.
  if noCurrencyCost and G.Safe(GetQuestMoneyToGet)==0 and G.Safe(GetNumQuestItems)==0 then G.Safe(AcceptQuest) end
 elseif event=="QUEST_PROGRESS" and relevant(id,event) then
  if noCurrencyCost and G.Safe(IsQuestCompletable)==true and G.Safe(GetQuestMoneyToGet)==0 and G.Safe(GetNumQuestItems)==0 then G.Safe(CompleteQuest) end
 elseif event=="QUEST_COMPLETE" and relevant(id,event) then
  if noCurrencyCost and G.Safe(GetNumQuestChoices)==0 and G.Safe(GetQuestMoneyToGet)==0 and G.Safe(GetNumQuestItems)==0 then G.Safe(GetQuestReward,0) end
 elseif event=="GOSSIP_SHOW" and intent.autoGossip then
  local g=self:Current();local options=G.Read(C_GossipInfo and C_GossipInfo.GetOptions)
  if g and g.gossipOptionID and options then for _,o in ipairs(options) do if o.gossipOptionID==g.gossipOptionID and o.cost==0 then G.Safe(C_GossipInfo.SelectOption,o.gossipOptionID);break end end end
 end
end
function G:RecordObservation(event,c,arg1,arg2,spellID)
 if not c.recording or event=="refresh" then return end
 c.recorded=c.recorded or {};local mapID=G.Safe(C_Map and C_Map.GetBestMapForUnit,"player");local pos=mapID and G.Safe(C_Map.GetPlayerMapPosition,mapID,"player")
 c.recorded[#c.recorded+1]={event=event,at=G.Now(),mapID=mapID,x=pos and pos.x,y=pos and pos.y,argument=type(arg1)=="number" and arg1 or nil,second=type(arg2)=="number" and arg2 or nil,spellId=spellID,npcGUID=G.Safe(UnitGUID,"npc")}
 if #c.recorded>500 then table.remove(c.recorded,1) end
end
function G:Event(event,arg1,arg2,spellID)
 local c=self:Character();if not c then return end
 if event=="PLAYER_REGEN_DISABLED" or event=="GOSSIP_SHOW" or event=="QUEST_DETAIL" or event=="MERCHANT_SHOW" then
  local ui=self.UI;if ui then if ui.window and ui.window.nearby then ui.window.nearbyOpportunity=nil;ui.window.nearby:Hide() end;if ui.nearbyWindow then ui.nearbyWindow:Hide() end end
 end
 if event=="PLAYER_LOGIN" then
  if type(ToyboxSyncInbox)=="string" then self:ImportInbox(ToyboxSyncInbox) end
  self:Refresh();self:Log("Guide ready. /toybox opens Today; /toybox export keeps manual export available.")
 elseif event=="GOSSIP_SHOW" then
  c.dialogOpen=true
  local offers=self.Read(C_GossipInfo and C_GossipInfo.GetAvailableQuests)
  if type(offers)=="table" then c.offers={};c.offersAt=G.Now();for _,q in ipairs(offers) do if q.questID then c.offers[q.questID]=G.Now() end end end
  for id in pairs(c.offers or {}) do self:ObserveGuideQuestSet(c,id) end
  local guid=self.Read(UnitGUID,"npc");local id=type(guid)=="string" and tonumber(guid:match("^[^-]+%-[^-]+%-[^-]+%-[^-]+%-[^-]+%-(%d+)%-"));local name=self.Read(UnitName,"npc")
  if id and type(name)=="string" then c.npcNames=c.npcNames or {};c.npcNames[id]=name end
 elseif event=="GARRISON_MISSION_NPC_OPENED" then c.missionPanelOpen=true;c.missionFollowerType=type(arg1)=="number" and arg1 or nil
 elseif event=="GARRISON_MISSION_NPC_CLOSED" then c.missionPanelOpen=nil
 elseif event=="QUEST_TURNED_IN" and type(arg1)=="number" then c.turnInSequence=(c.turnInSequence or 0)+1;c.turnInRevisions=c.turnInRevisions or {};c.turnInRevisions[arg1]=c.turnInSequence;c.turnIns[arg1]=G.Now();c.flagsAt=nil;c.repTasksAt=nil
 elseif event=="UNIT_SPELLCAST_SUCCEEDED" and arg1=="player" then
  for _,g in ipairs(self.Pack.guides) do for _,v in ipairs(g.variants or {}) do if v.spellId==spellID then self:Use(spellID,G.Now()) end end end
 elseif event=="UPDATE_FACTION" or event=="MAJOR_FACTION_RENOWN_LEVEL_CHANGED" then c.reputationsAt=nil
 elseif event=="QUEST_POI_UPDATE" then c.repTasksAt=nil
 elseif event=="TRADE_SKILL_LIST_UPDATE" or event=="TRADE_SKILL_DATA_SOURCE_CHANGED" or event=="NEW_RECIPE_LEARNED" then c.recipeScanAt=nil
 elseif event=="NEW_TOY_ADDED" or event=="TOYS_UPDATED" then self.ownedRead=nil;if type(arg1)=="number" and self.Safe(PlayerHasToy,arg1)==true then self:DB().owned[arg1]=true end end
 c.interfaces=c.interfaces or {}
 local interface=event=="TRADE_SKILL_SHOW" and "profession" or event=="GARRISON_MISSION_NPC_OPENED" and "mission" or event=="MAIL_SHOW" and "mail" or event=="MERCHANT_SHOW" and "merchant"
 if event=="GOSSIP_CLOSED" then c.dialogOpen=false end
 if event=="MERCHANT_CLOSED" and c.interfaces.merchant then c.interfaces.merchant.open=false end
 if interface then local guid=self.Read(UnitGUID,"npc");local npc=type(guid)=="string" and tonumber(guid:match("^[^-]+%-[^-]+%-[^-]+%-[^-]+%-[^-]+%-(%d+)%-"));c.interfaces[interface]={open=true,at=G.Now(),npcId=npc} end
 if event=="UNIT_HEALTH" and (arg1=="target" or arg1=="mouseover") then self:ObserveSighting(arg1) elseif event=="PLAYER_TARGET_CHANGED" then self:ObserveSighting("target") elseif event=="UPDATE_MOUSEOVER_UNIT" then self:ObserveSighting("mouseover") end
 if event=="ACHIEVEMENT_EARNED" then c.achievementsAt=nil end
 if event=="QUEST_DETAIL" then local id=self.Read(GetQuestID);if type(id)=="number" then c.offers={[id]=G.Now()};c.offersAt=G.Now();self:ObserveGuideQuestSet(c,id) end end
 if event=="QUEST_DETAIL" or event=="QUEST_COMPLETE" then c.dialogOpen=true;self:ObserveRewardOffer(c) elseif event=="QUEST_FINISHED" then c.dialogOpen=false end
 self:RecordObservation(event,c,arg1,arg2,spellID);self:Convenience(event)
 if not queued and C_Timer and C_Timer.After then queued=true;C_Timer.After(0.3,function()
  queued=false;if G.Safe(InCombatLockdown) then return end
  self:Refresh();local g=self:Current()
  if g and not c.paused and not self.DisplaySteps then local state=self:Eligibility(g,c);if state=="done" or state=="owned" then c.selected=nil;c.cursor=1 end end
  if self.UI then self.UI:Refresh() end
 end) end
end
for _,event in ipairs({"PLAYER_LOGIN","PLAYER_ENTERING_WORLD","PLAYER_REGEN_ENABLED","PLAYER_REGEN_DISABLED","UNIT_HEALTH","TAXIMAP_OPENED","QUEST_LOG_UPDATE","QUEST_POI_UPDATE","QUEST_ACCEPTED","QUEST_TURNED_IN","QUEST_DETAIL","QUEST_PROGRESS","QUEST_COMPLETE","GOSSIP_SHOW","GOSSIP_CLOSED","QUEST_FINISHED","NEW_TOY_ADDED","TOYS_UPDATED","BAG_UPDATE_DELAYED","CURRENCY_DISPLAY_UPDATE","UPDATE_FACTION","MAJOR_FACTION_RENOWN_LEVEL_CHANGED","ACHIEVEMENT_EARNED","TRADE_SKILL_SHOW","TRADE_SKILL_LIST_UPDATE","TRADE_SKILL_DATA_SOURCE_CHANGED","NEW_RECIPE_LEARNED","SKILL_LINES_CHANGED","UNIT_SPELLCAST_SUCCEEDED","UPDATE_INSTANCE_INFO","CALENDAR_UPDATE_EVENT_LIST","GARRISON_MISSION_LIST_UPDATE","GARRISON_MISSION_FINISHED","GARRISON_MISSION_NPC_OPENED","GARRISON_MISSION_NPC_CLOSED","MAIL_SHOW","MERCHANT_SHOW","MERCHANT_CLOSED","UNIT_AURA","PLAYER_TARGET_CHANGED","UPDATE_MOUSEOVER_UNIT","ZONE_CHANGED_NEW_AREA","VIGNETTES_UPDATED"}) do pcall(frame.RegisterEvent,frame,event) end
frame:SetScript("OnEvent",function(_,event,...) local ok,err=pcall(G.Event,G,event,...);if not ok then G:Error(event,err) end end)
frame:SetScript("OnUpdate",function(_,dt) elapsed=elapsed+dt;observedElapsed=observedElapsed+dt;if elapsed<0.5 then return end;if G.TickSession then G:TickSession(elapsed) end;elapsed=0;if not G.Safe(InCombatLockdown) then G.Navigation:Tick();if G.UI.window and G.UI.window:IsShown() and observedElapsed>=60 then observedElapsed=0;G:Refresh() end end;if G.UI.window and G.UI.window:IsShown() then G.UI:Refresh() end end)
function G:Command(command,arg)
 local c=self:Character();if not c then return end
 if command=="" or command=="guide" then self.UI:Toggle()
 elseif command=="library" then self.UI:Ensure();self.UI:Library("toys",arg)
 elseif command=="settings" then self.UI:Settings()
 elseif command=="navigate" then self:FollowCurrentStep(true)
 elseif command=="follow" then local g=self:Current();if g then self:SetIntent("follow:"..g.id,not self:DB().intent.followed[g.id]) end
 elseif command=="snooze" then local g=self:Current();if g then c.snoozed[g.id]=self:Period(c,g.cadence) or G.Now()+86400;c.selected=nil;self:Changed() end
 elseif command=="undo" then self:Undo()
 elseif command=="back" then self:Back()
 elseif command=="skip" then self:Skip()
 elseif command=="continue" then self:Continue()
 elseif command=="used" then local g=self:Current();local minutes=tonumber(arg) or 0;if g and g.variants and minutes>=0 then for _,v in ipairs(self:Variants(g,c)) do if c.recipes[v.spellId] and c.recipes[v.spellId].learned then self:Use(v.spellId,G.Now()-minutes*60);break end end end
 elseif command=="record" then c.recording=not c.recording;self:Log(c.recording and "Guide recorder enabled." or "Guide recorder stopped.")
 elseif command=="diagnostics" then self.UI:Copy(self.Encode(self:Diagnostic()),"Toybox diagnostics")
 else return false end
 return true
end
G.frame=frame
function G:DispatchCommand(command,arg)
 local ok,result=pcall(self.Command,self,command,arg);if not ok then self:Error("command:"..command,result);return true end;return result
end
BINDING_HEADER_TOYBOXGUIDES="Toybox Guides"
BINDING_NAME_TOYBOX_TOGGLE="Open Today guide"
BINDING_NAME_TOYBOX_SKIP="Skip to next eligible step"
BINDING_NAME_TOYBOX_BACK="Previous guide step"
BINDING_NAME_TOYBOX_UNDO="Undo last guide action"
