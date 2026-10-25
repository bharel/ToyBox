local G=ToyboxGuides
local N={};G.Navigation=N
function N:Status()
 return {tomtom=TomTom and type(TomTom.AddWaypoint)=="function" or false,mapzeroth=self:Backend()~=nil,message=self.message,active=self.destination~=nil}
end
function N:Backend()
 local version=G.Safe(C_AddOns and C_AddOns.GetAddOnMetadata,"Mapzeroth","Version") or G.Safe(C_AddOns and C_AddOns.GetAddOnMetadata,"Mapzeroth-Rebuild","Version")
 local b=MapzerothAddon
 local semantic=type(version)=="string" and version:match("^(%d+%.%d+%.%d+)");if semantic~="2.0.3" and semantic~="2.0.4" then return nil end
 if b and b.Journey and type(b.Journey.PlanFromHere)=="function" and b.Navigation and type(b.Navigation.Sample)=="function" and type(b.Navigation.Update)=="function" and type(b.Navigation.Model)=="function" then return b end
end
function N:Yield()
 self.manualOverride=true;self.message="Your waypoint has priority. Click Navigate to resume Toybox directions."
end
function N:WatchArrow()
 if self.hooked or not TomTom or not TomTom.SetCrazyArrow or not hooksecurefunc then return end
 self.hooked=true
 hooksecurefunc(TomTom,"SetCrazyArrow",function(_,uid) if N.destination and not N.settingArrow and uid~=N.uid then N:Yield() end end)
end
function N:Clear()
 if self.uid and TomTom and TomTom.RemoveWaypoint then G.Safe(TomTom.RemoveWaypoint,TomTom,self.uid) end
 self.uid=nil;self.target=nil
 if self.nativePoint and C_Map then
  local current=G.Read(C_Map.GetUserWaypoint)
  local own=current and current.uiMapID==self.nativePoint.uiMapID and current.position and self.nativePoint.position and math.abs(current.position.x-self.nativePoint.position.x)<0.00001 and math.abs(current.position.y-self.nativePoint.position.y)<0.00001
  if own then G.Safe(C_Map.ClearUserWaypoint) end
  self.nativePoint=nil
 end
end
function N:Stop()
 self:Clear();local b=self:Backend();local owned=self.ownsBackend;if owned and b then G.Safe(b.Navigation.Stop,b.Navigation) end
 self.destination=nil;self.ownsBackend=nil;self.model=nil;self.plan=nil
 if owned and b and b.RouteLines then G.Safe(b.RouteLines.Follow,b.RouteLines,nil) end
 if owned and b and b.MinimapLines then G.Safe(b.MinimapLines.Follow,b.MinimapLines,nil) end
end
function N:Plan(b,entry)
 if type(b.GetPlayerStart)~="function" or type(b.GetPlayerContext)~="function" then return nil end
 local start=G.Safe(b.GetPlayerStart,b);local ctx=G.Safe(b.GetPlayerContext,b);if not start or not ctx then return nil end
 local localContext={};for k,v in pairs(ctx) do localContext[k]=v end;ctx=localContext
 local c=G:Character();local preferences=G.TravelPreferences and G:TravelPreferences(c) or {mode="fastest",guid=c and c.guid};local intent=G:DB().intent;local blockedItems,blockedSpells={},{}
 for _,group in ipairs({"Teleports","Hearthstones","Camps","Items"}) do for _,ability in ipairs(b.Abilities and b.Abilities[group] or {}) do
  local excluded=preferences.mode=="ordinary" or preferences.mode=="conserve" and (group=="Hearthstones" or ability.consumable or type(ability.cooldown)~="number" or ability.cooldown>=1800)
  if excluded then if ability.itemID then blockedItems[ability.itemID]=true end;if ability.spellID then blockedSpells[ability.spellID]=true end end
 end end
 local knownSpell,hasItem,hasToy=ctx.knowsSpell,ctx.hasItem,ctx.hasToy
 ctx.knowsSpell=function(id) return not blockedSpells[id] and intent["noTravelSpell:"..tostring(preferences.guid)..":"..id]~=true and G.Safe(knownSpell,id)==true end
 ctx.hasItem=function(id) return not blockedItems[id] and intent["noTravelItem:"..tostring(preferences.guid)..":"..id]~=true and G.Safe(hasItem,id)==true end
 ctx.hasToy=function(id) return not blockedItems[id] and intent["noTravelItem:"..tostring(preferences.guid)..":"..id]~=true and G.Safe(hasToy,id)==true end
 -- Unknown helper access cannot become an available verified route.
 local questCompleted,professionSkill,talentRank=ctx.questCompleted,ctx.professionSkill,ctx.talentRank
 ctx.questCompleted=function(id) return G.Safe(questCompleted,id)==true end
 ctx.professionSkill=function(id) return G.Safe(professionSkill,id) or 0 end
 ctx.talentRank=function(id) return G.Safe(talentRank,id) or 0 end
 if ctx.flightNodeFound then ctx.flightUsable=function(id) return ctx.flightNodeFound(id)==true end end
 ctx.money=G.Safe(GetMoney) or 0
 local original=ctx.cooldownRemaining
 ctx.cooldownRemaining=function(id)
  local cd=G.Read(C_Spell and C_Spell.GetSpellCooldown,id)
  if not cd or type(cd.startTime)~="number" or type(cd.duration)~="number" then return math.huge end
  return math.max(0,cd.startTime+cd.duration-(G.Safe(GetTime) or 0))
 end
 local getItemCD=C_Item and C_Item.GetItemCooldown or C_Container and C_Container.GetItemCooldown or GetItemCooldown
 ctx.itemCooldownRemaining=function(id)
  local startTime,duration=G.Read(getItemCD,id)
  if type(startTime)~="number" or type(duration)~="number" then return math.huge end
  return math.max(0,startTime+duration-(G.Safe(GetTime) or 0))
 end
 local session=G.Safe(b.Journey.Build,b.Journey,ctx,start,G.Safe(b.Journey.ExtrasOf,b.Journey,entry))
 local plan=session and G.Safe(b.Journey.PlanEntry,b.Journey,session,entry)
 if plan and plan.unaffordable then return nil end
 return plan
