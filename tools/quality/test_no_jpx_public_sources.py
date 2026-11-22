"""Stop JPX / J-Quants / exchange-host links from returning to public assets."""

import html
import re
import shutil
import subprocess
import unicodedata
import unittest
import zlib
from pathlib import Path
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parents[2]
PRIVATE_FOLDERS = {
    ".git", ".github", "node_modules", "docs", "tools", "migration",
    "validation", "quality-results",
}
TEXT_EXTENSIONS = {
    ".html", ".htm", ".js", ".mjs", ".cjs", ".json", ".jsonc", ".txt",
    ".xml", ".css", ".rss", ".atom", ".svg", ".map", ".md", ".csv", ".tsv",
    ".webmanifest", ".toml",
}
FORBIDDEN = re.compile(
    r"(?<![a-z\d-])(?:jpx\.co\.jp|tdnet\.info|jpx-jquants\.com|jquants\.com|jpx\.github\.io)"
    r"\.?(?![a-z\d.-])", re.I
)
JS_ESCAPE = re.compile(r"\\(?:u([0-9a-f]{4})|x([0-9a-f]{2}))", re.I)
PDF_STREAM = re.compile(rb"\bstream\r?\n(.*?)\r?\nendstream\b", re.S)
PDF_URI_HEX = re.compile(rb"/URI\s*<([0-9a-f\s]{10,4096})>", re.I)
PDF_URI_LITERAL = re.compile(rb"/URI\s*\(((?:[^()\\]|\\.){1,4096})\)", re.I | re.S)
PDF_OCTAL = re.compile(rb"\\([0-3][0-7]{2})")
MAX_STREAM = 8_000_000


def text_has_source(value: str) -> bool:
    for _ in range(3):
        value = unicodedata.normalize("NFKC", value)
        if FORBIDDEN.search(value):
            return True
        normalized = JS_ESCAPE.sub(lambda m: chr(int(m[1] or m[2], 16)), value)
        normalized = unquote(html.unescape(normalized)).replace(r"\/", "/")
        if normalized == value:
            return False
        value = normalized
    return bool(FORBIDDEN.search(value))


def pdf_chunk_has_source(body: bytes) -> bool:
    lower = body.lower()
    if any(marker in lower for marker in (b"jpx.", b"tdnet.", b"jquants.")):
        if FORBIDDEN.search(lower.decode("latin-1")):
            return True
    for m in PDF_URI_LITERAL.finditer(body):
        value = PDF_OCTAL.sub(lambda x: bytes([int(x[1], 8)]), m[1])
        if text_has_source(value.decode("latin-1")):
            return True
    for m in PDF_URI_HEX.finditer(body):
        try:
            raw = bytes.fromhex(m[1].decode("ascii"))
        except ValueError:
            continue
        for encoding in ("utf-8", "utf-16-be", "utf-16-le"):
            if text_has_source(raw.decode(encoding, errors="ignore")):
                return True
    return False


def pdf_has_source(body: bytes) -> bool:
    if pdf_chunk_has_source(body):
        return True
    for m in PDF_STREAM.finditer(body):
        try:
            # Common PDF object/annotation streams use Flate; cap decompressed size.
            decoded = zlib.decompressobj().decompress(m[1], MAX_STREAM)
        except zlib.error:
            continue
        if pdf_chunk_has_source(decoded):
            return True
    return False


def tracked_and_candidate_files():
    names = subprocess.check_output([
        "git", "-C", str(ROOT), "ls-files", "-z", "--cached", "--others",
        "--exclude-standard",
    ]).split(b"\0")
    for name in set(names) - {b""}:
        rel = Path(name.decode("utf-8"))
        if rel.parts[0] in PRIVATE_FOLDERS or rel.parts[0].startswith("."):
            continue
        if rel.name.startswith("README"):
            continue  # excluded from the published asset bundle
        if rel.suffix.lower() not in TEXT_EXTENSIONS | {".pdf"} and rel.name not in {"_headers", "_redirects"}:
            continue
        full = ROOT / rel
        if full.is_file():
            yield rel, full


def full_pdf_has_source(path: Path) -> bool:
    for args in (["pdftotext", str(path), "-"], ["pdfinfo", "-url", str(path)], ["pdfinfo", "-meta", str(path)]):
        result = subprocess.run(args, check=True, capture_output=True, timeout=12)
        if text_has_source(result.stdout.decode("utf-8", errors="replace")):
            return True
    return False


class PublicSourcePolicyTests(unittest.TestCase):
    def test_detection_and_boundaries(self):
        for value in (
            'https://www2.jpx.co.jp/disc/X.pdf',
            'https://api.JQUANTS.COM./v2',
            '//jpx-jquants.com/path',
            'https&#x3a;//port&#46;jpx&#46;co&#46;jp/path',
            'https:%2F%2Fwww%2Ejpx%2Eco%2Ejp/path',
            r'https:\/\/jpx\u002eco\x2ejp/robot',
        ):
            self.assertTrue(text_has_source(value), value)
        for value in ('JPX', 'TOPIX', 'edition-jpx.co.jp', 'jpx.co.jp.example.com'):
            self.assertFalse(text_has_source(value), value)
        uri = b'https://www.jpx.co.jp/'
        self.assertTrue(pdf_has_source(b'%PDF /URI <' + uri.hex().encode() + b'>'))
        self.assertTrue(pdf_has_source(b'%PDF stream\n' + zlib.compress(b'/URI (' + uri + b')') + b'\nendstream'))
        self.assertTrue(pdf_has_source(rb'%PDF /URI (https://www.jpx\056co\056jp/)'))
        self.assertFalse(pdf_has_source(b'%PDF /URI (https://example.com/)'))

    def test_public_and_runtime_files(self):
        findings = []
        for rel, path in tracked_and_candidate_files():
            if rel.suffix.lower() == ".pdf":
                bad = pdf_has_source(path.read_bytes())
            else:
                bad = text_has_source(path.read_text(encoding="utf-8", errors="replace"))
            if bad:
                findings.append(rel.as_posix())
        self.assertEqual(sorted(findings), [], "Use verified non-JPX primary sources; do not relabel unverifiable data.")


if __name__ == "__main__":
    import sys

    if sys.argv[1:] == ["--full-pdf"]:
        if not all(shutil.which(command) for command in ("pdftotext", "pdfinfo")):
            raise SystemExit("Full PDF text and embedded-link check needs Poppler.")
        pdfs = [(rel, path) for rel, path in tracked_and_candidate_files() if rel.suffix.lower() == ".pdf"]
        contaminated = [str(rel) for rel, path in pdfs if full_pdf_has_source(path)]
        print(f"PDFs scanned: {len(pdfs)}; JPX findings: {len(contaminated)}")
        if contaminated:
            raise SystemExit("\n".join(sorted(contaminated)))
    else:
        unittest.main()
