local G=ToyboxGuides
function G:ProgressForecast(requirements,rules,c,random)
 c=c or self:Character();if random then return {status="random",label="Random drop; no guaranteed completion date.",requirements=self.Array and self.Array({}) or {},assumptions=self.Array and self.Array({}) or {}} end
 local result={requirements={},assumptions={"Assumes you complete the selected eligible activities and their access and reward rules stay unchanged."}};local unknown=false;local ready=#requirements>0;local labels={}
 for _,requirement in ipairs(requirements) do
  local out={key=requirement.key,remaining=requirement.remaining};result.requirements[#result.requirements+1]=out
  if requirement.remaining==nil then out.reason="The current balance or required amount is not established."
  elseif requirement.remaining>0 then
   ready=false;local groups={};for _,rule in ipairs(rules or {}) do
    if rule.kind==requirement.kind and rule.resourceId==requirement.resourceId and rule.sourceChecked and #(rule.sources or {})>0 and not rule.choiceRequired and not rule.modifiersUnknown and type(rule.quantity)=="number" and rule.quantity>0 and ((rule.scope=="warband")== (requirement.scope=="warband")) and (not rule.when or self:Condition(rule.when,c)==true) then
     local key=rule.sharedGroup or rule.id;local old=groups[key];if not old or rule.quantity<old.quantity then groups[key]=rule end
    end
   end
   local cadence,total,available,missing,mixed=nil,0,0,false,false
   for _,rule in pairs(groups) do
    if cadence and cadence~=rule.cadence then mixed=true end;cadence=rule.cadence;total=total+rule.quantity
    if not rule.questId then missing=true else local done=self:Condition({kind="questTurnedIn",questId=rule.questId,cadence=rule.cadence,scope=rule.scope,currentPeriodFlag=true},c);if done==nil then missing=true elseif done==false then available=available+rule.quantity end end
   end
   out.cadence=cadence
   local reset=cadence=="daily" and c.dailyResetAt or cadence=="weekly" and c.weeklyResetAt or cadence=="fortnightly" and c.archaeology and c.archaeology.endAt
   if total==0 then out.reason="No verified eligible yield is established for the selected activities."
   elseif mixed then out.reason="Selected yields use different reset schedules; a combined finish period is not established."
   elseif cadence~="once" and (not reset or reset<=self.Now()) then out.reason="The current reset boundary is not established."
   elseif missing then out.reason="Completion of part of the current set is unknown; the verified full-set yield is "..total.."."
   else local additional=requirement.remaining<=available and 0 or cadence~="once" and math.ceil((requirement.remaining-available)/total)
    if additional==false then out.reason="The known one-time rewards do not cover the remaining requirement." else
     out.additionalResets=additional;out.setsRemaining=(available>0 and 1 or 0)+additional;if additional==1 then out.nextResetAt=reset end
     labels[#labels+1]=out.setsRemaining.." "..cadence.." set"..(out.setsRemaining==1 and "" or "s").." remaining; "..additional.." additional reset"..(additional==1 and "" or "s")
    end
   end
  end
  if out.reason then unknown=true;ready=false end
 end
 result.status=ready and "ready" or (unknown or #labels==0) and "unknown" or "estimated"
 result.requirements=self.Array and self.Array(result.requirements) or result.requirements;result.assumptions=self.Array and self.Array(result.assumptions) or result.assumptions
 result.label=ready and "Known resource requirements are covered." or (unknown or #labels==0) and "Finish estimate needs more evidence." or table.concat(labels," · ");return result
end
function G:GoalForecast(g,c)
 c=c or self:Character();local planned={};local included=false;for _,id in ipairs(c.session and c.session.guides or {}) do local guide=self:Guide(id);if guide then planned[#planned+1]=guide;if id==g.id then included=true end end end;if not included then planned[#planned+1]=g end;local requirements={};for _,r in ipairs(self:ResourceAllocations(planned,c)[g.id] or {}) do local kind,id=r.key:match(":([icg]):(%d+)$");if true then requirements[#requirements+1]={key=r.key,required=r.required,remaining=r.shortfall,scope=r.scope,kind=kind=="c" and "currency" or kind=="g" and "money" or "item",resourceId=tonumber(id)} end end
 local graph=self:GraphState(g,c);local daily=graph and graph.dailySession
 if daily and daily.progress then local p=daily.progress;requirements={{key="collection:"..daily.label,required=p.total,remaining=math.max(0,p.total-p.count),scope="character",kind="item",resourceId=daily.resourceId}} end
 local rules={};for _,rule in ipairs(self.Pack.yields or {}) do if not rule.guideId or rule.guideId==g.id or rule.guideId==g.progressGuideId then local value={};for k,v in pairs(rule) do value[k]=v end;local observed=c.rewardOffers and c.rewardOffers[rule.questId];local amount=observed and observed.at<=self.Now() and self.Now()-observed.at<=300 and (rule.kind=="item" and observed.items[rule.resourceId] or observed.currencies and observed.currencies[rule.resourceId]);if type(amount)=="number" then value.quantity=amount;value.sourceChecked=true;value.modifiersUnknown=false;value.sources={"Observed game reward"} end;rules[#rules+1]=value end end
 local reputation=g.goalReputation;if reputation then requirements[#requirements+1]={key="reputation:"..reputation.factionId,required=reputation.value,remaining=self:Condition({kind="reputation",factionId=reputation.factionId,metric=reputation.metric,value=reputation.value},c)==true and 0 or nil,scope="character",kind="reputation",resourceId=reputation.factionId} end
 local result=self:ProgressForecast(requirements,rules,c,g.outcome=="random-drop")
 if daily and daily.progress and daily.fullSetYield and result.status=="unknown" then result.label=math.max(0,daily.progress.total-daily.progress.count).." seals remaining; "..daily.fullSetYield.." per verified full daily set. Today's partial yield needs reward evidence." end
 local names={[241]="Champion’s Seals",[44987]="Valiant’s Seals",[45192]="Aspirant’s Seals",[46114]="Champion’s Writs",[2003]="Dragon Isles Supplies"};for _,row in ipairs(result.requirements) do local id=tonumber(row.key:match(":(%d+)$"));row.label=row.key:match("^reputation:") and "Reputation / Renown prerequisite" or names[id] or "Resource requirement";if row.key:match("^reputation:") and row.remaining==nil then row.reason="The required standing is not established as met. Remaining reputation and its eligible yields need current threshold evidence." end end
 result.assumptions[#result.assumptions+1]="This estimates the listed resources. Remaining introductions, reward collection and learning are separate steps."
 return result
end
