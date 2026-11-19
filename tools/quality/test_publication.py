import unittest,tempfile
from pathlib import Path
from publication import ads_authorized,index_policy,run,read_public,ADS,ORIGIN
from unittest.mock import patch
from urllib.error import HTTPError
from email.message import Message
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
   for n in ('sitemap.xml','sitemap-pdfs.xml'):(root/n).write_text('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'+ORIGIN+'/</loc></url></urlset>')
   r=run(root,True,lambda p:{'status':403,'inconclusive':True})
   self.assertEqual(sum(x['state']=='inconclusive' for x in r['checks']),45)
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
   (root/'sitemap.xml').write_text('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>'+ORIGIN+u+'</loc></url>' for u in ['/','/section/','/global-index'])+'</urlset>')
   self.assertTrue(all(x['state']=='passed' for x in run(root)['checks']))

 def test_direct_ad_loader_and_wrong_publisher_are_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'ads.txt').write_text(ADS)
   for n in ('sitemap.xml','sitemap-pdfs.xml'):(root/n).write_text('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>')
   (root/'index.html').write_text('<link rel="canonical" href="'+ORIGIN+'/"><script src="/assets/privacy-controls.js"></script><meta name="google-adsense-account" content="ca-pub-wrong"><script src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>')
   c=next(x for x in run(root)['checks'] if x['check']=='advertising publisher and consent-only loading')
   self.assertEqual(c['state'],'failed');self.assertEqual(c['errors'],['index.html'])

 def test_http_error_retains_noindex_evidence(self):
  headers=Message();headers['X-Robots-Tag']='noindex'
  error=HTTPError(ORIGIN+'/api/checkout',410,'Gone',headers,None)
  with patch('publication.build_opener') as opener:
   opener.return_value.open.side_effect=error
   r=read_public('/api/checkout')
  self.assertEqual(r['status'],410);self.assertEqual(r['robots'],'noindex');self.assertFalse(r['inconclusive'])
 def test_retired_sales_api_requires_retirement_noindex_and_sitemap_exclusion(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'ads.txt').write_text(ADS)
   for n in ('sitemap.xml','sitemap-pdfs.xml'):(root/n).write_text('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>')
   def retired(overrides={},sitemap=False):
    def reader(p):return {'status':410,'robots':'noindex',**overrides} if p.startswith('/api/') else {'inconclusive':True}
    rows=run(root,True,reader)['checks']
    return [x for x in rows if x['check'].startswith('retired GSC sales API')]
   self.assertEqual([x['state'] for x in retired()],['passed']*3)
   self.assertEqual([x['state'] for x in retired({'status':200})],['failed']*3)
   self.assertEqual([x['state'] for x in retired({'robots':''})],['failed']*3)
   self.assertEqual([x['state'] for x in retired({'status':403,'inconclusive':True})],['inconclusive']*3)
   (root/'sitemap.xml').write_text('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'+ORIGIN+'/api/checkout</loc></url></urlset>')
   self.assertEqual(retired()[0]['state'],'failed')

 def test_indexable_pages_missing_from_sitemap_are_detected(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'ads.txt').write_text(ADS)
   for n in ('sitemap.xml','sitemap-pdfs.xml'):(root/n).write_text('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>')
   (root/'article.html').write_text('<link rel="canonical" href="'+ORIGIN+'/article"><script src="/assets/privacy-controls.js"></script>')
   (root/'private.html').write_text('<meta name="robots" content="noindex">')
   c=next(x for x in run(root)['checks'] if x['check']=='indexable HTML sitemap coverage')
   self.assertEqual(c['state'],'failed');self.assertEqual(c['missing_urls'],[ORIGIN+'/article']);self.assertEqual(c['indexable_count'],1)
   (root/'sitemap.xml').write_text('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'+ORIGIN+'/article</loc></url></urlset>')
   self.assertEqual(next(x for x in run(root)['checks'] if x['check']=='indexable HTML sitemap coverage')['state'],'passed')
