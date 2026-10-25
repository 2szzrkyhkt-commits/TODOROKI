from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse,unquote
from collections import Counter
import json,re,subprocess,tempfile,unicodedata
r=Path(__file__).resolve().parents[1]
class Parse(HTMLParser):
 def __init__(self,t):
  super().__init__();self.attrs=[];self.feed(t)
 def handle_starttag(self,tag,attrs):self.attrs.append((tag,dict(attrs)))
pages={p:Parse(p.read_text()) for p in r.rglob('*.html') if '.git' not in p.parts}
errors=[];links=0;script_count=0
for p,s in pages.items():
 duplicate=[k for k,v in Counter(a.get('id') for t,a in s.attrs if a.get('id')).items() if v>1]
 if duplicate:errors.append([str(p.relative_to(r)),'duplicate IDs',duplicate])
 for tag,a in s.attrs:
  u=a.get('href') or a.get('src')
  if not u:continue
  v=urlparse(u)
  if v.scheme or v.netloc or v.path.startswith('/api/'):continue
  links+=1
  target=(r/unquote(v.path.lstrip('/'))) if v.path.startswith('/') else (p.parent/unquote(v.path))
  if not v.path:target=p
  if target.is_dir():target=target/'index.html'
  if not target.exists() and not target.suffix:target=target.with_suffix('.html')
  if not target.exists():errors.append([str(p.relative_to(r)),'missing file',u])
  elif v.fragment and target in pages:
   if unquote(v.fragment) not in [a.get('id') for t,a in pages[target].attrs]:errors.append([str(p.relative_to(r)),'missing anchor',u])
 for script in re.findall(r'<script\b([^>]*)>(.*?)</script>',p.read_text(),re.S|re.I):
  if 'src=' in script[0] or 'application/ld+json' in script[0]:continue
  with tempfile.NamedTemporaryFile(suffix='.js',mode='w') as f:
   f.write(script[1]);f.flush();x=subprocess.run(['node','--check',f.name],capture_output=True,text=True)
   if x.returncode:errors.append([str(p.relative_to(r)),'script syntax',x.stderr])
  script_count+=1
for p in (r/'assets').glob('*.js'):
 x=subprocess.run(['node','--check',str(p)],capture_output=True,text=True)
 if x.returncode:errors.append([str(p.relative_to(r)),'script syntax',x.stderr])
catalog=json.loads((r/'assets/pdf-catalog.json').read_text())
for path,item in catalog.items():
 if not (r/path.lstrip('/')).is_file():errors.append(['catalog','missing',path])
for path in r.rglob('glossary.html'):
 t=path.read_text();entries=re.findall(r'<article\b[^>]*class="entry".*?</article>',t,re.S)
 if len(entries)!=69:errors.append([str(path),'glossary count',len(entries)])
 for e in entries:
  ps=re.findall(r'<p>(.*?)</p>',e,re.S)
  if any(n>1 for n in Counter(ps).values()):errors.append([str(path),'repeated paragraph',e[:120]])
# Verify the preserved PDFs and article text against recorded GitHub source hashes.
import hashlib
from lxml import html
baseline=json.loads((r/'validation/baseline.json').read_text());base=baseline['source_commit']
for rel,digest in baseline['pdf_sha256'].items():
 p=r/rel
 if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=digest:errors.append([rel,'PDF content changed'])
for rel,digest in baseline['article_text_sha256'].items():
 p=r/rel
 if not p.exists():errors.append([rel,'article removed']);continue
 doc=html.fromstring(p.read_text());main=doc.xpath('//main');text=''
 if main:
  main=main[0]
  for sc in main.xpath('.//script'):sc.getparent().remove(sc)
  text=' '.join(main.text_content().split())
 if hashlib.sha256(text.encode()).hexdigest()!=digest:errors.append([rel,'article text changed'])
report={'source_commit':base,'html_pages':len(pages),'internal_references_checked':links,'inline_scripts_checked':script_count,'pdf_files':len(list((r/'pdf').rglob('*.pdf'))),'listed_pdfs':len(catalog),'glossary_entries_per_language':69,'errors':errors}
(r/'validation/audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False));raise SystemExit(bool(errors))
