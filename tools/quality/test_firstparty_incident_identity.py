"""Sustained first-party availability incidents must not reopen on a wobbling 5xx."""
from pathlib import Path
import json
import tempfile
import unittest
from unittest.mock import patch

import audit
from notification_policy import issue_message


class FirstPartyIncidentIdentityTests(unittest.TestCase):
    def observe(self, root, status=200, attempts=None, previous=None, other=None):
        def get(url):
            code=status if url==audit.BASE else other if url==audit.BASE+'boki1' and other is not None else 200
            result={'url':url,'status':code,'headers':{},'seconds':0}
            if code!=200:
                result['kind']='inconclusive' if code==403 else 'http_failure'
                result['attempts']=attempts or [{'status':code}]
            return result
        with patch.object(audit,'request',side_effect=get):
            return audit.run('hourly',root,previous,live=True)

    def test_live_5xx_wobble_is_one_incident_but_refreshed_evidence_and_real_recurrence_remain(self):
        with tempfile.TemporaryDirectory() as tmp:
            previous=str(Path(tmp)/'latest.json')
            first=self.observe(tmp,503,[{'status':502},{'status':503}])
            ident=next(k for k,v in first['notification_candidates'].items() if v['id']=='TQ01')
            self.assertRegex(ident,'^[a-f0-9]{24}$')
            title=issue_message(ident,first['notification_candidates'][ident],'fixture/repo','11')
            self.assertNotIn(audit.BASE,' '.join(title),'do not send raw URL to issue')
            wobble=self.observe(tmp,502,[{'status':502}],previous)
            self.assertIn(ident,wobble['findings'])
            self.assertEqual(wobble['findings'][ident]['detail']['status'],502)
            self.assertNotIn(ident,wobble['notification_candidates'])
            self.assertNotIn(ident,wobble['resolved'])
            unknown=self.observe(tmp,403,previous=previous)
            self.assertIn(ident,unknown['unverified_findings'])
            self.assertFalse(unknown['resolved'])
            unproven=self.observe(tmp,500,previous=previous)
            self.assertIn(ident,unproven['findings'])
            self.assertNotIn(ident,unproven['notification_candidates'])
            recovered=self.observe(tmp,200,previous=previous)
            self.assertIn(ident,recovered['resolved'])
            again=self.observe(tmp,503,previous=previous)
            self.assertIn(ident,again['notification_candidates'])

    def test_legacy_ledger_keeps_existing_incident_identity_across_same_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            previous=Path(tmp)/'latest.json'
            first=self.observe(tmp,503,[{'status':502},{'status':503}])
            old={'findings':{},'unverified_findings':{}}
            for finding in first['findings'].values():
                if finding['id'] not in ('TQ01','TQ03'):
                    continue
                old['findings'][audit.fingerprint([finding['id'],finding['detail']])]=finding
                # Simulate an older format where a second transient envelope was unverified.
                detail={**finding['detail'],'status':504,'attempts':[{'status':504}]}
                old['unverified_findings'][audit.fingerprint([finding['id'],detail])]={**finding,'detail':detail}
            first.update(old)
            previous.write_text(json.dumps(first))
            current=self.observe(tmp,500,[{'status':500}],str(previous))
            self.assertTrue(any(v['id']=='TQ01' for v in current['findings'].values()))
            self.assertFalse(current['notification_candidates'])
            self.assertFalse(current['unverified_findings'])
            self.assertFalse(current['resolved'])

    def test_identity_remains_scoped_by_criterion_url_http_family_and_first_party_host(self):
        with tempfile.TemporaryDirectory() as tmp:
            first=self.observe(tmp,503,other=503)
            t03={k:v for k,v in first['findings'].items() if v['id']=='TQ03'}
            self.assertEqual({x['detail']['url'] for x in t03.values()},{audit.BASE,audit.BASE+'boki1'})
            self.assertEqual(len(t03),2)
            first_id=next(k for k,v in first['findings'].items() if v['id']=='TQ01')
            self.assertNotIn(first_id,t03)
        identity=audit.finding_fingerprint
        fault={'kind':'http_failure','status':502,'url':audit.BASE}
        for changed in (
          {'url':'https://fixture.invalid/'},{'url':'https://todoroki-gold.com@fixture.invalid/'},
          {'url':'http://todoroki-gold.com/'},{'url':'https://user@todoroki-gold.com/'},
          {'url':'https://todoroki-gold.com:8080/'},{'url':audit.BASE+'boki1'}, {'status':404},
          {'kind':'inconclusive'},{'status':'503'}
        ):
            with self.subTest(changed=changed):
                self.assertNotEqual(identity('TQ01',fault),identity('TQ01',{**fault,**changed}))
        # External references and non-allowlisted criteria keep existing fingerprint logic.
        for criterion,other in [('TQ20',fault),('TQ01',{**fault,'url':'https://fixture.invalid/'})]:
            self.assertEqual(identity(criterion,other),audit.fingerprint([criterion,other]))
