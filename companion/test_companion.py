import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location('toybox',Path(__file__).with_name('toybox_companion.py'))
t=importlib.util.module_from_spec(spec)
spec.loader.exec_module(t)

GUID='Player-123-ABCDEF'
def snapshot(at=1792719863,name='Examplepriest',realm='Example Realm',region='EU'):
    return {'format':'toybox-addon-v1','version':1,'exportedAt':at,'character':{'name':name,'realm':realm,'region':region,'guid':GUID},'toysComplete':True,'raidsFresh':True,'toys':[],'ownedToyIds':[],'questLog':[],'raidLockouts':[],'completedQuestIds':[],'watchedQuests':[],'warnings':[]}
def lua_file(value):
    # A SavedVariables string contains JSON text as a quoted Lua string.
    return 'ToyboxExportDB = { ["characters"] = {}, ["outbox"] = { ["'+GUID+'"] = '+json.dumps(json.dumps(value,ensure_ascii=False),ensure_ascii=False)+' } }\n'
class FakeClient:
    def __init__(self):self.requests=[];self.fail=0
    def request(self,body):
        self.requests.append(body)
        if body['action']=='upload' and self.fail:
            self.fail-=1
            raise t.TransportError('Offline')
        return {'ok':True}
class CompanionTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name);self.wow=self.root/'game';self.state=self.root/'state';self.path=self.wow/'WTF/Account/Example/SavedVariables/ToyboxExport.lua';self.path.parent.mkdir(parents=True)
        self.clock=[1000.0];self.client=FakeClient();self.watcher=t.Watcher(self.client,self.wow,self.state,clock=lambda:self.clock[0])
    def tearDown(self):self.temp.cleanup()
    def test_saved_strings_utf8_and_escapes(self):
        a=snapshot(name='Prêtré');a['warnings']=['Quoted "text", new\nline, slash \\ and apostrophe']
        self.path.write_text(lua_file(a));self.assertEqual(t.read_saved(self.path),[(GUID,a)])
        self.assertEqual(t.LuaData('ToyboxExportDB = {x="\\195\\169"}').parse()['x'],'é')
    def test_never_executes_code(self):
        for text in ['ToyboxExportDB = os.execute("touch /tmp/nope")','ToyboxExportDB = {}; os.execute("bad")','ToyboxExportDB = {x=function() end}','ToyboxExportDB = {x=1+1}','OtherAddonDB = {}','ToyboxExportDB={x=1,x=2}']:
            with self.subTest(text=text),self.assertRaises(t.CompanionError):t.LuaData(text).parse()
    def test_partial_files_and_mismatched_identity(self):
        self.path.write_text(lua_file(snapshot())[:-8]);self.assertRaises(t.CompanionError,t.read_saved,self.path)
        a=snapshot();a['character']['guid']='Player-999-ABC';self.path.write_text(lua_file(a));self.assertRaises(t.CompanionError,t.read_saved,self.path)
    def test_debounce_and_persistent_dedup(self):
        self.path.write_text(lua_file(snapshot()));self.assertEqual(self.watcher.scan(),0);self.clock[0]+=3;self.assertEqual(self.watcher.scan(),1);self.assertEqual(self.watcher.scan(),0)
        reloaded=t.Watcher(self.client,self.wow,self.state,clock=lambda:self.clock[0]);self.assertEqual(reloaded.scan(settle=0),0)
        self.assertEqual(len([r for r in self.client.requests if r['action']=='upload']),1)
        self.assertEqual((self.state/'state.json').stat().st_mode&0o777,0o600)
    def test_retry_keeps_pending_snapshot(self):
        self.path.write_text(lua_file(snapshot()));self.client.fail=1;self.assertEqual(self.watcher.step(settle=0),0);self.assertEqual(self.watcher.state['synced'],{});self.assertEqual(self.watcher.state['status'],'retrying')
        self.clock[0]+=5;self.assertEqual(self.watcher.step(settle=0),1);self.assertEqual(len(self.watcher.state['synced']),1)
    def test_auth_failure_backs_off(self):
        def fail(_body):raise t.TransportError('Revoked',401)
        self.watcher.client.request=fail;self.path.write_text(lua_file(snapshot()));self.watcher.step(settle=0);self.assertTrue(self.watcher.locked_out);self.assertEqual(self.watcher.retry_at,1300)
    def test_old_snapshot_and_identity_isolation(self):
        self.assertTrue(self.watcher.upload(GUID,snapshot()));self.assertFalse(self.watcher.upload(GUID,snapshot(at=1792719000)))
        self.assertTrue(self.watcher.upload(GUID,snapshot(region='US')));self.assertTrue(self.watcher.upload(GUID,snapshot(realm='Kazzak')));self.assertEqual(len(self.watcher.state['synced']),3)
    def test_old_addon_waits_and_no_unknown_ownership(self):
        self.path.write_text('ToyboxExportDB = { watched={},characters={} }');self.assertEqual(self.watcher.scan(settle=0),0);self.assertEqual(self.watcher.state['status'],'waiting');self.assertFalse(any(r['action']=='upload' for r in self.client.requests))
    def test_report_revisions_are_independent_and_invalid_reports_do_not_block_progress(self):
        a=snapshot();a['guides']={'reports':[{'id':'device:report:1','revision':1}]}
        self.watcher.upload(GUID,a);self.watcher.upload(GUID,a)
        self.assertEqual(len([r for r in self.client.requests if r['action']=='guide-reports']),1)
        a['guides']['reports'][0].update(revision=2,deleted=True)
        self.watcher.upload(GUID,a)
        self.assertEqual(self.client.requests[-2]['action'],'guide-report-change')
        def reject_report(body):
            self.client.requests.append(body)
            if body['action']=='guide-reports':raise t.TransportError('Invalid report',400)
            return {'ok':True}
        self.client.request=reject_report
        a['guides']['reports']=[{'id':'malformed','revision':1}];a['exportedAt']+=1
        self.assertTrue(self.watcher.upload(GUID,a));self.assertEqual(self.watcher.state['reportError'],'Invalid report')
        self.assertNotIn('malformed',self.watcher.state['guideReports'])
        self.assertEqual(self.client.requests[-1]['action'],'upload')
    def test_previous_save_recovers_dated_clears_only(self):
        old=snapshot();old['raidLockouts']=[{'name':'The Nighthold','difficultyId':16,'encounters':[{'name':"Gul'dan",'killed':True},{'name':'Other','killed':False}]}]
        current=snapshot(at=old['exportedAt']+600);current['game']={'version':1,'questsAvailable':True,'instances':[],'recipes':[]}
        self.path.write_text(lua_file(current));backup=Path(str(self.path)+'.bak');backup.write_text(lua_file(old))
        recovered=t.read_with_history(self.path)[0][1]
        self.assertEqual(recovered['game']['raidClears'],[{'instance':'The Nighthold','difficultyId':16,'encounter':"Gul'dan",'at':old['exportedAt']}])
        self.assertEqual(recovered['exportedAt'],current['exportedAt']);self.assertEqual(recovered['raidLockouts'],[]);self.assertEqual(recovered['ownedToyIds'],[])
        old['character']['realm']='Elsewhere';backup.write_text(lua_file(old));self.assertNotIn('raidClears',t.read_with_history(self.path)[0][1]['game'])
        backup.write_text('ToyboxExportDB={x=function() end}');self.assertEqual(t.read_with_history(self.path)[0][1],current)
    def test_capture_identity_disk_stage_and_immutable_history(self):
        a=snapshot();a['capture']={'version':1,'id':GUID+':'+str(a['exportedAt'])+':1','at':a['exportedAt'],'sequence':1};a['game']={'version':1,'questsAvailable':True,'instances':[],'recipes':[]}
        old=snapshot(at=a['exportedAt']-60);old['raidLockouts']=[{'name':'Raid','difficultyId':16,'encounters':[{'name':'Boss','killed':True}]}]
        self.path.write_text(lua_file(a));Path(str(self.path)+'.bak').write_text(lua_file(old))
        self.assertEqual(t.read_with_history(self.path)[0][1],a)
        self.watcher.scan(settle=0)
        upload=next(r for r in self.client.requests if r['action']=='upload')
        self.assertEqual(upload['disk']['captureId'],a['capture']['id']);self.assertEqual(upload['disk']['observedAt'],1000000)
        self.assertNotIn('path',upload['disk']);self.assertEqual(self.watcher.state['runningVersion'],'1.4.0')
        self.assertEqual(t.read_saved(self.path)[0][1],a)

    def test_credentials_never_follow_redirect(self):
        from http.server import BaseHTTPRequestHandler,HTTPServer
        import threading
        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                self.send_response(302);self.send_header('Location','https://example.com/steal');self.end_headers()
            def log_message(self,*_args):pass
        server=HTTPServer(('127.0.0.1',0),Handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            client=t.Client({'siteAccess':'fixture','token':'fixture'},site='http://127.0.0.1:'+str(server.server_port))
            with self.assertRaises(t.TransportError):client.request({'action':'upload'})
        finally:server.shutdown();server.server_close();thread.join()
        with self.assertRaises(t.CompanionError):t.Client({'siteAccess':'fixture'},site='https://example.com')
if __name__=='__main__':unittest.main()
