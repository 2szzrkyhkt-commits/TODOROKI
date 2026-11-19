"""Independent rolling extrema, time alignment and original-byte verification."""
from fractions import Fraction
import hashlib
from pathlib import Path
import re
import unittest
from test_indicator_examples import Cells

ROOT = Path(__file__).resolve().parents[2]


class DonchianExamples(unittest.TestCase):
    def setUp(self):
        self.html=(ROOT/'donchian-channels.html').read_text()
        self.section=re.search(r'<section id="worked-reading".*?</section>',self.html,re.S).group()
        self.tables=re.findall(r'<table>.*?</table>',self.section,re.S)

    def test_all_rolling_extrema_from_input_bars(self):
        self.assertEqual(len(self.tables),2)
        inputs=[[int(c.replace(',','')) for c in row] for row in Cells(self.tables[0]).rows[1:]]
        self.assertEqual([r[0] for r in inputs],[1,2,3,4,5])
        self.assertTrue(all(low<=close<=high for _,high,low,close in inputs))
        output=Cells(self.tables[1]).rows[1:]
        self.assertEqual(len(output),3)
        for i,row in enumerate(output):
            bars=inputs[i:i+3];upper=max(r[1] for r in bars);lower=min(r[2] for r in bars)
            self.assertEqual(row,[f'{i+1}〜{i+3}']+[f'{v:,}' for v in [upper,lower,(upper+lower)//2,upper-lower]])
        self.assertEqual([row[-1] for row in output],['200','190','180'])
        self.assertNotEqual(Fraction(sum(r[3] for r in inputs[:3]),3),1100)

    def test_prior_window_breakout_and_current_window_are_distinct(self):
        rows=[[int(c.replace(',','')) for c in row] for row in Cells(self.tables[0]).rows[1:]]
        previous_upper=max(r[1] for r in rows[:3])
        current_upper=max(r[1] for r in rows[1:4])
        self.assertTrue(previous_upper<rows[3][3]<current_upper)
        self.assertGreater(current_upper,previous_upper)
        previous_width=previous_upper-min(r[2] for r in rows[:3])
        current_width=current_upper-min(r[2] for r in rows[1:4])
        self.assertLess(current_width,previous_width)
        for term in ['期間n＝3本','仮想','2026年11月17日','終値比較はTODOROKIの説明例',
                     '43000502253','43000599828','/envelope-basics','/pivot-points']:
            self.assertIn(term,self.section)

    def test_original_source_and_advertising_are_unchanged(self):
        text=re.sub(r'<section id="worked-reading".*?</section>','',self.html,flags=re.S)
        text=re.sub(r'<style id="indicator-worked-style">.*?</style>','',text,flags=re.S)
        raw=text.encode()
        self.assertEqual(hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest(),
                         'a13fe92000cc45075596661cb460feda6c054f31')
