import json,unittest
from pathlib import Path
from urllib.parse import unquote
ROOT=Path(__file__).resolve().parents[2]
class LegacyTests(unittest.TestCase):
 def test_permanent_rules_match_known_destinations(self):
  expected=json.loads((ROOT/'tools/quality/legacy-redirects.json').read_text())
  rules=[s.split() for s in (ROOT/'_redirects').read_text().splitlines() if s and not s.startswith('#')]
  self.assertEqual({src:(dest,code) for src,dest,code in rules},{r['from']:(r['to'],'301') for r in expected})
  for src,dest,code in rules:
   self.assertNotIn('*',src);self.assertTrue(dest.startswith('/') and not dest.startswith('//'))
   target=ROOT/unquote(dest).lstrip('/')
   self.assertTrue(target.is_file() or target.with_suffix('.html').is_file(),dest)
 def test_api_and_pdf_directory_are_not_rewritten(self):
  sources={r['from'] for r in json.loads((ROOT/'tools/quality/legacy-redirects.json').read_text())}
  self.assertFalse(sources.intersection({'/api/auth/','/pdf/','/premium.html'}))
