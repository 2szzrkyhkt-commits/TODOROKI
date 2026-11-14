"""Bounded public publication checks; never requests advertising endpoints."""
from pathlib import Path
from urllib.parse import urlsplit,quote
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError, URLError
from html.parser import HTMLParser
from datetime import datetime, timezone
import argparse, json, xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[2]
ORIGIN='https://todoroki-gold.com'
ADS='google.com, pub-7179318481718851, DIRECT, f08c47fec0942fa0'
class Tags(HTMLParser):
 def __init__(self,text):super().__init__();self.tags=[];self.feed(text)
 def handle_starttag(self,t,a):self.tags.append((t,dict(a)))
def index_policy(text):
 tags=Tags(text).tags
 return {'noindex':any(t=='meta' and a.get('name','').lower()=='robots' and 'noindex' in a.get('content','').lower() for t,a in tags),'canonical':[a.get('href') for t,a in tags if t=='link' and a.get('rel')=='canonical']}
def sitemap_urls(text):
 return {n.text.strip() for n in ET.fromstring(text).iter() if n.tag.endswith('}loc') and n.text}
def ads_authorized(text):
 return any(','.join(x.strip() for x in line.split('#',1)[0].split(','))==','.join(x.strip() for x in ADS.split(',')) for line in text.splitlines())
class SameOriginRedirect(HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,newurl):
  if urlsplit(newurl).scheme!='https' or urlsplit(newurl).netloc!='todoroki-gold.com':raise ValueError('unexpected cross-origin redirect')
  return super().redirect_request(req,fp,code,msg,headers,newurl)
def read_public(path):
 url=ORIGIN+path
 try:
  with build_opener(SameOriginRedirect()).open(Request(url,headers={'User-Agent':'TODOROKI-Quality-Audit/1.0'}),timeout=20) as r:
   return {'status':r.status,'final_url':r.url,'text':r.read(5*1024*1024).decode('utf-8'),'robots':r.headers.get('X-Robots-Tag',''),'link':r.headers.get('Link','')}
 except HTTPError as e:return {'status':e.code,'inconclusive':e.code in (401,403,429)}
 except (URLError,TimeoutError,OSError) as e:return {'inconclusive':True,'reason':type(e).__name__}
 except ValueError:return {'inconclusive':False,'reason':'unexpected_redirect_or_invalid_response'}
