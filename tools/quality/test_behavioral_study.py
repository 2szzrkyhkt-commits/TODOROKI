from collections import Counter
from html import unescape
from pathlib import Path
import json
import re
import subprocess
import unittest
from urllib.parse import parse_qs, unquote, urlsplit
from xml.etree import ElementTree
from test_behavioral_part_three import Page

ROOT = Path(__file__).resolve().parents[2]
def read(name): return (ROOT / name).read_text()

class FullBehavioralCourse(unittest.TestCase):
    def test_all_twenty_chapters_source_links_and_quizzes(self):
        s=read('behavioral-economics.html')
        gids=Counter(Page(read('glossary.html')).ids)
        self.assertEqual([int(n) for n in re.findall('data-study-chapter="(\\d+)"',s)],list(range(1,21)))
        ids=Counter(Page(s).ids)
        self.assertEqual(ids['behavior-study-progress'],1)
        for n in range(1,21):
            self.assertEqual(ids[f'chapter-{n}'],1)
        cards=re.findall(r'<article[^>]*data-study-chapter="(\d+)"[^>]*>(.*?)</article>',s,re.S)
        for n,body in cards:
            with self.subTest(n=n):
                self.assertIn('確認問題',body)
                self.assertIn('解答を見る',body)
                self.assertEqual(re.findall(r'name="choice" value="([0-2])"',body),['0','1','2'])
                self.assertRegex(body,r'<form data-study-quiz data-answer="[0-2]" hidden>')
                self.assertEqual(body.count('data-study-complete'),1)
                links=[x['href'] for x in Page(body).links]
                self.assertGreaterEqual(sum(x.startswith('https://') for x in links),2)
                gv=[x.split('#',1)[1] for x in links if x.startswith('/glossary#')]
                self.assertGreaterEqual(len(gv),2)
                self.assertTrue(all(gids[x]==1 for x in gv))
                pdf=next(v for v in links if v.startswith('/pdf-viewer.html?'))
                path=unquote(parse_qs(urlsplit(pdf).query)['file'][0])
                self.assertTrue((ROOT/path.lstrip('/')).is_file())
    def test_four_new_pdfs_catalog_viewers_and_sitemap(self):
        catalog=json.loads(read('assets/pdf-catalog.json'))
        library=read('pdf-library.html')
        sitemap={unquote(x.text) for x in ElementTree.fromstring(read('sitemap-pdfs.xml')).findall('.//{*}loc')}
        paths={k:v for k,v in catalog.items() if k.startswith('/pdf/行動経済学_第4部_')}
        self.assertEqual(len(paths),4)
        for path,entry in paths.items():
            n=int(path.split('_')[2])
            self.assertIn(n,range(17,21))
            self.assertTrue((ROOT/path.lstrip('/')).read_bytes().startswith(b'%PDF-'))
            self.assertIn('https://todoroki-gold.com'+path,sitemap)
            self.assertIn(entry['title'],library)
            self.assertIn(f'/behavioral-economics#chapter-{n}',library)
    def test_new_glossary_definitions_unique_and_reciprocal(self):
        g=read('glossary.html')
        s=read('behavioral-economics.html')
        by_key={k:v for k,v in re.findall(r'<article class="entry" id="(term-[^"]+)"[^>]*>(.*?)</article>',g,re.S)}
        labels=[unescape(re.search(r'<h2>(.*?)</h2>',v,re.S)[1]) for v in by_key.values() if re.search(r'<h2>(.*?)</h2>',v,re.S)]
        for k,v in by_key.items():
            if k.startswith('term-be-'):
                label=unescape(re.search(r'<h2>(.*?)</h2>',v,re.S)[1])
                self.assertEqual(labels.count(label),1,label)
                self.assertRegex(v,r'/behavioral-economics#chapter-\d+')
                self.assertIn('/glossary#'+k,s)
