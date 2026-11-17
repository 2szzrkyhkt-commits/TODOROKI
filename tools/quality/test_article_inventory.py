import tempfile
import unittest
import json
from pathlib import Path
from article_inventory import Body, inspect

class InventoryTests(unittest.TestCase):
    def test_chrome_and_ads_do_not_count_as_body(self):
        p = Body()
        p.feed('<header><a href="/header">head</a></header><main><nav><a href="/nav">nav</a></nav><aside><a href="/ad">ad</a><script>bad</script></aside><p>actual <a href="/body">body</a></p></main><footer><a href="/foot">foot</a></footer>')
        self.assertEqual(p.links, ['/body'])
        self.assertEqual(''.join(p.text), 'actual body')

    def fixture(self, root):
        (root/'sitemap.xml').write_text('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://todoroki-gold.com/a</loc></url><url><loc>https://todoroki-gold.com/en/</loc></url></urlset>')
        (root/'a.html').write_text('<meta property="og:type" content="article"><main><a href="#self">self</a><a href="/a#self">same</a><a href="/en/#valid">valid</a><a href="https://todoroki-gold.com/en/#missing">missing</a><a href="/not-in-sitemap">unknown</a><a href="https://example.org">external</a></main>')
        (root/'en').mkdir()
        (root/'en/index.html').write_text('<main><h1 id="valid">EN</h1></main>')

    def test_targets_fragments_and_unknown_routes(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d);self.fixture(root)
            report = inspect(root)
            a = report['records'][0]
            self.assertEqual(report['page_count'], 2)
            self.assertEqual(a['sitemap_body_targets'], ['/en/'])
            self.assertEqual(a['missing_target_fragments'], ['/en/#missing'])
            self.assertEqual(a['external_hosts'], ['example.org'])
            self.assertEqual(report['scope'], 'source_structure_only_not_fact_or_originality_review')

    def test_missing_source_fails(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);self.fixture(root);(root/'a.html').unlink()
            with self.assertRaises(FileNotFoundError): inspect(root)

    def test_duplicate_sitemap_fails(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);self.fixture(root)
            file=root/'sitemap.xml';file.write_text(file.read_text().replace('</urlset>','<url><loc>https://todoroki-gold.com/a</loc></url></urlset>'))
            with self.assertRaises(ValueError): inspect(root)

class CurrentInventoryTests(unittest.TestCase):
    def test_current_sitemap_and_repaired_navigation(self):
        root = Path(__file__).resolve().parents[2]
        report = inspect(root)
        records = {x['path']: x for x in report['records']}
        repaired = ['/open-house-group-3288-earnings-2026', '/nyk-9101-earnings-2026', '/yamada-hd-9831-earnings-2026']
        repaired += ['/' + lang + '/anthropic-ipo-ai-safety-2026' for lang in ['en', 'es', 'pt', 'zh-Hans', 'zh-Hant']]
        for p in repaired:
            with self.subTest(path=p):
                self.assertGreaterEqual(len(records[p]['sitemap_body_targets']), 3)
                self.assertFalse(records[p]['missing_target_fragments'])
                if 'anthropic' in p:
                    prefix = '/' + p.split('/')[1] + '/'
                    self.assertTrue(all(t.startswith(prefix) for t in records[p]['sitemap_body_targets']))
        self.assertFalse(report['article_meta_without_body_targets'])
        output=root/'quality-results/article-inventory.json'
        output.parent.mkdir(exist_ok=True)
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')

if __name__=='__main__': unittest.main()
