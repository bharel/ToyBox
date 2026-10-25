"""Build a deterministic, credential-free source download from tracked project inputs."""
from pathlib import Path
import subprocess,zipfile,hashlib,json
root=Path(__file__).resolve().parents[1]
paths=subprocess.check_output(['git','ls-files','-z','--cached','--others','--exclude-standard'],cwd=root).decode().split('\0')
output=root/'public/downloads/ToyboxGuides-source.zip';output.parent.mkdir(parents=True,exist_ok=True)
files=[]
for name in sorted(set(paths)):
    path=root/name
    if not name or not path.is_file() or path.is_symlink():continue
    if name.startswith(('public/downloads/','.git/','.sites-runtime/','.wrangler/','node_modules/','work/','outputs/')) or name.endswith(('.zip','.tar.gz','.pem','.key','.p12','.pfx','.sqlite','.sqlite3','.db')):continue
    if path.name.startswith(('.env','.dev.vars')) and path.name not in ('.env.example','.dev.vars.example'):continue
    if name.startswith('companion/site.local.') or any(part in ('WTF','SavedVariables','SavedVariablesPerCharacter') for part in Path(name).parts):continue
    if path.name in ('cookies.json','cookies.txt') or path.name.startswith(('storage-state','storageState')):continue
    files.append(name)
manifest={name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in files}
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
    for name,data in [(name,(root/name).read_bytes()) for name in files]+[('SOURCE-HASHES.json',(json.dumps(manifest,indent=2,sort_keys=True)+'\n').encode())]:
        info=zipfile.ZipInfo('ToyboxGuides-source/'+name,date_time=(2026,10,24,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16;archive.writestr(info,data)
print('Packaged ToyboxGuides-source.zip:',len(files),'source files')
