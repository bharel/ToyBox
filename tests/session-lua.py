from pathlib import Path
import json,sys
source=Path('tests/guide-ui-check.py').read_text();exec(source[:source.index("lua.execute('''\nlocal G=ToyboxGuides")])
def table(v):
    if isinstance(v,dict):return lua.table_from({int(k) if str(k).isdigit() else k:table(x) for k,x in v.items()})
    if isinstance(v,list):return lua.table_from([table(x) for x in v])
    return v
cases=json.loads(Path(sys.argv[1]).read_text());results=[]
for case in cases:
    lua.globals().CASE=table(case)
    value=lua.execute('''
local G=ToyboxGuides;local f=CASE;G.Now=function() return f.now end
local c=G:Character();for k,v in pairs(f.state) do c[k]=v end;c.session={version=1,createdAt=f.now,guides={f.guide.id},seen={},farm={},spent=0};G.Pack.guides={f.guide}
local result={};for _,op in ipairs(G:Checklist(f.guide,c)) do result[#result+1]={stepId=op.stepId,state=op.state,available=op.available} end
return G.Encode(G.Array(result))
''')
    results.append(json.loads(value))
print(json.dumps(results))