def run(root=ROOT,live=False,reader=read_public):
 checks=[]
 def add(name,ok,**evidence):checks.append({'check':name,'state':'passed' if ok else 'failed',**evidence})
 ads=(root/'ads.txt').read_text();add('ads.txt authorized publisher',ads_authorized(ads))
 sitemaps={name:sitemap_urls((root/name).read_text()) for name in ('sitemap.xml','sitemap-pdfs.xml')}
 noindex=[];indexable=[];missing_consent=[];canonical_errors=[];ad_errors=[]
 for p in root.rglob('*.html'):
  if any(x in p.parts for x in ('.git','node_modules','quality-results')):continue
  rel=p.relative_to(root).as_posix();text=p.read_text();policy=index_policy(text)
  tags=Tags(text).tags
  clients=[a.get('content') for t,a in tags if t=='meta' and a.get('name','').lower()=='google-adsense-account']
  loaders=[a.get('src') for t,a in tags if t=='script' and 'adsbygoogle.js' in a.get('src','')]
  slots=[a for t,a in tags if t=='ins' and 'adsbygoogle' in a.get('class','').split()]
  if len(clients)>1 or any(c!='ca-pub-7179318481718851' for c in clients) or loaders or any(a.get('data-ad-client')!='ca-pub-7179318481718851' or not a.get('data-ad-slot') for a in slots):ad_errors.append(rel)
  if policy['noindex']:noindex.append(rel);continue
  indexable.append(rel)
  if '/assets/privacy-controls.js' not in text:missing_consent.append(rel)
  expected=ORIGIN+('/' if rel=='index.html' else '/'+rel[:-10] if rel.endswith('/index.html') else '/'+rel[:-5])
  if policy['canonical']!=[expected]:canonical_errors.append(rel)
 for rel in noindex:
  clean=rel[:-5];url=ORIGIN+('/' if clean=='index' else '/'+clean)
  if url in sitemaps['sitemap.xml']:canonical_errors.append(rel)
 add('advertising publisher and consent-only loading',not ad_errors,errors=ad_errors,scope='source placement; Auto ads settings and actual delivery require AdSense owner')
 add('indexable pages use consent loader',not missing_consent,pages=len(indexable),missing=missing_consent)
 add('noindex policy and canonical inventory',not canonical_errors,noindex_pages=sorted(noindex),errors=canonical_errors,scope='source policy, not GSC exclusion reasons')
 for name,urls in sitemaps.items():add(name+' uses own HTTPS origin',all(u.startswith(ORIGIN+'/') for u in urls),url_count=len(urls))
 if live:
  for name in ('ads.txt','robots.txt','sitemap.xml','sitemap-pdfs.xml'):
   r=reader('/'+name);text=r.pop('text','')
   if r.get('inconclusive'):checks.append({'check':'live '+name,'state':'inconclusive',**r});continue
   ok=r.get('status')==200
   if ok and name=='ads.txt':ok=ads_authorized(text)
   if ok and name=='robots.txt':ok=all('Sitemap: '+ORIGIN+'/'+x in text for x in sitemaps)
   if ok and name in sitemaps:
    try:ok=sitemap_urls(text)==sitemaps[name]
    except ET.ParseError:ok=False
   add('live '+name,ok,**r)
  for path in ('/es/margin-of-safety.html','/es/mbo-investing.html','/zh-Hans/japanese-stocks.html','/business-ma.html','/business-list.html','/price-value.html','/inflation.html','/investment-list.html','/economy-list.html','/inflation-asset-gap.html','/interest-rate.html'):
   r=reader(path);text=r.pop('text','');expected=ORIGIN+path[:-5]
   if r.get('inconclusive'):checks.append({'check':'canonical redirect '+path,'state':'inconclusive',**r});continue
   add('canonical redirect '+path,r.get('status')==200 and r.get('final_url')==expected and index_policy(text)['canonical']==[expected],**r)
  for path,target in [('/pdf/Amazon輸入ビジネス_価格差と相乗り販売_修正版.pdf','/pdf/Amazon輸入ビジネス_価格差と相乗り販売.pdf'),('/pdf/社会的選好_情報共有_フリーライド_黒金.pdf','/pdf/社会的選好と情報共有_仕事仲間の協力_改訂版.pdf'),('/pdf/社会的選好と情報共有_仕事仲間の協力.pdf','/pdf/社会的選好と情報共有_仕事仲間の協力_改訂版.pdf')]:
   r=reader(quote(path));r.pop('text','')
   if r.get('inconclusive'):checks.append({'check':'PDF canonical '+path,'state':'inconclusive',**r});continue
   add('PDF canonical '+path,r.get('status')==200 and r.get('link')=='<'+ORIGIN+quote(target)+'>; rel="canonical"',**r)
  for path in ('/login','/pdf-viewer'):
   r=reader(path);text=r.pop('text','')
   if r.get('inconclusive'):checks.append({'check':'intentional noindex '+path,'state':'inconclusive',**r});continue
   add('intentional noindex '+path,r.get('status')==200 and (index_policy(text)['noindex'] or 'noindex' in r.get('robots','').lower()),**r)
 return {'at':datetime.now(timezone.utc).isoformat(),'live_requested':live,'checks':checks,'limits':['AdSense approval, ad delivery and earnings are not verified by these checks.','GSC exclusion reasons and recrawl requests require the owner account.']}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--live',action='store_true');p.add_argument('--out',default='quality-results/publication.json');a=p.parse_args();r=run(live=a.live);out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(json.dumps(r,ensure_ascii=False));raise SystemExit(any(x['state']=='failed' for x in r['checks']))
