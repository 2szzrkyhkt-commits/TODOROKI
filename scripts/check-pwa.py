#!/usr/bin/env python3
"""Static checks for TODOROKI app shell; run: python3 scripts/check-pwa.py"""
from pathlib import Path
import json
import re
root=Path(__file__).resolve().parents[1]
html=(root/'app/index.html').read_text()
sw=(root/'app/sw.js').read_text()
manifest=json.loads((root/'app/manifest.webmanifest').read_text())
assert manifest['start_url']=='/app/' and manifest['scope']=='/app/'
assert manifest['display']=='standalone'
assert manifest['icons'] and all((root / icon['src'].lstrip('/')).is_file() for icon in manifest['icons'])
assert 'rel="manifest"' in html and 'apple-touch-icon' in html
assert 'serviceWorker.register' in html
assert 'type="password"' not in html
assert "request.method!=='GET'" in sw and 'url.origin!==self.location.origin' in sw
assert '/app/' in sw and 'caches.open' in sw
for href in re.findall(r'href="(/[^"#?]+)"',html):
    if href=='/':continue
    assert (root / href.lstrip('/')).exists() or (root / (href.lstrip('/') + '.html')).exists() or (root / href.lstrip('/') / 'index.html').exists(),href
assert 'apple-mobile-web-app-title' in html
assert 'request.mode===\'navigate\'' in sw
assert 'caches.match(\'/app/\')' in sw
assert 'caches.open' in sw
assert 'google' not in html.lower() or 'login' not in html.lower()
assert len(re.findall(r'<article>', html)) >= 7
assert 'href="/boki1"' in html and 'href="/calculators/"' in html
print('PWA static checks passed')
