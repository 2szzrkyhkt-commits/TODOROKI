import pathlib
import subprocess
import unittest


class ConsentOnlyArticlesTest(unittest.TestCase):
    def test_page_optout_preserves_optional_traffic_and_header(self):
        root = pathlib.Path(__file__).resolve().parents[2]
        result = subprocess.run(
            ["node", "--test", "tools/quality/consent-only-articles.test.mjs"],
            cwd=root, text=True, capture_output=True, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
