"""Validate the user-agreed T04 scope; no authentication, ads or data writes."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, HTTPRedirectHandler, build_opener
from article_inventory import Body, inspect, local_file

ROOT = Path(__file__).resolve().parents[2]
ORIGIN = 'https://todoroki-gold.com'


class Page(Body):
    def __init__(self):
        super().__init__(); self.canonicals=[]
    def handle_starttag(self, tag, attrs):
        super().handle_starttag(tag, attrs)
        a=dict(attrs)
        if tag=='link' and a.get('rel')=='canonical': self.canonicals.append(a.get('href'))


def signature(html):
    p=Page(); p.feed(html)
    text=' '.join(' '.join(p.text).split())
    return {'body_sha256':hashlib.sha256(text.encode()).hexdigest(),
            'body_characters':len(text),'canonicals':p.canonicals}


def prepare(root=ROOT, manifest=None):
    root=Path(root)
    if manifest is None: manifest=json.loads((root/'docs/t04-completion-scope.json').read_text())
    paths=[p for group in manifest['groups'].values() for p in group]
    if len(paths)!=len(set(paths)) or not paths:
        raise ValueError('Missing or duplicate scope paths')
    inventory=inspect(root)
    available={r['path'] for r in inventory['records']}
    if set(paths)-available: raise ValueError('Scope path missing from sitemap')
    if inventory['article_meta_without_body_targets'] or any(r['missing_target_fragments'] for r in inventory['records']):
        raise ValueError('Structural reading-path validation failed')
    expected={}
    for p in paths:
        s=signature(local_file(root,p).read_text())
        if not s['body_characters'] or s['canonicals']!=[ORIGIN+p]:
            raise ValueError('Missing body or canonical mismatch')
        expected[p]=s
    return inventory,expected


class SameOrigin(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not newurl.startswith(ORIGIN+'/') or urlsplit(newurl).netloc!='todoroki-gold.com':
            raise URLError('External redirect blocked')
        return super().redirect_request(req,fp,code,msg,headers,newurl)


def fetch_page(path):
    try:
        req=Request(ORIGIN+path,headers={'User-Agent':'TODOROKI-Scope-Verification/1.0'})
        with build_opener(SameOrigin()).open(req,timeout=15) as response:
            data=response.read(2*1024*1024+1)
            if len(data)>2*1024*1024: return {'error':'body_size_limit'}
            return {'status':response.status,'url':response.url,
                    'content_type':response.headers.get('Content-Type',''),
                    'html':data.decode('utf-8')}
    except HTTPError as e: return {'status':e.code,'error':'http_error'}
    except Exception: return {'error':'network_or_decode_error'}


def compare(path, expected, response):
    result={'path':path}
    if response.get('error') or response.get('status')!=200:
        return {**result,'state':'unverified','reason':response.get('error','http_status'),
                'status':response.get('status')}
    if not response.get('content_type','').lower().startswith('text/html'):
        return {**result,'state':'unverified','reason':'unexpected_content_type'}
    actual=signature(response['html'])
    if response.get('url')!=ORIGIN+path or actual!=expected:
        return {**result,'state':'failed','reason':'url_canonical_or_body_mismatch',
                'body_matches':actual['body_sha256']==expected['body_sha256'],
                'canonical_matches':actual['canonicals']==expected['canonicals']}
    return {**result,'state':'passed','body_sha256':actual['body_sha256']}


def run(live=False):
    inventory,expected=prepare()
    checks=[]
    if live:
        paths=list(expected)
        with ThreadPoolExecutor(max_workers=4) as executor:
            checks=list(executor.map(lambda p:compare(p,expected[p],fetch_page(p)),paths))
    return {'at':datetime.now(timezone.utc).isoformat(),'scope':'user-agreed T04 target groups',
            'structural_pages':inventory['page_count'],'article_meta_pages':inventory['article_meta_count'],
            'missing_target_fragments':0,'article_meta_without_body_targets':0,
            'target_pages':len(expected),'live_requested':live,'checks':checks,
            'limits':'Source structure and deployed body equality; not all-article fact/originality certification.'}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--live',action='store_true')
    args=parser.parse_args();report=run(args.live)
    Path('quality-results').mkdir(exist_ok=True)
    Path('quality-results/t04-scope.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'structural_pages':report['structural_pages'],'target_pages':report['target_pages'],
                      'live_requested':args.live,'states':{s:sum(c['state']==s for c in report['checks'])
                      for s in ['passed','failed','unverified']}},ensure_ascii=False))
    raise SystemExit(any(c['state']!='passed' for c in report['checks']))
