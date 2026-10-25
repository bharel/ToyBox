from pathlib import Path
import sys,json
sys.path.insert(0,str(Path('work/lua-runtime').resolve()))
from lupa.lua51 import LuaRuntime
lua=LuaRuntime(unpack_returned_tuples=True)
lua.execute('''
TOYBOX_TEST={};unpack=unpack or table.unpack;UIParent={};UISpecialFrames={};tinsert=table.insert;SlashCmdList={};GetServerTime=function() return 1792800000 end
UnitGUID=function() return "Player-1-ABC" end;UnitName=function() return "Examplepriest" end;GetRealmName=function() return "Example Realm" end;UnitClass=function() return "Priest","PRIEST" end;UnitLevel=function() return 90 end;GetCurrentRegion=function() return 3 end;UnitFactionGroup=function() return "Alliance" end
PlayerHasToy=function() return false end;InCombatLockdown=function() return false end;date=os.date;DEFAULT_CHAT_FRAME={AddMessage=function() end}
C_DateAndTime={GetSecondsUntilDailyReset=function() return 3600 end,GetSecondsUntilWeeklyReset=function() return 86400 end}
C_QuestLog={GetNumQuestLogEntries=function() return 0 end,IsQuestFlaggedCompleted=function() return false end}
local methods={}
function methods:SetText(value) self.text=value end;function methods:GetText() return self.text or "" end
function methods:SetScript(event,fn) self.scripts=self.scripts or {};self.scripts[event]=fn end
function methods:SetSize(w,h) self.width=w;self.height=h;if self.scripts and self.scripts.OnSizeChanged then self.scripts.OnSizeChanged(self,w,h) end end
function methods:SetWidth(w) self.width=w end
function methods:SetPoint(point,relative,relativePoint,x,y) self.point={point,relative,relativePoint,x,y} end
function methods:SetEnabled(value) self.enabled=value end
function methods:GetStringHeight() return math.max(14,math.ceil(#(self.text or "")/math.max(1,(self.width or 350)/7))*15) end
function methods:GetVerticalScroll() return self.scroll or 0 end
function methods:SetVerticalScroll(value) self.scroll=value end
function methods:SetHeight(h) self.height=h end;function methods:GetHeight() return self.height or 30 end;function methods:GetWidth() return self.width or 440 end
function methods:GetPoint() return "CENTER",UIParent,"CENTER",0,0 end
function methods:Show() self.shown=true end;function methods:Hide() self.shown=false end;function methods:IsShown() return self.shown~=false end
function methods:SetChecked(v) self.checked=v end;function methods:GetChecked() return self.checked end
function methods:CreateFontString() return OBJ() end;function methods:CreateTexture() return OBJ() end
function OBJ() return setmetatable({scripts={}},{__index=function(t,k) if k=="TitleText" then local v=OBJ();rawset(t,k,v);return v end;if methods[k] then return methods[k] end;if k:match("^Set") or k:match("^Register") or k:match("^Enable") or k:match("^Start") or k:match("^Stop") or k:match("^Clear") or k:match("^Highlight") then return function() end end end}) end
CreateFrame=function(_,name) local f=OBJ();if name then _G[name]=f end;return f end
GetQuestID=function() return 70893 end;GetQuestMoneyToGet=function() return 0 end;GetNumQuestItems=function() return 0 end;GetNumQuestChoices=function() return CHOICES or 0 end
C_QuestOffer={GetQuestRequiredCurrencyInfo=function() return nil end}
AcceptQuest=function() ACCEPTED=(ACCEPTED or 0)+1 end;GetQuestReward=function() REWARDED=(REWARDED or 0)+1 end
''')
for name in ['Core.lua','Data.lua','Engine.lua','Conditions.lua','Systems.lua','Walkthrough.lua','Session.lua','Guidance.lua','Forecast.lua','Navigation.lua','Sync.lua','Reports.lua','UI.lua','Integration.lua','ToyboxExport.lua']:
    lua.execute(Path('addon/ToyboxExport',name).read_text())
