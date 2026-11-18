import re
import sqlite3
from pathlib import Path
import unittest

class JgrantsScheduleSQL(unittest.TestCase):
    def test_due_sql_never_replaces_unpersisted_or_leased_snapshots(self):
        source=(Path(__file__).resolve().parents[1]/'japan-support/jgrants.js').read_text()
        query=re.search(r"prepare\('(SELECT \* FROM jgrants_jobs WHERE next_attempt[^']+)'\)",source).group(1)
        db=sqlite3.connect(':memory:')
        db.execute('CREATE TABLE jgrants_jobs(keyword TEXT,payload TEXT,cursor INTEGER,item_count INTEGER,next_attempt TEXT,lease_until TEXT)')
        now='2026-11-18T05:00:00Z'
        db.executemany('INSERT INTO jgrants_jobs VALUES(?,?,?,?,?,?)',[
            ('unfinished','[]',875,922,'2026-11-17T01:00:00Z',None),
            ('leased',None,0,0,'2026-11-17T02:00:00Z','2026-11-19T01:00:00Z'),
            ('future',None,0,0,'2026-11-19T01:00:00Z',None),
            ('unfetched',None,0,0,'2026-11-18T02:00:00Z',None),
            ('complete','[]',10,10,'2026-11-18T03:00:00Z',None),
        ])
        self.assertEqual(db.execute(query,(now,now)).fetchone()[0],'unfetched')
        db.execute("UPDATE jgrants_jobs SET next_attempt='2026-11-19T05:00:00Z' WHERE keyword='unfetched'")
        self.assertEqual(db.execute(query,(now,now)).fetchone()[0],'complete')
        db.execute("UPDATE jgrants_jobs SET next_attempt='2026-11-19T05:00:00Z' WHERE keyword='complete'")
        self.assertIsNone(db.execute(query,(now,now)).fetchone())
        self.assertEqual(db.execute("SELECT cursor,item_count,payload FROM jgrants_jobs WHERE keyword='unfinished'").fetchone(),(875,922,'[]'))
        db.close()

    def test_checkpoint_sql_rejects_stale_cursor_or_snapshot_and_replays(self):
        source=(Path(__file__).resolve().parents[1]/'japan-support/jgrants.js').read_text()
        query=re.search(r"prepare\('(UPDATE jgrants_jobs SET cursor=[^']+)'\)",source).group(1)
        db=sqlite3.connect(':memory:')
        db.execute('CREATE TABLE jgrants_jobs(keyword TEXT PRIMARY KEY,cursor INTEGER,checked_at TEXT,lease_until TEXT,payload TEXT)')
        stamp='2026-11-18T05:35:12.507Z'
        db.execute('INSERT INTO jgrants_jobs VALUES(?,?,?,?,?)',('支援',250,stamp,'leased','retained raw snapshot'))
        for args in [(275,'支援',225,stamp),(275,'支援',250,'older snapshot')]:
            self.assertEqual(db.execute(query,args).rowcount,0)
        self.assertEqual(db.execute('SELECT cursor,lease_until,payload FROM jgrants_jobs').fetchone(),(250,'leased','retained raw snapshot'))
        self.assertEqual(db.execute(query,(275,'支援',250,stamp)).rowcount,1)
        self.assertEqual(db.execute(query,(275,'支援',250,stamp)).rowcount,0)
        self.assertEqual(db.execute('SELECT cursor,lease_until,payload FROM jgrants_jobs').fetchone(),(275,None,'retained raw snapshot'))
        db.close()
