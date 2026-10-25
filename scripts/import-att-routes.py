"""Extract toy route facts from an installed, licensed Retail ATT database.

The data constructors run in a Lua environment without file, network, process,
load or require access. Imported descriptions/functions are not executable guides.
The resulting checked-in JSON makes normal builds independent of ATT installation.
"""
from pathlib import Path
import argparse,hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'work/lua-runtime'))
from lupa import LuaRuntime,lua_type

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--att-dir',type=Path,required=True);parser.add_argument('--output',type=Path);parser.add_argument('--all-entities',action='store_true');parser.add_argument('--all-quests',action='store_true');parser.add_argument('--objectives',action='store_true');args=parser.parse_args()
    license_path=args.att_dir/('LICENSE' if (args.att_dir/'LICENSE').exists() else 'LICENSE.txt')
    license=license_path.read_text(encoding='utf-8-sig')
    if 'MIT License' not in license or 'Permission is hereby granted' not in license:
        raise SystemExit('This source is not the expected MIT-licensed ATT release.')
    runtime=LuaRuntime(unpack_returned_tuples=True,max_memory=500*1024*1024)
    runtime.execute('''
    APP={L=setmetatable({},{__index=function(_,k) return k end})};CATEGORIES={}
    local keys={CharacterClass="classID",CharacterRace="raceID",Toy="itemID",Item="itemID",NPC="npcID",Quest="questID",CharacterUnlockQuest="questID",Map="mapID",Faction="factionID",Profession="professionID",Achievement="achievementID",CurrencyClass="currencyID",GarrisonMission="missionID",Recipe="recipeID",Spell="spellID",GarrisonBuilding="buildingID",CustomHeader="headerID",Expansion="expansionID",Difficulty="difficultyID",Encounter="encounterID",Instance="instanceID",Object="objectID"}
    setmetatable(APP,{__index=function(t,key)
      if key:match('^Create') then local fn=function(...)
       local args={...};local out=type(args[#args])=='table' and args[#args] or {}
       if out[1]~=nil and out.g==nil then out={g=out} end
       local kind=key:sub(7);out._kind=kind
       if kind=='ItemSource' then out.itemID=args[2] else out[keys[kind] or ('_'..kind)]=args[1] end
       return out
      end;rawset(t,key,fn);return fn end
    end})
    APP.OnTooltipDB=setmetatable({},{__index=function() return function() end end})
    APP.OnUpdateDB=APP.OnTooltipDB;APP.OnClickDB=APP.OnTooltipDB
    APP.WOWAPI={GetItemCount=function() return 0 end}
    APP.FactionID=0;APP.RaceIndex=-1;APP.ClassIndex=-1
    APP.indexOf=function(t,v) for i,x in ipairs(t or {}) do if x==v then return i end end end
    APP.ResolveQuestData=function(t) return t end
    APP.asset=function(path) return path end
    APP.AddEventHandler=function(event,fn) if event=='OnBuildDataCache' or event=='OnBuildHiddenDataCache' then fn(CATEGORIES) end end
    ENV={Enum={FlightPathFaction={Horde=1,Alliance=2}},GetCVar=function() return "" end,ipairs=ipairs,pairs=pairs,type=type,tonumber=tonumber,tostring=tostring,math=math,string=string,table=table};ENV._G=ENV
    function EVALUATE(source)
      local fn,err=load(source,'ATT metadata','t',ENV);if not fn then error(err) end
      local ticks=0;debug.sethook(function() ticks=ticks+1;if ticks>10000 then error('metadata instruction limit') end end,'',10000)
      local ok,result=pcall(fn,'AllTheThings',APP);debug.sethook();if not ok then error(result) end
    end
    ''')
    files=[];errors=[]
    for path in sorted((args.att_dir/'db/Standard/Categories').glob('*.lua')):
        source=path.read_text(encoding='utf-8-sig')
        files.append({'path':str(path.relative_to(args.att_dir)),'sha256':hashlib.sha256(source.encode()).hexdigest()})
        try:runtime.globals().EVALUATE(source)
        except Exception as e:errors.append({'file':path.name,'error':str(e)[:220]})
    def plain(v,depth=0):
        if depth>7:return None
        if lua_type(v)=='table':
            pairs=list(v.items())
            if pairs and sorted(k for k,_ in pairs if isinstance(k,(int,float)))==list(range(1,len(pairs)+1)) and all(isinstance(k,(int,float)) for k,_ in pairs):
                return [plain(value,depth+1) for _,value in sorted(pairs)]
            return {str(k):plain(value,depth+1) for k,value in pairs if lua_type(value)!='function'}
        return v if isinstance(v,(str,int,float,bool)) else None
    routes=[];quests={};quest_variants={};entities={};quest_objectives={};record_number=0
    inherited=['mapID','coord','coords','maps','r','c','lvl','minReputation','maxReputation','sourceQuests','sourceQuest','sourceQuestNumRequired','sqreq','altQuests','isDaily','isWeekly','isMonthly','isYearly','isWorldQuest','repeatable','isAccountWide','u','awp','rwp','professionID','missionID','buildingID','cost','difficultyID','difficulties','requireSkill','races','qgs','crs','expansionID','factionID','reputation','providers','provider','encounterID','instanceID','objectID','e','b','headers','qss','qis','description','objectiveID','spellID','sourceAchievements','isRaid','isWeeklyAccountQuest','isBreadcrumb','lockCriteria','isTrivial','isRepeatable','DisablePartySync','parentID']
    keys=['npcID','questID','achievementID','recipeID','itemID','objectID','missionID','encounterID','instanceID','spellID','mapID']
    def walk(node,context,category,depth=0):
        if lua_type(node)!='table' or depth>55:return
        nonlocal record_number
        record_number+=1
        ctx=dict(context);ctx['lineage']=list(context.get('lineage',[]))
        if node['_kind']=='CharacterClass' and isinstance(node['classID'],(int,float)):ctx['c']=[int(node['classID'])]
        if node['_kind']=='CharacterRace' and isinstance(node['raceID'],(int,float)):ctx['races']=[int(node['raceID'])]
        if node['_kind']=='CustomHeader' and isinstance(node['headerID'],(int,float)):
            ctx['headers']=[*context.get('headers',[]),int(node['headerID'])]
        # Faction-specific data is retained as separate route branches.
        if lua_type(node['aqd'])=='table' or lua_type(node['hqd'])=='table':
            for branch,side in [('aqd',2),('hqd',1)]:
                if lua_type(node[branch])=='table':
                    merged=runtime.table()
                    for k,v in node.items():
                        if k not in ('aqd','hqd'):merged[k]=v
                    for k,v in node[branch].items():merged[k]=v
                    merged['r']=side;walk(merged,context,category,depth+1)
            return
        if node['questID'] is not None:
            for key in ('questID','sourceQuests','sourceQuest','sourceQuestNumRequired','sqreq','isDaily','isWeekly','isMonthly','isYearly','isWorldQuest','repeatable','qgs'):
                ctx.pop(key,None)
        for key in inherited:
            if node[key] is not None:ctx[key]=plain(node[key])
        if node['sqreq'] is not None:ctx['sourceQuestNumRequired']=plain(node['sqreq'])
        for key in ['npcID','questID','achievementID','recipeID']:
            if node[key] is not None:ctx[key]=plain(node[key])
        # Keep exact constructor ancestry and local values. Effective inherited fields alone
        # cannot distinguish a quest reward from a tracking quest or a container's contents.
        local={k:plain(node[k]) for k in inherited+keys if node[k] is not None}
        local['kind']=node['_kind'];local['record']=record_number
        if node['_kind'] not in ('CustomHeader','Header','Map','Expansion','Filter','Category'):
            ctx['lineage'].append(local)
        if len(ctx['lineage'])>18:ctx['lineage']=ctx['lineage'][-18:]
        for key in ['npcID','objectID','instanceID','encounterID']:
            if node[key] is not None:
                entity_key=key+':'+str(int(node[key]));entities.setdefault(entity_key,[])
                entry={k:v for k,v in local.items() if k not in ('record','description')}
                for k in ['mapID','coords','coord','r','c','difficultyID','difficulties']:
                    if k not in entry and k in ctx:entry[k]=ctx[k]
                if entry not in entities[entity_key]:entities[entity_key].append(entry)
        if node['questID'] is not None:
            qid=plain(node['questID']);entry={k:v for k,v in ctx.items() if k in inherited or k in ['questID','npcID']}
            entry['localFacts']=local
            quest_variants.setdefault(str(qid),[])
            if entry not in quest_variants[str(qid)]:quest_variants[str(qid)].append(entry)
            # Keep variants separate. Canonical values are never assembled from conflicting branches.
            if str(qid) not in quests:quests[str(qid)]=entry
        if args.objectives and node['objectiveID'] is not None and ctx.get('questID'):
            row={k:v for k,v in local.items() if k not in ('record',)}
            row.update({k:ctx[k] for k in ['mapID','coord','coords','r','c'] if k not in row and k in ctx})
            quest_objectives.setdefault(str(ctx['questID']),[])
            if row not in quest_objectives[str(ctx['questID'])]:quest_objectives[str(ctx['questID'])].append(row)
        if node['_kind']=='Toy' and isinstance(node['itemID'],(int,float)):
            routes.append({'itemId':int(node['itemID']),'category':category,**ctx,'localFacts':local})
        groups=node['g']
        if lua_type(groups)=='table':
            for _,child in groups.items():walk(child,ctx,category,depth+1)
    for category,roots in runtime.globals().CATEGORIES.items():
        if roots['_kind'] is not None:walk(roots,{},category)
        else:
            for _,node in roots.items():walk(node,{},category)
    # Keep only prerequisite quest facts reachable from a toy route.
    required=set()
    def include(qid):
        qid=str(qid)
        if qid in required or qid not in quests:return
        required.add(qid);q=quests[qid]
        for old in q.get('sourceQuests',[]) if isinstance(q.get('sourceQuests'),list) else []:include(old)
        if q.get('sourceQuest'):include(q['sourceQuest'])
    for route in routes:
        if route.get('questID'):include(route['questID'])
        for qid in route.get('sourceQuests',[]) if isinstance(route.get('sourceQuests'),list) else []:include(qid)
    routes.sort(key=lambda r:json.dumps(r,sort_keys=True))
    authored=json.loads((ROOT/'lib/data/guide-authoring.json').read_text())
    for guide in authored['guides']:
        for qid in guide.get('questIds',[]):include(qid)
    for q in quests.values():
        if -413 in q.get('headers',[]):include(q['questID'])
    if args.all_quests:required.update(quests)
    wanted_entities=set()
    for r in routes:
        for a in r.get('lineage',[]):
            for key in ['npcID','objectID','instanceID','encounterID']:
                if a.get(key):wanted_entities.add(key+':'+str(a[key]))
        for key in ['npcID','objectID','instanceID','encounterID']:
            if r.get(key):wanted_entities.add(key+':'+str(r[key]))
    for q in quests.values():
        if str(q['questID']) in required or q.get('professionID')==202 or -413 in q.get('headers',[]):
            for npc in q.get('qgs',[]):wanted_entities.add('npcID:'+str(npc))
    data={'version':2,'source':'https://github.com/ATTWoWAddon/AllTheThings','release':(args.att_dir/'revision.txt').read_text().strip() if (args.att_dir/'revision.txt').exists() else 'installed-source','license':'MIT','reviewedAt':'2026-10-24','files':files,'errors':errors,'routes':routes,'quests':{k:quests[k] for k in sorted(required)},'questVariants':{k:quest_variants[k] for k in sorted(required)},'entities':{k:entities[k] for k in sorted(entities if args.all_entities else wanted_entities) if k in entities},'questObjectives':{k:v for k,v in quest_objectives.items() if k in required},'tournament':[q for q in sorted(quests.values(),key=lambda q:q['questID']) if -413 in q.get('headers',[])],'reputationTasks':[q for q in sorted(quests.values(),key=lambda q:q['questID']) if q.get('factionID') and not q.get('rwp') and (q.get('isWeekly') or q.get('isDaily') or q.get('isWorldQuest'))],'engineering':[q for q in sorted(quests.values(),key=lambda q:q['questID']) if q.get('professionID')==202 and not q.get('rwp') and not q.get('u') and q.get('awp',0)<=120105]}
    (args.output or ROOT/'lib/data/att-toy-routes.json').write_text(json.dumps(data,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n')
    out=ROOT/'addon/ToyboxExport/ATT-LICENSE.txt';out.write_text(license)
    print(json.dumps({'routes':len(routes),'toys':len({r['itemId'] for r in routes}),'prerequisiteQuests':len(required),'errors':errors}))
if __name__=='__main__':main()
