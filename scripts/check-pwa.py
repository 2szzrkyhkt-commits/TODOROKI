#!/usr/bin/env python3
"""Static checks for TODOROKI app launch migration."""
from pathlib import Path
import json
import re

root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text()
login=(root/'login.html').read_text()
install=(root/'assets/pwa-install.js').read_text()
account=(root/'assets/header-account.js').read_text()
sw=(root/'app/sw.js').read_text()
manifest=json.loads((root/'app/manifest.webmanifest').read_text())

assert manifest['start_url']==manifest['scope']=='/'
assert manifest['id']=='/app/' and manifest['display']=='standalone'
assert manifest['background_color']==manifest['theme_color']=='#000000'
assert manifest['icons'] and all((root / icon['src'].lstrip('/')).is_file() for icon in manifest['icons'])
assert not (root/'app/index.html').exists()
routes=[line.split() for line in (root/'_redirects').read_text().splitlines() if line.startswith('/app')]
assert routes==[[path, '/', '301'] for path in ('/app','/app/','/app/index','/app/index.html')]
assert (root/'_headers').read_text().count('Service-Worker-Allowed:')==1
assert '/app/sw.js\n  Service-Worker-Allowed: /\n' in (root/'_headers').read_text()
assert '<link rel="manifest" href="/app/manifest.webmanifest">' in html
assert 'apple-mobile-web-app-title' in html and 'apple-touch-icon' in html
assert 'id="td-install-app" type="button" hidden' in html and 'id="td-install-ios-help" hidden' in html
assert "serviceWorker.register('/app/sw.js', {scope: '/', updateViaCache: 'none'})" in install
assert 'beforeinstallprompt' in install and 'appinstalled' in install
assert 'caches.delete' in sw and 'self.clients.claim()' in sw and 'OLD_PREFIX' in sw
assert 'caches.match' not in sw and 'caches.open' not in sw
assert "addEventListener('fetch'" not in sw and 'addEventListener("fetch"' not in sw
assert "const destination = '/';" in login and '/app/' not in re.sub(r'/app/startup-iphone-1179x2556.png', '', login)
assert 'data-header-account' in html and 'href="/login"' in html
assert 'data-account-login-label' in html and 'showAccount(false, true)' in account
assert 'member !== null' in account and 'sessionUnavailable' in account
assert 'href="/boki1"' in html and 'href="/calculators/"' in html
assert 'href="/us-equity"' in html and 'href="/api/tools/equity" class="card-link" referrerpolicy="origin"' in html
for slug in ('jp','us'):
    assert f'href="/api/tools/{slug}" class="card-link" referrerpolicy="origin" target="_blank" rel="noopener"' in html
assert 'todoroki-edinet-connect.easysquid66.chatgpt.site' not in html
assert 'id="td-splash" hidden' in html
assert 'Loading...' not in html and 'td-splash-ring' not in html and 'td-splash-line' not in html
assert 'navigator.standalone' in html and 'requestAnimationFrame(() => requestAnimationFrame(dismiss))' in html
assert 'if (ios && nativeArtwork.matches) return;' in html
startup=root/'app/startup-iphone-1179x2556.png'
assert startup.read_bytes()[16:24]==bytes.fromhex('0000049b000009fc')
native_media = '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)'
assert html.count('rel="apple-touch-startup-image"') == 1
assert f'rel="apple-touch-startup-image" href="/app/{startup.name}" media="{native_media}"' in html
assert f"matchMedia('{native_media}')" in html
frames = []
for page in (html, login):
    assert 'viewport-fit=cover' in page
    assert 'name="apple-mobile-web-app-status-bar-style" content="black-translucent"' in page
    assert '<meta name="color-scheme" content="dark">' in page
    assert '<meta name="theme-color" content="#000000">' in page
    frame = re.search(r'<style id="td-first-frame">(.*?)</style>', page, re.S)
    assert frame and 'data:image/webp;base64,' in frame[1]
    assert 'center calc(50% - 17px) / 190px auto no-repeat' in frame[1]
    assert 'html { color-scheme: dark; background-color: #000; }' in frame[1]
    assert 'navigator.standalone === true' in page
    assert f'@media {native_media}' in frame[1]
    assert 'html[data-ios-standalone] #td-splash:not([hidden])' in frame[1]
    assert 'background-position: center calc(50svh - 28.667px);' in frame[1]
    assert 'html[data-ios-standalone] #td-splash:not([hidden]) {\n    background-image: none;' in frame[1]
    frames.append(frame[1])
    assert 'td-splash-label">TODOROKI' in page
assert len(set(frames)) == 1
print('PWA static migration checks passed')
