import contextlib
import io
import json
import os
from pathlib import Path
import runpy
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from notification_policy import eligible, issue_message

KEY='b'*24


class NotificationPolicyTests(unittest.TestCase):
    def invoke(self, candidates, issues=None, fail=False):
        script=Path(__file__).with_name('notify.py').resolve()
        cwd=Path.cwd()
        output=io.StringIO()
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'quality-results';p.mkdir()
            (p/'latest.json').write_text(json.dumps({'notification_candidates':candidates}))
            try:
                os.chdir(d)
                with patch.dict(os.environ,{'GITHUB_REPOSITORY':'fixture/repo','GITHUB_RUN_ID':'123'}), \
                     patch('subprocess.check_output',return_value=json.dumps(issues or [])) as read, \
                     patch('subprocess.run',side_effect=subprocess.CalledProcessError(1,'gh') if fail else None) as send, \
                     contextlib.redirect_stdout(output):
                    runpy.run_path(str(script),run_name='__main__')
                    return read.call_count,send.call_args_list,output.getvalue()
            finally:
                os.chdir(cwd)

    def test_external_502_legacy_candidate_does_not_dispatch(self):
        read,sent,_=self.invoke({KEY:{'id':'TQ20','detail':{'url':'https://fixture.invalid/','status':502}}})
        self.assertEqual(read,0);self.assertEqual(sent,[])

    def test_own_outage_dispatches_once_without_copying_details(self):
        secret='fixture-sensitive-value'
        read,sent,output=self.invoke({KEY:{'id':'TQ01','detail':{'url':'https://user:'+secret+'@fixture.invalid/?key='+secret,'body':secret,'error':secret}}})
        self.assertEqual(len(sent),1);self.assertEqual(read,1)
        args=sent[0].args[0];body=sent[0].kwargs['input']
        self.assertIn('TQ01',body);self.assertIn('/actions/runs/123',body)
        self.assertNotIn(secret,body+output+str(args));self.assertNotIn('fixture.invalid',body)
        self.assertTrue(sent[0].kwargs['check']);self.assertEqual(args[-2:],['--body-file','-'])

    def test_existing_open_incident_deduplicates_after_detail_policy_change(self):
        _,sent,_=self.invoke({KEY:{'id':'TQ01','detail':'new detail'}},[{'body':'<!-- todoroki-quality:'+KEY+' -->\nold detail'}])
        self.assertEqual(sent,[])

    def test_unknown_and_malformed_ids_do_not_dispatch(self):
        for value in ({'id':'TQ99'},{'id':['TQ01']},{},None):
            with self.subTest(value=value):
                self.assertFalse(eligible(value));self.assertEqual(self.invoke({KEY:value})[1],[])

    def test_untrusted_context_is_rejected_before_network(self):
        for key,repo,run in [('secret-value','fixture/repo','123'),(KEY,'fixture/repo?token=fixture','123'),(KEY,'fixture/repo','fixture-token')]:
            with self.subTest(key=key,repo=repo,run=run),self.assertRaises(ValueError):
                issue_message(key,{'id':'TQ01'},repo,run)

    def test_delivery_failure_is_not_reported_as_success(self):
        with self.assertRaises(subprocess.CalledProcessError):
            self.invoke({KEY:{'id':'TQ01'}},fail=True)

    def test_external_failure_remains_a_failed_ledger_finding(self):
        from audit import run
        with tempfile.TemporaryDirectory() as d:
            prior=run('hourly',d,live=False)
            external=prior['items'][19]
            external['errors']=[{'url':'https://fixture.invalid/reference','status':502,'kind':'http_failure'}]
            external['result']='未完了';prior['findings']={}
            path=Path(d)/'prior.json';path.write_text(json.dumps(prior))
            current=run('hourly',d,str(path),live=False)
            self.assertTrue(current['items'][19]['errors'])
            self.assertEqual(current['items'][19]['classification'],'未完了')
            self.assertTrue(any(v['id']=='TQ20' for v in current['findings'].values()))
            self.assertTrue(any(v['id']=='TQ20' for v in current['new_findings'].values()))
            self.assertFalse(any(v['id']=='TQ20' for v in current['notification_candidates'].values()))

class ResolutionTests(unittest.TestCase):
    def test_inconclusive_and_unexecuted_checks_preserve_unverified_incidents(self):
        from audit import resolution_state
        prior={'findings':{KEY:{'id':'TQ01','detail':{'status':503}}}}
        for row in ({'result':'未確認','last_run':'now','errors':[],'evidence':[{'kind':'inconclusive'}]},
                    {'result':'一部完了','last_run':'now','errors':[],'evidence':[{'inconclusive':'fixture'}]},
                    {'result':'完了','last_run':'yesterday','errors':[],'evidence':[{'status':200}]},
                    {'result':'未完了','last_run':'now','errors':[],'evidence':[{'status':200}]}):
            with self.subTest(row=row):
                _,resolved,unknown=resolution_state(prior,{}, {'TQ01':row},'now')
                self.assertEqual(resolved,[]);self.assertIn(KEY,unknown)

    def test_pending_incident_is_not_new_again_when_the_failure_is_reconfirmed(self):
        from audit import resolution_state
        finding={'id':'TQ01','detail':{'status':503}}
        old,resolved,unknown=resolution_state({'unverified_findings':{KEY:finding}},{KEY:finding},{},'now')
        self.assertIn(KEY,old);self.assertEqual(resolved,[]);self.assertEqual(unknown,{})

    def test_live_failure_unknown_unknown_recovery_and_stable_health(self):
        import audit
        def response(status):
            def fetch(url):
                r={'url':url,'final_url':url,'status':status if url==audit.BASE else 200,'headers':{},'seconds':0}
                if url==audit.BASE and status!=200:r['kind']='inconclusive' if status==403 else 'http_failure'
                return r
            return fetch
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'latest.json'
            with patch.object(audit,'request',side_effect=response(503)):
                failure=audit.run('hourly',d,live=True)
            key=next(k for k,v in failure['findings'].items() if v['id']=='TQ01')
            for _ in range(2):
                with patch.object(audit,'request',side_effect=response(403)):
                    unknown=audit.run('hourly',d,str(path),live=True)
                self.assertNotIn(key,unknown['resolved']);self.assertIn(key,unknown['unverified_findings'])
                self.assertFalse(unknown['new_findings'])
            with patch.object(audit,'request',side_effect=response(200)):
                recovered=audit.run('hourly',d,str(path),live=True)
            self.assertIn(key,recovered['resolved']);self.assertEqual(recovered['unverified_findings'],{})
            with patch.object(audit,'request',side_effect=response(200)):
                stable=audit.run('hourly',d,str(path),live=True)
            self.assertEqual(stable['resolved'],[]);self.assertEqual(stable['notification_candidates'],{})
