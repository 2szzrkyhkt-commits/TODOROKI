"""Offline contracts for the single TOTO valuation article reading-layout pilot."""
from html.parser import HTMLParser
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]

class Links(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.items = []
        self.feed(source)
    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.items.append(dict(attrs))

class TestValuationReadingLens(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = (ROOT / "toto-5332-earnings-valuation-2026.html").read_text()
        cls.lens = re.search(
            r'<section class="valuation-lens"[^>]*>(.*?)</section>', cls.source, re.S
        )[1]

    def test_conditions_are_balanced_and_always_visible(self):
        a, b = re.findall(r'<div class="valuation-condition">(.*?)</div>', self.lens, re.S)
        self.assertIn("上向き", a)
        self.assertIn("下向き", b)
        for case in (a, b):
            self.assertIn("会社予想", case)
            self.assertIn("営業キャッシュフロー", case)
        on_screen, _, rest = self.lens.partition("<details>")
        self.assertIn(a, on_screen)
        self.assertIn(b, on_screen)
        self.assertIn("将来の予測ではなく", on_screen)
        self.assertIn("次の決算", on_screen)
        self.assertIn("<summary>", rest)
        self.assertNotIn("details open", self.lens)

    def test_dates_quote_model_and_unknowns_are_distinct(self):
        self.assertIn('<time datetime="2026-10-30">', self.lens)
        self.assertIn('<time datetime="2026-11-19">', self.lens)
        self.assertIn("現在値ではありません", self.lens)
        self.assertIn("決算短信に株価の記載はなく", self.lens)
        self.assertEqual(
            re.findall(r"<dt>(.*?)</dt>", self.lens),
            ["実際の株価", "モデルの目安", "未算定の項目"],
        )
        self.assertIn("当時の会社予想EPSとPER・PBR", self.lens)
        self.assertIn("前提が変われば目安も変わります", self.lens)
        self.assertIn("DCFによる理論株価", self.lens)
        self.assertIn("示していません", self.lens)
        self.assertNotRegex(self.lens, r"[\d,.]+円|[\d.]+\s*[%％]")
        self.assertIn("5,377円", self.source)
        self.assertIn("3,700〜4,200円", self.source)

    def test_learning_link_and_existing_measured_tool_entry_are_separate(self):
        self.assertEqual(
            Links(self.lens).items, [{"href": "/behavioral-economics#part-three-chapter-12"}]
        )
        self.assertIn('id="part-three-chapter-12"', (ROOT / "behavioral-economics.html").read_text())
        for file in ("toto-5332-earnings-valuation-2026", "smc-6273-earnings-valuation-2026"):
            text = (ROOT / (file + ".html")).read_text()
            tracked = [a for a in Links(text).items if "data-article-tool-market" in a]
            self.assertEqual(tracked, [{"href": "/#equity-research-tool", "data-article-tool-market": "jp"}])
            self.assertEqual(text.count('src="/assets/article-tool-click.js"'), 1)

    def test_home_guide_is_optional_and_does_not_change_tool_entry(self):
        home=(ROOT / "index.html").read_text()
        guide=re.search(r'<details id="analysis-reading-guide"[^>]*>(.*?)</details>',home,re.S)[1]
        self.assertIn('企業・経済データの読み方',guide)
        self.assertIn('同じ決算期と単位',guide)
        self.assertIn('未確認はゼロと読み替えません',guide)
        self.assertIn('出典と更新日',guide)
        self.assertEqual(Links(guide).items,[{"href": "/behavioral-economics#part-three-chapter-12"}, {"href": "/behavioral-economics#chapter-19"}])
        for route in ('equity','jp','us'):
            self.assertEqual(len([a for a in Links(home).items if a.get('href')==f'/api/tools/{route}']),1)

    def test_layout_preserves_order_on_small_displays(self):
        self.assertIn("grid-template-columns:repeat(2,minmax(0,1fr))", self.source)
        self.assertIn("@media(max-width:560px)", self.source)
        self.assertIn(".valuation-conditions{grid-template-columns:minmax(0,1fr)}", self.source)
        self.assertIn(".valuation-lens summary:focus-visible", self.source)

if __name__ == "__main__":
    unittest.main()
