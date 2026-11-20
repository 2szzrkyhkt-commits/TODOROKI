#!/usr/bin/env python3
from pathlib import Path
s=(Path(__file__).resolve().parents[1]/'index.html').read_text()
assert 'id="td-pwa-launch-style"' in s
assert "matchMedia('(display-mode: standalone)')" in s
assert 'navigator.standalone===true' in s
assert 'splash.innerHTML=' in s and 'TODOROKI' in s and 'Loading...' in s
assert 'setTimeout(done,3500)' in s
assert 'prefers-reduced-motion:reduce' in s
print('Standalone homepage splash checks passed')
