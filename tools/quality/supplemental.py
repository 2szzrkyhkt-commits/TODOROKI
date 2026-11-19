"""Source checks are partial evidence, never live delivery or authorization proof."""
import re,json
from pathlib import Path

def inspect_source(root):
 out={}
 def record(i,errors,evidence):out[i]={'errors':errors,'evidence':evidence}
 privacy=(root/'assets/privacy-controls.js').read_text() if (root/'assets/privacy-controls.js').exists() else ''
 pages=list(root.rglob('*.html'));ads=[];duplicates=[];unguarded=[];noindex=[];secret_hits=[]
 for p in pages:
  if any(x in p.parts for x in ('.git','node_modules','quality-results')):continue
  text=p.read_text();rel=str(p.relative_to(root))
  tags=re.findall(r'<script\b[^>]*\bsrc=["\']([^"\']+)["\']',text,re.I)
  ad=[u for u in tags if 'pagead2.googlesyndication.com/pagead/js/adsbygoogle.js' in u]
  if len(ad)>1:duplicates.append({'path':rel,'count':len(ad)})
  if ad:unguarded.append({'path':rel,'directAdScriptCount':len(ad)})
  if re.search(r'<meta[^>]+name=["\']robots["\'][^>]+content=["\'][^"\']*noindex',text,re.I):noindex.append(rel)
 record(15,[],[{'noindex_pages':noindex,'scope':'inventory; index policy requires editorial review'}])
 record(35,[] if 'ca-pub-7179318481718851' in privacy else ['publisher tag missing'],[{'scope':'consent loader source only; not ad delivery'}])
 record(36,duplicates,[{'scope':'direct script duplicates plus dynamic idempotence source review','dynamic_guard': 'activated=true' in privacy}])
 record(39,unguarded,[{'default_off':'prefs={analytics:false,ads:false}' in privacy,'region_gate':'!region.optionalAllowed' in privacy,'gpc':'navigator.globalPrivacyControl===true' in privacy,'scope':'source contract only; browser consent tested separately'}])
 headers=(root/'_headers').read_text() if (root/'_headers').exists() else ''
 record(55,[],[{'scope':'configured headers only; CSP/HSTS applicability needs live review','configured':[k for k in ('X-Content-Type-Options','Referrer-Policy','Permissions-Policy','Content-Security-Policy','Strict-Transport-Security') if k in headers]}])
 patterns={'private_key':r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----','github_pat':r'\bgh[pousr]_[A-Za-z0-9]{30,}\b','aws_access_id':r'\bAKIA[0-9A-Z]{16}\b'}
 for p in root.rglob('*'):
  if not p.is_file() or any(x in p.parts for x in ('.git','node_modules','quality-results')) or p.suffix.lower() not in ('.js','.mjs','.json','.py','.yml','.html','.toml','.jsonc'):continue
  text=p.read_text(errors='replace')
  for name,pat in patterns.items():
   for m in re.finditer(pat,text):secret_hits.append({'path':str(p.relative_to(root)),'line':text[:m.start()].count('\n')+1,'type':name})
 record(57,secret_hits,[{'scope':'selected committed-file patterns; values never recorded, full history and provider secrets not inspected'}])
 return out
