from pathlib import Path
import json,sys
sys.path.insert(0,str(Path('work/lua-runtime').resolve()))
from lupa import LuaRuntime
lua=LuaRuntime(unpack_returned_tuples=True)
lua.execute(r'''
TOYBOX_TEST={}
DEFAULT_CHAT_FRAME={AddMessage=function() end}
CreateFrame=function() return {RegisterEvent=function() end,SetScript=function(_,name,fn) if name=="OnEvent" then TEST_EVENT=fn end end} end
SlashCmdList={}
C_ToyBox={}
local filters={collected=false,uncollected=true,unusable=false,search="fandral",sources={[1]=true,[2]=false},expansions={[1]=true,[2]=false}}
TEST_FILTERS=filters
C_PetJournal={GetNumPetSources=function() return 2 end}
GetNumExpansions=function() return 2 end
C_ToyBoxInfo={IsToySourceValid=function() return true end}
ToyBox={searchString="fandral"}
C_ToyBox.GetCollectedShown=function() return filters.collected end
C_ToyBox.GetUncollectedShown=function() return filters.uncollected end
C_ToyBox.GetUnusableShown=function() return filters.unusable end
C_ToyBox.SetCollectedShown=function(v) filters.collected=v end
C_ToyBox.SetUncollectedShown=function(v) filters.uncollected=v end
C_ToyBox.SetUnusableShown=function(v) filters.unusable=v end
C_ToyBox.IsSourceTypeFilterChecked=function(i) return filters.sources[i] end
C_ToyBox.IsExpansionTypeFilterChecked=function(i) return filters.expansions[i] end
C_ToyBox.SetSourceTypeFilter=function(i,v) filters.sources[i]=v end
C_ToyBox.SetExpansionTypeFilter=function(i,v) filters.expansions[i]=v end
C_ToyBox.SetAllSourceTypeFilters=function(v) for i=1,2 do filters.sources[i]=v end end
C_ToyBox.SetAllExpansionTypeFilters=function(v) for i=1,2 do filters.expansions[i]=v end end
C_ToyBox.SetFilterString=function(v) filters.search=v end
C_ToyBox.ForceToyRefilter=function() end
C_ToyBox.GetNumFilteredToys=function() return 2 end
C_ToyBox.GetNumLearnedDisplayedToys=function() return 2 end
C_ToyBox.GetToyFromIndex=function(i) assert(filters.search==""); assert(filters.unusable); return ({122304,900001})[i] end
C_ToyBox.GetToyInfo=function(id) return id,id==122304 and "Fandral's Seed Pouch" or 'A "quoted"\nToy',123 end
PlayerHasToy=function() return true end
GetServerTime=function() return 1792584000 end
UnitClass=function() return "Priest","PRIEST" end
UnitGUID=function() return "Player-100-ABC123" end
GetInstanceInfo=function() return "The Nighthold","raid",14,"Normal",20,0,false,1530 end
C_TradeSkillUI={IsTradeSkillReady=function() return true end,GetRecipeInfo=function(id) if id==447312 or id==178242 then return {learned=true,recipeID=id,skillLineAbilityID=id==447312 and 50787 or 33776} end end,GetRecipeCooldown=function(id) if id==447312 then return 7200,false end return 600,false,1,3 end}
C_GossipInfo={GetAvailableQuests=function() return {{questID=41171}} end}
UnitName=function() return "Examplepriest" end
GetRealmName=function() return "Example Realm" end
GetCurrentRegion=function() return 3 end
C_DateAndTime={GetSecondsUntilWeeklyReset=function() return 600000 end,GetSecondsUntilDailyReset=function() return 80000 end}
GetNumSavedInstances=function() return 1 end
GetSavedInstanceInfo=function() return "The Nighthold",42,600000,14,true,false,0,true,10,"Normal",2 end
GetSavedInstanceEncounterInfo=function(i,j) return j==1 and "Gul'dan" or "Other boss",1,j==1,j end
C_QuestLog={}
C_QuestLog.GetAllCompletedQuestIDs=function() return {12345,12346} end
C_QuestLog.GetNumQuestLogEntries=function() return 2,1 end
C_QuestLog.GetInfo=function(i) if i==1 then return {isHeader=true} end return {questID=40000,title="Weekly fixture",frequency=2} end
C_QuestLog.GetQuestObjectives=function() return {{text="Collect 5 widgets",numFulfilled=2,numRequired=5,finished=false}} end
C_QuestLog.IsComplete=function() return false end
C_QuestLog.IsQuestFlaggedCompleted=function(id) return id==12345 or id==58457 end
ToyboxExportDB={watched={[12345]=true}}
''')
lua.execute(Path('addon/ToyboxExport/ToyboxExport.lua').read_text())
snapshot=lua.globals().TOYBOX_TEST.build(True)
data=json.loads(lua.globals().TOYBOX_TEST.encode(snapshot))
assert data['format']=='toybox-addon-v1'
assert data['toysComplete'] is True and data['raidsFresh'] is True
assert data['ownedToyIds']==[122304,900001]
assert data['toys'][1]['name']=='A "quoted"\nToy'
assert data['raidLockouts'][0]['encounters'][0]['killed'] is True
assert data['raidLockouts'][0]['encounters'][1]['killed'] is False
assert data['questLog'][0]['frequency']==2
assert data['questLog'][0]['objectives'][0]['fulfilled']==2
assert data['watchedQuests']==[{'id':12345,'completed':True}]
assert data['warnings']==[]
assert data['addonVersion']=='2.4.0'
assert data['character']['guid']=='Player-100-ABC123'
assert data['game']['instances']==[{'instanceId':1530,'difficultyId':14,'at':1792584000}]
recipes={r['spellId']:r for r in data['game']['recipes']}
assert recipes[447312]['clientSkillLineAbilityId']==50787 and recipes[447312].get('blizzardRecipeId') is None and recipes[447312]['cooldownSeconds']==7200
assert recipes[178242]['charges']==1 and recipes[178242]['maxCharges']==3
assert 58457 in data['completedQuestIds']
lua.execute('TEST_EVENT(nil,"GOSSIP_SHOW")')
offered=json.loads(lua.globals().TOYBOX_TEST.encode(lua.globals().TOYBOX_TEST.build(True)))
assert offered['game']['offeredQuests']==[{'id':41171,'at':1792584000}]
# Seeing a live, attackable Retail rare establishes only a short-lived route observation.
lua.execute('TEST_TARGET=142684;UnitGUID=function(unit) if unit=="target" then return "Creature-0-1-0-1-"..TEST_TARGET.."-000001" end if unit=="player" then return "Player-100-ABC123" end end;UnitCanAttack=function() return true end;UnitIsDeadOrGhost=function() return false end;UnitFactionGroup=function() return "Alliance" end')
seen=json.loads(lua.globals().TOYBOX_TEST.encode(lua.globals().TOYBOX_TEST.build(True)))
assert seen['game']['routes']==[{'route':'kovork','kind':'npc','npcId':142684,'at':1792584000,'expiresAt':1792584300}]
lua.execute('ToyboxExportDB.characters={};TEST_TARGET=2603') # Original low-level Kovork is not the Warfront rare.
assert json.loads(lua.globals().TOYBOX_TEST.encode(lua.globals().TOYBOX_TEST.build(True)))['game']['routes']==[]
lua.execute('TEST_TARGET=147435') # Horde-only rare cannot prove the Alliance route.
assert json.loads(lua.globals().TOYBOX_TEST.encode(lua.globals().TOYBOX_TEST.build(True)))['game']['routes']==[]
lua.execute('TEST_TARGET=96323;UnitIsDeadOrGhost=function() return true end')
assert json.loads(lua.globals().TOYBOX_TEST.encode(lua.globals().TOYBOX_TEST.build(True)))['game']['routes']==[]
# Personal events, absent data and an ended holiday never prove an open Faire.
lua.execute('TEST_TARGET=nil;C_DateAndTime.GetCurrentCalendarTime=function() return {year=2026,month=10,monthDay=4,hour=12,minute=0} end;C_Calendar={GetMonthInfo=function() return {year=2026,month=10} end,GetNumDayEvents=function() return 1 end,GetDayEvent=function() return {calendarType="PLAYER"} end,GetHolidayInfo=function() return {name="Darkmoon Faire",startTime={year=2026,month=10,monthDay=4,hour=0,minute=0},endTime={year=2026,month=10,monthDay=11,hour=0,minute=0}} end}')
assert json.loads(lua.globals().TOYBOX_TEST.encode(lua.globals().TOYBOX_TEST.build(True)))['game']['routes']==[]
lua.execute('C_Calendar.GetDayEvent=function() return {calendarType="HOLIDAY"} end')
holiday=json.loads(lua.globals().TOYBOX_TEST.encode(lua.globals().TOYBOX_TEST.build(True)))
assert holiday['game']['routes']==[{'route':'darkmoon','kind':'calendar','at':1792584000,'expiresAt':1792584300}]
lua.execute('ToyboxExportDB.characters={};C_DateAndTime.GetCurrentCalendarTime=function() return {year=2026,month=10,monthDay=11,hour=0,minute=0} end')
assert json.loads(lua.globals().TOYBOX_TEST.encode(lua.globals().TOYBOX_TEST.build(True)))['game']['routes']==[]
lua.execute('C_Calendar=nil;UnitGUID=function() return "Player-100-ABC123" end')
# Every Legion find is recognized, and actual turn-ins keep their event time/reset.
lua.execute('C_GossipInfo.GetAvailableQuests=function() return {{questID=41192},{questID=41164}} end;TEST_EVENT(nil,"GOSSIP_SHOW");TEST_EVENT(nil,"QUEST_TURNED_IN",40000)')
quest_capture=json.loads(lua.globals().TOYBOX_TEST.encode(lua.globals().TOYBOX_TEST.build(True)))
assert {q['id'] for q in quest_capture['game']['offeredQuests']} >= {41192,41164}
assert quest_capture['game']['questTurnIns']==[{'id':40000,'title':'Weekly fixture','frequency':2,'at':1792584000,'resetAt':1793184000}]
assert any(q['id']==58457 and q['completed'] for q in quest_capture['game']['questChecks'])
lua.execute('GetProfessions=function() return 1,nil,3 end;GetProfessionInfo=function(index) return index==1 and "Engineering" or "Archaeology",1,800,800,0,0,index==1 and 202 or 794 end;GetTime=function() return 500 end;C_UnitAuras={GetPlayerAuraBySpellID=function(id) assert(id==233138);return {expirationTime=4100} end}')
timed=json.loads(lua.globals().TOYBOX_TEST.encode(lua.globals().TOYBOX_TEST.build(True)))
assert {p['id'] for p in timed['game']['professions']['data']}=={202,794}
assert timed['game']['archaeologyEndAt']==1792587600
lua.execute('C_UnitAuras.GetPlayerAuraBySpellID=function() return nil end')
assert json.loads(lua.globals().TOYBOX_TEST.encode(lua.globals().TOYBOX_TEST.build(True)))['game']['archaeologyEndAt']==1792587600
lua.execute('GetProfessions=nil;GetProfessionInfo=nil;C_UnitAuras=nil')
# Automatic snapshots persist JSON per GUID without opening a copy window.
lua.execute('TEST_QUEUE={};C_Timer={After=function(_,fn) table.insert(TEST_QUEUE,fn) end};InCombatLockdown=function() return false end')
lua.execute('TEST_EVENT(nil,"QUEST_LOG_UPDATE");TEST_EVENT(nil,"QUEST_LOG_UPDATE");assert(#TEST_QUEUE==1);local fn=table.remove(TEST_QUEUE,1);fn()')
automatic=json.loads(lua.globals().ToyboxExportDB['outbox']['Player-100-ABC123'])
assert automatic['character']['guid']=='Player-100-ABC123' and automatic['ownedToyIds']==[122304,900001]
assert lua.globals().ToyboxExportWindow is None
lua.execute('UnitGUID=function() return "Player-200-DEF456" end;TOYBOX_TEST.save()')
assert lua.globals().ToyboxExportDB['outbox']['Player-100-ABC123'] is not None
assert lua.globals().ToyboxExportDB['outbox']['Player-200-DEF456'] is not None
lua.execute('UnitGUID=function() return "Player-100-ABC123" end; InCombatLockdown=function() return true end')
before=lua.globals().ToyboxExportDB['outbox']['Player-100-ABC123']
lua.execute('TOYBOX_TEST.save()')
assert lua.globals().ToyboxExportDB['outbox']['Player-100-ABC123']==before
lua.execute('InCombatLockdown=function() return false end')
# Guild-member/linked views and unloaded recipes cannot become the player's evidence.
lua.execute('ToyboxExportDB.characters={};C_TradeSkillUI.IsTradeSkillGuildMember=function() return true end')
guild=json.loads(lua.globals().TOYBOX_TEST.encode(lua.globals().TOYBOX_TEST.build(True)))
assert guild['game']['recipes']==[]
lua.execute('C_TradeSkillUI.IsTradeSkillGuildMember=function() return false end; C_TradeSkillUI.GetRecipeInfo=function() return nil end')
unloaded=json.loads(lua.globals().TOYBOX_TEST.encode(lua.globals().TOYBOX_TEST.build(True)))
assert unloaded['game']['recipes']==[]
lua.execute('UnitGUID=function() return "Player-200-DEF456" end;GetInstanceInfo=function() return "World","none",0,"",0,0,false,0 end')
alt=json.loads(lua.globals().TOYBOX_TEST.encode(lua.globals().TOYBOX_TEST.build(True)))
assert alt['game']['recipes']==[] and alt['game']['instances']==[]
filters=lua.globals().TEST_FILTERS
assert filters['search']=='fandral' and filters['collected'] is False and filters['unusable'] is False
assert filters['sources'][2] is False and filters['expansions'][2] is False
lua.execute('C_ToyBox.GetToyFromIndex=function() error("fixture read failure") end')
failed=json.loads(lua.globals().TOYBOX_TEST.encode(lua.globals().TOYBOX_TEST.build(False)))
assert failed['toysComplete'] is False and len(failed['warnings'])>=2
assert filters['search']=='fandral' and filters['collected'] is False
assert lua.globals().TOYBOX_TEST.encode(lua.globals().TOYBOX_TEST.array())=='[]'
lua.execute('GetNumSavedInstances=function() return 0 end;GetServerTime=function() return 1792584999 end;TEST_EVENT(nil,"PLAYER_LOGOUT");TEST_EVENT(nil,"ADDONS_UNLOADING")')
assert lua.globals().ToyboxExportDB['outbox']['Player-200-DEF456'] is not None
shutdown=json.loads(lua.globals().ToyboxExportDB['outbox']['Player-200-DEF456'])
assert shutdown['exportedAt']==1792584000 # Shutdown cannot re-date a capture after APIs unload.
Path('work/addon-fixture.json').write_text(json.dumps(data))
print('Passed Lua addon fixtures: own-player recipe context, distinct recipe/spell IDs, remaining cooldowns and charges, GUID isolation, map/difficulty visits, offered archaeology quests, direct unlock checkpoints; valid JSON, all owned toys, restored filters, raid saves, quest objectives, exact reset timestamps, incomplete-scan markers and warnings.')
