"""Read-only quality audit; never treats unavailable evidence as a pass."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin,urlsplit,unquote,quote
from urllib.request import Request,urlopen
from urllib.error import HTTPError,URLError
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timezone
import unicodedata
import argparse,hashlib,json,time,ssl,socket,subprocess,xml.etree.ElementTree as ET
from criteria import CRITERIA
ROOT=Path(__file__).resolve().parents[2]
BASE='https://todoroki-gold.com/'
class HTML(HTMLParser):
 def __init__(self,text):
  super().__init__();self.tags=[];self.feed(text)
 def handle_starttag(self,t,a):self.tags.append((t,dict(a)))
def request(url,opener=urlopen,sleep=time.sleep):
 attempts=[]
 for i in range(3):
  try:
   start=time.monotonic()
   with opener(Request(quote(url,safe=':/?&=%+#'),headers={'User-Agent':'TODOROKI-Quality-Audit/1.0'}),timeout=20) as r:
    body=r.read(8*1024*1024)
    return dict(url=url,final_url=r.url,status=r.status,seconds=round(time.monotonic()-start,3),headers={k:v for k,v in r.headers.items() if k.lower() in ('content-type','cache-control','content-security-policy','strict-transport-security','x-content-type-options')},sha256=hashlib.sha256(body).hexdigest(),pdf=body.startswith(b'%PDF-'),attempts=attempts)
  except HTTPError as e:
   attempts.append({'status':e.code})
   if e.code not in (429,500,502,503,504):break
  except (URLError,TimeoutError,OSError) as e:attempts.append({'error':type(e).__name__})
  if i<2:sleep(2**i)
 return dict(url=url,attempts=attempts,status=attempts[-1].get('status'),kind='inconclusive' if attempts[-1].get('status') in (None,401,403,429) else 'http_failure')
def fingerprint(x):return hashlib.sha256(json.dumps(x,sort_keys=True,ensure_ascii=False).encode()).hexdigest()[:24]
def resolve(page,url):
 u=urlsplit(urljoin(BASE+page.relative_to(ROOT).as_posix(),url))
 if u.netloc!=urlsplit(BASE).netloc:return None,u
 path=ROOT/unquote(u.path).lstrip('/')
 if path.is_dir():path=path/'index.html'
 if not path.exists() and not path.suffix:path=path.with_suffix('.html')
 if not path.exists():
  key=unicodedata.normalize('NFC',str(path))
  path=next((x for x in ROOT.rglob('*') if unicodedata.normalize('NFC',str(x))==key),path)
 return path,u
def run(mode,out,previous=None,live=True):
 now=datetime.now(timezone.utc).isoformat(); rows={c['id']:{**c,'result':'未確認','last_run':None,'errors':[],'evidence':[],'repair_status':'未着手','retest':None} for c in CRITERIA}
 prior=json.loads(Path(previous).read_text()) if previous and Path(previous).exists() else None
 if prior:
  for old in prior['items']:
   if old['id'] in rows:rows[old['id']].update({k:old[k] for k in ('result','last_run','errors','evidence','repair_status','retest')})
 def result(i,errors,evidence,partial=False):
  row=rows[f'TQ{i:02}'];old=row['result'];row.update(result=('未完了' if errors else '一部完了' if partial else '完了'),last_run=now,errors=errors,evidence=evidence,retest={'previous':old,'at':now})
 pages={p:HTML(p.read_text()) for p in ROOT.rglob('*.html') if not any(s in p.parts for s in ('.git','node_modules','quality-results'))}
 if mode!='hourly':
  problems={i:[] for i in (8,9,10,11,15,16,17,18,19,21,22,23,24,27,35,50,51)}
  titles={};canonical={};links=set();ext=set();pdfs={};counts=Counter()
  for p,d in pages.items():
   rel=p.relative_to(ROOT).as_posix();text=p.read_text();tags=d.tags
   noindex=any(t=='meta' and a.get('name')=='robots' and 'noindex' in a.get('content','') for t,a in tags)
   if not __import__('re').search(r'<title[^>]*>\s*[^<\s]',text,__import__('re').I):problems[8].append([rel,'empty title'])
   for block in __import__('re').findall(r'<script[^>]*type=[\"\']application/ld\+json[\"\'][^>]*>(.*?)</script>',text,__import__('re').S|__import__('re').I):
    try:
     value=json.loads(block)
     if not isinstance(value,(dict,list)):problems[19].append([rel,'invalid JSON-LD root'])
    except json.JSONDecodeError:problems[19].append([rel,'invalid JSON-LD'])
   if noindex and any(t=='link' and a.get('rel')=='canonical' for t,a in tags):counts['noindex_with_canonical']+=1
   for i,t,attr,value in [(8,'title',None,None),(9,'meta','name','description'),(10,'link','rel','canonical')]:
    found=[a for tag,a in tags if tag==t and (attr is None or a.get(attr)==value)]
    if not noindex and len(found)!=1:problems[i].append([rel,'expected one tag',len(found)])
    if found and attr and not (found[0].get('content') or found[0].get('href')):problems[i].append([rel,'empty value'])
   for tag,a in tags:
    if tag=='link' and a.get('rel')=='canonical':
     target,u=resolve(p,a.get('href',''));canonical.setdefault(a.get('href',''),[]).append(rel)
     if target!=p:problems[10].append([rel,'canonical target mismatch',a.get('href')])
    if a.get('hreflang'):
     target,u=resolve(p,a.get('href',''))
     if target is not None and not target.exists():problems[11].append([rel,'missing language target',a.get('href')])
    if tag=='img' and 'alt' not in a:problems[50].append([rel,a.get('src')])
    if tag in ('input','select','textarea') and a.get('type') not in ('hidden','submit','button'):
     if not (a.get('aria-label') or a.get('aria-labelledby') or any(t=='label' and z.get('for')==a.get('id') and a.get('id') for t,z in tags)):problems[51].append([rel,a.get('id'),'requires browser verification of wrapping label'])
    url=a.get('href') or a.get('src')
    if not url or urlsplit(url).scheme in ('mailto','tel','javascript','data'):continue
    target,u=resolve(p,url)
    if target is None:ext.add(u._replace(fragment='').geturl());continue
    links.add(u._replace(fragment='').geturl())
    if u.path.startswith('/api/'):continue
    if not target.exists():problems[18].append([rel,url])
    elif u.fragment and target in pages and unquote(u.fragment) not in {a.get('id') for t,a in pages[target].tags}:problems[21].append([rel,url])
   scripts=[a['src'] for t,a in tags if t=='script' and a.get('src')]
   problems[27].extend([rel,s] for s,n in Counter(scripts).items() if n>1)
   heads=[int(t[1]) for t,a in tags if len(t)==2 and t[0]=='h' and t[1].isdigit()]
   if not noindex and heads.count(1)!=1:problems[16].append([rel,'h1 count',heads.count(1)])
   if any(b>a+1 for a,b in zip(heads,heads[1:])):problems[16].append([rel,'heading level jump'])
   ids=[a['id'] for t,a in tags if a.get('id')]
   problems[17].extend([rel,'duplicate id',s] for s,n in Counter(ids).items() if n>1)
  for url,rels in canonical.items():
   if len(rels)>1:problems[17].append(['duplicate canonical',url,rels])
  for i in (8,9,10,11,16,17,18,19,21,27,50,51):result(i,[] if i==51 else problems[i],[{'html_count':len(pages),'scope':'static source across all languages','review_candidates':problems[i] if i==51 else []}],partial=True)
  for i,file in ((12,'robots.txt'),(13,'sitemap.xml'),(14,'sitemap-pdfs.xml')):
   errors=[];p=ROOT/file
   if not p.exists():errors.append('missing file')
   elif file.endswith('.xml'):
    try:
     urls=[e.text for e in ET.fromstring(p.read_text()).iter() if e.tag.endswith('}loc')]
     for url in urls:
      target,u=resolve(ROOT/'index.html',url);links.add(url)
      if target is not None and not target.exists():errors.append(url)
    except ET.ParseError as e:errors.append(str(e))
   result(i,errors,[file],partial=True)
  catalog=json.loads((ROOT/'assets/pdf-catalog.json').read_text())
  result(23,[u for u in catalog if not resolve(ROOT/'index.html',u)[0].is_file()],[{'catalog_entries':len(catalog)}],partial=True)
  for p in (ROOT/'pdf').rglob('*.pdf'):
   data=p.read_bytes();pdfs.setdefault(hashlib.sha256(data).hexdigest(),[]).append(p.relative_to(ROOT).as_posix())
   if not data.startswith(b'%PDF-'):problems[22].append(str(p.relative_to(ROOT)))
  result(22,problems[22],[{'pdf_files':sum(map(len,pdfs.values()))}],partial=True)
  result(25,[],[{'duplicate_pdf_groups':[v for v in pdfs.values() if len(v)>1]}],partial=True)
  if live and mode in ('daily','weekly','monthly','all'):
   with ThreadPoolExecutor(max_workers=4) as pool:network=list(pool.map(request,sorted(links|ext)))
   for i,scope in ((18,links),(20,ext)):
    data=[x for x in network if x['url'] in scope];errors=[x for x in data if x.get('kind')=='http_failure']
    result(i,rows[f'TQ{i:02}']['errors']+errors,data,partial=any(x.get('kind')=='inconclusive' for x in data))
 if live:
  urls=[BASE,BASE+'boki1',BASE+'pdf-library',BASE+'en/',BASE+'es/',BASE+'pt/',BASE+'zh-Hans/',BASE+'zh-Hant/',BASE+'api/privacy/region']
  network=[request(u) for u in urls]
  for i,data in ((1,network[:1]),(2,network[1:-1]),(3,network),(4,network),(6,network[-1:]),(7,network)):
   errors=[x for x in data if x.get('kind')=='http_failure']
   if i==7:errors=[x for x in data if x.get('seconds',0)>10]
   result(i,errors,data,partial=any('kind' in x for x in data))
   if all(x.get('kind')=='inconclusive' for x in data):rows[f'TQ{i:02}']['result']='未確認'
 browser=Path(out)/'browser.json'
 if browser.exists():
  for key,data in json.loads(browser.read_text()).items():
   result(int(key),data['errors'],data['evidence'],partial=True)
   if data['evidence'] and all('inconclusive' in e for e in data['evidence']):rows[f'TQ{int(key):02}']['result']='未確認'
 # A full 62-row ledger always exists; unimplemented/manual checks remain unknown.
 items=list(rows.values());current={fingerprint([x['id'],e]):{'id':x['id'],'detail':e} for x in items for e in x['errors']}
 old=prior.get('findings',{}) if prior else {};new={k:v for k,v in current.items() if k not in old};resolved=[k for k in old if k not in current]
 report={'schema':1,'criteria_status':'provisional-original-missing','at':now,'timezone':'Asia/Tokyo','mode':mode,'source_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'items':items,'counts':dict(Counter(x['result'] for x in items)),'findings':current,'new_findings':new,'resolved':resolved,'notification_candidates':{k:v for k,v in new.items() if v['id'] in ('TQ01','TQ02','TQ03','TQ06','TQ10','TQ18','TQ20','TQ26','TQ28','TQ29','TQ30','TQ31','TQ32','TQ33','TQ34','TQ35','TQ36','TQ37','TQ38','TQ39','TQ53','TQ54','TQ55','TQ57','TQ59')},'limitations':['No original checklist; no real iPhone test','Unimplemented checks remain unknown; no claim of complete automation']}
 out=Path(out);out.mkdir(parents=True,exist_ok=True);(out/'latest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 (out/'summary.md').write_text('# TODOROKI 暫定62項目監査\n\n'+now+'\n\n|ID|項目|判定|最終実行|\n|---|---|---|---|\n'+''.join(f"|{x['id']}|{x['name']}|{x['result']}|{x['last_run'] or '未実行'}|\n" for x in items))
 print(json.dumps(report['counts'],ensure_ascii=False));return report
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--mode',default='daily',choices=['hourly','daily','weekly','monthly','all']);p.add_argument('--out',default='quality-results');p.add_argument('--previous');p.add_argument('--offline',action='store_true');a=p.parse_args();run(a.mode,a.out,a.previous,not a.offline)
