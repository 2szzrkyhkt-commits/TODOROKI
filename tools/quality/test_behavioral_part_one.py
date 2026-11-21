"""Check the existing behavioral-economics page and all six course PDF routes."""
from collections import Counter
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import unittest
from urllib.parse import parse_qs, unquote, urlsplit
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[2]
TITLES = ("期待効用理論", "確率判断のバイアス", "時間割引", "社会的選好", "信頼と公平性", "メカニズムデザイン")
ORIGINAL_ANCHORS = (
    "fundamentals", "biases", "investing", "bayesian-reasoning", "game-theory", "entry-game",
    "part-one-review", "uncertainty", "ambiguity", "time-preference", "social-preferences",
    "trust-design", "decision-fields", "part-one-quiz",
)


class Page(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.ids, self.links = [], []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if tag == "a" and "href" in attrs:
            self.links.append(attrs["href"])


class BehavioralPartOne(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.study = (ROOT / "behavioral-economics.html").read_text()
        cls.glossary = (ROOT / "glossary.html").read_text()
        cls.library = (ROOT / "pdf-library.html").read_text()
        cls.catalog = json.loads((ROOT / "assets/pdf-catalog.json").read_text())
        cls.sitemap = {
            unquote(urlsplit(node.text).path)
            for node in ElementTree.parse(ROOT / "sitemap-pdfs.xml").findall(".//{*}loc")
        }

    def test_all_old_anchors_unique_and_crosslinks_resolve(self):
        ids = Counter(Page(self.study).ids)
        terms = Counter(Page(self.glossary).ids)
        for anchor in ORIGINAL_ANCHORS:
            self.assertEqual(ids[anchor], 1)
        self.assertEqual(ids["prospect-companion"], 1)
        self.assertTrue(all(n == 1 for n in ids.values()))
        for link in Page(self.study).links:
            if link.startswith("#"):
                self.assertEqual(ids[link[1:]], 1, link)
            if link.startswith("/glossary#"):
                self.assertEqual(terms[link.split("#")[1]], 1, link)
        self.assertIn('href="https://todoroki-gold.com/behavioral-economics"', self.study)
        self.assertIn('<script src="/assets/privacy-controls.js" defer>', self.study)
        self.assertNotIn("仕事への応用", self.study)

    def test_pdf_cards_have_catalog_and_static_library_and_reciprocal_links(self):
        cards = re.findall(r'<article id="part-one-pdf-(0[1-6])" class="card part-one-card">(.*?)</article>', self.study, re.S)
        self.assertEqual([i for i, _ in cards], [f"{i:02d}" for i in range(1, 7)])
        for (number, card), title in zip(cards, TITLES):
            with self.subTest(number=number):
                pdf = f"/pdf/行動経済学_第1部_{number}_{title}.pdf"
                self.assertIn(f"{title}</h3>", card)
                self.assertEqual(self.catalog[pdf]["lang"], "ja")
                self.assertIn(pdf, self.sitemap)
                routes = [urlsplit(href) for href in Page(card).links]
                viewer = next(x for x in routes if x.path == "/pdf-viewer.html")
                self.assertEqual(unquote(parse_qs(viewer.query)["file"][0]), pdf)
                library_card = re.search(r'<article class="card"><div class="tag">行動経済学</div><h2>行動経済学 第1部 '+number+r'｜[^<]+</h2>.*?</article>',self.library,re.S)
                self.assertIsNotNone(library_card)
                self.assertIn(f"/behavioral-economics#part-one-pdf-{number}", Page(library_card[0]).links)
                self.assertTrue(any(unquote(href) == pdf for href in Page(library_card[0]).links))
                glossary_ids = [r.fragment for r in routes if r.path == "/glossary"]
                self.assertGreaterEqual(len(glossary_ids), 2)
                for glossary_id in glossary_ids:
                    entry = re.search(r'<article\b[^>]*id="'+glossary_id+r'"[^>]*>.*?</article>', self.glossary, re.S)
                    self.assertIn(f"/behavioral-economics#part-one-pdf-{number}", Page(entry[0]).links)
                asset = ROOT / pdf.removeprefix("/")
                self.assertTrue(asset.is_file(), f"Missing release PDF {pdf}")
                self.assertEqual(asset.read_bytes()[:5], b"%PDF-")

    def test_mobile_grid_and_controls_have_fallback(self):
        self.assertIn('grid-template-columns:repeat(2,minmax(0,1fr))', self.study)
        self.assertRegex(self.study, r'@media\(max-width:680px\)\{\.part-one-cards\{grid-template-columns:minmax\(0,1fr\)')
        self.assertIn('min-height:44px', self.study)
        self.assertIn('<details class="part-one-detail"><summary>', self.study)
