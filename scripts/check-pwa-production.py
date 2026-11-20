#!/usr/bin/env python3
"""Check the actual production PWA HTTP responses, not just repository files."""
import json, re, urllib.error, urllib.request
from concurrent.futures import ThreadPoolExecutor
import time
from http.cookiejar import CookieJar
from urllib.parse import urlsplit
BASE='https://todoroki-gold.com'
def get(path):
    req=urllib.request.Request(BASE+path,headers={'User-Agent':'TODOROKI-PWA-Smoke/1.0','Cache-Control':'no-cache'})
    with urllib.request.urlopen(req,timeout=25) as response:
        data=response.read(500000)
        print(path,response.status,response.headers.get('Content-Type'),len(data))
        assert response.status==200
        return data,response.headers
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def check_legacy(path):
    request=urllib.request.Request(BASE + path, headers={'User-Agent':'TODOROKI-PWA-Smoke/1.0','Cache-Control':'no-cache'})
    try:
        urllib.request.build_opener(NoRedirect).open(request, timeout=25).close()
    except urllib.error.HTTPError as exc:
        with exc:
            if exc.code in (401,403,429):
                raise RuntimeError(f'{path}: the smoke request was denied (HTTP {exc.code}); not retrying') from None
            location=urlsplit(exc.headers.get('Location', ''))
            assert exc.code in (301,308) and location.path=='/' and location.netloc in ('','todoroki-gold.com')
            print(path,exc.code,'→ /')
            return
    raise AssertionError(f'{path}: old app home did not redirect')

# The GitHub push and the separate Cloudflare build run concurrently.
# Wait for evidence the intended release (not the former shell) is on the edge.
for attempt in range(18):
    try:
        check_legacy('/app/')
        manifest_bytes,_=get('/app/manifest.webmanifest')
        assert json.loads(manifest_bytes)['start_url']=='/'
        break
    except (OSError, AssertionError, ValueError):
        if attempt==17: raise
        time.sleep(10)
for path in ('/app','/app/index','/app/index.html'):
    check_legacy(path)
html,_=get('/')
assert b'TODOROKI' in html and b'/app/manifest.webmanifest' in html
raw,headers=get('/app/manifest.webmanifest')
manifest=json.loads(raw)
assert manifest['start_url']==manifest['scope']=='/'
assert manifest['id']=='/app/'
assert manifest['display']=='standalone'
assert 'json' in headers.get('Content-Type','') or 'manifest' in headers.get('Content-Type','')
assert manifest['background_color'] == manifest['theme_color'] == '#000000'
startup_link = re.search(rb'rel="apple-touch-startup-image" href="([^"]+)" media="([^"]+)"', html)
assert startup_link, 'Missing iOS startup image link'
assert html.count(b'rel="apple-touch-startup-image"') == 1
assert startup_link[2] == b'(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)'
assert b"matchMedia('" + startup_link[2] + b"')" in html
startup, headers = get(startup_link[1].decode())
assert headers.get_content_type() == 'image/png'
assert startup[:8] == b'\x89PNG\r\n\x1a\n'
assert startup[16:24] == bytes.fromhex('0000049b000009fc')
sw,sw_headers=get('/app/sw.js')
assert sw_headers.get('Service-Worker-Allowed')=='/'
assert b'todoroki-app-shell' in sw
for icon in manifest['icons']:
    data,_=get(icon['src'])
    assert data
# Exercise the same origin entry and the cookie handoff to each statistics tool.

MOBILE_PROFILES = {
    'iPhone Safari': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
    'iPhone Chrome': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1',
    'Android Chrome': 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
}
# These are HTTP-profile probes, not native or installed-device tests.
GATED_TOOLS = {
    'jp': ('todoroki-economy-data.easysquid66.chatgpt.site', '日本経済を見える化'),
    'us': ('todoroki-us-economy-data.easysquid66.chatgpt.site', '米国経済を見える化'),
    'equity': ('todoroki-equity-lab.easysquid66.chatgpt.site', '銘柄を探す'),
}
for tool in GATED_TOOLS:
    link = f'href="/api/tools/{tool}"'.encode()
    assert link in html, f'Missing entry link for {tool}'


def check_economy_entry(profile, user_agent, tool, host, heading, source):
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))
    headers = {'User-Agent': user_agent}
    if source:
        headers.update({'Referer': BASE + source, 'Sec-Fetch-Site': 'same-origin'})
    endpoint = BASE + '/api/tools/' + tool
    try:
        with opener.open(urllib.request.Request(endpoint, headers=headers), timeout=25) as response:
            document = response.read(500000)
            destination = urlsplit(response.url)
            assert response.status == 200
            if source:
                assert (destination.scheme, destination.hostname, destination.path) == ('https', host, '/')
                assert heading.encode() in document
            else:
                assert destination.geturl() == endpoint
                assert b'<form method="post">' in document
        if not source:
            recovery = urllib.request.Request(endpoint, data=b'', headers={
                **headers, 'Origin': BASE, 'Sec-Fetch-Site': 'same-origin',
            })
            with opener.open(recovery, timeout=25) as response:
                destination = urlsplit(response.url)
                assert (destination.scheme, destination.hostname, destination.path) == ('https', host, '/')
                assert heading.encode() in response.read(500000)
    except (OSError, AssertionError) as exc:
        # HTTP errors can contain an entry ticket URL. Report the case and status only.
        raise AssertionError(f'{profile}, {tool}, {source or "no referrer"}: '
                             f'{type(exc).__name__} {getattr(exc, "code", "")}') from None
    print(profile, tool, source or 'no referrer', 'OK')


with ThreadPoolExecutor(max_workers=4) as pool:
    checks = [
        pool.submit(check_economy_entry, profile, user_agent, tool, host, heading, source)
        for profile, user_agent in MOBILE_PROFILES.items()
        for tool, (host, heading) in GATED_TOOLS.items()
        for source in ('/', None)
    ]
    for check in checks:
        check.result()

print('Production PWA smoke passed')
