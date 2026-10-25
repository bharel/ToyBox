local G=ToyboxGuides
function G.ValidIntent(key,value)
 if type(key)~="string" or #key>160 then return false end
 if key:match("^travelMode:Player%-%d+%-%x+$") then return value=="fastest" or value=="conserve" or value=="ordinary" end
 if key:match("^noTravelItem:Player%-%d+%-%x+:%d+$") or key:match("^noTravelSpell:Player%-%d+%-%x+:%d+$") then return type(value)=="boolean" end
 if key=="budget" then return type(value)=="number" and value>=5 and value<=240 and value%1==0 end
 if key=="scale" then return type(value)=="number" and value>=0.7 and value<=1.5 end
 if key=="autoQuests" or key=="autoGossip" or key=="autoFlights" or key=="locked" or key=="includeSolo" or key=="includeGroup" or key=="includePvP" or key=="checklistExpanded" then return type(value)=="boolean" end
 local kind,id=key:match("^([^:]+):([%w_%-]+)$")
 if not kind then return false end
 if kind=="follow" or kind=="exclude" or kind=="engineering" or kind=="followToy" then return type(value)=="boolean" end
 return kind=="priority" and type(value)=="number" and value%1==0 and value>=1 and value<=3
end
-- A small JSON decoder. Imported text is data; loadstring/load are never used.
function G.Decode(s)
 if type(s)~="string" or #s>1000000 then return nil end
 local pos,nodes=1,0;local parse
 local function ws() local _,e=s:find("^[ \t\r\n]*",pos);pos=(e or pos-1)+1 end
 local function str()
  if s:sub(pos,pos)~='"' then error('quote') end
  pos=pos+1;local parts={}
  while pos<=#s do
   local ch=s:sub(pos,pos);pos=pos+1
   if ch=='"' then return table.concat(parts) end
   if ch=='\\' then
    local c=s:sub(pos,pos);pos=pos+1
    local escapes={['"']='"',['\\']='\\',['/']='/',b='\b',f='\f',n='\n',r='\r',t='\t'}
    if escapes[c] then ch=escapes[c] elseif c=='u' then
     local hex=s:sub(pos,pos+3);if not hex:match('^%x%x%x%x$') then error('escape') end;pos=pos+4
     local code=tonumber(hex,16)
     if code<128 then ch=string.char(code) elseif code<2048 then ch=string.char(192+math.floor(code/64),128+code%64) elseif code<55296 or code>57343 then ch=string.char(224+math.floor(code/4096),128+math.floor(code/64)%64,128+code%64) else error('unicode surrogate') end
    else error('escape') end
   elseif ch:byte()<32 then error('control') end
   parts[#parts+1]=ch
  end;error('string')
 end
 parse=function(depth)
  nodes=nodes+1;if nodes>40000 or depth>16 then error('limits') end;ws();local ch=s:sub(pos,pos)
  if ch=='"' then return str() elseif ch=='{' or ch=='[' then
   local object=ch=='{';local out={};pos=pos+1;ws();local finish=object and '}' or ']'
   if s:sub(pos,pos)==finish then pos=pos+1;return out end
   while true do
    ws();local key=object and str() or #out+1
    if object then ws();if s:sub(pos,pos)~=':' then error('colon') end;pos=pos+1 end
    local value=parse(depth+1);if out[key]~=nil then error('duplicate key') end;out[key]=value;ws();local endch=s:sub(pos,pos);pos=pos+1
    if endch==finish then return out elseif endch~=',' then error('comma') end
   end
  elseif s:sub(pos,pos+3)=='true' then pos=pos+4;return true elseif s:sub(pos,pos+4)=='false' then pos=pos+5;return false elseif s:sub(pos,pos+3)=='null' then pos=pos+4;return nil end
  local token=s:match('^-?%d+%.?%d*[eE]?[+-]?%d*',pos);if not token then error('value') end
  local v=tonumber(token);if not v or v~=v or v==math.huge or v==-math.huge then error('number') end;pos=pos+#token;return v
 end
 local ok,result=pcall(parse,0);ws();if ok and pos>#s then return result end
end
function G:ImportInbox(s)
 local data=self.Decode(s);local d=self:DB()
 if type(data)~="table" or data.version~=1 or type(data.profile)~="string" or #data.profile>150 or type(data.revision)~="number" or data.revision%1~=0 or type(data.values)~="table" or type(data.ack)~="table" then return false end
 if d.profile and d.profile~=data.profile or data.revision<(d.revision or 0) then return false end
 local receipts={};if data.captureAck~=nil then
  if type(data.captureAck)~="table" then return false end;local count=0
  for guid,r in pairs(data.captureAck) do count=count+1;if count>100 or type(guid)~="string" or not guid:match("^Player%-%d+%-%x+$") or type(r)~="table" or r.guid~=guid or type(r.id)~="string" or #r.id>240 or r.id:sub(1,#guid+1)~=guid..":" or r.sequence~=nil and (type(r.sequence)~="number" or r.sequence<1 or r.sequence%1~=0) or r.status~="accepted" or type(r.capturedAt)~="number" or type(r.acceptedAt)~="number" or r.capturedAt<=0 or r.acceptedAt<=0 then return false end;receipts[guid]=r end
 end
 local clean={};for k,v in pairs(data.values) do if not self.ValidIntent(k,v) then return false end;clean[k]=v end
 local acknowledged={};for _,id in ipairs(data.ack) do if type(id)~="string" or #id>240 then return false end;acknowledged[id]=true end
 d.profile=data.profile;d.revision=data.revision
 local pending={};for _,op in ipairs(d.pending) do if not acknowledged[op.id] then pending[#pending+1]=op end end
 for k,v in pairs(clean) do self:ApplyIntent(k,v) end
 d.pending=pending;for _,op in ipairs(pending) do self:ApplyIntent(op.key,op.value) end
 d.captureAck=d.captureAck or {};for guid,r in pairs(receipts) do local old=d.captureAck[guid];if not old or (r.capturedAt>(old.capturedAt or 0) or r.capturedAt==old.capturedAt and (r.sequence or 0)>=(old.sequence or 0)) then d.captureAck[guid]=r end end
 if self.ReportAcknowledgements then self:ReportAcknowledgements(data.reportAck) end
 return true
end
function G:RecipeEvidence(c)
 local out={};for id,recipe in pairs(c.recipes or {}) do local r={};for key,value in pairs(recipe) do if key~="schematic" then r[key]=value end end;out[id]=r end;return out
end
function G:ExportGuides()
 local c=self:Character();if not c then return nil end
 local nearby={};for i,row in ipairs(c.nearbyCache and c.nearbyCache.rows or {}) do if i<=10 then nearby[#nearby+1]=row end end
 local d=self:DB();local session={};for k,v in pairs(c.session or {}) do session[k]=v end;session.skipped=c.skipped;session.continued=c.continued;session.snoozed=c.snoozed
 return {version=1,guidance=self:DataValue({nearby=nearby}),session=self:DataValue(session),sync={capture=d.captures and d.captures[c.guid],ack=d.captureAck and d.captureAck[c.guid]},capabilities={"session-v1","reports-v1","guidance-v1","sync-receipts-v1"},reports=self.ReportOutbox and self:ReportOutbox() or nil,profile=d.profile,revision=d.revision,operations=self.Array and self.Array(d.pending) or d.pending,roster={guid=c.guid,name=c.name,realm=c.realm,region=c.region,classFile=c.class,at=c.at},coverage=self.Pack.coverage,observed=self:DataValue({timeUnit="unix-seconds",at=c.at,activityStarts=c.activityStarts,turnInRevisions=c.turnInRevisions,rewardOffers=c.rewardOffers,faction=c.faction,class=c.class,level=c.level,professionsAt=c.professionsAt,offers=c.offers,offersAt=c.offersAt,equipped=c.equipped,auras=c.auras,interfaces=c.interfaces,questSets=c.questSets,questFlags=c.flags,turnIns=c.turnIns,cooldownUses=c.uses,cooldownOverrides=c.cooldownOverrides,raidLockouts=c.raidLockouts,reputations=c.reputations,repTasks=c.repTasks,repTasksAt=c.repTasksAt,currencies=c.currencies,missions=c.missions,inventory=c.inventory,money=c.money,merchant=c.merchant,professions=c.professions,recipes=self:RecipeEvidence(c),quests=c.quests,professionTiers=c.professionTiers,achievements=c.achievements,sources=c.sources,calendar=c.calendar,archaeology=c.archaeology,walkthrough={version=2,release=self.Pack.release,selected=c.selected,viewStep=c.viewStep},dailyResetAt=c.dailyResetAt,weeklyResetAt=c.weeklyResetAt,questsAt=c.questsAt}),diagnostic=self:DataValue({version=self.version,errors=self.errors or {},windowOpen=self.UI.window and self.UI.window:IsShown() or false})}
end
function G:DataValue(v,depth)
 if issecretvalue and issecretvalue(v) then return nil end
 if type(v)~="table" then return type(v)~="function" and v or nil end
 if (depth or 0)>12 then return nil end
 local n,count,sequence=0,0,true
 for k in pairs(v) do count=count+1;if type(k)~="number" or k<1 or k%1~=0 then sequence=false else n=math.max(n,k) end end
 local out={};if sequence and n==count and count>0 and self.Array then self.Array(out) end
 for k,value in pairs(v) do if count<=10000 then local key=sequence and n==count and count>0 and k or tostring(k);out[key]=self:DataValue(value,(depth or 0)+1) end end
 return out
end
