from pathlib import Path
import zipfile
root=Path(__file__).resolve().parents[1]
output=root/'public/downloads/ToyboxCompanion.zip'
output.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
    for name in ('toybox_companion.py','requirements.txt','README.md'):
        info=zipfile.ZipInfo('ToyboxCompanion/companion/'+name,date_time=(2026,10,23,0,0,0))
        info.compress_type=zipfile.ZIP_DEFLATED
        info.external_attr=0o644<<16
        archive.writestr(info,(root/'companion'/name).read_bytes())
print('Packaged ToyboxCompanion.zip')
