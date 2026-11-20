#!/usr/bin/env python3
"""Check the actual production PWA HTTP responses, not just repository files."""
import json, sys, urllib.request
BASE='https://todoroki-gold.com'
def get(path):
    req=urllib.request.Request(BASE+path,headers={'User-Agent':'TODOROKI-PWA-Smoke/1.0','Cache-Control':'no-cache'})
    with urllib.request.urlopen(req,timeout=25) as response:
        data=response.read(500000)
        print(path,response.status,response.headers.get('Content-Type'),len(data))
        assert response.status==200
        return data,response.headers
html,_=get('/app/')
assert b'TODOROKI' in html and b'/app/manifest.webmanifest' in html
raw,headers=get('/app/manifest.webmanifest')
manifest=json.loads(raw)
assert manifest['start_url']=='/app/' and manifest['scope']=='/app/'
assert manifest['display']=='standalone'
assert 'json' in headers.get('Content-Type','') or 'manifest' in headers.get('Content-Type','')
sw,_=get('/app/sw.js')
assert b'todoroki-app-shell' in sw
for icon in manifest['icons']:
    data,_=get(icon['src'])
    assert data
print('Production PWA smoke passed')