end
function N:Pin(d)
 if self.manualOverride or not d or not d.mapID or not d.x or not d.y then return end
 self:WatchArrow()
 local key=d.mapID..":"..d.x..":"..d.y
 if self.target==key then return end
 self:Clear();self.target=key
 if TomTom and TomTom.AddWaypoint then
  self.settingArrow=true
  self.uid=G.Safe(TomTom.AddWaypoint,TomTom,d.mapID,d.x,d.y,{title=d.label or "Toybox",persistent=false,minimap=true,world=true,crazy=true,from="Toybox"})
  if self.uid and TomTom.SetCrazyArrow then G.Safe(TomTom.SetCrazyArrow,TomTom,self.uid,15,d.label or "Toybox") end
  self.settingArrow=nil
 elseif C_Map and UiMapPoint and G.Safe(C_Map.CanSetUserWaypointOnMap,d.mapID) then
  if G.Read(C_Map.GetUserWaypoint) then self:Yield();return end
  local p=G.Safe(UiMapPoint.CreateFromCoordinates,d.mapID,d.x,d.y)
  if p then G.Safe(C_Map.SetUserWaypoint,p);self.nativePoint=G.Read(C_Map.GetUserWaypoint);G.Safe(C_SuperTrack and C_SuperTrack.SetSuperTrackedUserWaypoint,true) end
 end
end
function N:Go(d)
 if G.Safe(InCombatLockdown) then self.pending=d;return end
 self:Stop();self.manualOverride=nil;self.destination=d
 if not d then self.message="Follow the quest log or written directions; a verified destination is not available.";return end
 local b=self:Backend()
 if b then
  local dest={id="TOYBOX_DEST",mapID=d.mapID,x=d.x,y=d.y}
  local entry={name=d.label or "Toybox destination",dest=dest,nodeID=dest.id}
  local plan=self:Plan(b,entry)
  if plan and plan.assumed and #plan.assumed>0 then plan=nil;self.message="Transport access is not established. Use the destination pin or written directions." end
  if plan and plan.steps and #plan.steps>0 then
   G.Safe(b.Navigation.Start,b.Navigation,entry,plan);self.ownsBackend=true;self.plan=plan;self.entry=entry
   self.message=plan.assumed and #plan.assumed>0 and "Route contains unconfirmed travel access; check the indicated flight or phase." or "Following the available transport route."
  else self.message="No supported transport route; use the destination and written instructions." end
 else self.message="Full travel needs a supported Mapzeroth 2.0.3/2.0.4 and TomTom. Destination guidance remains available." end
 self:Pin(d)
end
function N:Preview()
 local result={};for _,step in ipairs(self.plan and self.plan.steps or {}) do if #result<12 then
  local source=step.source or step.ability or {};result[#result+1]={method=step.method or step.kind,text=step.text,itemId=source.itemID,spellId=source.spellID,consumable=source.consumable==true,fare=step.fare or source.fare}
 end end;return result
end
function N:Tick()
 if self.pending and not G.Safe(InCombatLockdown) then local d=self.pending;self.pending=nil;self:Go(d) end
 if self.manualOverride or not self.ownsBackend then return end
 local b=self:Backend();if not b then self.ownsBackend=nil;return end
 local sample=G.Safe(b.Navigation.Sample,b.Navigation)
 local model=sample and G.Safe(b.Navigation.Update,b.Navigation,sample) or G.Safe(b.Navigation.Model,b.Navigation)
 if model and model.replan then
  local plan=self:Plan(b,model.entry or self.entry)
  if plan and not (plan.assumed and #plan.assumed>0) then G.Safe(b.Navigation.Start,b.Navigation,model.entry or self.entry,plan);self.plan=plan;self.message="Route recalculated from your current location." else G.Safe(b.Navigation.Stop,b.Navigation);self.ownsBackend=nil;self.plan=nil;self:Pin(self.destination);self.message="No confirmed route from here; follow the written directions." end
  return
 end
 self.model=model
 if b.RouteLines then G.Safe(b.RouteLines.Init,b.RouteLines);G.Safe(b.RouteLines.Follow,b.RouteLines,model and not model.finished and self.plan or nil,model and model.index) end
 if b.MinimapLines then G.Safe(b.MinimapLines.Follow,b.MinimapLines,model and not model.finished and self.plan or nil,model and model.index) end
 if model and model.step and model.step.nodeID then
  local node=G.Safe(b.World.GetNode,b.World,model.step.nodeID)
  if node then self:Pin({mapID=node.mapID,x=node.x,y=node.y,label=node.name or model.destination}) else self:Pin(self.destination) end
 end
 if model and model.finished then self.message="Arrived at the destination." end
end
