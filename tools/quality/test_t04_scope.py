import copy
import json
from pathlib import Path
import unittest
from t04_scope import prepare, signature, compare


class ScopeChecks(unittest.TestCase):
    def test_agreed_source_inventory(self):
        inventory,targets=prepare()
        self.assertEqual(inventory['page_count'],195)
        self.assertEqual(len(targets),33)
        self.assertEqual(inventory['article_meta_without_body_targets'],[])

    def test_duplicate_and_out_of_scope_paths_fail(self):
        root=Path(__file__).resolve().parents[2]
        manifest=json.loads((root/'docs/t04-completion-scope.json').read_text())
        for value in ['/rsi-basics','/login','https://other.example']:
            changed=copy.deepcopy(manifest);changed['groups']['extra']=[value]
            with self.assertRaises(ValueError):prepare(root,changed)

    def test_live_errors_and_differences_never_pass(self):
        html='<link rel="canonical" href="https://todoroki-gold.com/example"><main><p>Verified article</p></main>'
        expected=signature(html)
        response={'status':200,'url':'https://todoroki-gold.com/example','content_type':'text/html','html':html}
        self.assertEqual(compare('/example',expected,response)['state'],'passed')
        for mutation in [{'status':403},{'error':'network_error'},
                         {'content_type':'application/json'},
                         {'url':'https://other.example/'},
                         {'html':html.replace('Verified article','Changed article')}]:
            self.assertNotEqual(compare('/example',expected,{**response,**mutation})['state'],'passed')
