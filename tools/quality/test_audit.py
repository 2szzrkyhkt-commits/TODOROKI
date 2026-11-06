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

class CadenceTests(unittest.TestCase):
 def test_daily_delayed_to_afternoon(self):
  from cadence import choose,JST
  from datetime import datetime
  old={'completed_modes':{'daily':'2026-11-05T19:00:00+09:00','weekly':'2026-11-03T03:00:00+09:00','monthly':'2026-11-03T03:00:00+09:00'}}
  self.assertEqual(choose(old,'schedule',now=datetime(2026,11,6,15,tzinfo=JST)),'daily')
 def test_hourly_after_daily(self):
  from cadence import choose,JST
  from datetime import datetime
  stamp='2026-11-06T03:00:00+09:00';old={'completed_modes':dict.fromkeys(['daily','weekly','monthly'],stamp)}
  self.assertEqual(choose(old,'schedule',now=datetime(2026,11,6,15,tzinfo=JST)),'hourly')
 def test_week_rollover(self):
  from cadence import choose,JST
  from datetime import datetime
  stamp='2026-11-06T03:00:00+09:00';old={'completed_modes':dict.fromkeys(['daily','weekly','monthly'],stamp)}
  self.assertEqual(choose(old,'schedule',now=datetime(2026,11,9,15,tzinfo=JST)),'weekly')
 def test_month_rollover(self):
  from cadence import choose,JST
  from datetime import datetime
  stamp='2026-11-06T03:00:00+09:00';old={'completed_modes':dict.fromkeys(['daily','weekly','monthly'],stamp)}
  self.assertEqual(choose(old,'schedule',now=datetime(2026,12,1,15,tzinfo=JST)),'monthly')

class NotificationTests(unittest.TestCase):
 def exercise(self,candidates,issues):
  import runpy,os
  script=Path(__file__).with_name('notify.py').resolve();cwd=Path.cwd()
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'quality-results';p.mkdir();(p/'latest.json').write_text(json.dumps({'notification_candidates':candidates}))
   try:
    os.chdir(d)
    with patch.dict(os.environ,{'GITHUB_REPOSITORY':'fixture/repo','GITHUB_RUN_ID':'1'}),patch('subprocess.check_output',return_value=json.dumps(issues)),patch('subprocess.run') as send:
     runpy.run_path(str(script));return send.call_count
   finally:os.chdir(cwd)
 def test_healthy_sends_nothing(self):self.assertEqual(self.exercise({},[]),0)
 def test_same_open_finding_sends_nothing(self):
  self.assertEqual(self.exercise({'fixture-key':{'id':'TQ01','detail':'fixture'}},[{'body':'<!-- todoroki-quality:fixture-key -->'}]),0)
 def test_new_finding_sends_once(self):
  self.assertEqual(self.exercise({'fixture-key':{'id':'TQ01','detail':'fixture'}},[]),1)
