"""Source-only evidence for T04; never assesses truth or editorial originality."""
import argparse
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit
import xml.etree.ElementTree as ET

ORIGIN = 'https://todoroki-gold.com'
EXCLUDED = {'header', 'footer', 'nav', 'aside', 'script', 'style'}

class Body(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_main = False
        self.excluded = 0
        self.text = []
        self.links = []
        self.ids = set()
        self.article_meta = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get('id'):
            self.ids.add(a['id'])
        if tag == 'meta' and a.get('property') == 'og:type' and a.get('content') == 'article':
            self.article_meta = True
        if tag == 'main':
            self.in_main = True
        if self.in_main and tag in EXCLUDED:
            self.excluded += 1
        if self.in_main and not self.excluded and tag == 'a':
            self.links.append(a.get('href', ''))

    def handle_endtag(self, tag):
        if self.in_main and tag in EXCLUDED:
            self.excluded = max(0, self.excluded - 1)
        if tag == 'main':
            self.in_main = False

    def handle_data(self, data):
        if self.in_main and not self.excluded:
            self.text.append(data)

def local_file(root, path):
    if path == '/':
        return root / 'index.html'
    base = root / path.lstrip('/')
    return base.with_suffix('.html') if not base.suffix else base

def inspect(root):
    root = Path(root)
    urls = [x.text for x in ET.parse(root / 'sitemap.xml').iter() if x.tag.endswith('}loc')]
    if len(urls) != len(set(urls)):
        raise ValueError('Duplicate sitemap URLs')
    parsed = {}
    for url in urls:
        parts = urlsplit(url)
        if parts.scheme != 'https' or parts.netloc != 'todoroki-gold.com' or parts.query or parts.fragment:
            raise ValueError('Unexpected sitemap URL')
        p = parts.path
        file = root / (p.lstrip('/') + 'index.html') if p.endswith('/') else local_file(root, p)
        raw = file.read_bytes()  # Missing source must fail, never appear as an empty page.
        parser = Body()
        parser.feed(raw.decode('utf-8'))
        parsed[p] = (parser, hashlib.sha256(raw).hexdigest())
    records = []
    for p, (body, digest) in parsed.items():
        internal, external, broken_fragments = set(), set(), set()
        for href in body.links:
            if not href or href.startswith('#'):
                continue
            target = urlsplit(urljoin(ORIGIN + p, href))
            if target.scheme not in ('http', 'https'):
                continue
            if target.netloc == 'todoroki-gold.com':
                if target.path == p:
                    continue
                if target.path in parsed:
                    internal.add(target.path)
                    if target.fragment and target.fragment not in parsed[target.path][0].ids:
                        broken_fragments.add(target.path + '#' + target.fragment)
            else:
                # Inventory only: not a claim that external links are primary or verified.
                external.add(target.hostname)
        records.append({'path': p, 'sha256': digest, 'article_meta': body.article_meta,
                        'body_characters': len(' '.join(' '.join(body.text).split())),
                        'sitemap_body_targets': sorted(internal),
                        'external_hosts': sorted(external),
                        'missing_target_fragments': sorted(broken_fragments)})
    return {'schema': 1, 'scope': 'source_structure_only_not_fact_or_originality_review',
            'page_count': len(records), 'article_meta_count': sum(x['article_meta'] for x in records),
            'article_meta_without_body_targets': [x['path'] for x in records if x['article_meta'] and not x['sitemap_body_targets']],
            'records': records}

if __name__ == '__main__':
    cli = argparse.ArgumentParser()
    cli.add_argument('--root', default='.')
    cli.add_argument('--output', required=True)
    args = cli.parse_args()
    report = inspect(args.root)
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'pages': report['page_count'], 'article_meta': report['article_meta_count'],
                      'without_body_targets': report['article_meta_without_body_targets']}, ensure_ascii=False))
