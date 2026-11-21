"""Check applied, disclosure-only behavioral finance UX, without touching tool behavior."""
import os
from pathlib import Path
import re
import unittest
from tools.quality.test_valuation_reading_lens import Links

ROOT = Path(__file__).resolve().parents[2]
LEARN = "/behavioral-economics#chapter-19"


class AppliedBehavioralFinance(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.home = (ROOT / "index.html").read_text()
        cls.usa = (ROOT / "us-equity.html").read_text()
        cls.article = (ROOT / "smc-6273-earnings-valuation-2026.html").read_text()

    def test_home_reuses_guide_and_keeps_access_links(self):
        self.assertEqual(self.home.count('id="analysis-reading-guide"'), 1)
        g = re.search(r'<details id="analysis-reading-guide"[^>]*>(.*?)</details>', self.home, re.S)[1]
        self.assertIn("上向き・下向き", g)
        self.assertIn("基準日・通貨", g)
        self.assertIn("不明なら理論値の比較は保留", g)
        self.assertEqual(g.count("<li>"), 3)
        for route in ("equity", "jp", "us"):
            [link] = [a for a in Links(self.home).items if a.get("href") == f"/api/tools/{route}"]
            self.assertEqual(link.get("referrerpolicy"), "origin")
        self.assertEqual(sum(a.get("href") == "/us-equity" for a in Links(self.home).items), 1)
        self.assertIn("リアルタイム株価を確認する機能ではありません", self.home)

    def test_us_landing_describes_existing_public_route_and_limits(self):
        [link] = [a for a in Links(self.usa).items if a.get("href") == "https://todoroki-us-equity-lab.easysquid66.chatgpt.site/"]
        self.assertNotIn("target", link)
        self.assertIn("別サイトの米国企業分析ツール", self.usa)
        self.assertIn("出典と基準日", self.usa)
        self.assertIn('href="/#analysis-reading-guide"', self.usa)

    def test_article_disclosure_not_a_price_or_model_claim(self):
        details = re.search(r'<details class="note">(.*?)</details>', self.article, re.S)[1]
        self.assertIn("<summary>株価の目安を見る前のチェック</summary>", details)
        for x in ("DCFの理論株価は算定していません", "成長率・割引率・予測期間後の価値", "前提が欠けているときは比較を保留", "反対に弱まる"):
            self.assertIn(x, details)
        self.assertNotRegex(details, r"[\d,.]+円|[\d.]+\s*[%％]")
        self.assertEqual(Links(details).items, [{"href": LEARN}])
        self.assertEqual([a for a in Links(self.article).items if "data-article-tool-market" in a],
                         [{"href": "/#equity-research-tool", "data-article-tool-market": "jp"}])

    def test_combined_release_has_exact_chapter_target(self):
        if os.environ.get("BE_FULL_COURSE_REQUIRED") != "1":
            self.skipTest("Run with BE_FULL_COURSE_REQUIRED=1 after merging the companion course patch")
        course = (ROOT / "behavioral-economics.html").read_text()
        self.assertEqual(course.count('id="chapter-19"'), 1)
        self.assertEqual(self.home.count(f'href="{LEARN}"'), 1)
        self.assertEqual(self.article.count(f'href="{LEARN}"'), 1)

if __name__ == "__main__":
    unittest.main()
