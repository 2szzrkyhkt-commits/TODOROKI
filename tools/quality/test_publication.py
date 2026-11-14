import unittest,tempfile
from pathlib import Path
from publication import ads_authorized,index_policy,run,ADS,ORIGIN
class PublicationTests(unittest.TestCase):
 def test_other_publishers_do_not_authorize_ours(self):
  self.assertFalse(ads_authorized('google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0'))
  self.assertTrue(ads_authorized(ADS+' # owner'))
 def test_noindex_and_canonical_are_separate(self):
  p=index_policy('<META name="robots" content="noindex,follow"><link rel="canonical" href="https://example.com/">')
  self.assertTrue(p['noindex']);self.assertEqual(p['canonical'],['https://example.com/'])
 def test_live_block_is_inconclusive_not_passed(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'ads.txt').write_text(ADS)
   (root/'index.html').write_text('<link rel="canonical" href="'+ORIGIN+'/"><script src="/assets/privacy-controls.js"></script>')
   for n in ('sitemap.xml','sitemap-pdfs.xml'):(root/n).write_text('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>')
   r=run(root,True,lambda p:{'status':403,'inconclusive':True})
   self.assertEqual(sum(x['state']=='inconclusive' for x in r['checks']),9)
   self.assertFalse(any(x['state']=='failed' for x in r['checks']))
 def test_unredirected_html_alias_fails_contract(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'ads.txt').write_text(ADS)
   for n in ('sitemap.xml','sitemap-pdfs.xml'):(root/n).write_text('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>')
   def reader(p):return {'status':200,'final_url':ORIGIN+p,'text':'<meta name="robots" content="noindex">'}
   r=run(root,True,reader)
   self.assertTrue(all(x['state']=='failed' for x in r['checks'] if x['check'].startswith('canonical redirect')))

 def test_wrong_canonical_and_cross_page_duplicate_fail(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'ads.txt').write_text(ADS)
   for n in ('sitemap.xml','sitemap-pdfs.xml'):(root/n).write_text('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>')
   (root/'wrong.html').write_text('<link rel="canonical" href="'+ORIGIN+'/other"><script src="/assets/privacy-controls.js"></script>')
   (root/'other.html').write_text('<link rel="canonical" href="'+ORIGIN+'/other"><script src="/assets/privacy-controls.js"></script>')
   r=run(root);c=next(x for x in r['checks'] if x['check']=='noindex policy and canonical inventory')
   self.assertEqual(c['state'],'failed');self.assertEqual(c['errors'],['wrong.html'])
 def test_directory_index_and_name_ending_index_have_distinct_urls(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'ads.txt').write_text(ADS)
   for n in ('sitemap.xml','sitemap-pdfs.xml'):(root/n).write_text('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>')
   (root/'section').mkdir()
   for name,url in [('index.html','/'),('section/index.html','/section/'),('global-index.html','/global-index')]:
    (root/name).write_text('<link rel="canonical" href="'+ORIGIN+url+'"><script src="/assets/privacy-controls.js"></script>')
   self.assertTrue(all(x['state']=='passed' for x in run(root)['checks']))
