#!/usr/bin/env python3
"""Toybox companion: read SavedVariables as data and upload snapshots over HTTPS."""
from __future__ import annotations
import argparse
import getpass
import hashlib
import json
import logging
import os
import platform
import plistlib
import re
import secrets
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import webbrowser
from pathlib import Path

VERSION = '1.4.0'
ROOT = Path(__file__).resolve().parents[1]
DEFAULT_STATE = ROOT / 'work' / 'companion'


def configured_site():
    """Read the deployment address from local configuration, never source."""
    try:
        local = json.loads((Path(__file__).parent / 'site.local.json').read_text())
    except (OSError, ValueError):
        local = {}
    if not isinstance(local, dict):
        local = {}
    return (os.environ.get('TOYBOX_SITE_ORIGIN') or local.get('site') or
            'https://toybox.example.invalid').rstrip('/')


SITE = configured_site()
MAX_FILE = 128 * 1024 * 1024
MAX_SNAPSHOT = 2_500_000
SERVICE = 'chatgpt.site.bar-toybox.companion'
LABEL = 'chat.toybox.companion'
LOG = logging.getLogger('toybox')

class CompanionError(Exception):
    pass

class TransportError(CompanionError):
    def __init__(self, message, status=0):
        super().__init__(message)
        self.status = status

class LuaData:
    """Bounded parser for SavedVariables data; never evaluates Lua code."""
    def __init__(self, text):
        if len(text.encode('utf-8')) > MAX_FILE:
            raise CompanionError('The Toybox saved file is too large.')
        self.text, self.pos, self.items = text.lstrip('\ufeff'), 0, 0

    def skip(self):
        while self.pos < len(self.text):
            m = re.match(r'\s+|--[^\r\n]*', self.text[self.pos:])
            if not m:
                return
            self.pos += len(m[0])

    def take(self, value):
        self.skip()
        if not self.text.startswith(value, self.pos):
            raise CompanionError('The saved file is incomplete or is not supported Toybox data.')
        self.pos += len(value)

    def string(self):
        quote = self.text[self.pos]
        self.pos += 1
        out = bytearray()
        escapes = {'a':'\a','b':'\b','f':'\f','n':'\n','r':'\r','t':'\t','v':'\v','\\':'\\','"':'"',"'":"'"}
        while self.pos < len(self.text):
            c = self.text[self.pos]
            self.pos += 1
            if c == quote:
                return bytes(out).decode('utf-8')
            if c != '\\':
                out.extend(c.encode('utf-8'))
                continue
            if self.pos >= len(self.text):
                break
            c = self.text[self.pos]
            self.pos += 1
            if c in escapes:
                out.extend(escapes[c].encode('utf-8'))
            elif c.isdigit():
                digits = c
                while len(digits) < 3 and self.pos < len(self.text) and self.text[self.pos].isdigit():
                    digits += self.text[self.pos]
                    self.pos += 1
                if int(digits) > 255:
                    raise CompanionError('Invalid saved-file escape.')
                # Lua decimal escapes denote bytes; saved JSON normally uses ASCII escapes.
                out.append(int(digits))
            elif c == 'x':
                h = self.text[self.pos:self.pos+2]
                if not re.fullmatch('[a-fA-F0-9]{2}', h):
                    raise CompanionError('Invalid saved-file escape.')
                out.append(int(h, 16))
                self.pos += 2
            elif c == 'z':
                while self.pos < len(self.text) and self.text[self.pos].isspace():
                    self.pos += 1
            elif c in '\r\n':
                if c == '\r' and self.text[self.pos:self.pos+1] == '\n':
                    self.pos += 1
                out.extend(b'\n')
            else:
                raise CompanionError('Unsupported saved-file escape.')
        raise CompanionError('The saved file is incomplete. Waiting for WoW to finish writing.')

    def value(self, depth=0):
        if depth > 60:
            raise CompanionError('Saved-file nesting is too deep.')
        self.skip()
        self.items += 1
        if self.items > 300000 or self.pos >= len(self.text):
            raise CompanionError('The saved file is incomplete or too complex.')
        c = self.text[self.pos]
        if c in "\"'":
            return self.string()
        if c == '{':
            self.pos += 1
            table, index = {}, 1
            while True:
                self.skip()
                if self.text[self.pos:self.pos+1] == '}':
                    self.pos += 1
                    return table
                if self.text[self.pos:self.pos+1] == '[':
                    self.pos += 1
                    key = self.value(depth+1)
                    if not isinstance(key, (str, int)) or isinstance(key, bool):
                        raise CompanionError('Invalid saved-file key.')
                    self.take(']')
                    self.take('=')
                else:
                    field = re.match(r'([A-Za-z_]\w*)\s*=', self.text[self.pos:])
                    if field:
                        key = field[1]
                        self.pos += len(field[0])
                    else:
                        key, index = index, index+1
                if key in table:
                    raise CompanionError('Duplicate saved-file key.')
                table[key] = self.value(depth+1)
                self.skip()
                if self.text[self.pos:self.pos+1] in (',',';'):
                    self.pos += 1
                elif self.text[self.pos:self.pos+1] != '}':
                    raise CompanionError('The saved file is incomplete or contains executable Lua.')
        m = re.match(r'(true|false|nil)\b|[-+]?(?:0[xX][a-fA-F0-9]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?)', self.text[self.pos:])
        if not m:
            raise CompanionError('Only saved data is accepted; Lua code is never executed.')
        self.pos += len(m[0])
        if m[0] in ('true','false','nil'):
            return {'true':True,'false':False,'nil':None}[m[0]]
        return int(m[0], 0) if re.fullmatch(r'[-+]?0[xX][0-9a-fA-F]+', m[0]) else float(m[0]) if any(x in m[0] for x in '.eE') else int(m[0])

    def parse(self):
        self.take('ToyboxExportDB')
        self.take('=')
        result = self.value()
        self.skip()
        if self.text[self.pos:self.pos+1] == ';':
            self.pos += 1
        self.skip()
        if self.pos != len(self.text) or not isinstance(result, dict):
            raise CompanionError('Only the ToyboxExportDB saved data is accepted.')
        return result


