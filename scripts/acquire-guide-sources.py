"""Fetch only pinned, permitted text sources; research references are never bulk imported."""
from pathlib import Path
import argparse,hashlib,json,urllib.request
ROOT=Path(__file__).resolve().parents[1]
def main():
 p=argparse.ArgumentParser();p.add_argument('--download',action='store_true');p.add_argument('--check',action='store_true');args=p.parse_args()
 manifest=json.loads((ROOT/'docs/GUIDE-CONTENT-SOURCES.json').read_text());cache=ROOT/'work/content-sources';cache.mkdir(parents=True,exist_ok=True)
 results=[]
 for source in manifest['imports']:
  if source['license']!='MIT' or not source['url'].startswith('https://raw.githubusercontent.com/') or not source.get('revision'):raise ValueError('Only pinned permitted raw sources may be acquired.')
  path=cache/(source['id']+'.txt')
  if args.download and not path.exists():
   request=urllib.request.Request(source['url'],headers={'User-Agent':'Toybox-content-authoring/2.1'})
   data=urllib.request.urlopen(request,timeout=30).read(20_000_001)
   if len(data)>20_000_000:raise ValueError('Source exceeds 20 MB.')
   # Existing source manifest hashes were calculated after UTF-8 BOM removal.
   normalized=data.decode('utf-8-sig').replace('\r\n','\n').encode()
   if hashlib.sha256(normalized).hexdigest()!=source['sha256']:raise ValueError('Pinned source checksum mismatch: '+source['id'])
   path.write_bytes(normalized)
  if path.exists():
   if hashlib.sha256(path.read_bytes()).hexdigest()!=source['sha256']:raise ValueError('Cached source checksum mismatch: '+source['id'])
   results.append({'id':source['id'],'status':'verified'})
  else:results.append({'id':source['id'],'status':'not cached; use --download'})
 print(json.dumps({'sources':results,'consultationOnly':len(manifest['references'])}))
 if args.check and any(r['status']!='verified' for r in results):raise SystemExit('Source cache is incomplete; acquire permitted sources before verification.')
if __name__=='__main__':main()
