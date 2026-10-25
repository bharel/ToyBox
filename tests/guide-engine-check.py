from pathlib import Path
import json,sys
sys.path.insert(0,str(Path('work/lua-runtime').resolve()))
from lupa.lua51 import LuaRuntime
lua=LuaRuntime(unpack_returned_tuples=True)
lua.execute('''
unpack=unpack or table.unpack;TEST_NOW=1792800000;TEST_GUID="Player-1-ABC";TEST_OWNED={};TEST_QUESTS={};TEST_FLAGS={}
GetServerTime=function() return TEST_NOW end
UnitGUID=function() return TEST_GUID end;UnitName=function() return "Someone" end;GetRealmName=function() return "A Realm" end
UnitClass=function() return "Mage","MAGE" end;UnitLevel=function() return 90 end;UnitFactionGroup=function() return "Alliance" end;GetCurrentRegion=function() return 1 end
PlayerHasToy=function(id) return TEST_OWNED[id] or false end
InCombatLockdown=function() return false end;date=os.date
C_DateAndTime={GetSecondsUntilDailyReset=function() return 3600 end,GetSecondsUntilWeeklyReset=function() return 604800-((TEST_NOW-(1792800000+86400))%604800) end}
C_QuestLog={GetNumQuestLogEntries=function() return #TEST_QUESTS end,GetInfo=function(i) return TEST_QUESTS[i] end,GetQuestObjectives=function(id) return {{text="Widgets: 2/5",numFulfilled=2,numRequired=5,finished=false}} end,IsComplete=function(id) return TEST_READY or false end,IsQuestFlaggedCompleted=function(id) return TEST_FLAGS[id] or false end}
DEFAULT_CHAT_FRAME={AddMessage=function() end}
''')
for file in ['Core.lua','Data.lua','Engine.lua','Conditions.lua','Systems.lua','Walkthrough.lua','Session.lua','Guidance.lua','Forecast.lua','Navigation.lua','Sync.lua']:
    lua.execute(Path('addon/ToyboxExport',file).read_text())
