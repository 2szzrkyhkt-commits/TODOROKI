import importlib.util
import pathlib
import unittest

HERE = pathlib.Path(__file__).parent
def load(name):
    spec = importlib.util.spec_from_file_location(name, HERE / (name + ".py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod
triage = load("triage")
approval = load("approval")

class SafetyTests(unittest.TestCase):
    def test_unverified_never_runs(self):
        self.assertFalse(approval.decision({})["allowed"])
        self.assertIn("tests_passed", approval.decision({})["missing_or_unverified"])

    def test_verified_low_risk_passes(self):
        evidence = {key: True for key in approval.REQUIRED}
        evidence.update(major_spec_change=False, authentication_change=False,
                        data_deletion=False, payment_change=False)
        self.assertTrue(approval.decision(evidence)["allowed"])
        evidence["data_deletion"] = True
        self.assertFalse(approval.decision(evidence)["allowed"])

    def test_completed_excluded(self):
        self.assertEqual(triage.classify({"todo_complete": True, "title": "本番障害"})["execution"], "excluded_completed")

    def test_priority_not_authorization(self):
        result = triage.classify({"todo_complete": False, "title": "重大な本番障害"})
        self.assertEqual(result["priority"], 1)
        self.assertEqual(result["execution"], "review_required")
