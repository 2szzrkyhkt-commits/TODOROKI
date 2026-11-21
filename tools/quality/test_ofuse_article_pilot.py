"""Contract for the opt-in, ordinary OFUSE link on the shared article component."""
from html.parser import HTMLParser
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
DESTINATION = "https://ofuse.me/todoroki_gold"
FILES = ("valuation-per-pbr.html", "fundamental-analysis.html", "financial-statements-basics.html")


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
        cls.articles = {p: (ROOT / p).read_text() for p in FILES}
        cls.home = (ROOT / "index.html").read_text()

    def test_same_native_optional_link_matches_home_destination(self):
        self.assertTrue(any(a.get("href") == DESTINATION for a in Links(self.home).anchors))
        blocks = []
        for path, article in self.articles.items():
            with self.subTest(path=path):
                [block] = re.findall(r'<aside class="article-ofuse"[^>]*>(.*?)</aside>', article, re.S)
                blocks.append(block)
                [link] = Links(block).anchors
                self.assertEqual(link, {
                    "class": "article-ofuse-link", "href": DESTINATION, "rel": "noreferrer",
                    "aria-describedby": "article-ofuse-intro article-ofuse-external",
                })
                self.assertEqual(sum(a.get("href") == DESTINATION for a in Links(article).anchors), 1)
                self.assertNotRegex(block, r'<(?:form|input|script|img|iframe)\b|on(?:click|submit)=')
                for msg in ("とどろきを応援する", "記事やツールが役に立ったら、任意で応援できます。", "OFUSEが開きます"):
                    self.assertIn(msg, block)
        self.assertEqual(len(set(blocks)), 1, "all opted-in pages use exact same markup")

    def test_separation_from_pdf_and_advertisements(self):
        for path, article in self.articles.items():
            with self.subTest(path=path):
                for ref in ("article-ofuse-intro", "article-ofuse-external"):
                    self.assertEqual(article.count(f'id="{ref}"'), 1)
                self.assertRegex(article, r'</aside>\s*<section class="related"><h2>関連記事</h2>')
                before, after = article.split('<aside class="article-ofuse"', 1)
                source = before.rsplit("<section", 1)[1]
                self.assertRegex(source, r'<h2>[^<]+</h2>.*?</section>\s*$', "previous sibling is editorial content")
                self.assertNotIn("/pdf", source)
                self.assertNotIn("広告", source)
                after_related = after.partition('<section class="related"><h2>関連記事</h2>')[2]
                related, _, rest = after_related.partition("</section>")
                self.assertNotIn("広告", related)
                self.assertIn('aria-label="広告', rest)

    def test_readable_on_narrow_screens_without_changing_other_pages(self):
        css = (ROOT / "assets/article-ofuse.css").read_text()
        self.assertIn("min-height: 44px", css)
        self.assertIn("max-width: 100%", css)
        self.assertIn(":focus-visible", css)
        self.assertNotRegex(css, r"position:\s*(?:fixed|sticky)|@import|url\(")
        self.assertNotIn("article-ofuse.css", self.home)
        for path, article in self.articles.items():
            with self.subTest(path=path):
                self.assertEqual(article.count('href="/assets/article-ofuse.css"'), 1)
        for p in ("toto-5332-earnings-valuation-2026.html", "smc-6273-earnings-valuation-2026.html"):
            self.assertNotIn("article-ofuse.css", (ROOT / p).read_text())


if __name__ == "__main__":
    unittest.main()