lua.execute('''
local G=ToyboxGuides
G:Refresh();assert(G:Character().region=="US")
-- Poster observations are collected even while another activity is selected.
do
 local c=G:Character();c.selected="argent-tournament";G:ObserveGuideQuestSet(c,72397);assert(not c.questSets or not c.questSets["rep-expedition-posters"])
 G:ObserveGuideQuestSet(c,71007);assert(c.questSets["rep-expedition-posters"].quests[71007]);c.questSets=nil
 local saved=TEST_QUESTS;TEST_QUESTS={{questID=71001,title="Accepted before choosing a guide"}};G:Refresh();assert(c.questSets["rep-expedition-posters"].quests[71001]);TEST_QUESTS=saved;c.questSets=nil;c.selected=nil;G:Refresh()
end
-- Finishing a reset-scoped set is independent of the multi-day seal quest.
do
 local c=G:Character();local argent;for _,g in ipairs(G.Pack.guides) do if g.id=="argent-tournament" then argent=g end end
 c.quests={[13718]={title="The Valiant's Charge",complete=false,objectives={{numFulfilled=20,numRequired=25}}}};c.questsAt=TEST_NOW
 for _,id in ipairs({13665,13592,13847,13603}) do c.turnIns[id]=TEST_NOW end
 local state,_,ready=G:Eligibility(argent,c);assert(state=="upcoming" and ready==c.dailyResetAt)
 G.dirty=true;local plan=G:Plan();local found=false
 for _,entry in ipairs(plan.today) do assert(entry.guide.id~=argent.id) end
 for _,entry in ipairs(plan.upcoming) do if entry.guide.id==argent.id then found=true end end;assert(found)
 c.dailyResetAt=c.dailyResetAt+86400;assert(G:Eligibility(argent,c)~="upcoming");assert(G:GraphState(argent,c).dailySession.progress.count==20)
 c.quests[13718].complete=true;c.quests[13718].objectives[1].numFulfilled=25;c.selected=argent.id;c.cursor=1
 assert(G:Steps(argent,c)[1].kind=="turnin");assert(not G:RelevantQuest(13718,"QUEST_COMPLETE"))
 c.quests={};c.turnIns={};c.selected=nil;c.dailyResetAt=TEST_NOW+3600;G.dirty=true
end
local before=G:Character();before.turnIns[70893]=TEST_NOW
TEST_GUID="Player-2-DEF";G:Refresh();assert(G:Character().turnIns[70893]==nil)
TEST_GUID="Player-1-ABC";assert(G:Character().turnIns[70893]==TEST_NOW)
local feast;for _,g in ipairs(G.Pack.guides) do if g.id=="rep-tuskarr-feast" then feast=g end end
assert(G:Eligibility(feast,before)=="done")
TEST_NOW=TEST_NOW+86401;G:Refresh();assert(G:Eligibility(feast,before)~="done")
-- Lifetime flags alone do not complete a recurring quest.
before.flags[70893]={value=true,at=TEST_NOW,source="history"};assert(G:Eligibility(feast,before)~="done")
TEST_FLAGS[70893]=true;before.flagsAt=nil;G:Refresh();assert(G:Eligibility(feast,before)=="done");TEST_FLAGS[70893]=false;before.flagsAt=nil;G:Refresh()
TEST_QUESTS={{questID=70893,title="Community Feast",frequency=2}};G:Refresh()
assert(G:Steps(feast,before)[1].counters=="Widgets: 2/5");assert(G:Steps(feast,before)[1].text~="Widgets: 2/5")
TEST_READY=true;G:Refresh();assert(G:Steps(feast,before)[1].kind=="turnin")
TEST_QUESTS={};G:Refresh();assert(G:Steps(feast,before)[1].kind~="turnin")
G:Select(feast.id);local id=G:Steps(feast,before)[1].id;G:Skip();assert(before.skipped[id]);assert(not G:DB().owned[199892]);G:Undo();assert(before.skipped[id]==nil)
G:SetIntent("budget",15);local plan=G:Plan();assert(plan.overrun>0);assert(plan.minutes>15)
assert(G:SetIntent("owned:199892",true)==false)
-- Profile imports cannot execute text or erase an unacknowledged local edit.
assert(G:ImportInbox('{"version":1,"profile":"test","revision":1,"values":{"budget":60},"ack":[]}'))
assert(G:DB().intent.budget==15)
assert(not G:ImportInbox('{"version":1,"profile":"other","revision":2,"values":{},"ack":[]}'))
assert(not G.Decode('os.execute("no")'))
assert(not G.Decode('{x:"bad"}'))
assert(not G.Decode('{"x":1,"x":2}'))
local op=G:DB().pending[#G:DB().pending].id
assert(G:ImportInbox('{"version":1,"profile":"test","revision":2,"values":{"budget":60},"ack":["'..op..'"]}'))
assert(G:DB().intent.budget==60)
assert(not G:ImportInbox('{"version":1,"profile":"test","revision":1,"values":{"budget":30},"ack":[]}'))
-- Live ownership retires toy goals but not an explicit Engineering routine.
for _,id in ipairs(feast.rewards) do TEST_OWNED[id]=true end
G.ownedRead=nil;assert(G:Eligibility(feast,before)=="owned")
assert(G:Use(447312,TEST_NOW-7200));assert(before.uses[447312]==TEST_NOW-7200);G:Undo();assert(before.uses[447312]==nil)
assert(not G:Use(447312,TEST_NOW+1))
-- Mission waits and completed recurring opportunities cannot create ownership.
do
 local current=G:Character();local mission={id="mission-wait",method="Mission",rewards={999999},facts={missionID=123},walkthrough={version=2,nodes={{id="mission-wait:observe",kind="observe",text="Inspect mission",manual=true}}}}
 current.missions={[1]={at=TEST_NOW-1000,running={{missionID=123,name="Toy mission",missionEndTime=TEST_NOW+3600}}}}
 local state,_,ready=G:Eligibility(mission,current);assert(state=="upcoming" and ready==TEST_NOW+3600 and not G:Owned(999999))
 current.missions=nil
 local opportunity={id="daily-reward",method="Quest",cadence="daily",rewards={999999},walkthrough={version=2,nodes={{id="daily-reward:learn",kind="learn",text="Learn reward",requires={kind="itemCount",itemId=999999},completeWhen={kind="toyOwned",itemId=999999}}},opportunityCompleteWhen={kind="questTurnedIn",questId=999,cadence="daily",currentPeriodFlag=true}}}
 current.turnIns[999]=TEST_NOW;assert(G:Eligibility(opportunity,current)=="upcoming");assert(not G:Owned(999999))
 local inventory=current.inventory;current.inventory={at=TEST_NOW,data={[999999]=1}};assert(G:Eligibility(opportunity,current)=="ready");assert(not G:Owned(999999));current.inventory=inventory;current.turnIns[999]=nil
end
-- Elapsed cooldowns, daily resets and sequential charges stay separate.
local c=G:Character();c.recipes={};c.useHistory={};c.uses={}
local elapsed={spellId=447312,timing={kind="elapsed",durationMs=72000000}}
c.recipes[447312]={learned=true,at=TEST_NOW-1};assert(G:Cooldown(c,elapsed).state=="unknown")
G:Use(447312,TEST_NOW);assert(G:Cooldown(c,elapsed).state=="upcoming")
TEST_NOW=TEST_NOW+72000;assert(G:Cooldown(c,elapsed).state=="ready")
local charge={spellId=178242,timing={kind="charges",durationMs=86400000,maxCharges=3}}
c.recipes[178242]={learned=true,at=TEST_NOW-1};assert(G:Cooldown(c,charge).state=="unknown")
c.recipes[178242]={learned=true,at=TEST_NOW,charges=0,maxCharges=3,readyAt=TEST_NOW+100}
TEST_NOW=TEST_NOW+100;assert(G:Cooldown(c,charge).charges==1)
TEST_NOW=TEST_NOW+86400*9;assert(G:Cooldown(c,charge).charges==3)
G:Use(178242,TEST_NOW-2);G:Use(178242,TEST_NOW-1);G:Use(178242,TEST_NOW);assert(G:Cooldown(c,charge).charges==0)
G:Undo();assert(G:Cooldown(c,charge).charges==1)
assert(G:AdjustCooldown(178242,1200,0,3));assert(G:Cooldown(c,charge).charges==0)
G:Undo();assert(G:Cooldown(c,charge).charges==1)
assert(not G:AdjustCooldown(178242,1200,4,3))
local daily={spellId=139176,timing={kind="daily"}}
G:Refresh();c.recipes[139176]={learned=true,at=TEST_NOW-1};G:Use(139176,TEST_NOW)
assert(G:Cooldown(c,daily).readyAt==c.dailyResetAt)
-- Structured predicates do not execute content or promote account achievement to character access.
assert(G:Condition({kind="questInLog",questId=12345},c)==false)
assert(G:Condition({kind="unsupported"},c)==nil)
c.achievements={[42]={completed=true,at=TEST_NOW}}
assert(G:Condition({kind="achievement",achievementId=42,scope="character"},c)==nil)
assert(G:Condition({kind="achievement",achievementId=42,scope="account"},c)==true)
c.inventory={data={[1]=2},at=TEST_NOW};assert(G:Condition({kind="itemCount",itemId=1,quantity=2},c))
TEST_NOW=TEST_NOW+301;assert(G:Condition({kind="itemCount",itemId=1,quantity=2},c)==nil)
-- Expired world quests are not fresh reputation opportunities.
c.repTasksAt=TEST_NOW;c.repTasks={[100]={[123]={title="Expired",expiresAt=TEST_NOW-1}}}
assert(G:Eligibility({id="fixture-rep",system="reputation",factionId=100,rewards={}},c)~="ready")
-- Both map APIs are supported; unavailable and expired tasks stay out of work.
do
 local oldTasks,oldMap=C_TaskQuest,C_Map;local oldAward=C_QuestLog.DoesQuestAwardReputationWithFaction;local oldTitle=C_QuestLog.GetTitleForQuestID
 local oldQuests,oldTasksAt,oldRepTasks=c.quests,c.repTasksAt,c.repTasks
 C_Map={GetBestMapForUnit=function() return 2133 end}
 local function scan(map) if map==2133 then return {{questID=90001,x=.2,y=.3},{questID=90002,x=.3,y=.4},{questID=90003,x=.4,y=.5}} end;return {} end
 C_TaskQuest={GetQuestsOnMap=scan,IsActive=function(id) return id~=90002 end,GetQuestTimeLeftSeconds=function(id) return id==90003 and -10 or 600 end}
 C_QuestLog.DoesQuestAwardReputationWithFaction=function(id,faction) return faction==2564 and id>=90001 end;C_QuestLog.GetTitleForQuestID=function(id) return "Observed quest "..id end
 c.repTasksAt=nil;c.quests={[75665]={title="Weekly",complete=false,objectives={{numFulfilled=500,numRequired=1500}}}};c.questsAt=TEST_NOW
 G:ObserveReputationTasks(c);assert(c.repTasks[2564][90001].eligible==true);assert(c.repTasks[2564][90002].eligible==false)
 local weekly;for _,g in ipairs(G.Pack.guides) do if g.id=="rep-niffen-weekly" then weekly=g end end
 local rows=G:ProgressActivities(weekly,c);assert(#rows==1 and rows[1].questId==90001)
 C_TaskQuest.GetQuestsForPlayerByMapID=scan;C_TaskQuest.GetQuestsOnMap=nil;c.repTasksAt=nil;G:ObserveReputationTasks(c);assert(c.repTasks[2564][90001].eligible)
 C_TaskQuest,C_Map=oldTasks,oldMap;C_QuestLog.DoesQuestAwardReputationWithFaction=oldAward;C_QuestLog.GetTitleForQuestID=oldTitle;c.quests=oldQuests;c.repTasksAt=oldTasksAt;c.repTasks=oldRepTasks
end
-- Native fallback preserves a personal waypoint and pauses until explicit resume.
local personal={uiMapID=84,position={x=.2,y=.3}};local current=personal
TomTom=nil;UiMapPoint={CreateFromCoordinates=function(map,x,y) return {uiMapID=map,position={x=x,y=y}} end}
C_Map={CanSetUserWaypointOnMap=function() return true end,GetUserWaypoint=function() return current end,SetUserWaypoint=function(p) current=p end,ClearUserWaypoint=function() current=nil end}
G.Navigation:Go({mapID=84,x=.5,y=.5});assert(current==personal);assert(G.Navigation.manualOverride)
G.Navigation:Stop();assert(current==personal)
current=nil;G.Navigation:Go({mapID=84,x=.5,y=.5});assert(current~=nil);G.Navigation:Stop();assert(current==nil)
-- Continue only advances the guide cursor and Undo restores it; observed facts remain unchanged.
local manual={id="cursor-fixture",title="Cursor",method="Treasure",cadence="once",rewards={999999},steps={},walkthrough={version=2,nodes={{id="cursor-fixture:observe",kind="interact",text="Interact manually.",manual=true},{id="cursor-fixture:learn",kind="learn",text="Learn toy.",completeWhen={kind="toyOwned",itemId=999999},after={"cursor-fixture:observe"}}},completeWhen={kind="toyOwned",itemId=999999}}}
local oldGuides=G.Pack.guides;local oldSelected=c.selected;G.Pack.guides={manual};c.selected=manual.id;c.cursor=1;local flags=c.flags;local turnIns=c.turnIns
G:Continue();assert(G:Steps(manual,c)[1].id=="cursor-fixture:learn");assert(not G:GraphState(manual,c).complete);assert(c.flags==flags and c.turnIns==turnIns and not G:Owned(999999))
G:Undo();assert(G:Steps(manual,c)[1].id=="cursor-fixture:observe")
G.Pack.guides={{id="old",aliasOf="new"},{id="new"}};G.guideAliasesBuilt=nil;G.guideAliases=nil;G:DB().intent.followed.old=true;assert(G:GuideIntent("followed","new")==true);G:DB().intent.followed.new=false;assert(G:GuideIntent("followed","new")==false)
G:DB().intent.followed.old=nil;G:DB().intent.followed.new=nil;G.guideAliasesBuilt=nil;G.guideAliases=nil;G.Pack.guides=oldGuides;c.selected=oldSelected
-- A prior exact-GUID learned recipe keeps its timestamp during migration.
ToyboxExportDB.characters={[c.guid]={recipes={[447312]={at=TEST_NOW-100,cooldownSeconds=60,blizzardRecipeId=50787}}}}
c.recipes[447312]=nil;G:Refresh();assert(c.recipes[447312].learned and c.recipes[447312].at==TEST_NOW-100);assert(c.recipes[447312].readyAt==TEST_NOW-40)
-- Profession removal invalidates old learned evidence; unreadable APIs preserve it.
local oldProfs=GetProfessions;local oldInfo=GetProfessionInfo
c.professions={[202]={name="Engineering"}};GetProfessions=function() return nil end;GetProfessionInfo=function() return nil end;G:Refresh();assert(c.recipes[447312].invalidatedAt==TEST_NOW)
assert(G:Cooldown(c,elapsed).state=="unknown")
c.professions={[202]={name="Engineering"}};GetProfessions=function() error("unavailable") end;G:Refresh();assert(c.professions[202])
GetProfessions=oldProfs;GetProfessionInfo=oldInfo
-- Essential deadlines precede pin rank; guaranteed progress breaks otherwise equal ties.
local original=G.Pack.guides;local intent=G:DB().intent;local oldIntent=intent
G:DB().intent={budget=15,followed={},excluded={},priorities={weekly=1,daily=3}}
G.Pack.guides={{id="weekly",title="Weekly",zone="A",method="Quest",cadence="weekly",essential=true,minutes=10,rewards={},outcome="guaranteed-progress"},{id="daily",title="Daily",zone="A",method="Quest",cadence="daily",essential=true,minutes=10,rewards={},outcome="guaranteed-progress"}}
G.dirty=true;local fixturePlan=G:Plan();assert(fixturePlan.today[1].guide.id=="daily");assert(fixturePlan.overrun==5)
G:DB().intent={budget=15,followed={},excluded={},priorities={}}
G.Pack.guides={{id="a-random",title="Drop",zone="A",method="Drop",minutes=10,rewards={},outcome="random-drop"},{id="z-progress",title="Quest",zone="A",method="Quest",minutes=10,rewards={},outcome="guaranteed-progress"}}
G.dirty=true;assert(G:Plan().today[1].guide.id=="z-progress")
G.Pack.guides={{id="vendor1",title="Vendor",zone="A",method="Vendor",minutes=10,rewards={},costs={{"c",99,10}},npcId=42,destination={mapID=84,x=.5,y=.5}},{id="vendor2",title="Vendor",zone="A",method="Vendor",minutes=10,rewards={},costs={{"c",99,15}},npcId=42,destination={mapID=84,x=.5,y=.5}}}
G.dirty=true;local vendors=G:Plan();assert(#vendors.today==1 and #vendors.today[1].grouped==2);assert(G:Preparation(vendors)["c:99"].required==25)
G.Pack.guides=original;G:DB().intent=oldIntent;G.dirty=true
-- Only Toybox's own waypoint is removed; unsupported helpers retain directions.
local removed={};TomTom={AddWaypoint=function() return "own" end,RemoveWaypoint=function(_,id) removed[#removed+1]=id end,SetCrazyArrow=function() end}
G.Navigation:Go({mapID=2024,x=.135,y=.485,label="Pleeqi"});G.Navigation:Stop();assert(#removed==1 and removed[1]=="own")
''')
pack=json.loads(Path('lib/data/guide-pack.json').read_text())
assert pack['coverage']['catalogueToys']==len(pack['toys'])
ids=[g['id'] for g in pack['guides']];assert len(ids)==len(set(ids))
for g in pack['guides']:
    assert g['steps'] and len({s['id'] for s in g['steps']})==len(g['steps'])
print('Passed guide engine: arbitrary GUID/region, exact character isolation, weekly expiry, lifetime flags, quest objectives and abandonment, skip/Undo, essential overflow, safe profile decoding and conflicts, ownership separation, craft adjustments and waypoint ownership.')
