import unittest
from pathlib import Path
from html.parser import HTMLParser
import re
ROOT=Path(__file__).resolve().parents[2]
class Tags(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids=[]; self.links=[]; self.labels=[]
    def handle_starttag(self,t,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if t=='a':self.links.append(a.get('href'))
        self.labels.extend(a.get('aria-labelledby','').split())
class TaxPublicSlice(unittest.TestCase):
    def setUp(self):
        self.page=(ROOT/'tax-study.html').read_text()
        self.section=re.search(r'<!-- tax-source-release:start -->([\s\S]*?)<!-- tax-source-release:end -->',self.page).group(1)
    def test_public_links_only(self):
        p=Tags();p.feed(self.page)
        self.assertFalse(any(re.match(r'^(https?:)?//', link or '') for link in p.links))
    def test_filter_contract(self):
        self.assertIn('id="tax-source-kind" disabled', self.section)
        self.assertIn('id="tax-source-subject" disabled', self.section)
        self.assertIn('id="tax-source-query" type="search"', self.section)
        self.assertIn('<noscript>', self.section)
        self.assertIn('role="status"', self.section)
        import subprocess
        subprocess.run(['node','--test',str(ROOT/'tools/quality/tax-public-feed.test.mjs'),str(ROOT/'tools/tax/public-feed.test.mjs')],check=True,cwd=ROOT)
    def test_accessible_ids_and_preserved_learning(self):
        p=Tags();p.feed(self.page)
        self.assertEqual(len(p.ids),len(set(p.ids)))
        self.assertTrue(all(i in p.ids for i in p.labels))
        self.assertTrue(all(x[1:] in p.ids for x in p.links if x and x.startswith('#')))
        self.assertEqual(len(re.findall(r'data-tax-lesson="',self.page)),22)
        self.assertIn('id="income-tax-form"',self.page)
if __name__=='__main__':unittest.main()


