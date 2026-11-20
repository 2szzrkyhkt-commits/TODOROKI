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
    if href=='/':continue
    assert (root / href.lstrip('/')).exists() or (root / (href.lstrip('/') + '.html')).exists() or (root / href.lstrip('/') / 'index.html').exists(),href
assert 'apple-mobile-web-app-title' in html
assert 'OLD_PREFIX' in sw
assert 'caches.match' not in sw
assert 'caches.open' not in sw
assert 'google' not in html.lower() or 'login' not in html.lower()
assert len(re.findall(r'<article>', html)) >= 7
assert 'href="/boki1"' in html and 'href="/calculators/"' in html
assert "'/api/auth/me'" in html and "cache:'no-store'" in html
assert 'href="/login.html"' in html
assert 'id="td-splash"' in html
assert 'td-splash-title">TODOROKI' in html
assert 'Loading...' not in html and 'td-splash-ring' not in html
assert 'td-splash-line' in html and 'DOMContentLoaded' in html
assert 'Loading' not in html and '読み込み中' not in html
assert 'display-mode:standalone' in html
assert manifest['background_color'] == manifest['theme_color'] == '#000000'
startup = root / 'app/startup-iphone-1179x2556.png'
assert startup.read_bytes()[16:24] == bytes.fromhex('0000049b000009fc')
assert f'rel="apple-touch-startup-image" href="/app/{startup.name}"' in html
assert '(device-width: 393px) and (device-height: 852px)' in html
assert '(-webkit-device-pixel-ratio: 3) and (orientation: portrait)' in html
print('PWA static checks passed')
