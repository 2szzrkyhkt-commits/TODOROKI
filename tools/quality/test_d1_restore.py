import copy
import importlib.util
import json
from pathlib import Path
import sqlite3
import unittest

spec = importlib.util.spec_from_file_location('d1_restore', Path(__file__).with_name('d1_restore.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class RestoreTests(unittest.TestCase):
    def fixture(self):
        return {'format': m.FORMAT, 'database': 'synthetic-only',
                'bookmark_before': 'same', 'bookmark_after': 'same',
                'schema': [dict(type='table', name='parent', tbl_name='parent',
                                sql='CREATE TABLE parent(id TEXT PRIMARY KEY, value TEXT)'),
                           dict(type='table', name='child', tbl_name='child',
                                sql='CREATE TABLE child(id TEXT PRIMARY KEY, parent_id TEXT REFERENCES parent(id))'),
                           dict(type='index', name='child_parent', tbl_name='child',
                                sql='CREATE INDEX child_parent ON child(parent_id)')],
                'tables': [dict(name='parent', rows=[dict(id='a', value="改行\n引用'\"; DROP TABLE parent; --")]),
                           dict(name='child', rows=[dict(id='b', parent_id='a')])],
                'read_meta': [dict(success=True, rows_written=0, changed_db=False)] * 2}

    def verify(self, obj):
        raw = json.dumps(obj, ensure_ascii=False).encode()
        return m.verify(raw, m.digest(raw))

    def test_exact_restore_including_sql_like_text(self):
        result = self.verify(self.fixture())
        self.assertEqual(result['restored_rows'], 2)
        self.assertEqual(result['integrity_check'], 'ok')
        self.assertNotIn('改行', json.dumps(result, ensure_ascii=False))

    def test_digest_mismatch(self):
        with self.assertRaises(ValueError):
            m.verify(b'{}', '0' * 64)

    def test_changed_bookmark(self):
        obj = self.fixture(); obj['bookmark_after'] = 'new'
        with self.assertRaises(ValueError): self.verify(obj)

    def test_missing_or_duplicate_tables(self):
        for mutation in ('missing', 'duplicate'):
            obj = self.fixture()
            if mutation == 'missing': obj['tables'].pop(); obj['read_meta'].pop()
            else: obj['tables'][1]['name'] = 'parent'
            with self.assertRaises(ValueError): self.verify(obj)

    def test_read_writes_or_missing_metadata(self):
        for field, value in [('rows_written', 1), ('changed_db', True), ('success', False)]:
            obj = copy.deepcopy(self.fixture()); obj['read_meta'][0][field] = value
            with self.assertRaises(ValueError): self.verify(obj)

    def test_orphan_rejected(self):
        obj = self.fixture(); obj['tables'][1]['rows'][0]['parent_id'] = 'absent'
        with self.assertRaises(ValueError): self.verify(obj)

    def test_row_limit_and_missing_columns(self):
        obj = self.fixture(); obj['tables'][0]['rows'] *= 5001
        with self.assertRaises(ValueError): self.verify(obj)
        obj = self.fixture(); del obj['tables'][0]['rows'][0]['value']
        with self.assertRaises(ValueError): self.verify(obj)

    def test_executable_schema_rejected(self):
        for sql in ["ATTACH DATABASE '/tmp/should-not-exist' AS other",
                    'CREATE VIRTUAL TABLE parent USING fts5(value)',
                    'CREATE TABLE parent(id TEXT); DROP TABLE parent']:
            obj = self.fixture(); obj['schema'][0]['sql'] = sql
            with self.assertRaises((ValueError, sqlite3.Error)): self.verify(obj)
