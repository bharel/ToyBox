from pathlib import Path
source=Path('tests/guide-ui-check.py').read_text()
exec(source[:source.index("lua.execute('''\nlocal G=ToyboxGuides")])
lua.execute('''
local G=ToyboxGuides;G:Refresh();local c=G:Character();local original=G.Pack.guides
local function fixture(id,nodes,extra)
 local g={id=id,title=id,zone="Test hub",method="Quest",cadence="daily",minutes=5,rewards={999999},steps={},walkthrough={version=2,nodes=nodes,completeWhen={kind="toyOwned",itemId=999999}}}
 for k,v in pairs(extra or {}) do g[k]=v end;return g
end
local g=fixture("trip",{{id="trip:a",text="Pick up",kind="interact",manual=true,stopId="hub-a",destination={mapID=84,x=.1,y=.1}},{id="trip:b",text="Do work",kind="interact",manual=true,stopId="field-b",destination={mapID=84,x=.7,y=.7},after={"trip:a"}},{id="trip:c",text="Return",kind="interact",manual=true,stopId="hub-a",destination={mapID=84,x=.1,y=.1},after={"trip:b"}}})
G.Pack.guides={g};c.session=nil;c.selected=nil;G.dirty=true;G.UI:Ensure();G.UI.window:Show()
local nav={};local go=G.Navigation.Go;G.Navigation.Go=function(self,d) nav[#nav+1]=d and d.x or false end
G:Select(g.id);assert(c.session.activeStop=="hub-a");local win=G.UI.window
assert(win.checklistScroll:IsShown());assert(#win.checklist>=1)
win.nextButton.scripts.OnClick();assert(win.nextStop:IsShown());assert(c.session.activeStop=="hub-a" and c.session.pending.stop.id=="field-b");assert(nav[#nav]==.1)
win.nextStop.scripts.OnClick();assert(c.session.activeStop=="field-b" and nav[#nav]==.7);assert(win.action.text=="Do work")
win.nextButton.scripts.OnClick();assert(c.session.activeStop=="field-b" and win.nextStop:IsShown());win.nextStop.scripts.OnClick();assert(c.session.activeStop=="hub-a")
assert(not G:Owned(999999));assert(not c.turnIns[999999])
-- Selecting a checklist row changes selection only and stages another stop.
local both=fixture("both",{{id="both:a",text="First",kind="interact",manual=true,stopId="a"},{id="both:b",text="Second",kind="interact",manual=true,stopId="b"}})
G.Pack.guides={both};c.session=nil;c.selected=nil;G.dirty=true;G:Select(both.id);local ops=G:SessionChecklist();local target
for _,op in ipairs(ops) do if op.stepId=="both:b" then target=op end end
local history=#c.history;assert(G:SelectOpportunity(target));assert(#c.history==history and not c.skipped[target.stepId]);assert(c.session.activeStop=="b" and not win.nextStop:IsShown())
-- Farm time is active play time, not wall-clock time or ownership.
local farm=fixture("farm",{{id="farm:loot",text="Farm",kind="loot",completeWhen={kind="toyOwned",itemId=999999}}},{cadence="repeatable",outcome="random-drop",minutes=10})
G.Pack.guides={farm};c.session=nil;c.selected=nil;G.dirty=true;G:Select(farm.id);UnitIsAFK=function() return false end
local block=G:FarmBlock(farm,c);assert(block.duration==600);G:TickSession(300);assert(block.elapsed==300)
c.paused=true;G:TickSession(100);assert(block.elapsed==300);c.paused=false
UnitIsAFK=function() return true end;G:TickSession(100);assert(block.elapsed==300);UnitIsAFK=function() return false end
G:TickSession(500);G.UI:Refresh();assert(block.elapsed==600 and win.farmEnded);assert(not G:Owned(999999) and not G:GraphState(farm,c).complete)
G:AnotherFarmBlock();assert(G:FarmBlock(farm,c).elapsed==0)
-- Reports contain a bounded current context, never whole bags or credentials.
local reportId=G:ReportIssue();local report=G:DB().reports[reportId];assert(report.guideId==farm.id and report.character.guid==c.guid);assert(report.context.inventory==nil and report.context.token==nil)
assert(G:ReportIssue()==reportId);assert(G:SetReportNote("The source is absent"));assert(report.revision==2)
G:Undo();assert(report.deleted and report.revision==3);G:ReportAcknowledgements({[reportId]=2});assert(G:DB().reports[reportId]);G:ReportAcknowledgements({[reportId]=3});assert(not G:DB().reports[reportId])
-- One character's balance cannot fund two purchases twice.
c.currencies[99]={quantity=15,at=G.Now()};local allocated=G:ResourceAllocations({{id="one",costs={{"c",99,10}}},{id="two",costs={{"c",99,10}}}},c)
assert(allocated.one[1].allocated==10 and allocated.two[1].allocated==5 and allocated.two[1].shortfall==5)
c.currencies[99].at=G.Now()-301;assert(G:ResourceAllocations({{id="unknown",costs={{"c",99,10}}}},c).unknown[1].allocated==nil)
-- Alt suggestions need actual class/access evidence, and stale ones need a check.
local altGuide=fixture("druid",{{id="druid:loot",text="Druid toy",kind="loot",completeWhen={kind="toyOwned",itemId=999999}}},{requirements={classId=11}})
G.Pack.guides={altGuide};c.session={version=1,createdAt=G.Now(),guides={altGuide.id},seen={},farm={},spent=0};c.selected=altGuide.id
local alt={guid="Player-2-DEF",name="Exampledruid",realm="Alt Realm",region=c.region,class="DRUID",level=90,at=G.Now(),turnIns={},flags={},quests={},skipped={},snoozed={},history={}}
G:DB().characters[alt.guid]=alt;assert(#G:AltOpportunities().ready==1);alt.at=G.Now()-301;assert(#G:AltOpportunities().ready==0 and #G:AltOpportunities().unknown==1)
-- Vendor observations are exact-NPC facts, not generic merchant access.
c.merchant={npcId=123,at=G.Now(),offers={[999999]={usable=true}}};assert(G:Condition({kind="merchantOffer",npcId=123,itemId=999999},c));assert(G:Condition({kind="merchantOffer",npcId=456,itemId=999999},c)==false)
-- Planned purchases reserve currency and preserve each purchase at a shared stop.
local purchaseA=fixture("purchase-a",{{id="purchase-a:buy",kind="purchase",text="Buy A",requires={kind="currency",currencyId=99,quantity=10}}},{goalPath=true,costs={{"c",99,10}},npcId=1,destination={mapID=84,x=.2,y=.2}})
local purchaseB=fixture("purchase-b",{{id="purchase-b:buy",kind="purchase",text="Buy B",requires={kind="currency",currencyId=99,quantity=10}}},{goalPath=true,costs={{"c",99,10}},npcId=1,destination={mapID=84,x=.2,y=.2}})
G.Pack.guides={purchaseA,purchaseB};c.currencies[99]={quantity=15,at=G.Now()};G.dirty=true
local purchases=G:Plan();assert(#purchases.today==1 and #purchases.blocked==1)
c.currencies[99].quantity=20;G.dirty=true;purchases=G:Plan();assert(#purchases.today==1 and #purchases.today[1].grouped==2)
c.session=nil;c.selected=nil;assert(#G:EnsureSession(c).guides==2)
-- Long instructions and an expanded checklist keep reporting and footer controls apart.
win.title:SetText(string.rep("Long toy name ",12));win.action:SetText(string.rep("Long instruction ",100));win.daily:SetText(string.rep("Progress ",30));win.travel:SetText(string.rep("Destination ",20));win.next:SetText(string.rep("Next action ",30));win.status:SetText(string.rep("Status ",30))
win.hasDaily=true;win.hasTravel=true;win.hasNext=true;win.hasStatus=true;win.hasProgress=true;win.hasPins=true;win.farmEnded=true;win.use:Show();win.reward.itemID=999999;G.UI.checklistOpen=true
for _,width in ipairs({340,410,620}) do win:SetSize(width,680);G.UI:Layout();local reportBottom=-win.report.point[5]+win.report:GetHeight();local dividerTop=-win.divider.point[5];assert(reportBottom<dividerTop,"Report overlaps footer at "..width) end
win.checklist={};for i=1,70 do win.checklist[i]={id="scroll:"..i,label="Opportunity "..i,state="available",available=true,stop={label="Hub"}} end
win.checklistScroll:SetVerticalScroll(45*32);G.UI:UpdateChecklistRows();assert(win.checklistRows[40].op.id=="scroll:70")
G.Navigation.Go=go;G.Pack.guides=original
''')
print('Passed session integration: checklist selection, stop gates/waypoints, active farming time, report revisions/Undo, resource allocation, alt isolation/freshness and exact merchant observations.')
