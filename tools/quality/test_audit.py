import unittest,tempfile,json
from pathlib import Path
from urllib.error import URLError,HTTPError
from unittest.mock import patch
from audit import request,run,fingerprint
class AuditTests(unittest.TestCase):
 def test_retry_exponential(self):
  sleeps=[]
  class Response:
   status=200;url='https://example.com/';headers={}
   def __enter__(self):return self
   def __exit__(self,*a):pass
   def read(self,*a):return b'ok'
  values=iter([URLError('temporary'),URLError('temporary'),Response()])
  def opener(*a,**k):
   v=next(values)
   if isinstance(v,Exception):raise v
   return v
  r=request('https://example.com/',opener,sleeps.append)
  self.assertEqual(sleeps,[1,2]);self.assertEqual(r['status'],200);self.assertEqual(len(r['attempts']),2)
 def test_403_not_outage(self):
  def opener(*a,**k):raise HTTPError('https://example.com/',403,'blocked',{},None)
  self.assertEqual(request('https://example.com/',opener)['kind'],'inconclusive')
 def test_retry_exhaustion(self):
  sleeps=[]
  def opener(*a,**k):raise HTTPError('https://example.com/',503,'unavailable',{},None)
  r=request('https://example.com/',opener,sleeps.append)
  self.assertEqual(len(r['attempts']),3);self.assertEqual(r['kind'],'http_failure')
 def test_ledger_and_dedup(self):
  with tempfile.TemporaryDirectory() as d:
   first=run('daily',d,live=False);second=run('daily',d,str(Path(d)/'latest.json'),live=False)
   self.assertEqual(len(first['items']),62);self.assertEqual(len({x['id'] for x in first['items']}),62)
   self.assertEqual(second['new_findings'],{});self.assertEqual(first['findings'],second['findings'])
   self.assertEqual(first['items'][61]['result'],'未確認')
if __name__=='__main__':unittest.main()

class DetectionTests(unittest.TestCase):
 def test_injected_broken_anchor_and_recovery(self):
  import audit
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'assets').mkdir();(root/'pdf').mkdir()
   (root/'assets/pdf-catalog.json').write_text('{}')
   (root/'robots.txt').write_text('User-agent: *\nAllow: /')
   for file in ('sitemap.xml','sitemap-pdfs.xml'):(root/file).write_text('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>')
   page=root/'index.html';page.write_text('<html><title>Test</title><h1>Test</h1><a href="#missing">broken</a></html>')
   with patch.object(audit,'ROOT',root),patch.object(audit.subprocess,'check_output',return_value='fixture\n'):
    first=run('daily',root/'results',live=False)
    self.assertEqual(first['items'][20]['result'],'未完了')
    page.write_text('<html><title>Test</title><h1 id="missing">Test</h1><a href="#missing">valid</a></html>')
    second=run('daily',root/'results',str(root/'results/latest.json'),live=False)
    self.assertFalse(second['items'][20]['errors']);self.assertTrue(second['resolved'])
