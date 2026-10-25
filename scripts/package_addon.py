from pathlib import Path
import zipfile,json
root=Path(__file__).resolve().parents[1]
output=root/'public/downloads/ToyboxExport.zip'
output.parent.mkdir(parents=True,exist_ok=True)
manifest=json.loads((root/'docs/SOURCE-MANIFEST.json').read_text())
(root/'addon/ToyboxExport/SOURCES.json').write_text(json.dumps(manifest,indent=2)+'\n')
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as z:
    for file in sorted((root/'addon/ToyboxExport').iterdir()):
        info=zipfile.ZipInfo('ToyboxExport/'+file.name,date_time=(2026,10,21,0,0,0))
        info.compress_type=zipfile.ZIP_DEFLATED
        info.external_attr=0o644<<16
        z.writestr(info,file.read_bytes())
print('Packaged ToyboxExport.zip')
