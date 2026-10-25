from pathlib import Path
import json,sys
source=Path('tests/guide-ui-check.py').read_text();exec(source[:source.index("lua.execute('''\nlocal G=ToyboxGuides")])
if len(sys.argv)>1:
 def table(v):
  if isinstance(v,dict):return lua.table_from({int(k) if str(k).isdigit() else k:table(x) for k,x in v.items()})
  if isinstance(v,list):return lua.table_from([table(x) for x in v])
  return v
 results=[]
 for case in json.loads(Path(sys.argv[1]).read_text()):
  lua.globals().CASE=table(case)
  results.append(json.loads(lua.execute('''local G=ToyboxGuides;local f=CASE;G.Now=function() return f.now end;return G.Encode(G:ProgressForecast(f.requirements,f.rules,f.state,f.random))''')))
 print(json.dumps(results));raise SystemExit
lua.execute('''
local G=ToyboxGuides;G:Refresh();local c=G:Character();G.UI:Toggle()
local original=G.Pack.guides
local g={id="repair",title="Repair",zone="Test",method="Quest",cadence="once",rewards={999901},validation={sourceChecked=true},walkthrough={version=2,includesPrerequisites=true,nodes={
 {id="accept",kind="accept",questId=99001,text="Accept from the original NPC",destination={mapID=84,x=.1,y=.1},when={kind="questOffered",questId=99001},completeWhen={kind="questInLog",questId=99001}},
 {id="objective",kind="objective",questId=99001,text="Rescue the prisoner using the cage key",requires={kind="questInLog",questId=99001},completeWhen={kind="questObjectivesComplete",questId=99001},recovery={text="Open the quest log and inspect the cage-key objective."},destination={mapID=84,x=.2,y=.2}},
 {id="turnin",kind="turnin",questId=99001,text="Return to the original NPC",requires={kind="questObjectivesComplete",questId=99001},completeWhen={kind="questTurnedIn",questId=99001}}
}},steps={}}
G.Pack.guides={g};c.quests={[99001]={title="Prisoner",complete=false}};c.questsAt=G.Now();c.selected=g.id;c.session=nil;c.viewStep=nil
G.Refresh=function() end
assert(G:BeginRecovery("objective"));assert(c.session.recovery);local r=G:DisplaySteps(g,c)[1];assert(r.recovering and r.text:find("cage",1,true));assert(c.turnIns[99001]==nil)
G:Continue();assert(not c.session.recovery and c.viewStep=="objective","return cursor="..tostring(c.viewStep).." stop="..tostring(c.session.activeStop));assert(not G:Owned(999901));G:Undo();assert(not c.session.recovery)
G:BeginRecovery("objective");c.quests[99001].complete=true;local rows=G:DisplaySteps(g,c);assert(not c.session.recovery,"recovery did not return");assert(rows[1].kind=="turnin" or rows[1].stopTransition,"resumed row="..G.Encode(rows[1]))
c.quests[99001].complete=false;G.workRevision=(G.workRevision or 0)+1;c.session.pending=nil;c.viewStep="objective";G:BeginRecovery("objective");G:Back();assert(not c.session.recovery);G:BeginRecovery("objective");G:Skip();assert(not c.session.recovery);assert(not c.turnIns[99001])
-- Failed recovery does not create evidence. Selecting another activity cancels the detour.
c.session.pending=nil;c.session.activeStop=G:StopFor(g,g.walkthrough.nodes[2]).id;c.viewStep="objective";assert(G:BeginRecovery("phase"),"phase begin refused");assert(c.session.recovery,"phase immediately returned "..G.Encode(G:ActiveAction(g,c)));G:Select(g.id);assert(not c.session.recovery,"select retained recovery")
-- Fixed rewards are observed before convenience actions; item reward API's sixth return is the item ID.
GetQuestID=function() return 99001 end;GetNumQuestRewards=function() return 1 end
GetQuestItemInfo=function() return "Seal",123,2,1,true,45192 end
C_QuestInfoSystem={GetQuestRewardCurrencies=function() return {{currencyID=241,totalRewardAmount=3}} end}
G:ObserveRewardOffer(c);assert(c.rewardOffers[99001].items[45192]==2 and c.rewardOffers[99001].currencies[241]==3)
GetNumQuestRewards=nil;C_QuestInfoSystem=nil;local at=c.rewardOffers[99001].at;G:ObserveRewardOffer(c);assert(c.rewardOffers[99001].at==at)
-- Nearby is distance-qualified, source checked, and never changes selected activity or arrow.
local function nearby(id,method,npc) return {id=id,title=id,zone="Hub",method=method or "Quest",cadence="once",npcId=npc,rewards={999902},outcome="guaranteed-progress",validation={sourceChecked=true},walkthrough={version=2,includesPrerequisites=true,nodes={{id=id..":act",kind="interact",text="Do the action",manual=true,destination={mapID=84,x=.1,y=.1},stopId="other"}}},steps={}} end
local near,far,rare=nearby("near"),nearby("far"),nearby("rare","Rare",9001)
G.Pack.guides={g,near,far,rare};c.selected=g.id;c.session={version=1,guides={g.id},activeStop="current",seen={},farm={},spent=0};c.inventory={at=G.Now(),data={}};G.Eligibility=function() return "ready" end
C_Map={GetBestMapForUnit=function() return 84 end,GetPlayerMapPosition=function() return {x=.1,y=.1} end}
local backend={TravelGraph={DistanceProvider=function(a,b) return b.label=="far" and 501 or 500 end}};far.walkthrough.nodes[1].destination.label="far"
G.Navigation.Backend=function() return backend end;local selected=c.selected;local arrow=G.navigationStep
assert(#G:Nearby(c,true)==1 and G:Nearby(c,true)[1].guideId=="near");assert(c.selected==selected and G.navigationStep==arrow)
c.sightings={[9001]={active=true,at=G.Now(),mapID=84}};assert(#G:Nearby(c,true)==2)
c.sightings[9001].active=false;assert(#G:Nearby(c,true)==1)
G:QueueNearby("near");assert(c.selected==selected and G.navigationStep==arrow);assert(#G:Nearby(c,true)==0)
c.session.nearbyDismissed=nil;backend.TravelGraph.DistanceProvider=function() return nil end;assert(#G:Nearby(c,true)==0)
c.session.activeStop="other";assert(#G:Nearby(c,true)==2)
-- Leaving warning is shown once for unchanged findings; no fact is written by leaving.
G.LeaveFindings=function() return {{id="toy:999901",kind="learn",itemId=999901,label="Learn received toy"}} end
c.session.pending={guideId="near",stepId="near:act",stop={id="other",label="Hub"}};c.session.activeStop="current";c.session.leaveSeen={};c.selected=g.id
assert(G:NextStop()==false and c.session.leaveCheck);assert(G:DisplaySteps(g,c)[1].leaveCheck);assert(G:LeaveNow());assert(not c.session.leaveCheck and not G:Owned(999901));c.session.pending={guideId="near",stepId="near:act",stop={id="other",label="Hub"}};c.session.activeStop="current";assert(G:NextStop());assert(not c.session.leaveCheck)
-- GUID travel preferences filter a private routing context, preserving the helper's context.
local ctx={knowsSpell=function() return true end,hasItem=function() return true end,hasToy=function() return true end,questCompleted=function() return nil end,professionSkill=function() return nil end,talentRank=function() return nil end}
local observed;backend={Abilities={Teleports={{spellID=1,cooldown=60},{spellID=2,cooldown=1800},{spellID=3}},Hearthstones={{itemID=6948,cooldown=1200}},Items={{itemID=4,cooldown=60,consumable=true}}},GetPlayerStart=function() return {} end,GetPlayerContext=function() return ctx end,Journey={ExtrasOf=function() return {} end,Build=function(_,localCtx) observed=localCtx;return {} end,PlanEntry=function() return {} end}}
local N=G.Navigation;G:SetIntent("travelMode:"..c.guid,"conserve");N:Plan(backend,{});assert(observed.knowsSpell(1)==true and observed.knowsSpell(2)==false and observed.knowsSpell(3)==false and observed.hasItem(6948)==false and observed.hasItem(4)==false);assert(ctx.knowsSpell(2)==true)
G:SetIntent("travelMode:"..c.guid,"ordinary");N:Plan(backend,{});assert(observed.knowsSpell(1)==false)
G:SetIntent("travelMode:"..c.guid,"fastest");G:SetIntent("noTravelSpell:"..c.guid..":1",true);N:Plan(backend,{});assert(observed.knowsSpell(1)==false and observed.knowsSpell(2)==true);assert(observed.questCompleted(99)==false)
-- Older same-second receipts cannot replace a newer acknowledgment.
local guid=c.guid;local now=G.Now();local function inbox(sequence) return G.Encode({version=1,profile="receipt-fixture",revision=1,values={},ack=G.Array({}),captureAck={[guid]={id=guid..":"..now..":"..sequence,guid=guid,capturedAt=now*1000,acceptedAt=now*1000+100,sequence=sequence,status="accepted"}}}) end
assert(G:ImportInbox(inbox(2)));assert(G:ImportInbox(inbox(1)));assert(G:DB().captureAck[guid].sequence==2)
G.UI.window.nearby:Show();G.UI.window.nearbyOpportunity={};G:Event("PLAYER_REGEN_DISABLED");assert(not G.UI.window.nearby:IsShown())
G.Pack.guides=original
''')
print('Passed reliability Lua interactions: recovery return/Back/Skip/Undo, fixed reward observations, nearby range and stale sightings, stable selection, leaving warnings and GUID-scoped local travel filters. Fixtures, not in-game playtests.')