def snapshot_valid(snapshot, guid=None):
    if not isinstance(snapshot, dict) or snapshot.get('format') != 'toybox-addon-v1' or snapshot.get('version') != 1:
        raise CompanionError('This is not a Toybox snapshot.')
    character = snapshot.get('character', {})
    if not isinstance(character, dict) or not character.get('name') or not character.get('realm'):
        raise CompanionError('The snapshot has no character identity.')
    if guid and character.get('guid') != guid:
        raise CompanionError('The saved snapshot character does not match its GUID.')
    if not isinstance(snapshot.get('exportedAt'), (int,float)):
        raise CompanionError('The snapshot timestamp is missing.')
    if len(json.dumps(snapshot).encode()) > MAX_SNAPSHOT:
        raise CompanionError('The snapshot exceeds 2.5 MB.')
    return snapshot


def read_saved(path):
    before = path.stat()
    if before.st_size > MAX_FILE:
        raise CompanionError('The Toybox saved file is too large.')
    text = path.read_text(encoding='utf-8-sig')
    after = path.stat()
    if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
        raise CompanionError('WoW is still writing its saved file.')
    data = LuaData(text).parse()
    outbox = data.get('outbox', {})
    if not isinstance(outbox, dict) or len(outbox) > 250:
        raise CompanionError('Invalid Toybox snapshot outbox.')
    result = []
    for guid, payload in outbox.items():
        if not isinstance(guid, str) or not re.fullmatch(r'Player-\d+-[0-9a-fA-F]+', guid) or not isinstance(payload, str):
            raise CompanionError('Invalid saved snapshot identity.')
        if len(payload.encode()) > MAX_SNAPSHOT:
            raise CompanionError('The saved snapshot exceeds 2.5 MB.')
        result.append((guid, snapshot_valid(json.loads(payload), guid)))
    return result


