"""Static publication regression for the existing Part 1–3 learning page."""
from collections import Counter
from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import unittest
from urllib.parse import parse_qs, unquote, urlsplit
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
NAMES = {11:'情報処理のメカニズム',12:'プロスペクト理論',13:'心理会計',14:'取引効用理論',15:'選好の逆転',16:'社会的選好'}

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.ids = []
        self.links = []
        self.details = []
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        fields = dict(attrs)
        if 'id' in fields:
            self.ids.append(fields['id'])
        if tag == 'a':
            self.links.append(fields)
        if tag == 'details':
            self.details.append(fields)

class BehavioralPartThree(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.study = (ROOT / 'behavioral-economics.html').read_text()
        cls.glossary = (ROOT / 'glossary.html').read_text()
        cls.library = (ROOT / 'pdf-library.html').read_text()
        cls.catalog = json.loads((ROOT / 'assets/pdf-catalog.json').read_text())
        cls.cards = {int(n): h for n, h in re.findall(r'<article id="part-three-chapter-(1[1-6])"[^>]*>(.*?)</article>',cls.study,re.S)}
        cls.sitemap = [unquote(n.text) for n in ET.parse(ROOT / 'sitemap-pdfs.xml').getroot().findall('.//{*}loc')]

    def test_roadmap_has_new_sections_without_removing_originals(self):
        page = Page(self.study)
        self.assertFalse([key for key, ct in Counter(page.ids).items() if ct > 1])
        self.assertEqual(list(self.cards),list(NAMES))
        nav = Page(re.search(r'<nav id="behavior-study-roadmap".*?</nav>',self.study,re.S)[0])
        self.assertEqual([a['href'] for a in nav.links],['#part-one-roadmap','#part-two-roadmap','#part-three-roadmap'])
        review = re.search(r'<section id="part-two-roadmap".*?</section>',self.study,re.S)[0]
        self.assertIn('既存の教材',review)
        self.assertNotIn('完了',review)
        self.assertEqual([a['href'] for a in Page(review).links],
                         ['#biases','#bayesian-reasoning','#ambiguity','#investing','#part-three-roadmap'])
        for h in page.links:
            if h.get('href','').startswith('#'):
                self.assertIn(h['href'][1:],page.ids,h['href'])
        self.assertEqual(self.study.count('src="/assets/privacy-controls.js"'),1)
        for u in ('https://www.jstor.org/stable/1914185','https://sites.socsci.uci.edu/~bskyrms/bio/readings/ellsberg.pdf#page=11'):
            part1=self.study.split('<section id="part-one-roadmap"',1)[1].split('</section>',1)[0]
            self.assertIn(u,part1)

    def test_chapters_have_native_disclosures_verified_links_and_forward_backward_navigation(self):
        glossary_ids=Counter(Page(self.glossary).ids)
        self.assertFalse([key for key, ct in glossary_ids.items() if ct>1])
        unique_glossary_labels = [unescape(h) for h in re.findall(r'<article class="entry" id="term-[^"]+"[^>]*>(?:(?!</article>).)*?<h2>([^<]*)</h2>',self.glossary,re.S)]
        # Validate newly introduced labels are unique across the global JP glossary.
        new = self.glossary.split('<!-- be-part3:glossary-entries:start -->',1)[1].split('<!-- be-part3:glossary-entries:end -->',1)[0]
        for term in re.findall(r'<h2>([^<]*)</h2>',new):
            self.assertEqual(unique_glossary_labels.count(unescape(term)),1,term)
        for n,title in NAMES.items():
            with self.subTest(n=n):
                card=self.cards[n]
                self.assertIn(f'{n}</span> {title}</h3>',card)
                parsed=Page(card)
                self.assertEqual(len(parsed.details),5)
                self.assertTrue(all('open' not in row for row in parsed.details))
                self.assertRegex(card,r'<summary data-be-action="quiz">確認問題</summary><p>[^<]+</p>\s*<details')
                self.assertRegex(card,r'<summary>解答を見る</summary><p>[^<]+</p></details></details>')
                for section in ['理論・図解・事例','図解｜考える順序','日常での例','経済での例','マーケティングと情報設計','学術資料・参照先']:
                    self.assertIn(section,card)
                links=[h['href'] for h in parsed.links]
                sources=[u for u in links if urlsplit(u).scheme]
                self.assertGreaterEqual(len(sources),3)
                self.assertTrue(all(urlsplit(u).scheme=='https' and urlsplit(u).hostname for u in sources))
                terms = [u.split('#',1)[1] for u in links if u.startswith('/glossary#')]
                self.assertGreaterEqual(len(terms),6)
                for term in set(terms):
                    self.assertEqual(glossary_ids[term],1,term)
                    entry = re.search(r'<article class="entry" id="'+term+r'".*?</article>',self.glossary,re.S)[0]
                    self.assertIn(f'/behavioral-economics#part-three-chapter-{n}',entry)
                nav=Page(re.search(r'<nav class="part-one-actions part-three-sequence".*?</nav>',card,re.S)[0])
                self.assertEqual([a['href'] for a in nav.links],[f'#part-three-chapter-{n-1}' if n>11 else '#part-two-roadmap',
                                                                     f'#part-three-chapter-{n+1}' if n<16 else '#behavior-study-roadmap'])

    def test_pdf_viewer_raw_assets_library_and_sitemap_agree(self):
        for n,title in NAMES.items():
            with self.subTest(n=n):
                pdf=f'/pdf/行動経済学_第3部_{n}_{title}.pdf'
                label=f'行動経済学 第3部 {n}｜{title}'
                self.assertTrue((ROOT/pdf.lstrip('/')).read_bytes().startswith(b'%PDF-'))
                self.assertEqual(self.catalog.get(pdf),{'title':label,'lang':'ja'})
                self.assertEqual(self.sitemap.count('https://todoroki-gold.com'+pdf),1)
                card=re.search(r'<article class="card"><div class="tag">行動経済学</div><h2>'+label+r'</h2>.*?</article>',self.library,re.S)[0]
                self.assertTrue(any(a['href']==f'/behavioral-economics#part-three-chapter-{n}' for a in Page(card).links))
                self.assertIn(json.dumps(pdf.split('/')[-1],ensure_ascii=False)+': '+json.dumps(label,ensure_ascii=False),self.library)
                for h in [self.cards[n],card]:
                    links=Page(h).links
                    v=next(a for a in links if a['href'].startswith('/pdf-viewer.html?'))
                    q=parse_qs(urlsplit(v['href']).query)
                    self.assertEqual(q.get('lang'),['ja'])
                    self.assertEqual(unquote(q['file'][0]),pdf)
                    raw=next(a for a in links if 'download' in a)
                    self.assertEqual(unquote(raw['href']),pdf)
                    self.assertEqual(raw['download'],pdf.rsplit('/',1)[-1])

if __name__ == '__main__':
    unittest.main()
