from pathlib import Path
import json,sys
sys.path.insert(0,str(Path('work/lua-runtime').resolve()))
from lupa.lua51 import LuaRuntime
lua=LuaRuntime(unpack_returned_tuples=True)
lua.execute('''TEST_NOW=1000000;GetServerTime=function() return TEST_NOW end;PlayerHasToy=function(id) return TEST_OWNED[id] or false end;UnitGUID=function() return "Player-1-ABC" end;UnitName=function() return "Test" end;GetRealmName=function() return "Realm" end;UnitClass=function() return "Priest","PRIEST" end;GetCurrentRegion=function() return 3 end;date=os.date''')
for file in ['Core.lua','Engine.lua','Conditions.lua','Walkthrough.lua','Systems.lua']:
 lua.execute(Path('addon/ToyboxExport',file).read_text())
def table(v):
 if isinstance(v,dict):return lua.table_from({int(k) if str(k).isdigit() else k:table(x) for k,x in v.items()})
 if isinstance(v,list):return lua.table_from([table(x) for x in v])
 return v
out=[]
for case in json.loads(Path(sys.argv[1] if len(sys.argv)>1 else 'tests/fixtures/walkthrough.json').read_text()):
 lua.globals().TEST_NOW=case.get('now',1000000)
 lua.globals().TEST_OWNED=table({str(k):True for k in case.get('owned',[])})
 lua.execute('ToyboxExportDB=nil;ToyboxGuides.ownedRead=nil')
 state={'guid':'Player-1-ABC','region':'EU','turnIns':{},'flags':{},'quests':{},'skipped':{},**case.get('state',{})}
 c=table(state);characters=case.get('characters',[])
 db=lua.globals().ToyboxGuides.DB(lua.globals().ToyboxGuides)
 db['characters']=table({str(i):v for i,v in enumerate(characters)})
 if 'rule' in case:
  out.append(lua.globals().ToyboxGuides.Condition(lua.globals().ToyboxGuides,table(case['rule']),c))
 else:
  result=lua.globals().ToyboxGuides.GraphState(lua.globals().ToyboxGuides,table({'id':'fixture','walkthrough':case['graph']}),c)
  out.append({'complete':result['complete'],'rows':[{'id':r['id'],'text':r['text'],'available':r['available'],'counters':r['counters']} for _,r in result['rows'].items()]})
print(json.dumps(out))