def read_with_history(path):
    """Recover dated boss-clear evidence from WoW's own previous Toybox save."""
    snapshots = read_saved(path)
    try:
        previous = dict(read_saved(Path(str(path)+'.bak')))
    except (CompanionError,ValueError,UnicodeError,OSError):
        return snapshots  # A missing/broken backup never blocks the current save.
    for guid,current in snapshots:
        if current.get('capture'):
            continue  # Identified captures are immutable; the server retains historical clears.
        old = previous.get(guid)
        if not old or old.get('raidsFresh') is not True or not isinstance(current.get('game'),dict) or current['game'].get('version')!=1:
            continue
        identity = ('name','realm','region','guid')
        if any(str(current['character'].get(k,'')).casefold()!=str(old['character'].get(k,'')).casefold() for k in identity):
            continue
        old_at,now_at = old['exportedAt'],current['exportedAt']
        old_ms = old_at*(1000 if old_at<1e12 else 1)
        now_ms = now_at*(1000 if now_at<1e12 else 1)
        if not 1577836800000<=old_ms<=now_ms:
            continue
        raids=old.get('raidLockouts',[])
        if not isinstance(raids,list) or len(raids)>500:
            continue
        existing=current['game'].get('raidClears',[])
        if not isinstance(existing,list) or any(not isinstance(r,dict) or not isinstance(r.get('instance'),str) or not isinstance(r.get('encounter'),str) or type(r.get('difficultyId')) is not int or not isinstance(r.get('at'),(int,float)) for r in existing):
            continue
        clears = list(existing)
        for raid in raids:
            if not isinstance(raid,dict) or not isinstance(raid.get('name'),str) or len(raid['name'])>200 or type(raid.get('difficultyId')) is not int or not 1<=raid['difficultyId']<=250:
                continue
            encounters=raid.get('encounters',[])
            if not isinstance(encounters,list) or len(encounters)>100:
                continue
            for boss in encounters:
                if isinstance(boss,dict) and boss.get('killed') is True and isinstance(boss.get('name'),str) and len(boss['name'])<=200:
                    clears.append({'instance':raid['name'],'difficultyId':raid['difficultyId'],'encounter':boss['name'],'at':old_at})
        if clears:
            unique = {(r['instance'],r['difficultyId'],r['encounter']):r for r in clears}
            current['game']['raidClears'] = list(unique.values())[-2000:]
    return snapshots


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    path.parent.chmod(0o700)
    temp = path.with_name(path.name+'.tmp')
    with open(temp, 'w', encoding='utf-8') as stream:
        os.chmod(temp, 0o600)
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
    os.replace(temp, path)


def load_json(path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text())


def secure_store():
    try:
        import keyring
        backend = keyring.get_keyring()
        if not type(backend).__module__.startswith(('keyring.backends.macOS','keyring.backends.Windows','keyring.backends.SecretService','keyring.backends.kwallet')):
            raise CompanionError('A system credential store is required. Plain-text credential storage is disabled.')
        return keyring
    except ImportError:
        raise CompanionError('Install the companion requirements in its virtual environment first.') from None


def credential_key(state_dir):
    return hashlib.sha256(str(state_dir.resolve()).encode()).hexdigest()[:24]


def get_credentials(state_dir):
    raw = secure_store().get_password(SERVICE, credential_key(state_dir))
    if not raw:
        raise CompanionError('Run configure to connect this companion first.')
    return json.loads(raw)


def save_credentials(state_dir, credentials):
    secure_store().set_password(SERVICE, credential_key(state_dir), json.dumps(credentials))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise TransportError('Private-site access expired or was refused. Reconfigure the companion.', code)


