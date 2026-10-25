local G=ToyboxGuides
-- Conditions are bounded data. Content imports never supply executable predicates.
function G:Condition(rule,c,depth)
 if type(rule)~="table" or (depth or 0)>12 then return nil end
 if rule.all or rule.any then
  local unknown=false
  for _,r in ipairs(rule.all or rule.any) do local value=self:Condition(r,c,(depth or 0)+1)
   if rule.all and value==false then return false elseif rule.any and value==true then return true elseif value==nil then unknown=true end
  end
  if unknown then return nil end;return rule.all~=nil
 elseif rule.negate then local value=self:Condition(rule.negate,c,(depth or 0)+1);if value~=nil then return not value end
 elseif rule.kind=="toyOwned" then return self:Owned(rule.itemId)
 elseif rule.kind=="questInLog" then if c.questsAt and self.Now()-c.questsAt<300 then return c.quests[rule.questId]~=nil end
 elseif rule.kind=="questTurnedIn" then
  if rule.cadence=="daily" or rule.cadence=="weekly" then return self:QuestDone(c,rule.questId,{cadence=rule.cadence,currentPeriodFlag=true}) end
  local flag=c.flags and c.flags[rule.questId];if flag then return flag.value end
 elseif rule.kind=="itemCount" then
  local b=c.inventory;if b and b.at and self.Now()-b.at<300 then return (b.data[rule.itemId] or 0)>=(rule.quantity or 1) end
 elseif rule.kind=="currency" then local r=c.currencies and c.currencies[rule.currencyId];if r and self.Now()-r.at<300 then return r.quantity>=(rule.quantity or 1) end
 elseif rule.kind=="recipeLearned" then local r=c.recipes and c.recipes[rule.spellId];if r then return r.learned end
 elseif rule.kind=="achievement" then
  -- Account-wide achievement completion cannot establish a character unlock.
  local r=c.achievements and c.achievements[rule.achievementId];if rule.scope=="account" and r then return r.completed end
 end
 return nil
end
function G:FollowCurrentStep(force)
 local g,c=self:Current();if not g or c.paused then return end
 local step=self:Steps(g,c)[c.cursor or 1];if not step then return end
 if self.TravelAllowed and not self:TravelAllowed(g,c,step) then return end
 local d=step.destination
 if step.waypoints and #step.waypoints>0 then d=step.waypoints[c.waypointChoices and c.waypointChoices[step.id] or 1] end
 local key=step.id..":"..(d and table.concat({d.mapID,d.x,d.y},":") or "written")
 if force or key~=self.navigationStep then
  self.navigationStep=key
  if force or not self.Navigation.manualOverride then self.Navigation:Go(d) end
 end
end
