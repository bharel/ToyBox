"""Exercise Toybox's adapter against the actual pinned Mapzeroth 2.0.3 engine."""
from pathlib import Path
import os
import importlib.util,sys
sys.path.insert(0,str(Path('work/lua-runtime').resolve()))
version=os.environ.get('TOYBOX_MAPZEROTH_TEST_VERSION','2.0.3')
helper=Path('work/mapzeroth-'+version+'/tests/harness.py')
if not helper.is_file():raise SystemExit('Prepare the pinned Mapzeroth 2.0.3 source under work/mapzeroth-2.0.3 before this integration test.')
spec=importlib.util.spec_from_file_location('mapzeroth_harness',helper);h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
lua=h.new_runtime(modern=True);lua.execute(h.PRELUDE)
lua.execute('''
useRetailDistances();addon.World:Build()
GetServerTime=function() return 1792800000 end;GetTime=function() return 0 end;InCombatLockdown=function() return false end
C_AddOns={GetAddOnMetadata=function() return "2.0.3" end}
C_Spell={GetSpellCooldown=function() return {startTime=0,duration=0} end}
TomTom={AddWaypoint=function(_,m,x,y) return {m=m,x=x,y=y} end,RemoveWaypoint=function() end,SetCrazyArrow=function() end}
addon.GetPlayerContext=function() return makeCtx({level=90,class="PRIEST"}) end
addon.GetPlayerStart=function() return {id="TOYBOX_START",mapID=84,x=.5,y=.5} end
addon.Navigation.Sample=function() return {mapID=84,x=TEST_X or .5,y=.5,now=0,onTaxi=false} end
-- Map paint is tested by the helper; the adapter test runs without UI frames.
addon.RouteLines=nil;addon.MinimapLines=nil
''')
lua.execute('C_AddOns.GetAddOnMetadata=function() return "'+version+'" end')
for file in ['Core.lua','Navigation.lua']:lua.execute(Path('addon/ToyboxExport',file).read_text())
lua.execute('''
local N=ToyboxGuides.Navigation
N:Go({mapID=84,x=.6,y=.5,label="Stormwind target"})
assert(N.ownsBackend and #N.plan.steps>0,"actual helper did not produce a route")
N:Tick();assert(N.model and N.model.kind=="walk")
TEST_X=.6;N:Tick();assert(N.model.finished);assert(N.message=="Arrived at the destination.")
UnitGUID=function() return "Player-1-AA" end;UnitName=function() return "Fixture" end;GetRealmName=function() return "Realm" end;UnitClass=function() return "Priest","PRIEST" end;GetCurrentRegion=function() return 3 end
C_Map={GetMapInfo=function() return {name="Fixture map"} end,GetAreaInfo=function() return "Fixture area" end};C_Item={GetItemCooldown=function() return 0,0 end}
addon.GetPlayerStart=function() return {id="TOYBOX_START",mapID=52,x=.5,y=.5} end
local originalContext=makeCtx({level=90,class="PRIEST",faction="Alliance",items={6948},hearthNode="INN_6740"})
addon.GetPlayerContext=function() return originalContext end
local mode="fastest";ToyboxGuides.TravelPreferences=function() return {mode=mode,guid="Player-1-AA"} end
local function hearth(plan) for _,s in ipairs(plan and plan.steps or {}) do if s.method=="hearthstone" then return true end end;return false end
local entry={nodeID="INN_6740",name="Stormwind inn"}
local previousSafe=ToyboxGuides.Safe;ToyboxGuides.Safe=function(fn,...) if type(fn)~="function" then return nil end;local ok,a,b,c,d,e=pcall(fn,...);if not ok then error("Adapter swallowed: "..tostring(a)) end;return a,b,c,d,e end
local inn=addon.World:GetNode("INN_6740");entry.dest={id="TOYBOX_DEST",mapID=inn.mapID,x=inn.x,y=inn.y};entry.nodeID="TOYBOX_DEST";local fast=N:Plan(addon,entry);local methods={};for _,s in ipairs(fast and fast.steps or {}) do methods[#methods+1]=s.method end;assert(fast and hearth(fast),"ready hearthstone was not considered: "..table.concat(methods,",").." inn="..tostring(addon.World:GetNode("INN_6740")))
mode="conserve";local conserve=N:Plan(addon,entry);assert(conserve and not hearth(conserve),"conserve used a hearthstone")
mode="ordinary";assert(not hearth(N:Plan(addon,entry)));assert(originalContext.hasItem(6948),"helper context was modified")
mode="fastest";ToyboxGuides:DB().intent["noTravelItem:Player-1-AA:6948"]=true;assert(not hearth(N:Plan(addon,entry)));ToyboxGuides:DB().intent["noTravelItem:Player-1-AA:6948"]=nil
C_Item.GetItemCooldown=nil;assert(not hearth(N:Plan(addon,entry)),"unknown item cooldown was treated as ready")
C_AddOns.GetAddOnMetadata=function() return "2.0.99" end
assert(N:Backend()==nil,"unsupported internals must be rejected")
''')
print('Passed real Mapzeroth '+version+' adapter integration: context, route planning, current travel model, arrival, actual hearth routing under all three modes, item exclusions, unknown cooldown rejection, TomTom waypoint and unsupported-version fallback. This is an offline helper test, not an in-game playtest.')