class Client:
    def __init__(self, credentials, site=SITE):
        if site != SITE and not (urllib.parse.urlparse(site).scheme == 'http' and urllib.parse.urlparse(site).hostname in ('127.0.0.1','localhost')):
            raise CompanionError('Credentials can only be sent to your configured Toybox site.')
        self.credentials, self.site = credentials, site.rstrip('/')
        self.opener = urllib.request.build_opener(NoRedirect())

    def request(self, body=None, pair_id=None, proof=None, device=True):
        headers = {'Accept':'application/json','User-Agent':'ToyboxCompanion/'+VERSION,'OAI-Sites-Authorization':'Bearer '+self.credentials['siteAccess']}
        if device:
            if not self.credentials.get('token'):
                raise CompanionError('Run pair before starting background sync.')
            headers['Authorization'] = 'Bearer '+self.credentials['token']
        if proof:
            headers['X-Toybox-Pairing'] = proof
        url = self.site+'/api/companion'+('?pair='+urllib.parse.quote(pair_id) if pair_id else '')
        raw = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
        if raw is not None:
            headers['Content-Type'] = 'application/json'
        request = urllib.request.Request(url, data=raw, headers=headers)
        try:
            with self.opener.open(request, timeout=30) as response:
                if response.headers.get_content_type() != 'application/json':
                    raise TransportError('The private site requested sign-in. Reconfigure the companion.',401)
                return json.loads(response.read(3_000_000))
        except urllib.error.HTTPError as exc:
            message = 'Toybox rejected the request.'
            try:
                data = json.loads(exc.read(4096))
                message = data.get('error',message)
            except (ValueError,UnicodeError):
                if exc.code in (401,403):
                    message = 'Private-site access expired or this connection was revoked. Reconnect the companion.'
            raise TransportError(message,exc.code) from None
        except (urllib.error.URLError,TimeoutError,OSError):
            raise TransportError('Toybox is unreachable. Uploads will retry when the connection returns.') from None


def discover_wow():
    candidates = [Path('/Applications/World of Warcraft/_retail_'),Path('C:/Program Files (x86)/World of Warcraft/_retail_')]
    for path in candidates:
        if (path/'WTF/Account').is_dir():
            return path
    return None


def saved_files(wow):
    return sorted((wow/'WTF/Account').glob('*/SavedVariables/ToyboxExport.lua'))


