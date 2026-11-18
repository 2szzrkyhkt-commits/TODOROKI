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
