local G=ToyboxGuides
local U={};G.UI=U
local gold={0.85,0.72,0.46}
local colors={background={0.045,0.052,0.064,0.97},panel={0.08,0.09,0.11,1},border={0.26,0.27,0.29,1},ink={0.93,0.93,0.91},muted={0.59,0.63,0.68}}
local function text(parent,style)
 local f=parent:CreateFontString(nil,"OVERLAY",style or "GameFontHighlight")
 local size=style=="GameFontNormalLarge" and 18 or (style=="GameFontNormalSmall" or style=="GameFontHighlightSmall" or style=="GameFontDisableSmall") and 11 or 13
 f:SetFont(STANDARD_TEXT_FONT or "Fonts\\FRIZQT__.TTF",size,"");f:SetTextColor(unpack(colors.ink));f:SetJustifyH("LEFT");f:SetJustifyV("TOP");f:SetWordWrap(true)
 return f
end
local function backdrop(f,bg,border)
 f:SetBackdrop({bgFile="Interface\\Buttons\\WHITE8X8",edgeFile="Interface\\Buttons\\WHITE8X8",edgeSize=1,insets={left=1,right=1,top=1,bottom=1}})
 f:SetBackdropColor(unpack(bg or colors.panel));f:SetBackdropBorderColor(unpack(border or colors.border))
end
local function tooltip(b,label)
 if not label or not GameTooltip then return end
 GameTooltip:SetOwner(b,"ANCHOR_RIGHT");GameTooltip:SetText(label,1,1,1,true);GameTooltip:Show()
end
local function button(parent,label,w,fn,primary)
 local b=CreateFrame("Button",nil,parent,"BackdropTemplate");b:SetSize(w or 90,26);b:SetNormalFontObject("GameFontHighlightSmall");b:SetHighlightFontObject("GameFontHighlightSmall");b:SetText(label)
 local font=b.GetFontString and b:GetFontString();if font then font:SetFont(STANDARD_TEXT_FONT or "Fonts\\FRIZQT__.TTF",11,"");font:SetTextColor(unpack(primary and {0.12,0.11,0.08} or colors.ink)) end
 b.primary=primary;backdrop(b,primary and {0.77,0.65,0.40,1} or {0.1,0.11,0.13,0.9},primary and {0.85,0.74,0.49,1} or colors.border)
 b:SetScript("OnEnter",function(self) self:SetBackdropBorderColor(unpack(gold));self:SetBackdropColor(unpack(primary and {0.89,0.77,0.51,1} or {0.15,0.16,0.18,1}));tooltip(self,self.tip) end)
 b:SetScript("OnLeave",function(self) backdrop(self,primary and {0.77,0.65,0.40,1} or {0.1,0.11,0.13,0.9},primary and {0.85,0.74,0.49,1} or colors.border);if GameTooltip then GameTooltip:Hide() end end)
 b:SetScript("OnClick",function(...) if G.Safe(InCombatLockdown) then return end;local ok,err=pcall(fn,...);if not ok then G:Error("button:"..label,err) end end)
 return b
end
local function frame(name,title,w,h)
 local f=CreateFrame("Frame",name,UIParent,"BackdropTemplate");f:SetSize(w,h);f:SetPoint("CENTER");f:SetClampedToScreen(true);f:SetMovable(true);f:EnableMouse(true);f:RegisterForDrag("LeftButton");backdrop(f,colors.background)
 f.TitleText=text(f,"GameFontNormalSmall");f.TitleText:SetPoint("TOPLEFT",16,-13);f.TitleText:SetPoint("TOPRIGHT",-42,-13);f.TitleText:SetText(title);f.TitleText:SetTextColor(unpack(gold))
 f.accent=f:CreateTexture(nil,"ARTWORK");f.accent:SetColorTexture(gold[1],gold[2],gold[3],1);f.accent:SetHeight(2);f.accent:SetPoint("TOPLEFT",1,-1);f.accent:SetPoint("TOPRIGHT",-1,-1)
 f.CloseButton=button(f,"x",24,function() f:Hide() end);f.CloseButton:SetPoint("TOPRIGHT",-8,-7);f.CloseButton.tip="Close"
 f:SetScript("OnDragStart",function(self) if not G.Safe(InCombatLockdown) and not G:DB().intent.locked then self:StartMoving() end end)
 f:SetScript("OnDragStop",function(self) self:StopMovingOrSizing();local p,_,rp,x,y=self:GetPoint();if name=="ToyboxGuideWindow" then G:DB().position={p=p,rp=rp,x=x,y=y} end end)
 if UISpecialFrames then tinsert(UISpecialFrames,name) end
 return f