class Watcher:
    def __init__(self, client, wow, state_dir, clock=time.time):
        self.client, self.wow, self.state_dir, self.clock = client, wow, state_dir, clock
        self.state = load_json(state_dir/'state.json', {'synced':{}})
        self.observed = {}
        self.heartbeat_at = 0
        self.retry_at = 0
        self.failures = 0
        self.locked_out = False
        self.guides_supported = (wow/'Interface/AddOns/ToyboxExport/Inbox.lua').is_file()

    def persist(self):
        atomic_json(self.state_dir/'state.json', self.state)

    def upload(self, guid, snapshot):
        guide = snapshot.get('guides') or {}
        reports = guide.get('reports') or []
        if isinstance(reports, list):
            self.state['guideReportRequestIds'] = [r['id'] for r in reports[:20] if isinstance(r,dict) and isinstance(r.get('id'),str)]
        if isinstance(reports, list):
            sent = self.state.setdefault('guideReports', {})
            for report in reports[:20]:
                if not isinstance(report, dict) or not isinstance(report.get('id'), str):
                    continue
                revision = report.get('revision', 1)
                if not isinstance(revision, int) or revision < 1 or revision <= sent.get(report['id'], 0):
                    continue
                try:
                    if report.get('deleted'):
                        self.client.request({'action':'guide-report-change','id':report['id'],'revision':revision,'deleted':True})
                    else:
                        self.client.request({'action':'guide-reports','reports':[report]})
                except TransportError as exc:
                    if exc.status not in (400, 413):
                        raise
                    self.state['reportError'] = str(exc)
                    self.persist()
                    continue
                sent[report['id']] = revision
                self.persist()
        digest = hashlib.sha256(json.dumps(snapshot, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        scope = ':'.join((snapshot['character'].get('region',''),snapshot['character']['realm'].casefold(),guid))
        previous = self.state['synced'].get(scope,{})
        at = snapshot['exportedAt'] * (1000 if snapshot['exportedAt'] < 1e12 else 1)
        if previous.get('hash') == digest or previous.get('exportedAt',0) > at:
            return False
        disk = self.state.get('diskObservations', {}).get(guid)
        result = self.client.request({'action':'upload','snapshot':snapshot, **({'disk':disk} if disk else {})})
        if isinstance(result.get('receipt'),dict):
            self.state.setdefault('captureReceipts', {})[guid] = result['receipt']
        if snapshot.get('guides'):
            self.state['guidesEnabled'] = True
        self.state['synced'][scope] = {'hash':digest,'exportedAt':at,'uploadedAt':int(self.clock()*1000),'name':snapshot['character']['name'],'realm':snapshot['character']['realm']}
        self.state['lastSuccessAt'] = int(self.clock()*1000)
        self.state.pop('error',None)
        self.persist()
        LOG.info('%s · %s: %s',snapshot['character']['name'],snapshot['character']['realm'],'newer data already saved' if result.get('ignored') else 'snapshot synced')
        return True

    def stage_profile(self):
        capabilities = []
        toc = self.wow/'Interface/AddOns/ToyboxExport/ToyboxExport.toc'
        if toc.is_file():
            match = re.search(r'^## Version:\s*(\d+)\.(\d+)\.(\d+)',toc.read_text(encoding='utf-8'),re.M)
            if match and tuple(map(int,match.groups())) >= (2,2,0):
                capabilities = ['session-v1','reports-v1']
            if match and tuple(map(int,match.groups())) >= (2,3,0):
                capabilities += ['guidance-v1','sync-receipts-v1']
        pending = self.state.get('guideReportRequestIds',[])[:20]
        profile = self.client.request({'action':'guide-profile','capabilities':capabilities,'reportIds':pending})
        if not isinstance(profile,dict) or profile.get('version') != 1 or not isinstance(profile.get('profile'),str) or not isinstance(profile.get('revision'),int) or not isinstance(profile.get('values'),dict) or not isinstance(profile.get('ack'),list):
            raise CompanionError('Guide preferences were invalid; the previous inbox was kept.')
        # An addon inbox contains preference data only. No observations or tokens.
        clean = {k:profile[k] for k in ('version','profile','revision','values','ack')}
        if 'reports-v1' in capabilities and isinstance(profile.get('reportAck'),dict):
            clean['reportAck'] = profile['reportAck']
        if 'sync-receipts-v1' in capabilities and isinstance(profile.get('captureAck'),dict):
            clean['captureAck'] = profile['captureAck']
        data = json.dumps(clean,ensure_ascii=False,separators=(',',':')).encode('utf-8')
        if len(data)>750000:
            raise CompanionError('Guide preferences exceeded the supported inbox size.')
        directory = self.wow/'Interface/AddOns/ToyboxExport'
        toc = directory/'ToyboxExport.toc'
        target = directory/'Inbox.lua'
        if not toc.is_file() or 'Inbox.lua' not in toc.read_text(encoding='utf-8'):
            return False
        if directory.is_symlink() or target.is_symlink():
            raise CompanionError('The guide inbox must be a regular file in the installed addon.')
        marker = '-- Managed by the optional companion.'
        if target.exists() and not target.read_text(encoding='utf-8').startswith(marker):
            raise CompanionError('The guide inbox is not managed by Toybox; it was left unchanged.')
        digest = hashlib.sha256(data).hexdigest()
        if self.state.get('guideInboxHash') == digest and target.exists():
            return False
        # Decimal byte escapes cannot terminate the fixed string or execute Lua.
        content = marker+' A JSON string, never downloaded code.\nToyboxSyncInbox = "'+''.join('\\'+str(b).zfill(3) for b in data)+'"\n'
        temporary = directory/'Inbox.lua.tmp'
        with temporary.open('w',encoding='ascii') as output:
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
        temporary.replace(target)
        self.state['guideInboxHash'] = digest
        self.state['guideRevision'] = profile['revision']
        self.persist()
        return True

    def scan(self, settle=2):
        self.state['runningVersion'] = VERSION
        self.state['lastScanAt'] = int(self.clock()*1000)
        if self.clock() < self.retry_at:
            return 0
        count, found, errors = 0, False, []
        paths = saved_files(self.wow)
        for path in paths:
            try:
                stat = path.stat()
                signature = (stat.st_mtime_ns, stat.st_size)
                previous = self.observed.get(str(path))
                if previous is None or previous[0] != signature:
                    self.observed[str(path)] = (signature,self.clock())
                    if settle:
                        continue
                elif self.clock()-previous[1] < settle:
                    continue
                snapshots = read_with_history(path)
                found = found or bool(snapshots)
                for guid,snapshot in snapshots:
                    capture = snapshot.get('capture') or {}
                    self.state.setdefault('diskObservations', {})[guid] = {'guid':guid,'captureId':capture.get('id'),'capturedAt':int(capture.get('at',snapshot['exportedAt'])*(1000 if capture.get('at',snapshot['exportedAt'])<1e12 else 1)),'observedAt':int(self.clock()*1000),'fileWrittenAt':int(stat.st_mtime*1000)}
                    count += int(self.upload(guid,snapshot))
            except TransportError:
                raise
            except (CompanionError,ValueError,UnicodeError,OSError) as exc:
                errors.append(str(exc) if isinstance(exc,CompanionError) else 'The saved file is incomplete. Waiting for the next save.')
        self.state['status'] = 'watching' if found else 'waiting'
        self.state['savedFiles'] = len(paths)
        if errors:
            self.state['error'] = errors[0]
            self.state['status'] = 'retrying'
        else:
            self.state.pop('error',None)
        self.persist()
        if self.clock()-self.heartbeat_at >= 60:
            self.client.request({'action':'heartbeat','status':self.state['status'],'error':self.state.get('error'),'sync':{'version':1,'runningVersion':VERSION,'lastScanAt':self.state.get('lastScanAt'),'observations':list(self.state.get('diskObservations',{}).values())[-100:],'reportError':self.state.get('reportError')}})
            if self.state.get('guidesEnabled') or self.guides_supported:
                try:
                    self.stage_profile()
                    self.state.pop('guideError',None)
                except (CompanionError,ValueError,UnicodeError,OSError) as exc:
                    if isinstance(exc,TransportError):
                        raise
                    self.state['guideError'] = str(exc) if isinstance(exc,CompanionError) else 'Guide preferences could not be staged. Uploads continue; check the addon folder.'
                    LOG.warning('%s',self.state['guideError'])
                    self.persist()
            self.heartbeat_at = self.clock()
        self.failures = 0
        self.retry_at = 0
        return count

    def step(self, settle=2):
        try:
            count = self.scan(settle)
            self.locked_out = False
            return count
        except TransportError as exc:
            self.failures += 1
            self.locked_out = exc.status in (401,403,302,303,307,308)
            delay = 300 if self.locked_out else min(300,5*2**min(self.failures-1,6))
            self.retry_at = self.clock()+delay
            self.state.update(status='needs-connection' if self.locked_out else 'retrying',error=str(exc),retryAt=int(self.retry_at*1000))
            self.persist()
            LOG.warning('%s Next attempt in %ss.',str(exc),delay)
            return 0


def configure(args):
    config = load_json(args.state_dir/'config.json',{})
    wow = args.wow_dir or discover_wow()
    if not wow or not (wow/'WTF/Account').is_dir():
        raise CompanionError('Select the _retail_ folder containing WTF/Account with --wow-dir.')
    try:
        previous = get_credentials(args.state_dir)
    except CompanionError:
        previous = {}
    if args.credentials_stdin:
        credentials = json.loads(getpass.getpass('Private companion setup JSON (hidden): '))
    else:
        credentials = {'siteAccess':getpass.getpass('Private-site service access token (hidden): ')}
    if not isinstance(credentials.get('siteAccess'),str) or not credentials['siteAccess']:
        raise CompanionError('A private-site service credential is required.')
    previous.update(credentials)
    save_credentials(args.state_dir,previous)
    config.update(wowDir=str(wow.resolve()),name=args.name or config.get('name') or ('This Mac' if sys.platform=='darwin' else 'My WoW computer'),site=SITE)
    atomic_json(args.state_dir/'config.json',config)
    print('Private credentials saved in the system credential store. Run pair next.')


def pair(args):
    config = load_json(args.state_dir/'config.json',{})
    credentials = get_credentials(args.state_dir)
    client = Client(credentials)
    proof = secrets.token_hex(32)
    result = client.request({'action':'start','name':config.get('name','My WoW computer'),'challenge':hashlib.sha256(proof.encode()).hexdigest()},device=False)
    url = SITE+'/?companionPair='+result['id']
    print('Open this connection link in your signed-in browser:',flush=True)
    print(url,flush=True)
    if not args.no_browser:
        webbrowser.open(url)
    deadline = time.monotonic()+600
    while time.monotonic() < deadline:
        time.sleep(2)
        status = client.request(pair_id=result['id'],proof=proof,device=False)
        if not status.get('pending'):
            credentials.update(token=status['token'],deviceId=status['deviceId'])
            save_credentials(args.state_dir,credentials)
            config['deviceId'] = status['deviceId']
            atomic_json(args.state_dir/'config.json',config)
            client = Client(credentials)
            client.request({'action':'heartbeat','status':'waiting'})
            print('Connected. Run install to keep syncing in the background.',flush=True)
            return
    raise CompanionError('Pairing expired. Run pair again.')


def instance_lock(state_dir):
    # A held OS lock releases automatically when the process exits or crashes.
    path = state_dir/'watcher.lock'
    path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    stream = open(path,'a+')
    try:
        if os.name == 'nt':
            import msvcrt
            stream.seek(0);stream.write('0');stream.flush();stream.seek(0)
            msvcrt.locking(stream.fileno(),msvcrt.LK_NBLCK,1)
        else:
            import fcntl
            fcntl.flock(stream,fcntl.LOCK_EX|fcntl.LOCK_NB)
    except OSError:
        stream.close()
        raise CompanionError('The background watcher is already running. Use status to check it.') from None
    return stream


def watch(args):
    config = load_json(args.state_dir/'config.json',{})
    if not config.get('wowDir'):
        raise CompanionError('Run configure first.')
    lock = instance_lock(args.state_dir)
    watcher = Watcher(Client(get_credentials(args.state_dir)),Path(config['wowDir']),args.state_dir)
    stopping = False
    def stop(_signal,_frame):
        nonlocal stopping
        stopping = True
    signal.signal(signal.SIGTERM,stop)
    signal.signal(signal.SIGINT,stop)
    LOG.info('Watching Toybox saved snapshots. Log out or /reload in WoW to save current data.')
    try:
        if args.export:
            snapshot = snapshot_valid(json.loads(args.export.read_text()))
            watcher.upload(snapshot['character'].get('guid') or snapshot['character']['name'],snapshot)
            return
        while not stopping:
            watcher.step(settle=0 if args.once else 2)
            if args.once:
                if watcher.state.get('error'):
                    raise CompanionError(watcher.state['error'])
                print('Sync check finished. '+('Waiting for a saved Toybox Export 1.3 snapshot.' if watcher.state.get('status')=='waiting' else 'Saved snapshots are up to date.'))
                return
            time.sleep(5)
    finally:
        lock.close()


def launch_agent(args, remove=False):
    if sys.platform != 'darwin':
        raise CompanionError('Automatic service installation is currently available on macOS. Run watch with your operating system’s startup manager on other platforms.')
    get_credentials(args.state_dir)
    config = load_json(args.state_dir/'config.json',{})
    if not config.get('deviceId'):
        raise CompanionError('Run pair before installing the background service.')
    plist_path = Path.home()/'Library/LaunchAgents'/f'{LABEL}.plist'
    domain = f'gui/{os.getuid()}'
    if plist_path.exists():
        subprocess.run(['launchctl','bootout',domain,str(plist_path)],capture_output=True)
    if remove:
        if plist_path.exists():
            plist_path.unlink()
        print('Background service stopped. Your saved game progress and connection are kept.')
        return
    args.state_dir.mkdir(parents=True,exist_ok=True,mode=0o700)
    plist_path.parent.mkdir(parents=True,exist_ok=True)
    payload={'Label':LABEL,'ProgramArguments':[str(Path(sys.executable).absolute()),str(Path(__file__).resolve()),'--state-dir',str(args.state_dir),'watch'],'WorkingDirectory':str(ROOT),'RunAtLoad':True,'KeepAlive':True,'ThrottleInterval':30,'StandardOutPath':str(args.state_dir/'service.log'),'StandardErrorPath':str(args.state_dir/'service.log')}
    plist_path.write_bytes(plistlib.dumps(payload))
    plist_path.chmod(0o600)
    result = subprocess.run(['launchctl','bootstrap',domain,str(plist_path)],capture_output=True,text=True)
    if result.returncode:
        raise CompanionError('macOS could not start the service: '+result.stderr.strip()[:200])
    print('Background sync installed and started. It also starts when you sign in to this Mac.')


def status(args):
    config = load_json(args.state_dir/'config.json',{})
    state = load_json(args.state_dir/'state.json',{})
    print(json.dumps({'version':VERSION,'runningVersion':state.get('runningVersion'),'lastScanAt':state.get('lastScanAt'),'guideError':state.get('guideError'),'reportError':state.get('reportError'),'configured':bool(config),'paired':bool(config.get('deviceId')),'gameFolder':config.get('wowDir'),'status':state.get('status','Not started'),'lastSuccessAt':state.get('lastSuccessAt'),'savedFiles':state.get('savedFiles'),'error':state.get('error'),'characters':list(state.get('synced',{}).values())},indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--state-dir',type=Path,default=DEFAULT_STATE)
    sub = parser.add_subparsers(dest='command',required=True)
    setup = sub.add_parser('configure',help='Store private-site access in the system credential store.')
    setup.add_argument('--wow-dir',type=Path)
    setup.add_argument('--name')
    setup.add_argument('--credentials-stdin',action='store_true',help=argparse.SUPPRESS)
    connect = sub.add_parser('pair',help='Connect to your signed-in Toybox account once.')
    connect.add_argument('--no-browser',action='store_true')
    watcher = sub.add_parser('watch',help='Watch Toybox saved files and upload changed snapshots.')
    watcher.add_argument('--once',action='store_true')
    watcher.add_argument('--export',type=Path,help='Import an existing Toybox JSON export once.')
    for name in ('status','install','uninstall'):
        sub.add_parser(name)
    args = parser.parse_args()
    args.state_dir = args.state_dir.expanduser().resolve()
    logging.basicConfig(level=logging.INFO,format='%(asctime)s %(message)s',datefmt='%Y-%m-%d %H:%M:%S')
    try:
        {'configure':configure,'pair':pair,'watch':watch,'status':status,'install':launch_agent,'uninstall':lambda a:launch_agent(a,remove=True)}[args.command](args)
    except (CompanionError,ValueError,OSError) as exc:
        print('Toybox: '+str(exc),file=sys.stderr)
        return 1
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
