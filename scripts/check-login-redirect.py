#!/usr/bin/env python3
from pathlib import Path
s=(Path(__file__).resolve().parents[1]/'login.html').read_text()
assert "await api('verify'" in s
assert "if (!data.member) throw" in s
assert s.count("window.location.replace(destination)") == 2
assert "const destination = '/';" in s
assert "new URLSearchParams(location.search)" not in s
assert 'id="email-form" hidden' in s
assert 'id="td-session-page" hidden' in s
assert "show('member'); status('ログインしました。')" not in s
print('Login redirect checks passed')
