local G=ToyboxGuides
function G:ReportIssue()
 local g,c=self:Current();if not g or not c then return end
 local rows=self.DisplaySteps and self:DisplaySteps(g,c) or self:Steps(g,c);local row=rows[c.cursor or 1];if not row then return end
 local d=self:DB();d.reports=d.reports or {};d.reportSequence=(d.reportSequence or 0)+1
 local latest=c.lastReport and d.reports[c.lastReport];if latest and not latest.deleted and latest.guideId==g.id and latest.stepId==row.id and self.Now()-latest.createdAt<10 then return latest.id end
 local id=d.device..":report:"..d.reportSequence
 local context={instruction=type(row.text)=="string" and row.text:sub(1,2000),questId=row.questId,quest=row.questId and c.quests and c.quests[row.questId],questFlag=row.questId and c.flags and c.flags[row.questId],turnIn=row.questId and c.turnIns[row.questId],destination=row.destination,dailyResetAt=c.dailyResetAt,weeklyResetAt=c.weeklyResetAt,navigation=self.Navigation and self.Navigation:Status(),build=self.Safe(GetBuildInfo),sources=row.sources}
 -- Only the current condition tree and relevant observations are captured.
 context.requirements=row.requires or row.when
 context.session=c.session and {activeStop=c.session.activeStop,waiting=c.session.pending~=nil}
 d.reports[id]={version=1,id=id,revision=1,profile=d.profile,guideId=g.id,stepId=row.id,createdAt=self.Now(),addonVersion=self.version,contentVersion=g.walkthrough and g.walkthrough.contentVersion or self.Pack.release,character={guid=c.guid,name=c.name,realm=c.realm,region=c.region},context=self:DataValue(context)}
 c.lastReport=id;c.history[#c.history+1]={kind="report",key=id};while #c.history>500 do table.remove(c.history,1) end
 self:Changed();return id
end
function G:SetReportNote(note)
 local c=self:Character();local r=c and self:DB().reports and self:DB().reports[c.lastReport]
 if not r or r.deleted or type(note)~="string" then return false end
 r.note=note:sub(1,2000);r.revision=(r.revision or 1)+1;self:Changed();return true
end
function G:ReportOutbox()
 local reports={};for _,r in pairs(self:DB().reports or {}) do if (r.ackRevision or 0)<(r.revision or 1) then
  local copy={};for k,v in pairs(r) do if k~="ackRevision" then copy[k]=v end end;reports[#reports+1]=copy
 end end
 table.sort(reports,function(a,b) return a.createdAt<b.createdAt end)
 while #reports>20 do table.remove(reports) end
 return self.Array and self.Array(reports) or reports
end
function G:ReportAcknowledgements(ack)
 if type(ack)~="table" then return end
 for id,revision in pairs(ack) do local r=self:DB().reports and self:DB().reports[id]
  if r and type(revision)=="number" and revision>=1 then
   r.ackRevision=math.max(r.ackRevision or 0,math.min(revision,r.revision or 1))
   if r.deleted and r.ackRevision>=r.revision then self:DB().reports[id]=nil end
  end
 end
end
