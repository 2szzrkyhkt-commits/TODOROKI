"""T04 momentum tables: exact arithmetic, undefined values and byte retention."""
from fractions import Fraction as F
from pathlib import Path
import hashlib
import re
import unittest
from test_indicator_examples import Cells

ROOT = Path(__file__).resolve().parents[2]


def section(slug):
    return re.search(r'<section id="worked-reading".*?</section>',
                     (ROOT/(slug+'.html')).read_text(), re.S).group()


class MomentumExamples(unittest.TestCase):
    def test_macd_recurrence_and_price_counterexample(self):
        rows = Cells(section('macd-basics')).rows[1:]
        fast = slow = F(100); signal = F(0); histograms = []
        self.assertEqual(len(rows), 2)
        for row, price in zip(rows, [110,109]):
            fast = F(11,13)*fast + F(2,13)*price
            slow = F(25,27)*slow + F(2,27)*price
            macd = fast - slow
            signal = F(4,5)*signal + F(1,5)*macd
            histogram = macd - signal; histograms.append(histogram)
            self.assertEqual(row, [str(price)] + [f'{float(x):.5f}' for x in [fast,slow,macd,signal,histogram]])
        self.assertGreater(histograms[1], histograms[0])

    def test_stochastic_warmup_and_double_smoothing(self):
        rows = Cells(section('stochastic-basics')).rows[1:]
        closes = [100,100,92,106,110,94,100]
        self.assertEqual(len(rows), 7)
        raw = [None,None] + [F(c-90,20)*100 for c in closes[2:]]
        def sma(values):
            return [None if i<2 or any(v is None for v in values[i-2:i+1])
                    else sum(values[i-2:i+1])/3 for i in range(len(values))]
        fast_d = sma(raw); slow_d = sma(fast_d)
        for i,row in enumerate(rows):
            fmt = lambda value: '—' if value is None else f'{float(value):.2f}'
            self.assertEqual(row,[str(i+1),str(closes[i]),fmt(raw[i]),fmt(fast_d[i]),fmt(slow_d[i])])
        self.assertEqual(slow_d[-1],F(560,9))
        self.assertIn('追加平滑化1は平滑化なし', section('stochastic-basics'))

    def test_adx_direction_symmetry_and_zero_denominator(self):
        rows = Cells(section('dmi-adx-basics')).rows[1:]
        self.assertEqual(len(rows),4)
        for row in rows:
            plus,minus = map(int,row[1:3])
            if plus+minus == 0:
                self.assertEqual(row[3:],['未定義','表示仕様を確認']);continue
            dx = F(abs(plus-minus),plus+minus)*100
            adx = (20*13+dx)/14
            self.assertEqual(row[3:],[f'{float(dx):.2f}',f'{float(adx):.2f}'])
        self.assertEqual(rows[0][3:],rows[1][3:])
        self.assertIn('各行は独立した別の条件',section('dmi-adx-basics'))

    def test_scope_sources_and_navigation(self):
        for slug in ['macd-basics','stochastic-basics','dmi-adx-basics']:
            s=section(slug)
            for term in ['2026年11月17日','仮','https://www.tradingview.com/']:
                self.assertIn(term,s)
            self.assertEqual(s.count('<caption>'),1)
            for other in ['macd-basics','stochastic-basics','dmi-adx-basics']:
                if other!=slug:self.assertIn(f'/{other}#worked-reading',s)

    def test_original_bytes_remain_unchanged(self):
        hashes={'macd-basics':'04f6feea5c6bf80484865f831d03d8fbd8ca3b16',
                'stochastic-basics':'49c74e357692fbcc04579c8bb223654a17781502',
                'dmi-adx-basics':'d076b260410c441bde88473e715f7f641d14bc29'}
        for slug,expected in hashes.items():
            s=(ROOT/(slug+'.html')).read_text()
            s=re.sub(r'<section id="worked-reading".*?</section>','',s,flags=re.S)
            s=re.sub(r'<style id="indicator-worked-style">.*?</style>','',s,flags=re.S)
            b=s.encode();self.assertEqual(hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest(),expected)