lua.execute('''
local G=ToyboxGuides
local function choose(id) G:Select(id);local c=G:Character();if c.session and c.session.pending then G:NextStop() end end
G:Refresh();G.UI:Toggle();assert(G.UI.window:IsShown());assert(#G.UI.window.title.text>0)
choose("rep-tuskarr-feast");assert(G.UI.window.title.text=="Cook at the Community Feast")
G.UI:Library("toys","tuskarr",1);assert(G.UI.library:IsShown());assert(G.UI.library.rows[1].item)
G.UI:Library("guides","niffen",1);assert(G.UI.library.rows[1].guide)
G.UI:Details();assert(G.UI.copy.edit.text:find("Source:",1,true))
G.UI:Settings();local eng=G.UI.settings.checks[1];eng:SetChecked(true);eng.scripts.OnClick(eng);assert(G:DB().intent.engineering[G:Character().guid])
choose("rep-tuskarr-feast");G:Convenience("QUEST_DETAIL");assert(ACCEPTED==1)
G:Convenience("QUEST_COMPLETE");assert(REWARDED==nil)
C_QuestLog.GetNumQuestLogEntries=function() return 1 end;C_QuestLog.GetInfo=function() return {questID=70893,title="Community Feast"} end;C_QuestLog.IsComplete=function() return true end;C_QuestLog.GetQuestObjectives=function() return {} end;G:Refresh()
G:Convenience("QUEST_COMPLETE");assert(REWARDED==1)
C_QuestOffer.GetQuestRequiredCurrencyInfo=function() return {requiredAmount=50} end;G:Convenience("QUEST_COMPLETE");assert(REWARDED==1);C_QuestOffer.GetQuestRequiredCurrencyInfo=function() return nil end
CHOICES=1;G:Convenience("QUEST_COMPLETE");assert(REWARDED==1)
GetQuestMoneyToGet=function() return 100 end;G:Convenience("QUEST_DETAIL");assert(ACCEPTED==1)
local selected=G:Character().selected
G.UI:Library("guides","niffen",1);assert(G:Character().selected==selected)
-- Daily objectives lead the guide; the multi-day seal requirement stays secondary.
local char=G:Character();char.quests={[13718]={title="The Valiant's Charge",complete=false,objectives={{text="20/25 Valiant's Seal",numFulfilled=20,numRequired=25,finished=false}}},[13665]={title="The Grand Melee",complete=false,objectives={{text="0/3 Mark of the Valiant",numFulfilled=0,numRequired=3,finished=false}}}};char.questsAt=G.Now();choose("argent-tournament")
local ui=G.UI;local win=ui.window
assert(win.action.text:find("The Grand Melee",1,true));assert(not win.action.text:find("20/25",1,true));assert(win.counter.text=="0/3 Mark of the Valiant")
assert(win.daily.text:find("0/4 dailies turned in today",1,true));assert(win.daily.text:find("20/25 Valiant's Seals",1,true))
assert(win.progress:IsShown() and not win.nextButton:IsShown());assert(not win.travel.text:find("verified destination is not available",1,true))
win.skip.scripts.OnClick();assert(not win.action.text:find("Not ready to turn in",1,true));assert(char.viewStep~="argent-tournament:q13665:turnin")
win.undo.scripts.OnClick();assert(win.action.text:find("The Grand Melee",1,true));assert(win.counter.text=="0/3 Mark of the Valiant")
do
 local quests=char.quests;char.quests={[75665]={title="A Worthy Ally",complete=false,objectives={{numFulfilled=500,numRequired=1500}}}};char.questsAt=G.Now()
 char.repTasksAt=G.Now();char.repTasks={[2564]={[90001]={title="Available reputation quest",isTask=true,eligible=true}}};choose("rep-niffen-weekly")
 assert(win.action.text:find("Available reputation quest",1,true));assert(not win.action.text:find("1500",1,true));assert(win.daily.text:find("500/1500",1,true));assert(win.daily.text:find("within this weekly quest",1,true))
 char.quests=quests;char.repTasks=nil;char.repTasksAt=nil;choose("argent-tournament")
end
local expanded=win:GetHeight();ui:SetCompact(true);assert(win:GetHeight()<expanded and not win.rewardRow:IsShown());ui:SetCompact(false);assert(win.rewardRow:IsShown())
for _,width in ipairs({340,410,620}) do win:SetSize(width,win:GetHeight());ui:Refresh();assert(win:GetHeight()>=250 and win:GetHeight()<=680);assert(win.actionContent:GetWidth()==width-36) end
-- Direct buttons skip an unmet turn-in, false faction branch and completed step.
do
 local original=G.Pack.guides;local previous=char.selected
 local fixture={id="control-fixture",title="Controls",zone="Test",method="Quest",cadence="daily",rewards={},steps={},walkthrough={version=2,nodes={
  {id="control:a",kind="interact",text="First action",manual=true},
  {id="control:locked",kind="turnin",text="Not ready to turn in",after={"control:a"},requires={kind="questInLog",questId=999}},
  {id="control:unknown",kind="purchase",text="Inventory not observed",after={"control:a"},requires={kind="itemCount",itemId=999998}},
  {id="control:wrong",kind="interact",text="Wrong faction",when={kind="faction",value="Horde"},manual=true},
  {id="control:complete",kind="interact",text="Already finished",completeWhen={kind="questTurnedIn",questId=7}},
  {id="control:b",kind="interact",text="Second valid action",after={"control:a"},manual=true},
  {id="control:c",kind="interact",text="Third valid action",after={"control:b"},manual=true}
 },completeWhen={kind="toyOwned",itemId=999999}}}
 G.Pack.guides={fixture};char.flags[7]={value=true,at=G.Now()};char.faction="Alliance";char.questsAt=G.Now();char.cursor=1;choose(fixture.id)
 local flags,turnIns=char.flags,char.turnIns
 assert(win.back.text=="Back" and win.skip.text=="Skip" and win.undo.text=="Undo");assert(win.skip:IsShown() and win.skip.enabled)
 win.skip.scripts.OnClick();assert(win.action.text=="Second valid action" and char.viewStep=="control:b");assert(win.back.enabled)
 ui:Refresh();assert(win.action.text=="Second valid action")
 win.back.scripts.OnClick();assert(win.action.text=="First action" and not char.skipped["control:a"])
 win.skip.scripts.OnClick();win.skip.scripts.OnClick();assert(win.action.text=="Third valid action")
 win.skip.scripts.OnClick();assert(win.action.text:find("Nothing else",1,true) or win.action.text:find("Planned progress",1,true));assert(win.activities:IsShown() and not win.skip.enabled);assert(not G:GraphState(fixture,char).complete)
 -- Real observations can reveal a valid action without undoing or manufacturing progress.
 char.quests[999]={complete=false,objectives={}};char.questsAt=G.Now();ui:Refresh();assert(char.viewStep=="control:locked" and not win.activities:IsShown())
 char.quests[999]=nil;ui:Refresh()
 win.undo.scripts.OnClick();assert(win.action.text=="Third valid action")
 win.back.scripts.OnClick();assert(win.action.text=="Second valid action");win.back.scripts.OnClick();assert(win.action.text=="First action")
 assert(win.nextButton:IsShown());win.nextButton.scripts.OnClick();assert(win.action.text=="Second valid action")
 win.undo.scripts.OnClick();assert(win.action.text=="First action")
 assert(char.flags==flags and char.turnIns==turnIns and not G:Owned(999999))
 -- All visible controls fit and never overlap, including Continue and Compact.
 for _,compact in ipairs({false,true}) do ui:SetCompact(compact)
  for _,width in ipairs({340,410,620}) do win:SetSize(width,win:GetHeight());ui:Refresh()
   local lastRight=0
   for _,b in ipairs({win.back,win.skip,win.undo,win.details,win.nextButton}) do
    assert(b:IsShown());local x=b.point[4];assert(x>=lastRight and x+b:GetWidth()<=width-18);lastRight=x+b:GetWidth()
   end
  end
 end
 -- Pausing prevents a click or command from advancing the guide.
 char.paused=true;ui:Refresh();local step=char.viewStep;G:Skip();assert(char.viewStep==step and not win.skip.enabled);char.paused=false
 ui:SetCompact(false);G.Pack.guides=original;char.selected=previous;char.cursor=1;char.viewStep=nil;G.dirty=true;ui:Refresh()
end
ui:Menu();assert(ui.menu:IsShown() and #ui.menu.actions==13);ui:Menu();assert(not ui.menu:IsShown())
-- Return to the original activity; window browsing never completes a quest or toy.
assert(not G:Owned(45011));choose("rep-tuskarr-feast")
local o=G:ExportGuides();assert(o.version==1 and o.roster.guid==G:Character().guid and type(o.operations)=="table")
G:Command("snooze","");assert(G:Character().snoozed["rep-tuskarr-feast"])
G.UI:Toggle();assert(not G.UI.window:IsShown())
''')
lua.execute('TOYBOX_TEST.save()')
snapshot=json.loads(lua.globals().ToyboxExportDB['outbox']['Player-1-ABC'])
assert snapshot['guides']['version']==1 and isinstance(snapshot['guides']['operations'],list)
assert snapshot['guides']['roster']['guid']=='Player-1-ABC'
assert snapshot['guides']['observed']['timeUnit']=='unix-seconds'
print('Passed complete Lua window fixtures: direct Skip/Back/Undo/Continue clicks, valid-step selection, end recovery, compact/wide control containment, Today, library search, quest safeguards, optional Engineering and export.')