end
function U:Copy(value,title)
 if not self.copy then
  local f=frame("ToyboxCopyWindow","Toybox · Copy",560,370)
  local scroll=CreateFrame("ScrollFrame",nil,f,"UIPanelScrollFrameTemplate");scroll:SetPoint("TOPLEFT",18,-65);scroll:SetPoint("BOTTOMRIGHT",-35,20)
  local edit=CreateFrame("EditBox",nil,scroll);edit:SetMultiLine(true);edit:SetFontObject(ChatFontNormal);edit:SetWidth(490);edit:SetMaxLetters(0);edit:SetAutoFocus(false);scroll:SetScrollChild(edit);f.edit=edit
  local caption=text(f);caption:SetPoint("TOPLEFT",18,-35);caption:SetText("Select and copy with Ctrl/Cmd+C.");self.copy=f
 end
 self.copy.TitleText:SetText(title or "Toybox · Copy");self.copy.edit:SetText(value);self.copy.edit:SetHeight(math.max(250,#value/6));self.copy:Show();self.copy.edit:SetFocus();self.copy.edit:HighlightText()
end
function U:SetCompact(value)
 self.compact=value;G:DB().guideCompact=value;self.preferredHeight=nil;self:Refresh()
end
function U:ReportNote()
 if not self.noteWindow then
  local f=frame("ToyboxReportNote","Optional report note",420,180);self.noteWindow=f
  f.edit=CreateFrame("EditBox",nil,f,"InputBoxTemplate");f.edit:SetMultiLine(true);f.edit:SetSize(365,70);f.edit:SetPoint("TOPLEFT",24,-45);f.edit:SetAutoFocus(false);f.edit:SetMaxLetters(2000)
  local save=button(f,"Save note",90,function() if G:SetReportNote(f.edit:GetText()) then f:Hide();self:Refresh() end end);save:SetPoint("BOTTOMRIGHT",-20,16)
 end
 local c=G:Character();local r=c and G:DB().reports and G:DB().reports[c.lastReport];self.noteWindow.edit:SetText(r and r.note or "");self.noteWindow:Show();self.noteWindow.edit:SetFocus()
end
function U:Preparation()
 local c=G:Character();local guides={};for _,id in ipairs(G:EnsureSession(c).guides) do local guide=G:Guide(id);if guide then guides[#guides+1]=guide end end
 local allocations=G:ResourceAllocations(guides,c);local lines={"Preparation for your planned purchases","Balances are reserved once across this plan. Unknown balances are not zero. Transferable currency still belongs to its observed character until transferred.",""}
 for _,guide in ipairs(guides) do if #(allocations[guide.id] or {})>0 then lines[#lines+1]=guide.title;for _,r in ipairs(allocations[guide.id]) do
  lines[#lines+1]="  "..r.key.." · "..r.required.." required · "..(r.shortfall~=nil and r.shortfall.." still needed" or "check balance in game").." · "..r.scope
 end;lines[#lines+1]="" end end
 if #lines==3 then lines[#lines+1]="No known purchase costs in this session." end
 self:Copy(table.concat(lines,"\n"),"Toybox · Preparation")
end
function U:ToyGoal(itemId)
 if not G.GoalPaths then return end
 if not self.goalWindow then
  local f=frame("ToyboxGoalWindow","Toybox · Toy path",500,430);self.goalWindow=f
  f.summary=text(f);f.summary:SetPoint("TOPLEFT",20,-44);f.summary:SetWidth(460);f.summary:SetHeight(100)
  f.follow=button(f,"Follow toy",120,function() local id=f.itemId;local values=G:DB().intent.followedToys or {};G:SetIntent("followToy:"..id,not values[id]);self:ToyGoal(id) end);f.follow:SetPoint("BOTTOMLEFT",20,20)
  f.start=button(f,"Do next",100,function() if G:SelectGoal(f.itemId) then f:Hide();self.window:Show();self:Refresh() end end,true);f.start:SetPoint("BOTTOMRIGHT",-20,20)
  f.forecast=button(f,"Forecast",100,function() local paths=G:GoalPaths(f.itemId);if paths[1] then local v=G:GoalForecast(paths[1].guide);local lines={v.label};for _,r in ipairs(v.requirements) do lines[#lines+1]=(r.label or "Resource requirement").." · "..(r.remaining~=nil and r.remaining.." remaining" or "balance unknown")..(r.reason and "\n"..r.reason or "") end;for _,a in ipairs(v.assumptions) do lines[#lines+1]=a end;self:Copy(table.concat(lines,"\n"),"Toybox · Forecast") end end);f.forecast:SetPoint("BOTTOM",0,20)
  f.routes={};for i=1,5 do local b=button(f,"",460,function(b) if b.guide then G:Select(b.guide);f:Hide();self.window:Show();self:Refresh() end end);b:SetSize(460,38);b:SetPoint("TOPLEFT",20,-155-(i-1)*42);f.routes[i]=b end
 end
 local f=self.goalWindow;f.itemId=itemId;local paths=G:GoalPaths(itemId);local first=paths[1];local name=G.Read(C_Item and C_Item.GetItemNameByID,itemId) or "Toy #"..itemId
 local lines={name,G:Owned(itemId) and "Learned in your collection." or first and ("Next: "..(first.next and first.next.text or first.reason)) or "This toy still needs an authored acquisition path."}
 if first then local costs=G:ResourceAllocations({first.guide})[first.guide.id];for _,r in ipairs(costs) do lines[#lines+1]=tostring(r.required).." required · "..(r.shortfall~=nil and r.shortfall.." still needed" or "balance unknown") end end
 if first and G.GoalForecast then lines[#lines+1]=G:GoalForecast(first.guide).label end
 f.summary:SetText(table.concat(lines,"\n"));f.follow:SetText((G:DB().intent.followedToys or {})[itemId] and "Unfollow toy" or "Follow toy");f.start:SetEnabled(first~=nil and not G:Owned(itemId))
 for i,b in ipairs(f.routes) do local path=paths[i];if path then b.guide=path.guide.id;b:SetText(path.guide.title.." · "..path.state.."\n"..(path.sourceChecked and "Source-checked path" or "Upstream walkthrough gaps remain"));b:Show() else b:Hide() end end;f:Show()
end
function U:RecoveryChoices()
 if not self.recoveryWindow then local f=frame("ToyboxRecoveryWindow","Toybox · I'm stuck",420,310);self.recoveryWindow=f;f.rows={};for i=1,5 do local b=button(f,"",380,function(b) if G:BeginRecovery(b.reason) then f:Hide() end end);b:SetPoint("TOPLEFT",20,-45-(i-1)*43);b:SetHeight(34);f.rows[i]=b end end
 local choices=G:RecoveryOptions();for i,b in ipairs(self.recoveryWindow.rows) do local option=choices[i];if option then b.reason=option.id;b:SetText(option.label);b:Show() else b:Hide() end end;self.recoveryWindow:Show()
end
function U:NearbyChoice(row)
 if not self.nearbyWindow then
  local f=frame("ToyboxNearbyWindow","Toybox · Nearby",450,190);self.nearbyWindow=f;f.label=text(f);f.label:SetPoint("TOPLEFT",20,-45);f.label:SetSize(410,65)
  local add=button(f,"Add after this stop",150,function() G:QueueNearby(f.row.guideId);f:Hide() end,true);add:SetPoint("BOTTOMLEFT",20,20)
  local detail=button(f,"Details",90,function() local g=G:Guide(f.row.guideId);self:Copy(g.title.."\n"..(g.details or "").."\n"..(g.source or ""),"Toybox · Nearby details") end);detail:SetPoint("BOTTOMLEFT",180,20)
  local dismiss=button(f,"Dismiss",90,function() G:DismissNearby(f.row.guideId);f:Hide() end);dismiss:SetPoint("BOTTOMRIGHT",-20,20)
 end
 self.nearbyWindow.row=row;self.nearbyWindow.label:SetText(row.label.."\n"..(row.sameStop and "At this stop" or math.floor(row.distance or 0).." yards away").." · your current activity and waypoint stay selected.");self.nearbyWindow:Show()
end
function U:TravelSettings(page)
 page=page or 1
 if not self.travelWindow then
  local f=frame("ToyboxTravelWindow","Toybox · Travel",480,490);self.travelWindow=f;f.rows={}
  for i,mode in ipairs({"fastest","conserve","ordinary"}) do local b=button(f,({fastest="Fastest verified",conserve="Conserve cooldowns",ordinary="Ordinary travel"})[mode],140,function() G:SetIntent("travelMode:"..G:Character().guid,mode);G.navigationStep=nil;self:TravelSettings() end);b:SetPoint("TOPLEFT",20+(i-1)*147,-45);f[mode]=b end
  f.label=text(f);f.label:SetPoint("TOPLEFT",20,-86);f.label:SetSize(440,40)
  for i=1,8 do local b=button(f,"",440,function(b) G:SetIntent(b.key,G:DB().intent[b.key]~=true);G.navigationStep=nil;self:TravelSettings(self.travelWindow.page) end);b:SetPoint("TOPLEFT",20,-135-(i-1)*33);f.rows[i]=b end
  local previous=button(f,"Previous",80,function() self:TravelSettings(math.max(1,f.page-1)) end);previous:SetPoint("BOTTOMLEFT",20,20)
  local next=button(f,"Next",80,function() self:TravelSettings(f.page+1) end);next:SetPoint("BOTTOMLEFT",110,20)
  local preview=button(f,"Route preview",130,function() local lines={"Supported route preview"};local fare=G.Navigation.plan and G.Navigation.plan.fare;if type(fare)=="number" and fare>0 then lines[#lines+1]="Total known flight fare: "..fare.." copper" end;for _,step in ipairs(G.Navigation:Preview()) do lines[#lines+1]=(step.text or step.method or "Travel")..(step.consumable and " · consumes an item" or "")..(step.fare and " · fare "..step.fare.." copper" or "") end;if #lines==1 then lines[#lines+1]="No verified transport route is active. Follow the written directions and destination pin." end;self:Copy(table.concat(lines,"\n"),"Toybox · Travel") end);preview:SetPoint("BOTTOMRIGHT",-20,20)
 end
 local f=self.travelWindow;local c=G:Character();local preferences=G:TravelPreferences(c);f.label:SetText("Selected: "..preferences.mode..". Click a travel source to exclude or allow it. Travel always requires your action.")
 local b=G.Navigation:Backend();local entries={};local seen={};for _,group in ipairs({"Teleports","Hearthstones","Camps","Items"}) do for _,ability in ipairs(b and b.Abilities and b.Abilities[group] or {}) do
  local kind,id=ability.itemID and "Item" or "Spell",ability.itemID or ability.spellID;local key=id and "noTravel"..kind..":"..c.guid..":"..id
  if key and not seen[key] then seen[key]=true;entries[#entries+1]={key=key,label=(kind=="Item" and G.Read(C_Item and C_Item.GetItemNameByID,id) or kind=="Spell" and G.Read(C_Spell and C_Spell.GetSpellName,id)) or kind.." #"..id} end
 end end;table.sort(entries,function(a,b)return a.label<b.label end);f.page=math.max(1,math.min(page,math.max(1,math.ceil(#entries/8))))
 for i,row in ipairs(f.rows) do local entry=entries[(f.page-1)*8+i];if entry then row.key=entry.key;row:SetText((G:DB().intent[entry.key] and "Excluded · " or "Allowed · ")..entry.label);row:Show() else row:Hide() end end;f:Show()
end
function U:SyncStatus()
 local c=G:Character();local d=G:DB();local capture=d.captures and d.captures[c.guid];local ack=d.captureAck and d.captureAck[c.guid]
 local lines={"Live capture and last acknowledged upload","Last capture: "..(capture and date("%c",capture.at) or "not captured yet"),"Capture ID: "..(capture and capture.id or "unknown"),"Last accepted capture: "..(ack and ack.id or "not acknowledged"),"Accepted at: "..(ack and ack.acceptedAt and date("%c",ack.acceptedAt/1000) or "unknown"),"","WoW writes snapshots at /reload, logout or exit. The addon cannot inspect its saved file or contact the website. An acknowledgment is last known status from the companion inbox, not a live connection."}
 self:Copy(table.concat(lines,"\n"),"Toybox · Sync status")
end
function U:Menu()
 self:Ensure();if self.menu and self.menu:IsShown() then self.menu:Hide();return end
 if not self.menu then
  local m=frame("ToyboxGuideMenu","Guide actions",224,468);self.menu=m;m:SetFrameStrata("DIALOG")
  local choices={
   {"Choose another activity",function() self:Library("guides") end},
   {"Today's plan",function() self:Library("today") end},
   {"Skip this step",function() G:Skip() end},
   {"Snooze this activity",function() G:Command("snooze","") end},
   {"Undo last action",function() G:Undo() end},
   {"Replan Today",function() if G.ReplanSession then G:ReplanSession() else local c=G:Character();c.selected=nil;c.cursor=1;G.dirty=true;self:Refresh() end end},
   {"Compact / expanded",function() self:SetCompact(not self.compact) end},
   {"Lock / unlock position",function() G:SetIntent("locked",not G:DB().intent.locked) end},
   {"Toy library",function() self:Library("toys") end},
   {"Settings",function() self:Settings() end},
   {"Activity details",function() self:Details() end},
   {"Sync status",function() self:SyncStatus() end},
   {"Export diagnostics",function() self:Copy(G.Encode(G:Diagnostic()),"Toybox diagnostics") end}
  }
  m.actions={};for i,row in ipairs(choices) do local b=button(m,row[1],192,function() m:Hide();row[2]() end);b:SetPoint("TOPLEFT",16,-42-(i-1)*31);m.actions[i]=b end
 end
 self.menu:ClearAllPoints();self.menu:SetPoint("TOPRIGHT",self.window,"BOTTOMRIGHT",0,-6);self.menu:Show()
end
function U:Ensure()
 if self.window then return end
 local d=G:DB()
 if d.guideAppearanceVersion~=1 then d.previousGuideSize=d.size;d.size={410,340};d.guideAppearanceVersion=1 end
 local size=d.size or {410,340};self.compact=d.guideCompact==true
 local f=frame("ToyboxGuideWindow","TOYBOX",math.max(340,math.min(620,size[1] or 410)),340);self.window=f;f:Hide();f:SetFrameStrata("MEDIUM")
 f.TitleText:ClearAllPoints();f.TitleText:SetPoint("TOPLEFT",18,-15);f.TitleText:SetWidth(72)
 f.today=button(f,"Today",58,function() self:Library("today") end);f.today:SetPoint("TOPLEFT",91,-8);f.today.tip="Choose from today's activities"
 f.pause=button(f,"II",26,function() local c=G:Character();c.paused=not c.paused;if c.paused then G.Navigation:Stop() end;self:Refresh() end);f.pause:SetPoint("TOPRIGHT",-72,-7);f.pause.tip="Pause guide"
 f.more=button(f,"...",26,function() self:Menu() end);f.more:SetPoint("TOPRIGHT",-40,-7);f.more.tip="More actions, compact mode and settings"
 f:SetResizable(true);if f.SetResizeBounds then f:SetResizeBounds(340,190,620,680) end
 local p=d.position;if p then f:ClearAllPoints();f:SetPoint(p.p,UIParent,p.rp,p.x,p.y) end
 local grip=CreateFrame("Button",nil,f);grip:SetSize(16,16);grip:SetPoint("BOTTOMRIGHT",-2,2);grip:SetNormalTexture("Interface\\ChatFrame\\UI-ChatIM-SizeGrabber-Up");f.grip=grip
 grip:SetScript("OnMouseDown",function() if not G.Safe(InCombatLockdown) and not d.intent.locked then self.resizing=true;f:StartSizing("BOTTOMRIGHT") end end)
 grip:SetScript("OnMouseUp",function() f:StopMovingOrSizing();self.resizing=nil;self.preferredHeight=f:GetHeight();d.size={f:GetWidth(),f:GetHeight()};self:Refresh() end)
 f:SetScript("OnSizeChanged",function() if not self.layoutBusy then self:Refresh() end end)
 f.location=text(f,"GameFontNormalSmall");f.location:SetTextColor(unpack(colors.muted))
 f.title=text(f,"GameFontNormalLarge");f.title:SetTextColor(unpack(gold))
 f.actionScroll=CreateFrame("ScrollFrame",nil,f);f.actionContent=CreateFrame("Frame",nil,f.actionScroll);f.actionScroll:SetScrollChild(f.actionContent);f.actionScroll:EnableMouseWheel(true)
 f.action=text(f.actionContent);f.action:SetFont(STANDARD_TEXT_FONT or "Fonts\\FRIZQT__.TTF",15,"");f.action:SetPoint("TOPLEFT");f.action:SetPoint("TOPRIGHT")
 f.actionScroll:SetScript("OnMouseWheel",function(scroll,delta) local max=math.max(0,f.actionContent:GetHeight()-scroll:GetHeight());scroll:SetVerticalScroll(math.max(0,math.min(max,(scroll:GetVerticalScroll() or 0)-delta*24))) end)
 f.counter=text(f,"GameFontHighlightSmall");f.counter:SetTextColor(unpack(colors.ink))
 f.daily=text(f,"GameFontHighlightSmall");f.daily:SetTextColor(unpack(colors.muted))
 f.remaining=text(f,"GameFontHighlightSmall");f.remaining:SetJustifyH("RIGHT");f.remaining:SetTextColor(unpack(colors.muted))
 f.progress=CreateFrame("StatusBar",nil,f);f.progress:SetStatusBarTexture("Interface\\Buttons\\WHITE8X8");f.progress:SetStatusBarColor(unpack(gold));f.progress:SetMinMaxValues(0,1);f.progress:SetValue(0)
 f.progress.background=f.progress:CreateTexture(nil,"BACKGROUND");f.progress.background:SetAllPoints();f.progress.background:SetColorTexture(.16,.18,.21,1)
 f.travel=text(f,"GameFontNormalSmall");f.travel:SetTextColor(.63,.75,.85)
 f.rewardRow=CreateFrame("Frame",nil,f,"BackdropTemplate");backdrop(f.rewardRow,{.075,.085,.10,1},{.20,.22,.25,1})
 f.reward=CreateFrame("Button",nil,f.rewardRow);f.reward:SetSize(32,32);f.reward:SetPoint("LEFT",10,0)
 f.reward.icon=f.reward:CreateTexture(nil,"ARTWORK");f.reward.icon:SetAllPoints();f.reward.icon:SetTexCoord(.07,.93,.07,.93)
 f.reward.caption=text(f.rewardRow,"GameFontNormalSmall");f.reward.caption:SetFont(STANDARD_TEXT_FONT or "Fonts\\FRIZQT__.TTF",9,"");f.reward.caption:SetText("TOY REWARD");f.reward.caption:SetTextColor(unpack(colors.muted));f.reward.caption:SetPoint("TOPLEFT",52,-9)
 f.reward.label=text(f.rewardRow);f.reward.label:SetPoint("TOPLEFT",52,-23);f.reward.label:SetPoint("TOPRIGHT",-10,-23)
 f.reward:SetScript("OnEnter",function(b) if b.itemID and GameTooltip then GameTooltip:SetOwner(b,"ANCHOR_RIGHT");GameTooltip:SetItemByID(b.itemID);GameTooltip:Show() end end);f.reward:SetScript("OnLeave",function() if GameTooltip then GameTooltip:Hide() end end)
 f.reward:SetScript("OnClick",function(b) if b.itemID then local _,link=G.Safe(GetItemInfo,b.itemID);if G.Safe(IsShiftKeyDown) and link and ChatEdit_InsertLink then ChatEdit_InsertLink(link) else self:Copy("https://www.wowhead.com/item="..b.itemID,"Open this toy on Wowhead") end end end)
 f.next=text(f,"GameFontHighlightSmall");f.next:SetTextColor(unpack(colors.muted))
 f.use=CreateFrame("Button",nil,f,"SecureActionButtonTemplate,BackdropTemplate");f.use:SetSize(190,26);f.use:RegisterForClicks("AnyUp","AnyDown");f.use:SetNormalFontObject("GameFontHighlightSmall");backdrop(f.use,{.18,.23,.27,1});f.use:SetText("Use travel action");f.use:Hide()
 f.status=text(f,"GameFontNormalSmall");f.status:SetTextColor(unpack(colors.muted))
 f.divider=f:CreateTexture(nil,"ARTWORK");f.divider:SetColorTexture(.22,.24,.27,1);f.divider:SetHeight(1)
 f.back=button(f,"Back",44,function() G:Back() end);f.back.tip="Previous action or restore the last skipped step"
 f.skip=button(f,"Skip",44,function() G:Skip() end);f.skip.tip="Move to the next eligible step without completing this one"
 f.undo=button(f,"Undo",44,function() G:Undo() end);f.undo.tip="Undo the last skip, Continue or manual cooldown entry"
 f.details=button(f,"Details",52,function() self:Details() end)
 f.pin=button(f,"Next pin",72,function() G:CycleWaypoint() end);f.pin:Hide()
 f.nextButton=button(f,"Continue",88,function() local g,c=G:Current();if g and g.walkthrough then G:Continue() elseif g then c.cursor=math.min(#G:Steps(g,c),(c.cursor or 1)+1);self:Refresh() end end,true);f.nextButton.tip="Browse to the next action; this does not mark anything complete"
 f.activities=button(f,"Activities",80,function() self:Library("today") end);f.activities.tip="Choose another activity from Today"
 f.nextStop=button(f,"Next stop",80,function() G:NextStop() end,true);f.nextStop.tip="Start the next stop when you're ready"
 f.anotherBlock=button(f,"Another block",100,function() G:AnotherFarmBlock() end);f.anotherBlock:Hide()
 f.checklistToggle=button(f,"Checklist",90,function() G:SetIntent("checklistExpanded",not self.checklistOpen);self:Refresh() end)
 f.prepare=button(f,"Preparation",90,function() self:Preparation() end)
 f.stuck=button(f,"I'm stuck",90,function() self:RecoveryChoices() end)
 f.nearby=button(f,"",350,function() if f.nearbyOpportunity then self:NearbyChoice(f.nearbyOpportunity) end end)
 f.finishHere=button(f,"Finish here",100,function() G:FinishHere() end,true)
 f.leaveNow=button(f,"Leave for now",110,function() G:LeaveNow() end)
 f.checklistScroll=CreateFrame("ScrollFrame",nil,f,"UIPanelScrollFrameTemplate");f.checklistContent=CreateFrame("Frame",nil,f.checklistScroll);f.checklistScroll:SetScrollChild(f.checklistContent);f.checklistScroll:SetScript("OnVerticalScroll",function() self:UpdateChecklistRows() end)
 f.checklistRows={};for i=1,40 do local b=button(f.checklistContent,"",350,function(self) if self.op then G:SelectOpportunity(self.op) end end);b:SetPoint("TOPLEFT",0,-(i-1)*32);b:SetSize(350,28);f.checklistRows[i]=b end
 f.report=button(f,"This instruction is wrong",175,function() local id=G.ReportIssue and G:ReportIssue();if id then self:Refresh() end end);f.report.tip="Save a private report. Add an optional note or Undo. Upload happens after reload when paired."
 f.reportNote=button(f,"Add note",68,function() self:ReportNote() end)
 f.auto=text(f,"GameFontNormalSmall");f.auto:SetJustifyH("RIGHT");f.auto:SetTextColor(.52,.72,.61)
 f.footer=text(f,"GameFontDisableSmall");f.footer:SetTextColor(unpack(colors.muted))
 f:SetScript("OnHide",function() if self.menu then self.menu:Hide() end end);f:Hide()
end
local function measured(font,width,fallback)
 font:SetWidth(width);local h=font.GetStringHeight and font:GetStringHeight();return type(h)=="number" and math.max(fallback or 14,h) or fallback or 14
end
function U:Layout()
 if self.layoutBusy then return end;self.layoutBusy=true
 local f=self.window;local width=f:GetWidth();local inner=width-36;local y=46
 local function place(item,x,top,w,h) item:ClearAllPoints();item:SetPoint("TOPLEFT",f,"TOPLEFT",x,-top);if w then item:SetWidth(w) end;if h then item:SetHeight(h) end end
 if self.compact then f.location:Hide();f.title:Hide() else
  f.location:Show();place(f.location,18,y,inner,14);y=y+23
  f.title:Show();local h=math.min(44,measured(f.title,inner,22));place(f.title,18,y,inner,h);y=y+h+14
 end
 local actionHeight=measured(f.action,inner,20);local viewport=math.min(actionHeight,self.tightLayout and 40 or self.compact and 100 or self.checklistOpen and 100 or 160)
 f.actionContent:SetSize(inner,actionHeight);place(f.actionScroll,18,y,inner,viewport);f.action:SetHeight(actionHeight)
 if f.actionScroll.GetVerticalScroll and f.actionScroll:GetVerticalScroll()>math.max(0,actionHeight-viewport) then f.actionScroll:SetVerticalScroll(0) end
 y=y+viewport+14
 if f.hasProgress then
  f.counter:Show();f.remaining:Show();f.progress:Show();place(f.counter,18,y,inner-88,16);place(f.remaining,width-106,y,88,16);y=y+22;place(f.progress,18,y,inner,4);y=y+17
 elseif f.hasCounters then f.counter:Show();f.remaining:Hide();f.progress:Hide();local h=measured(f.counter,inner,14);place(f.counter,18,y,inner,h);y=y+h+12
 else f.counter:Hide();f.remaining:Hide();f.progress:Hide() end
 if f.hasDaily then f.daily:Show();local h=math.min(32,measured(f.daily,inner,14));place(f.daily,18,y,inner,h);y=y+h+12 else f.daily:Hide() end
 if f.hasTravel and not self.compact then f.travel:Show();local h=math.min(28,measured(f.travel,inner,14));place(f.travel,18,y,inner,h);y=y+h+12 else f.travel:Hide() end
 if f.hasPins then f.pin:Show();place(f.pin,18,y,72,26);y=y+38 else f.pin:Hide() end
 if f.reward.itemID and not self.compact then f.rewardRow:Show();local h=math.max(52,measured(f.reward.label,inner-64,16)+32);place(f.rewardRow,18,y,inner,h);y=y+h+12 else f.rewardRow:Hide() end
 if f.hasNext and not self.compact then f.next:Show();local h=math.min(self.tightLayout and 14 or 28,measured(f.next,inner,14));place(f.next,18,y,inner,h);y=y+h+12 else f.next:Hide() end
 if f.use:IsShown() then place(f.use,18,y,math.min(230,inner),26);y=y+38 end
 if f.hasStatus and not self.compact and not self.tightLayout then f.status:Show();local h=math.min(42,measured(f.status,inner,14));place(f.status,18,y,inner,h);y=y+h+12 else f.status:Hide() end
 if f.leaveCheck then f.finishHere:Show();f.leaveNow:Show();place(f.finishHere,18,y,100,26);place(f.leaveNow,126,y,110,26);y=y+34 else f.finishHere:Hide();f.leaveNow:Hide() end
 if f.nearbyOpportunity and not self.compact and not self.tightLayout then f.nearby:Show();f.nearby:SetText("Nearby · "..f.nearbyOpportunity.label);place(f.nearby,18,y,inner,26);y=y+34 else f.nearby:Hide() end
 if not f.canContinue and not f.atEnd and not self.tightLayout then f.auto:Show();place(f.auto,18,y,inner,14);y=y+22 else f.auto:Hide() end
 if G.SessionChecklist then
  f.checklistToggle:Show();place(f.checklistToggle,18,y,90,24);f.prepare:Show();place(f.prepare,114,y,90,24);f.stuck:Show();place(f.stuck,210,y,math.min(90,inner-192),24);y=y+30
  if self.checklistOpen then
   f.checklistScroll:Show();local h=math.max(32,math.min(160,#(f.checklist or {})*32,680-y-136));place(f.checklistScroll,18,y,inner-22,h);f.checklistContent:SetSize(inner-22,math.max(32,#(f.checklist or {})*32));y=y+h+10
   for _,b in ipairs(f.checklistRows) do b:SetWidth(inner-22) end
  else f.checklistScroll:Hide() end
 else f.checklistToggle:Hide();f.prepare:Hide();f.checklistScroll:Hide() end
 f.report:Show();place(f.report,18,y,175,24)
 if f.hasReport then f.reportNote:Show();place(f.reportNote,199,y,68,24) else f.reportNote:Hide() end;y=y+32
 if f.farmEnded then f.anotherBlock:Show();place(f.anotherBlock,18,y,100,24);y=y+30 else f.anotherBlock:Hide() end
 if y+72>680 and not self.tightLayout then self.layoutBusy=nil;self.tightLayout=true;self:Layout();self.tightLayout=nil;return end
 local target=math.min(680,math.max(self.compact and 190 or 250,y+72,self.preferredHeight or 0))
 if not self.resizing and math.abs(f:GetHeight()-target)>1 then f:SetHeight(target) end
 local foot=f:GetHeight()-61;place(f.divider,18,foot-9,inner,1);place(f.back,18,foot,44,26);place(f.skip,68,foot,44,26);place(f.undo,118,foot,44,26);place(f.details,168,foot,52,26)
 if f.canContinue then f.nextButton:Show();place(f.nextButton,width-98,foot,80,26) else f.nextButton:Hide() end
 if f.atEnd and not f.stopTransition and not f.leaveCheck then f.activities:Show();place(f.activities,width-98,foot,80,26) else f.activities:Hide() end
 if f.stopTransition then f.nextStop:Show();place(f.nextStop,width-98,foot,80,26) else f.nextStop:Hide() end
 place(f.footer,18,f:GetHeight()-24,inner-12,14)
 self.layoutBusy=nil
end
function U:UpdateChecklistRows()
 local f=self.window;if not f or not f.checklist then return end
 local offset=math.max(0,math.min(math.max(0,#f.checklist-#f.checklistRows),math.floor((f.checklistScroll:GetVerticalScroll() or 0)/32)))
 local names={['ready-turnin']="Turn in",['objectives-finished']="Objectives finished",accepted="Accepted",available="Available",completed="Done",deferred="Deferred",unknown="Check in game",['cooling-down']="Upcoming"}
 for i,b in ipairs(f.checklistRows) do local op=f.checklist[i+offset];b:ClearAllPoints();b:SetPoint("TOPLEFT",0,-(i+offset-1)*32);if op then b.op=op;b:SetText((names[op.state] or op.state).." · "..op.label);b.tip=(op.stop and op.stop.label or "").."\n"..(op.reason or "");b:SetEnabled(op.available or op.selectable);b:SetAlpha((op.available or op.selectable) and 1 or .55);b:Show() else b.op=nil;b:Hide() end end
end
function U:Refresh()
 if not self.window or not self.window:IsShown() or G.Safe(InCombatLockdown) then return end
 if G.ResolveCurrent then G:ResolveCurrent() end
 local f=self.window;local g,c=G:Current();local plan=G:Plan()
 if not c then return end
 if not g then
  f.stopTransition=false;f.farmEnded=false;f.leaveCheck=nil;f.nearbyOpportunity=nil;f.checklist={};for _,b in ipairs(f.checklistRows) do b:Hide() end;f.title:SetText("Your plan is clear");f.action:SetText("Choose a toy or activity from Today.");f.location:SetText(c.name or "Character");f.hasProgress=false;f.hasCounters=false;f.hasDaily=false;f.hasTravel=false;f.hasNext=false;f.hasStatus=false;f.reward.itemID=nil;f.use:Hide();f.canContinue=false;f.atEnd=true;f.hasPins=false;f.back:SetEnabled(false);f.skip:SetEnabled(false);f.undo:SetEnabled(#c.history>0);f.auto:SetText("Choose an activity");f.footer:SetText("Today · "..plan.budget.." min available");self:Layout();return
 end
 local rows=G.DisplaySteps and G:DisplaySteps(g,c) or G:Steps(g,c);c.cursor=math.min(c.cursor or 1,#rows)
 if c.viewGuide==g.id and c.viewStep then local found;for i,row in ipairs(rows) do if row.id==c.viewStep then found=i end end;c.cursor=found or 1 end
 local s=rows[c.cursor];c.viewGuide=g.id;c.viewStep=s and s.id
 f.stopTransition=s and s.stopTransition;f.farmEnded=s and s.farmEnded
 f.leaveCheck=s and s.leaveCheck
 local suppress=G.Safe(InCombatLockdown) or c.dialogOpen or c.interfaces and c.interfaces.merchant and c.interfaces.merchant.open
 f.nearbyOpportunity=not suppress and G.Nearby and G:Nearby(c)[1] or nil
 f.hasReport=c.lastReport and G:DB().reports and G:DB().reports[c.lastReport] and not G:DB().reports[c.lastReport].deleted
 f.report:SetText(f.hasReport and "Report saved · Undo available" or "This instruction is wrong")
 self.checklistOpen=G:DB().intent.checklistExpanded;if self.checklistOpen==nil then self.checklistOpen=not self.compact end
 f.checklistToggle:SetText(self.checklistOpen and "Hide checklist" or "Checklist")
 f.checklist=G.SessionChecklist and G:SessionChecklist() or {}
 self:UpdateChecklistRows()
 if f.lastActionID~=(s and s.id) then f.actionScroll:SetVerticalScroll(0);f.lastActionID=s and s.id end
 local state,reason=G:Eligibility(g,c)
 local canBack=s and s.recovering or G:CanBack(g,c,rows);f.back:SetEnabled(canBack);f.back:SetAlpha(canBack and 1 or .35)
 local canSkip=s and not s.endOfSteps and not c.paused;f.skip:SetEnabled(canSkip);f.skip:SetAlpha(canSkip and 1 or .35)
 f.undo:SetEnabled(#c.history>0);f.undo:SetAlpha(#c.history>0 and 1 or .35)
 if s and G.Instruction then local row={};for k,v in pairs(s) do row[k]=v end;row.text=G:Instruction(s,c);s=row end
 if G.FollowCurrentStep and not c.paused then G:FollowCurrentStep() end
 f.location:SetText((c.name or "Character").."  /  "..(G:Location(g) or ""));f.title:SetText(G:Title(g,c))
 local instruction=s and s.text or reason
 if G.SessionSummary and s and s.endOfSteps and not s.stopTransition and not s.farmEnded then local summary=G:SessionSummary();if summary.remaining==0 then instruction=(summary.state=="nothing-ready" and "Nothing else is currently ready." or "Planned progress finished.").."\n"..summary.completed.." completed · "..summary.deferred.." deferred · "..summary.unknown.." upcoming or needing a check." end end
 f.action:SetText(c.paused and "Guide paused. Resume when you're ready." or instruction)
 f.pause:SetText(c.paused and ">" or "II");f.pause.tip=c.paused and "Resume guide" or "Pause guide"
 f.hasProgress=s and type(s.count)=="number" and type(s.total)=="number" and s.total>0 or false;f.hasCounters=s and s.counters and s.counters~="" or false
 f.counter:SetText(s and s.counters or "")
 if f.hasProgress then f.progress:SetMinMaxValues(0,s.total);f.progress:SetValue(math.min(s.count,s.total));f.remaining:SetText(math.max(0,s.total-s.count).." remaining") end
 local daily=s and (s.progressSummary or s.dailyProgress);local long=s and s.longTermProgress
 f.hasDaily=daily~=nil;f.daily:SetText(daily and daily..(long and long.total>0 and ("\n"..long.counters.." · "..(long.carryText or "carries over each day")) or "") or "")
 local n=G.Navigation;local nav=n.model;local travel
 if not c.paused and nav and nav.step and nav.step.text then travel=nav.step.text..(nav.distance and (" · "..math.floor(nav.distance).." yd") or "")
 elseif s and s.destination then local d=s.destination;local map=G.Read(C_Map and C_Map.GetMapInfo,d.mapID);travel=(d.label or map and map.name or "Destination").." · "..string.format("%.1f, %.1f",d.x*100,d.y*100) end
 f.hasTravel=travel~=nil;f.travel:SetText(travel or "")
 local source=not c.paused and (s and s.kind=="accept" and s.itemId and {itemID=s.itemId} or nav and nav.kind=="ability" and nav.step and nav.step.source)
 if source and (source.itemID or source.spellID) then
  f.use:SetAttribute("type",source.itemID and "item" or "spell");f.use:SetAttribute("item",source.itemID and "item:"..source.itemID or nil);f.use:SetAttribute("spell",source.spellID);f.use:SetText(s and s.kind=="accept" and s.itemId and "Use quest item" or nav.step.text or "Use travel action");f.use:Show()
 else f.use:Hide() end
 local reward=g.system=="archaeology" and c.archaeology and c.archaeology.endAt and c.archaeology.endAt>G.Now() and c.archaeology.itemId or G:Missing(g)[1];f.reward.itemID=reward
 if reward then f.reward.label:SetText(G.Safe(C_Item and C_Item.GetItemNameByID,reward) or "Toy item #"..reward);f.reward.icon:SetTexture(G.Safe(C_Item and C_Item.GetItemIconByID,reward) or 134400) end
 local nextStep=rows[c.cursor+1];f.hasNext=nextStep~=nil;f.next:SetText(nextStep and "Next  ·  "..(G.Instruction and G:Instruction(nextStep,c) or nextStep.text) or "")
 f.hasStatus=c.paused or state=="blocked" or state=="upcoming" and not daily;f.status:SetText(c.paused and "Your place is saved." or reason)
 f.atEnd=s and s.endOfSteps==true;f.canContinue=s and s.manual==true and s.available~=false and not f.atEnd and not c.paused;f.hasPins=s and s.waypoints and #s.waypoints>1 or false
 f.auto:SetText(c.paused and "Paused" or state=="upcoming" and (daily and "Waiting for daily reset" or "Cooling down") or s and s.available==false and "Needs an observation" or f.hasProgress and "Tracking progress" or "Updates automatically")
 local block=G.IsOpenFarm and G:IsOpenFarm(g) and G:FarmBlock(g,c);if block and state=="ready" and not c.paused and s and (s.kind=="kill" or s.kind=="loot" or s.kind=="objective") then f.auto:SetText("Farming block · "..math.ceil(math.max(0,block.duration-block.elapsed)/60).." min remaining") end
 f.footer:SetText("Today  ·  ~"..plan.minutes.." / "..plan.budget.." min"..(plan.overrun>0 and ("  ·  +"..plan.overrun.." over budget") or ""))
 f:SetScale(G:DB().intent.scale or 1);self:Layout()
end
function U:Toggle() if G.Safe(InCombatLockdown) then G:Log("Open or reposition the guide after combat.");return end;self:Ensure();if self.window:IsShown() then self.window:Hide() else G:Refresh();self.window:Show();self:Refresh() end end
function U:Details()
 local g,c=G:Current();if not g then return end
 local lines={G:Title(g,c),"",g.details or "","Coverage: "..g.coverage,""}
 if g.validation then lines[#lines+1]=(g.validation.sourceChecked and "Checked against sources" or "Source details need review").." · "..(g.validation.playtested and "Playtested" or "Not played through yet") end
 if g.walkthrough then
  lines[#lines+1]="\nWalkthrough:"
  for _,node in ipairs(g.walkthrough.nodes) do lines[#lines+1]=node.text;if node.recovery then lines[#lines+1]="If unavailable: "..node.recovery.text end end
 end
 if g.catchUp then local k=c.knowledge and c.knowledge[g.catchUp.skillLineId];lines[#lines+1]="\nPotential catch-up knowledge: "..(k and (k.remaining.." · checked "..date("%c",k.at)) or "Open this expansion's Engineering to observe it.").."\nThis is not a count of available orders." end
 for _,s in ipairs(g.steps) do lines[#lines+1]=s.text end
 if g.system=="archaeology" and c.archaeology then lines[#lines+1]="\nObserved reward: "..c.archaeology.name..(c.archaeology.endAt and c.archaeology.endAt>G.Now() and (" · until "..date("%c",c.archaeology.endAt)) or " · check the current offer") end
 if g.variants then for _,v in ipairs(G:Variants(g,c)) do if c.recipes and c.recipes[v.spellId] and c.recipes[v.spellId].learned then local cd=G:Cooldown(c,v);lines[#lines+1]="\nCooldown: "..cd.state..(cd.charges and (" · "..cd.charges.."/"..cd.maxCharges.." charges") or "")..(cd.readyAt and (" · ready "..date("%c",cd.readyAt)) or "")..(cd.estimated and " · estimate from recorded use" or "") end end end
 for _,entry in ipairs(G:Plan().today) do if entry.guide.id==g.id and entry.grouped and #entry.grouped>1 then lines[#lines+1]="\nAlso at this stop:";for _,nearby in ipairs(entry.grouped) do if nearby.id~=g.id then lines[#lines+1]=G:Title(nearby,c) end end end end
 lines[#lines+1]="\nCombined preparation for Today (bags only):"
 local costs=G:Preparation(G:Plan());local ordered={};for key in pairs(costs) do ordered[#ordered+1]=key end;table.sort(ordered)
 for _,key in ipairs(ordered) do local cost=costs[key];local name=cost.kind=="c" and (c.currencies[cost.id] and c.currencies[cost.id].name or ("Currency #"..cost.id)) or cost.kind=="i" and (G.Safe(C_Item and C_Item.GetItemNameByID,cost.id) or ("Item #"..cost.id)) or "Copper";lines[#lines+1]=name..": "..cost.required.." required · "..(cost.available~=nil and cost.available or "unknown").." available"..(cost.at and (" · checked "..date("%c",cost.at)) or "") end
 if #ordered==0 then lines[#lines+1]="No shared item or currency costs are recorded for this plan. Craft materials are listed in each recipe." end
 for itemId,drop in pairs(g.dropEstimates or {}) do lines[#lines+1]="\nDrop estimate: ~"..drop.percent.."% · pooled report, difficulty unspecified. "..drop.boss.." · retrieved "..drop.retrievedAt.."\n"..drop.source end
 if g.method:lower():find("drop",1,true) and not next(g.dropEstimates or {}) then lines[#lines+1]="\nDrop estimate: Unknown. No matching sourced percentage is recorded." end
 lines[#lines+1]="\nSource: "..(g.source or "Not recorded")
 lines[#lines+1]="\n/toybox navigate — start directions\n/toybox snooze — hide until the next reset\n/toybox follow — follow this route\n/toybox undo — undo your last skip or cooldown entry"
 self:Copy(table.concat(lines,"\n"),"Toybox · Details")
 if not self.detailActions then
  local f=frame("ToyboxGuideActions","Toybox · Activity controls",570,280);self.detailActions=f
  local navigate=button(f,"Navigate",100,function() local current=G:Current();if current then G:FollowCurrentStep(true) end end);navigate:SetPoint("TOPLEFT",20,-40)
  local follow=button(f,"Follow / unfollow",130,function() local current=G:Current();if current then G:SetIntent("follow:"..current.id,not G:GuideIntent("followed",current.id)) end end);follow:SetPoint("LEFT",navigate,"RIGHT",8,0)
  local undo=button(f,"Undo",90,function() G:Undo() end);undo:SetPoint("LEFT",follow,"RIGHT",8,0)
  local retire=button(f,"Dismiss route",110,function() local current=G:Current();if current then G:SetIntent("exclude:"..current.id,true);G:Character().selected=nil;G:Changed();f:Hide() end end);retire:SetPoint("LEFT",undo,"RIGHT",8,0)
  local label=text(f);label:SetPoint("TOPLEFT",20,-85);label:SetText("Cooldown use: minutes ago (0 = used now)")
  f.minutes=CreateFrame("EditBox",nil,f,"InputBoxTemplate");f.minutes:SetSize(75,26);f.minutes:SetPoint("TOPLEFT",20,-113);f.minutes:SetAutoFocus(false);f.minutes:SetNumeric(true);f.minutes:SetText("0")
  local used=button(f,"Record craft use",135,function() G:Command("used",f.minutes:GetText()) end);used:SetPoint("LEFT",f.minutes,"RIGHT",12,0)
  local observeLabel=text(f);observeLabel:SetPoint("TOPLEFT",20,-156);observeLabel:SetText("Observed in game: ready in minutes · charges (if rechargeable)")
  f.ready=CreateFrame("EditBox",nil,f,"InputBoxTemplate");f.ready:SetSize(75,26);f.ready:SetPoint("TOPLEFT",20,-183);f.ready:SetAutoFocus(false);f.ready:SetNumeric(true);f.ready:SetText("0")
  f.charges=CreateFrame("EditBox",nil,f,"InputBoxTemplate");f.charges:SetSize(65,26);f.charges:SetPoint("LEFT",f.ready,"RIGHT",12,0);f.charges:SetAutoFocus(false);f.charges:SetNumeric(true);f.charges:SetText("")
  local observed=button(f,"Save observation",140,function() local current=G:Current();local character=G:Character();if current then for _,v in ipairs(G:Variants(current,character)) do if character.recipes and character.recipes[v.spellId] and character.recipes[v.spellId].learned then G:AdjustCooldown(v.spellId,(tonumber(f.ready:GetText()) or 0)*60,v.timing.kind=="charges" and tonumber(f.charges:GetText()) or nil,v.timing.maxCharges);break end end end end);observed:SetPoint("LEFT",f.charges,"RIGHT",12,0)
  f.craftNote=text(f,"GameFontDisableSmall");f.craftNote:SetPoint("BOTTOMLEFT",20,20);f.craftNote:SetText("This records cooldown use only. It does not change toy ownership.")
 end
 self.detailActions:ClearAllPoints();self.detailActions:SetPoint("TOPLEFT",self.copy,"BOTTOMLEFT",0,-6);self.detailActions:Show()
end
function U:Library(mode,query,page)
 if not self.library then
  local f=frame("ToyboxLibraryWindow","Toybox · Library",660,590);self.library=f
  f.search=CreateFrame("EditBox",nil,f,"InputBoxTemplate");f.search:SetSize(350,26);f.search:SetPoint("TOPLEFT",25,-40);f.search:SetAutoFocus(false)
  f.search:SetScript("OnTextChanged",function(b,user) if user then self:Library(self.mode,b:GetText(),1) end end)
  f.switch=button(f,"Show toys",120,function() self:Library(self.mode=="toys" and "guides" or "toys",f.search:GetText(),1) end);f.switch:SetPoint("TOPRIGHT",-20,-40)
  for i,spec in ipairs({{"today","Today"},{"guides","All guides"},{"toys","Toys"},{"upcoming","Upcoming"},{"blocked","Prerequisites"},{"alts","Other characters"}}) do local mode,label=unpack(spec);local b=button(f,label,98,function() self:Library(mode,f.search:GetText(),1) end);b:SetPoint("TOPLEFT",20+(i-1)*102,-74) end
  f.rows={};for i=1,10 do local b=button(f,"",615,function(b) if b.guide then G:Select(b.guide);self.window:Show();self:Refresh();f:Hide() elseif b.item and G.GoalPaths then self:ToyGoal(b.item) elseif b.item or b.description then self:Copy(b.description,"Toybox · Toy sources") end end);b:SetHeight(40);b:SetPoint("TOPLEFT",20,-110-(i-1)*42);f.rows[i]=b end
  f.previous=button(f,"Previous",90,function() self:Library(self.mode,f.search:GetText(),math.max(1,(self.page or 1)-1)) end);f.previous:SetPoint("BOTTOMLEFT",20,20)
  f.next=button(f,"Next",90,function() self:Library(self.mode,f.search:GetText(),(self.page or 1)+1) end);f.next:SetPoint("LEFT",f.previous,"RIGHT",6,0)
  f.count=text(f,"GameFontNormalSmall");f.count:SetPoint("BOTTOMRIGHT",-20,25)
 end
 local f=self.library;self.mode=mode or self.mode or "guides";self.page=page or 1;query=(query or f.search:GetText() or ""):lower()
 local items={};local c=G:Character()
 if self.mode=="toys" then
  for _,t in ipairs(G.Pack.toys) do
   local toyName=G.Safe(C_Item and C_Item.GetItemNameByID,t.itemId) or t.name
   local paths={};for _,r in ipairs(t.routes) do paths[#paths+1]=table.concat(r.path," / ").." · "..r.availability end
   local description=toyName.."\n"..table.concat(paths,"\n").."\nhttps://www.wowhead.com/item="..t.itemId
   if (toyName.." "..table.concat(paths," ")):lower():find(query,1,true) then items[#items+1]={item=t.itemId,label=(G:Owned(t.itemId) and "Owned · " or "")..toyName.."\n"..(paths[1] or "Needs checking"),description=description} end
  end
 elseif self.mode=="alts" then
  if G.AltOpportunities then local opportunities=G:AltOpportunities();for _,state in ipairs({"ready","unknown"}) do for _,op in ipairs(opportunities[state]) do local g=G:Guide(op.guideId);items[#items+1]={label=op.name.." · "..op.realm.." · "..(state=="ready" and "Eligible" or "Needs checking").."\n"..(g and g.title or op.guideId),description=op.reason.."\nLast observed: "..(op.at and date("%c",op.at) or "unknown").."\nFinish the current stop before switching. Availability is checked again at login."} end end else
  for guid,alt in pairs(G:DB().characters) do if guid~=c.guid then local titles={};for _,g in ipairs(G.Pack.guides) do if g.requirements and (g.requirements.classId or g.requirements.classIds) and G:Eligibility(g,alt)~="blocked" and #G:Missing(g)>0 then titles[#titles+1]=g.title end end;items[#items+1]={label=(alt.name or guid).." · "..(alt.realm or "").."\n"..#titles.." class-specific opportunities to check",description=table.concat(titles,"\n").."\nLog in on this character to refresh its live access and lockouts."} end end
  end
 else
  local allowed
  if self.mode~="guides" then allowed={};local plan=G:Plan();local entries=self.mode=="today" and plan.today or self.mode=="upcoming" and plan.upcoming or plan.blocked;for _,u in ipairs(entries) do allowed[u.guide.id]=true end end
  for _,g in ipairs(G.Pack.guides) do
   local state,reason=G:Eligibility(g,c)
   local visible=self.mode~="guides" or g.walkthrough or g.essential or G:GuideIntent("followed",g.id)
   if visible and state~="excluded" and (not allowed or allowed[g.id]) and (G:Title(g,c).." "..G:Location(g).." "..g.expansion.." "..g.method):lower():find(query,1,true) then items[#items+1]={guide=g.id,label=G:Title(g,c).." · "..state.."\n"..G:Location(g)} end
  end
 end
 self.page=math.min(self.page,math.max(1,math.ceil(#items/10)))
 for i,b in ipairs(f.rows) do local row=items[(self.page-1)*10+i];if row then b.guide=row.guide;b.item=row.item;b.description=row.description;b:SetText(row.label);b:Show() else b:Hide() end end
 f.switch:SetText(self.mode=="toys" and "Show guides" or "Show toys")
 f.count:SetText(#items.." results · "..self.page.."/"..math.max(1,math.ceil(#items/10)));f:Show()
end
function U:Settings()
 if not self.settings then
  local f=frame("ToyboxSettingsWindow","Toybox · Settings",450,550);self.settings=f
  local y=-48;local function check(label,get,set)
   local b=CreateFrame("CheckButton",nil,f,"UICheckButtonTemplate");b:SetPoint("TOPLEFT",20,y);y=y-37
   local title=text(f);title:SetPoint("LEFT",b,"RIGHT",2,0);title:SetText(label)
   b:SetScript("OnClick",function() set(b:GetChecked()==true);self:Refresh() end);b.get=get;f.checks=f.checks or {};f.checks[#f.checks+1]=b
  end
  check("Engineering for this character",function() local c=G:Character();local e=G:DB().intent.engineering;return c and e and e[c.guid] end,function(v) G:SetIntent("engineering:"..G:Character().guid,v) end)
  for _,spec in ipairs({{"autoQuests","Accept and turn in unambiguous guide quests",true},{"autoGossip","Choose supported guide dialogue",false},{"autoFlights","Take free supported flights",false},{"locked","Lock guide position",false},{"includeSolo","Include solo activities",true},{"includeGroup","Include group activities",true},{"includePvP","Include PvP activities",true}}) do
   local key,label,default=unpack(spec);check(label,function() local v=G:DB().intent[key];if v==nil then return default end;return v end,function(v) G:SetIntent(key,v) end)
  end
  for i,minutes in ipairs({15,30,60}) do local b=button(f,tostring(minutes).." min",65,function() G:SetIntent("budget",minutes);f.budget:SetText(tostring(minutes));self:Refresh() end);b:SetPoint("TOPRIGHT",-20-(3-i)*70,-395) end
  local label=text(f);label:SetPoint("TOPLEFT",24,-359);label:SetText("Session budget (5–240 min)")
  f.budget=CreateFrame("EditBox",nil,f,"InputBoxTemplate");f.budget:SetSize(75,26);f.budget:SetPoint("TOPLEFT",260,-353);f.budget:SetAutoFocus(false);f.budget:SetNumeric(true)
  local save=button(f,"Save budget",110,function() G:SetIntent("budget",tonumber(f.budget:GetText()));self:Refresh() end);save:SetPoint("TOPLEFT",24,-395)
  local smaller=button(f,"Smaller text",110,function() G:SetIntent("scale",math.max(0.7,(G:DB().intent.scale or 1)-0.1)) end);smaller:SetPoint("TOPLEFT",24,-438)
  local larger=button(f,"Larger text",110,function() G:SetIntent("scale",math.min(1.5,(G:DB().intent.scale or 1)+0.1)) end);larger:SetPoint("LEFT",smaller,"RIGHT",6,0)
  local diagnostics=button(f,"Diagnostics",110,function() self:Copy(G.Encode(G:Diagnostic()),"Toybox · Diagnostics") end);diagnostics:SetPoint("TOPLEFT",24,-483)
  local travel=button(f,"Travel preferences",160,function() self:TravelSettings() end);travel:SetPoint("TOPLEFT",144,-483)
 end
 for _,b in ipairs(self.settings.checks) do b:SetChecked(not not b.get()) end
 self.settings.budget:SetText(tostring(G:DB().intent.budget or 30));self.settings:Show()
end
