import sqlite3
import unittest
from pathlib import Path

class NationalIndexRegistration(unittest.TestCase):
    def test_registration_is_additive_and_does_not_reset_existing_state(self):
        db=sqlite3.connect(':memory:')
        db.execute('CREATE TABLE sources(id TEXT PRIMARY KEY,agency,url TEXT UNIQUE,terms_url,commercial,reproduction,modification,automated_access,third_party,api_format,attribution,reviewed_at,enabled,interval_seconds,next_attempt)')
        db.execute("INSERT INTO sources(id,agency,url,next_attempt,enabled) VALUES('existing','retained','https://example.test/','future',0)")
        sql=(Path(__file__).resolve().parents[1]/'japan-support/national-source-registration.sql').read_text()
        db.executescript(sql)
        self.assertEqual(db.execute('SELECT COUNT(*) FROM sources').fetchone()[0],2)
        self.assertEqual(db.execute("SELECT interval_seconds,enabled,automated_access,third_party FROM sources WHERE id='mhlw-livelihood-index'").fetchone(),(86400,1,'approved','excluded'))
        db.execute("UPDATE sources SET next_attempt='do not reset',enabled=0 WHERE id='mhlw-livelihood-index'")
        db.executescript(sql)
        self.assertEqual(db.execute("SELECT next_attempt,enabled FROM sources WHERE id='mhlw-livelihood-index'").fetchone(),('do not reset',0))
        self.assertEqual(db.execute("SELECT agency,next_attempt,enabled FROM sources WHERE id='existing'").fetchone(),('retained','future',0))
        db.close()
