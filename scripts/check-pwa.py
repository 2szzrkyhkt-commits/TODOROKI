#!/usr/bin/env python3
"""Static checks for TODOROKI app shell; run: python3 scripts/check-pwa.py"""
from pathlib import Path
import json
import re
root=Path(__file__).resolve().parents[1]
html=(root/'app/index.html').read_text()
sw=(root/'app/sw.js').read_text()
manifest=json.loads((root/'app/manifest.webmanifest').read_text())
assert manifest['start_url']=='/app/' and manifest['scope']=='/'
assert manifest['display']=='standalone'
assert manifest['id']=='/app/'
assert (root/'login.html').exists() and (root/'index.html').exists()
assert manifest['icons'] and all((root / icon['src'].lstrip('/')).is_file() for icon in manifest['icons'])
assert 'rel="manifest"' in html and 'apple-touch-icon' in html
assert 'serviceWorker.register' in html
assert 'type="password"' not in html
assert 'fetch' not in sw.split('// No fetch interception:')[0]
assert 'caches.delete' in sw and 'self.clients.claim()' in sw
assert 'caches.open' not in sw
for href in re.findall(r'href="(/[^"#?]+)"',html):
    if href in ('/', '/api/tools/equity', '/api/tools/jp', '/api/tools/us'):continue
    assert (root / href.lstrip('/')).exists() or (root / (href.lstrip('/') + '.html')).exists() or (root / href.lstrip('/') / 'index.html').exists(),href
assert 'apple-mobile-web-app-title' in html
assert 'OLD_PREFIX' in sw
assert 'caches.match' not in sw
assert 'caches.open' not in sw
assert 'google' not in html.lower() or 'login' not in html.lower()
assert len(re.findall(r'<article>', html)) >= 7
assert 'href="/boki1"' in html and 'href="/calculators/"' in html
session=(root/'assets/session-startup.js').read_text()
assert "'/api/auth/me'" in session and "cache: 'no-store'" in session
assert 'id="td-session-page" hidden' in html
assert "location.replace('/login?from=app')" in html
assert 'href="/login"' in html
assert 'id="td-splash"' in html
assert 'td-splash-label">TODOROKI' in html
assert 'Loading...' not in html and 'td-splash-ring' not in html
assert 'td-splash-line' not in html and 'DOMContentLoaded' in html
assert 'Loading' not in html and '読み込み中' not in html
assert manifest['background_color'] == manifest['theme_color'] == '#000000'
startup = root / 'app/startup-iphone-1179x2556.png'
assert startup.read_bytes()[16:24] == bytes.fromhex('0000049b000009fc')
assert f'rel="apple-touch-startup-image" href="/app/{startup.name}"' in html
assert '(max-device-width: 480px)' in html
assert '(-webkit-device-pixel-ratio: 3) and (orientation: portrait)' in html
entry=(root/'index.html').read_text()
assert 'navigator.standalone' in entry and 'requestAnimationFrame(() => requestAnimationFrame(dismiss))' in entry
assert 'apple-touch-startup-image' in entry
style=(root/'assets/session-startup.css').read_text()
assert f'url("/app/{startup.name}") center / 393px auto no-repeat' in style
for page in (entry, html, (root/'login.html').read_text()):
    assert 'viewport-fit=cover' in page
    assert 'name="apple-mobile-web-app-status-bar-style" content="black-translucent"' in page
    assert 'href="/assets/session-startup.css"' in page
    assert f'rel="preload" as="image" href="/app/{startup.name}"' in page
    assert 'td-splash-label">TODOROKI' in page
print('PWA static checks passed')
