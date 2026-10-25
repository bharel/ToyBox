from pathlib import Path
import json,tempfile,unittest
import toybox_companion as tc

class Client:
    def __init__(self,profile):self.profile=profile;self.requests=[]
    def request(self,body):self.requests.append(body);return self.profile

class GuideSyncTests(unittest.TestCase):
    def setup_watcher(self,root,profile):
        wow=root/'wow';addon=wow/'Interface/AddOns/ToyboxExport';addon.mkdir(parents=True)
        (addon/'ToyboxExport.toc').write_text('## Title: Toybox Guides\nInbox.lua\n')
        (addon/'Inbox.lua').write_text('-- Managed by the optional companion.\nToyboxSyncInbox = nil\n')
        saved=wow/'WTF/Account/fixture/SavedVariables/ToyboxExport.lua';saved.parent.mkdir(parents=True);saved.write_text('untouched game data')
        state=root/'state';state.mkdir();return tc.Watcher(Client(profile),wow,state),addon/'Inbox.lua',saved

    def test_inbox_is_data_atomic_idempotent_and_does_not_touch_save(self):
        with tempfile.TemporaryDirectory() as folder:
            profile={'version':1,'profile':'Unicode-é"; os.execute("no")','revision':3,'values':{'budget':30},'ack':['device:1'],'token':'must not be staged'}
            watcher,target,saved=self.setup_watcher(Path(folder),profile)
            self.assertTrue(watcher.stage_profile());self.assertFalse(watcher.stage_profile())
            text=target.read_text();self.assertNotIn('os.execute',text);self.assertNotIn('must not be staged',text)
            self.assertEqual(saved.read_text(),'untouched game data');self.assertFalse(target.with_suffix('.lua.tmp').exists())
            encoded=text.split('ToyboxSyncInbox = "')[1].split('"')[0]
            payload=bytes(int(chunk) for chunk in encoded.split('\\')[1:]).decode()
            self.assertEqual(json.loads(payload)['profile'],profile['profile'])

    def test_invalid_and_unmanaged_inboxes_keep_previous(self):
        with tempfile.TemporaryDirectory() as folder:
            watcher,target,_=self.setup_watcher(Path(folder),{'version':2})
            old=target.read_text()
            with self.assertRaises(tc.CompanionError):watcher.stage_profile()
            self.assertEqual(target.read_text(),old)
            watcher.client.profile={'version':1,'profile':'test','revision':0,'values':{},'ack':[]}
            target.write_text('unmanaged source')
            with self.assertRaises(tc.CompanionError):watcher.stage_profile()
            self.assertEqual(target.read_text(),'unmanaged source')

    def test_capabilities_and_report_ack_are_addon_version_specific(self):
        with tempfile.TemporaryDirectory() as folder:
            profile={'version':1,'profile':'fixture','revision':1,'values':{},'ack':[],'reportAck':{'device:report:1':3}}
            watcher,target,saved=self.setup_watcher(Path(folder),profile)
            watcher.stage_profile();self.assertEqual(watcher.client.requests[-1]['capabilities'],[])
            self.assertNotIn('reportAck',bytes(int(x) for x in target.read_text().split('ToyboxSyncInbox = "')[1].split('"')[0].split('\\')[1:]).decode())
            (target.parent/'ToyboxExport.toc').write_text('## Version: 2.2.0\nInbox.lua\n')
            watcher.state['guideReportRequestIds']=['device:report:1'];watcher.stage_profile()
            self.assertEqual(watcher.client.requests[-1]['capabilities'],['session-v1','reports-v1'])
            self.assertEqual(watcher.client.requests[-1]['reportIds'],['device:report:1'])
            payload=bytes(int(x) for x in target.read_text().split('ToyboxSyncInbox = "')[1].split('"')[0].split('\\')[1:]).decode()
            self.assertEqual(json.loads(payload)['reportAck'],profile['reportAck']);self.assertEqual(saved.read_text(),'untouched game data')

    def test_receipt_capability_is_new_version_only(self):
        with tempfile.TemporaryDirectory() as folder:
            profile={'version':1,'profile':'fixture','revision':1,'values':{},'ack':[],'captureAck':{'Player-1-AA':{'id':'capture'}}}
            watcher,target,saved=self.setup_watcher(Path(folder),profile)
            (target.parent/'ToyboxExport.toc').write_text('## Version: 2.3.0\nInbox.lua\n')
            watcher.stage_profile()
            self.assertIn('sync-receipts-v1',watcher.client.requests[-1]['capabilities'])
            payload=bytes(int(x) for x in target.read_text().split('ToyboxSyncInbox = "')[1].split('"')[0].split('\\')[1:]).decode()
            self.assertEqual(json.loads(payload)['captureAck'],profile['captureAck'])
            self.assertEqual(saved.read_text(),'untouched game data')

if __name__=='__main__':unittest.main()
