"""Run PDF initialization regressions against checked-out source, never live pages."""
import pathlib
import subprocess
import unittest


class PDFViewerTests(unittest.TestCase):
    def test_pdf_viewer_all_languages_and_replaced_header(self):
        root = pathlib.Path(__file__).resolve().parents[2]
        result = subprocess.run(
            ['node', '--test', 'tools/quality/pdf-viewer.test.mjs'],
            cwd=root, text=True, capture_output=True, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
