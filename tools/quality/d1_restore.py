"""Verify a bounded read-only D1 snapshot in an isolated, in-memory SQLite DB.

Never connects to Cloudflare. Never writes a restored database to production.
The caller must supply the independently retained SHA256 of the snapshot bytes.
Only aggregate evidence is returned; row contents are not logged.
"""
import argparse
import hashlib
import json
import re
import sqlite3
from pathlib import Path

FORMAT = 'todoroki-d1-read-snapshot-v1'
MAX_BYTES = 8 * 1024 * 1024
MAX_ROWS = 5000
IDENT = re.compile(r'^[A-Za-z][A-Za-z0-9_]*$')


def digest(value):
    return hashlib.sha256(value).hexdigest()


def canonical_rows(rows):
    # Sort the serialized rows, retaining duplicate rows and JSON value types.
    return '\n'.join(sorted(json.dumps(row, sort_keys=True, ensure_ascii=False,
                                     separators=(',', ':'), allow_nan=False)
                            for row in rows)).encode('utf-8')


def verify(raw, expected_sha256):
    if len(raw) > MAX_BYTES or not re.fullmatch('[0-9a-f]{64}', expected_sha256):
        raise ValueError('invalid snapshot size or expected digest')
    if digest(raw) != expected_sha256:
        raise ValueError('snapshot digest mismatch')
    obj = json.loads(raw)
    if obj.get('format') != FORMAT:
        raise ValueError('unsupported snapshot format')
    before, after = obj.get('bookmark_before'), obj.get('bookmark_after')
    if not before or before != after:
        raise ValueError('source changed during capture or bookmark missing')
    schema, tables, meta = obj['schema'], obj['tables'], obj['read_meta']
    if not tables or len(tables) > 100 or len(meta) != len(tables):
        raise ValueError('invalid table inventory')
    if any(m.get('success') is not True or m.get('rows_written') != 0
           or m.get('changed_db') is not False for m in meta):
        raise ValueError('capture was not verified read-only')
    names = [table['name'] for table in tables]
    if len(set(names)) != len(names) or any(not IDENT.fullmatch(n) for n in names):
        raise ValueError('invalid or duplicate table name')
    schema_names = [s['name'] for s in schema if s['type'] == 'table']
    if sorted(schema_names) != sorted(names):
        raise ValueError('schema and data inventory differ')
    if any(s['type'] not in ('table', 'index') or not s['sql']
           or s['tbl_name'] not in names for s in schema):
        raise ValueError('unsupported schema object')
    # A dump is data, never trusted executable code. No triggers, views,
    # virtual tables, attachments, file functions or multi-statement scripts.
    for s in schema:
        pattern = (r'^CREATE TABLE\s' if s['type'] == 'table'
                   else r'^CREATE (?:UNIQUE )?INDEX\s')
        if not re.match(pattern, s['sql'], re.I):
            raise ValueError('unsupported schema statement')
    with sqlite3.connect(':memory:') as conn:
        conn.enable_load_extension(False)
        conn.setlimit(sqlite3.SQLITE_LIMIT_LENGTH, MAX_BYTES)
        conn.setlimit(sqlite3.SQLITE_LIMIT_SQL_LENGTH, 128 * 1024)
        denied = {sqlite3.SQLITE_ATTACH, sqlite3.SQLITE_DETACH,
                  sqlite3.SQLITE_CREATE_VTABLE, sqlite3.SQLITE_CREATE_TRIGGER,
                  sqlite3.SQLITE_CREATE_VIEW}

        def authorize(action, arg1, arg2, database, trigger):
            if action in denied or (action == sqlite3.SQLITE_FUNCTION and
                                    (arg2 or '').lower() in
                                    ('load_extension', 'readfile', 'writefile')):
                return sqlite3.SQLITE_DENY
            return sqlite3.SQLITE_OK

        conn.set_authorizer(authorize)
        for s in sorted(schema, key=lambda s: s['type'] != 'table'):
            conn.execute(s['sql'])
        evidence = []
        for table in tables:
            name, rows = table['name'], table['rows']
            if len(rows) > MAX_ROWS:
                raise ValueError('capture may be truncated: row limit exceeded')
            columns = [r[1] for r in conn.execute(f'PRAGMA table_info("{name}")')]
            if any(not IDENT.fullmatch(c) for c in columns):
                raise ValueError('unsupported column identifier')
            for row in rows:
                if set(row) != set(columns):
                    raise ValueError('row columns differ from schema')
                values = [row[c] for c in columns]
                if any(type(v) not in (str, int, float, type(None)) for v in values):
                    raise ValueError('unsupported SQLite value type')
                quoted = ','.join('"' + c + '"' for c in columns)
                placeholders = ','.join('?' for _ in columns)
                conn.execute(f'INSERT INTO "{name}" ({quoted}) VALUES ({placeholders})', values)
            conn.row_factory = sqlite3.Row
            restored = [dict(row) for row in conn.execute(f'SELECT * FROM "{name}"')]
            conn.row_factory = None
            source_hash = digest(canonical_rows(rows))
            if source_hash != digest(canonical_rows(restored)):
                raise ValueError('restored row content differs')
            evidence.append({'table': name, 'rows': len(rows), 'sha256': source_hash})
        restored_schema = conn.execute("SELECT type,name,tbl_name,sql FROM sqlite_schema "
                                       "WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").fetchall()
        expected_schema = sorted((s['type'], s['name'], s['tbl_name'], s['sql']) for s in schema)
        if sorted(restored_schema) != expected_schema:
            raise ValueError('restored schema differs')
        if conn.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
            raise ValueError('SQLite integrity check failed')
        if conn.execute('PRAGMA foreign_key_check').fetchall():
            raise ValueError('foreign key integrity check failed')
    return {'scope': obj.get('database'), 'captured_at': obj.get('captured_at'),
            'snapshot_sha256': expected_sha256, 'stable_bookmark': True,
            'restored_tables': len(tables), 'restored_rows': sum(t['rows'] for t in evidence),
            'tables': evidence, 'schema_matches': True, 'integrity_check': 'ok',
            'foreign_key_violations': 0, 'production_writes': 0,
            'restore_target': 'isolated in-memory SQLite; not Cloudflare D1',
            'limitations': ['one database only', 'no R2/KV backup',
                            'not a recurring backup or cloud D1 import test']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('snapshot', type=Path)
    parser.add_argument('--sha256', required=True)
    args = parser.parse_args()
    # Errors omit database contents and SQLite exception text.
    try:
        result = verify(args.snapshot.read_bytes(), args.sha256)
    except (ValueError, KeyError, TypeError, sqlite3.Error):
        raise SystemExit('Snapshot verification failed; no production changes performed.')
    print(json.dumps(result, ensure_ascii=False, indent=2))
