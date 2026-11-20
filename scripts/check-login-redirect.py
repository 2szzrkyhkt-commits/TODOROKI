#!/usr/bin/env python3
from pathlib import Path
s=(Path(__file__).resolve().parents[1]/'login.html').read_text()
assert "await api('verify'" in s
assert "if (!data.member) throw" in s
assert s.count("window.location.replace('/')") == 2
assert "show('member'); status('ログインしました。')" not in s
print('Login redirect checks passed')
