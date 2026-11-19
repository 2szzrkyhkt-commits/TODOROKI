"""Fail closed on unreadable previous ledger; only a genuine 404 means first run."""
import subprocess,json,os
from pathlib import Path
root='repos/'+os.environ['GITHUB_REPOSITORY'];p=Path('/tmp/quality-state');p.mkdir(parents=True,exist_ok=True)
r=subprocess.run(['gh','api',root+'/git/ref/heads/quality-history'],capture_output=True,text=True)
if r.returncode:
 if '(HTTP 404)' not in r.stderr:raise RuntimeError('previous ledger lookup failed: '+r.stderr)
 print('No existing ledger: first run')
else:
 r=subprocess.run(['gh','api',root+'/contents/latest.json?ref=quality-history','-H','Accept: application/vnd.github.raw+json'],capture_output=True,text=True,check=True)
 data=json.loads(r.stdout);assert len(data['items'])==62
 (p/'latest.json').write_text(r.stdout);print('Loaded durable ledger:',data['at'])
