"""Contract for the single static OFUSE link on the valuation pilot article."""
from html.parser import HTMLParser
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
DESTINATION = "https://ofuse.me/todoroki_gold"

class Links(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.anchors = []
        self.feed(html)

    def handle_starttag(self, name, attrs):
        if name == "a":
            self.anchors.append(dict(attrs))


class ArticleSupportPilot(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.article = (ROOT / "valuation-per-pbr.html").read_text()
        cls.home = (ROOT / "index.html").read_text()
        cls.block = re.search(r'<aside class="article-ofuse"[^>]*>(.*?)</aside>', cls.article, re.S)[1]

    def test_one_native_optional_link_matches_home_destination(self):
        [link] = Links(self.block).anchors
        self.assertEqual(link, {
            "class": "article-ofuse-link", "href": DESTINATION, "rel": "noreferrer",
            "aria-describedby": "article-ofuse-intro article-ofuse-external",
        })
        self.assertEqual(sum(a.get("href") == DESTINATION for a in Links(self.article).anchors), 1)
        self.assertTrue(any(a.get("href") == DESTINATION for a in Links(self.home).anchors))
        self.assertNotRegex(self.block, r'<(?:form|input|script|img|iframe)\b|on(?:click|submit)=')

    def test_exact_plain_language_and_separation(self):
        for s in ("とどろきを応援する", "記事やツールが役に立ったら、任意で応援できます。", "OFUSEが開きます"):
            self.assertIn(s, self.block)
        for ref in ("article-ofuse-intro", "article-ofuse-external"):
            self.assertEqual(self.article.count(f'id="{ref}"'), 1)
        self.assertRegex(self.article, r'</aside>\s*<section class="related"><h2>関連記事</h2>')
        before, after = self.article.split('<aside class="article-ofuse"', 1)
        source = before.rsplit('<h2>定義と比較データの確認先</h2>', 1)[1]
        self.assertNotIn('/pdf', source)
        self.assertNotIn('広告', source)
        self.assertGreater(after.find('aria-label="広告'), after.find('<h2>関連記事</h2>'))

    def test_readable_on_narrow_screens_without_changing_other_pages(self):
        css = (ROOT / "assets/article-ofuse.css").read_text()
        self.assertIn("min-height: 44px", css)
        self.assertIn("max-width: 100%", css)
        self.assertIn(":focus-visible", css)
        self.assertNotRegex(css, r"position:\s*(?:fixed|sticky)|@import|url\(")
        self.assertNotIn("article-ofuse.css", self.home)
        self.assertIn('href="/assets/article-ofuse.css"', self.article)
        for p in ("toto-5332-earnings-valuation-2026.html", "smc-6273-earnings-valuation-2026.html"):
            self.assertNotIn("article-ofuse.css", (ROOT / p).read_text())

if __name__ == "__main__":
    unittest.main()
