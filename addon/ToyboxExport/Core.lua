-- Toybox Guides. Account data stays inside the client's SavedVariables account.
ToyboxGuides = {version="2.4.0", listeners={}, dirty=true}
local G=ToyboxGuides
local function public(value,depth)
 if issecretvalue and issecretvalue(value) then return nil end
 if type(value)~="table" then return value end
 if (depth or 0)>8 then return nil end
 local out,count={},0
 for k,v in pairs(value) do
  count=count+1;if count>2000 then break end
  if not (issecretvalue and issecretvalue(k)) and (type(k)=="number" or type(k)=="string") then out[k]=public(v,(depth or 0)+1) end
 end
 return out
end
function G.Safe(fn,...)
 if type(fn)~="function" then return nil end
 local ok,v,a,b,c,d=pcall(fn,...)
 if ok then
  local function readable(x) if not (issecretvalue and issecretvalue(x)) then return x end end
  return readable(v),readable(a),readable(b),readable(c),readable(d)
 end
end
function G.Read(fn,...)
 local v,a,b,c,d=G.Safe(fn,...);return public(v),public(a),public(b),public(c),public(d)
end
function G.Now() return G.Safe(GetServerTime) or 0 end
function G:DB()
 ToyboxExportDB=ToyboxExportDB or {}
 local d=ToyboxExportDB.guides
 if type(d)~="table" or d.version~=1 then
  if d~=nil then ToyboxExportDB.guidesBackup=d end
  d={version=1,characters={},owned={},intent={budget=30,followed={},excluded={},priorities={}},pending={},sequence=0,revision=0,ack={}}
  ToyboxExportDB.guides=d
 end
 d.characters=d.characters or {};d.owned=d.owned or {};d.pending=d.pending or {};d.ack=d.ack or {}
 d.intent=d.intent or {};for _,k in ipairs({"followed","excluded","priorities"}) do d.intent[k]=d.intent[k] or {} end
 d.device=d.device or ((G.Safe(UnitGUID,"player") or "local")..":"..G.Now())
 return d
end
function G:Error(event,err)
 self.errors=self.errors or {};local row={event=event,message=tostring(err):sub(1,200),at=self.Now()};self.errors[#self.errors+1]=row
 if #self.errors>20 then table.remove(self.errors,1) end
 self:DB().errors=self.errors
 self:Log("A guide action needs attention. Your saved progress is kept; /toybox diagnostics has the details.")
end
function G:Character()
 local guid=G.Safe(UnitGUID,"player")
 if type(guid)~="string" or not guid:match("^Player%-%d+%-%x+$") then return nil end
 local d=self:DB();local c=d.characters[guid]
 if not c then c={guid=guid,turnIns={},uses={},overrides={},skipped={},snoozed={},favorites={},history={}};d.characters[guid]=c end
 for _,key in ipairs({"turnIns","uses","overrides","skipped","snoozed","favorites","history"}) do c[key]=c[key] or {} end
 if c.walkthroughSchema~=2 then c.walkthroughSchema=2;c.cursor=1;c.viewStep=nil end
 c.name=G.Safe(UnitName,"player") or c.name;c.realm=G.Safe(GetRealmName) or c.realm
 local _,class=G.Safe(UnitClass,"player");c.class=class or c.class
 c.region=({"US","KR","EU","TW","CN"})[G.Safe(GetCurrentRegion) or 0] or c.region or "Unknown"
 return c
end
function G:Changed() self.workRevision=(self.workRevision or 0)+1;self.dirty=true;if self.UI and self.UI.Refresh then self.UI:Refresh() end end
function G:SetIntent(key,value)
 if not self.ValidIntent or not self.ValidIntent(key,value) then return false end
 local d=self:DB();if #d.pending>=2000 then self:Log("Sync pending guide edits before adding more.");return false end;d.sequence=d.sequence+1
 local op={id=d.device..":"..d.sequence,key=key,value=value}
 d.pending[#d.pending+1]=op
 self:ApplyIntent(key,value);self:Changed();return true
end
function G:ApplyIntent(key,value)
 local d=self:DB();local kind,id=key:match("^([^:]+):(.+)$")
 if kind=="follow" then d.intent.followed[id]=value
 elseif kind=="exclude" then d.intent.excluded[id]=value
 elseif kind=="priority" then d.intent.priorities[id]=value
 elseif kind=="engineering" then d.intent.engineering=d.intent.engineering or {};d.intent.engineering[id]=value
 elseif kind=="followToy" then d.intent.followedToys=d.intent.followedToys or {};d.intent.followedToys[tonumber(id)]=value
 else d.intent[key]=value end
end
function G:GuideIntent(kind,id)
 local values=self:DB().intent[kind] or {}
 if values[id]~=nil then return values[id] end
 self.guideAliases=self.guideAliases or {}
 if not self.guideAliasesBuilt and self.Pack then
  for _,g in ipairs(self.Pack.guides) do if g.aliasOf then local list=self.guideAliases[g.aliasOf] or {};list[#list+1]=g.id;self.guideAliases[g.aliasOf]=list end end
  self.guideAliasesBuilt=true
 end
 local value
 for _,alias in ipairs(self.guideAliases[id] or {}) do
  local v=values[alias]
  if kind=="priorities" then if v and (not value or v<value) then value=v end
  elseif v==true then return true elseif v==false then value=false end
 end
 return value
end
function G:Log(s) if DEFAULT_CHAT_FRAME then DEFAULT_CHAT_FRAME:AddMessage("|cffd9b875Toybox:|r "..s) end end
function G:Diagnostic()
 local c=self:Character();local d=self:DB()
 return self:DataValue({recorded=c and c.recorded,version=self.version,pack=self.Pack and self.Pack.version,build=G.Safe(GetBuildInfo),character=c and {guid=c.guid,name=c.name,realm=c.realm,region=c.region},revision=d.revision,pending=#d.pending,navigation=self.Navigation and self.Navigation:Status(),errors=self.errors or {},coverage=self.Pack and self.Pack.coverage})
end
