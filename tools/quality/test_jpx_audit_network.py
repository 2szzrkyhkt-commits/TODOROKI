"""Use an isolated transport to check direct and redirected JPX audit exclusions."""
import io
import json
import tempfile
import unittest
from email.message import Message
from pathlib import Path
from unittest.mock import patch
from urllib.request import HTTPSHandler, ProxyHandler, build_opener
from urllib.response import addinfourl

import audit


class FakeHTTPS(HTTPSHandler):
    def __init__(self, targets):
        super().__init__()
        self.targets = targets
        self.requests = []

    def https_open(self, req):
        url = req.full_url
        self.requests.append(url)
        # A network request to an unregistered target fails the test immediately.
        status, destination = self.targets[url]
        headers = Message()
        if destination:
            headers['Location'] = destination
        response = addinfourl(io.BytesIO(b'ok'), headers, url, status)
        response.msg = 'found' if destination else 'ok'
        return response


class JPXAuditNetworkTests(unittest.TestCase):
    def test_direct_jpx_hosts_do_not_reach_transport(self):
        fake = FakeHTTPS({})
        opener = build_opener(ProxyHandler({}), fake, audit.AuditRedirectHandler()).open
        for url in [
            'https://www.jpx.co.jp/markets/',
            'https://JPX.CO.JP.:443/',
            'https://release.tdnet.info/path',
            'https://api.jpx-jquants.com/path',
            'https://jquants.com/path',
            'https://jpx.github.io/path',
        ]:
            with self.subTest(url=url):
                result = audit.request(url, opener)
                self.assertEqual(result['kind'], 'inconclusive')
                self.assertIn('no request sent', result['reason'])
        self.assertFalse(fake.requests)

    def test_redirect_to_jpx_stops_before_request_and_does_not_record_target_url(self):
        start = 'https://other.example/start'
        intermediate = 'https://other.example/news'
        blocked = 'https://www.release.tdnet.info/old-report.pdf'
        fake = FakeHTTPS({start:(302,intermediate), intermediate:(302,blocked)})
        opener = build_opener(ProxyHandler({}), fake, audit.AuditRedirectHandler()).open
        result = audit.request(start, opener)
        self.assertEqual(fake.requests,[start, intermediate])
        self.assertEqual(result['kind'],'inconclusive')
        self.assertIn('target not requested',result['reason'])
        self.assertNotIn(blocked,json.dumps(result))

    def test_unrelated_external_and_edinet_redirect_are_unaffected(self):
        start = 'https://other.example/start'
        destination = 'https://disclosure2.edinet-fsa.go.jp/'
        fake = FakeHTTPS({start:(302,destination),destination:(200,None)})
        opener = build_opener(ProxyHandler({}), fake, audit.AuditRedirectHandler()).open
        self.assertEqual(audit.request(start, opener)['status'],200)
        self.assertEqual(fake.requests,[start,destination])
        self.assertFalse(audit.is_jpx_url('https://jpx.co.jp.example.org/'))
        self.assertFalse(audit.is_jpx_url('https://issuer.example/path?notes=jpx.co.jp'))

    def test_tq20_reports_count_only_and_never_schedules_direct_source(self):
        url = 'https://jpx.co.jp/example.pdf'
        safe = 'https://other.example/news'
        seen = []
        def offline_probe(target):
            seen.append(target)
            return {'url':target,'status':200,'seconds':0,'headers':{}}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root/'assets').mkdir()
            (root/'assets/pdf-catalog.json').write_text('{}')
            (root/'pdf').mkdir()
            (root/'index.html').write_text(f'<html><title>Test</title><h1>Test</h1><a href="{url}">restricted</a><a href="{safe}">issuer</a></html>')
            with patch.object(audit,'ROOT',root),patch.object(audit,'request',side_effect=offline_probe),patch.object(audit.subprocess,'check_output',return_value='fixture\n'):
                result = audit.run('daily',root/'results',live=True)
            t20 = next(row for row in result['items'] if row['id']=='TQ20')
            self.assertEqual(t20['result'],'一部完了')
            self.assertNotIn(url,seen)
            self.assertIn(safe,seen)
            self.assertNotIn(url,json.dumps(t20))
            self.assertEqual(next(x['excluded_jpx_source_count'] for x in t20['evidence'] if 'excluded_jpx_source_count' in x),1)

    def test_corporate_sources_and_ir_path_are_denied_without_requests(self):
        fake = FakeHTTPS({})
        opener = build_opener(ProxyHandler({}), fake, audit.AuditRedirectHandler()).open
        for url in [
            'https://corporate.MURATA.com./documents/01.pdf',
            'https://ssl4.eir-parts.net/doc/5333/details.pdf',
            'https://www.unknown.example/Company/%69R/earnings.pdf',
            'https://ir.unknown.example/download.pdf',
            'https://ko5yqxb8d4.execute-api.ap-northeast-1.amazonaws.com/outputs/report.pdf',
        ]:
            with self.subTest(url=url):
                self.assertIn('issuer source URL excluded',audit.request(url,opener)['reason'])
        self.assertEqual(fake.requests,[])
        self.assertFalse(audit.is_issuer_source('https://nintendo.co.jp.unrelated.example/home'))
        self.assertFalse(audit.is_issuer_source('https://different.execute-api.ap-northeast-1.amazonaws.com/report'))

    def test_redirect_halts_for_known_ir_and_markup_tagged_destination(self):
        start = 'https://other.example/start'
        for destination, tagged in [
            ('https://ssl4.eir-parts.net/doc/file.pdf',()),
            ('https://unknown.example/investor-relations/results.pdf',()),
            ('https://files.example/download/file.pdf?revision=2',
             (audit.source_key('https://files.example/download/file.pdf?revision=1'),)),
        ]:
            with self.subTest(destination=destination):
                fake=FakeHTTPS({start:(302,destination)})
                opener=build_opener(ProxyHandler({}),fake,audit.AuditRedirectHandler(tagged)).open
                result=audit.request(start,opener)
                self.assertEqual(fake.requests,[start])
                self.assertIn('issuer source redirect excluded',result['reason'])
                self.assertNotIn(destination,json.dumps(result))

    def test_tq20_issuer_markup_excludes_repeated_url_and_keeps_government_check(self):
        blocked='https://files.example/download/file.pdf'
        allowed='https://disclosure2.edinet-fsa.go.jp/'
        known='https://www.advantest.com/document/report.pdf'
        seen=[]
        def probe(target,**kwargs):
            seen.append(target)
            return {'url':target,'status':200,'seconds':0,'headers':{}}
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            (root/'assets').mkdir()
            (root/'assets/pdf-catalog.json').write_text('{}')
            (root/'pdf').mkdir()
            (root/'index.html').write_text(
                f'<html><title>Test</title><h1>Test</h1>'
                f'<a href="{blocked}?ref=0" data-todoroki-source="issuer-ir">Corporate</a>'
                f'<a href="{blocked}?ref=1">Repeated</a><a href="{known}">Cohort</a>'
                f'<a href="{allowed}">EDINET</a></html>')
            with patch.object(audit,'ROOT',root),patch.object(audit,'request',side_effect=probe),patch.object(audit.subprocess,'check_output',return_value='fixture\n'):
                result=audit.run('daily',root/'results',live=True)
            t20=next(row for row in result['items'] if row['id']=='TQ20')
            self.assertEqual(t20['result'],'一部完了')
            self.assertIn(allowed,seen)
            self.assertFalse(any(u.startswith(blocked) or u==known for u in seen))
            self.assertEqual(t20['evidence'][-1]['excluded_issuer_source_count'],3)
            self.assertEqual(t20['evidence'][-1]['kind'],'inconclusive')
