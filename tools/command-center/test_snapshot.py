import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location("snapshot", pathlib.Path(__file__).with_name("snapshot.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class SnapshotTests(unittest.TestCase):
    def test_counts_and_independent_verification(self):
        data = module.build("- [x] Done <!-- todo:T01 project:Main -->\n- [ ] Open <!-- todo:T02 project:Lab -->")
        self.assertEqual(data["counts"], {"total": 2, "completed": 1, "open": 1})
        self.assertEqual(data["tasks"][0]["production"], "unverified")
        self.assertEqual(data["tasks"][1]["tests"], "unverified")

    def test_duplicate_rejected(self):
        with self.assertRaises(ValueError):
            module.build("- [ ] One <!-- todo:T01 project:A -->\n- [ ] Two <!-- todo:T01 project:A -->")

    def test_empty_rejected(self):
        with self.assertRaises(ValueError):
            module.build("No tasks")
