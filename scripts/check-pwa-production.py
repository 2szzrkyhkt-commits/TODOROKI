#!/usr/bin/env python3
"""Check the actual production PWA HTTP responses, not just repository files."""
import json, re, urllib.request
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
assert manifest['start_url']=='/app/' and manifest['scope']=='/'
assert manifest['display']=='standalone'
assert 'json' in headers.get('Content-Type','') or 'manifest' in headers.get('Content-Type','')
assert manifest['background_color'] == manifest['theme_color'] == '#000000'
startup_link = re.search(rb'rel="apple-touch-startup-image" href="([^"]+)"', html)
assert startup_link, 'Missing iOS startup image link'
startup, headers = get(startup_link[1].decode())
assert headers.get_content_type() == 'image/png'
assert startup[:8] == b'\x89PNG\r\n\x1a\n'
assert startup[16:24] == bytes.fromhex('0000049b000009fc')
sw,_=get('/app/sw.js')
assert b'todoroki-app-shell' in sw
for icon in manifest['icons']:
    data,_=get(icon['src'])
    assert data
print('Production PWA smoke passed')
