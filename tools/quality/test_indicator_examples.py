"""Independent arithmetic and source-preservation checks for T04 examples."""
import hashlib
from html.parser import HTMLParser
from fractions import Fraction
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]


def section(slug):
    return re.search(r'<section id="worked-reading".*?</section>',
                     (ROOT / (slug + '.html')).read_text(), re.S).group()


class Cells(HTMLParser):
    def __init__(self, text):
        super().__init__(); self.rows = []; self.cell = None; self.feed(text)
    def handle_starttag(self, tag, attrs):
        if tag == 'tr': self.rows.append([])
        if tag in ('td', 'th'): self.cell = ''
    def handle_data(self, text):
        if self.cell is not None: self.cell += text
    def handle_endtag(self, tag):
        if tag in ('td', 'th'): self.rows[-1].append(self.cell); self.cell = None


class IndicatorExamples(unittest.TestCase):
    def test_rsi_seed_and_different_update_rules(self):
        changes = [2, -1] * 7
        prices = [100]
        for d in changes: prices.append(prices[-1] + d)
        self.assertEqual((len(prices), prices[-1]), (15, 107))
        u = Fraction(sum(max(d, 0) for d in changes), 14)
        d = Fraction(sum(max(-d, 0) for d in changes), 14)
        self.assertEqual(100*u/(u+d), Fraction(200, 3))
        rma = ((u*13+3)/14, d*13/14)
        rolling = changes[1:] + [3]
        sma = (Fraction(sum(max(d, 0) for d in rolling), 14),
               Fraction(sum(max(-d, 0) for d in rolling), 14))
        rows = Cells(section('rsi-basics')).rows[1:]
        self.assertEqual(len(rows), 2)
        for row, (gain, loss) in zip(rows, (rma, sma)):
            self.assertEqual(row[1:], [f'{float(gain):.6f}', f'{float(loss):.6f}',
                                      f'{float(100*gain/(gain+loss)):.2f}'])
        self.assertGreater(100*rma[0]/sum(rma), 70)
        self.assertLess(100*sma[0]/sum(sma), 70)

    def test_atr_gap_sequence_and_update(self):
        rows = Cells(section('atr-basics')).rows[1:]
        self.assertEqual(len(rows), 4)
        ranges = []
        previous_close = 1000
        for row in rows:
            _, previous, high, low, close, tr = [int(c.replace(',', '')) for c in row]
            self.assertEqual(previous, previous_close)
            self.assertTrue(low <= close <= high)
            self.assertEqual(tr, max(high-low, abs(high-previous), abs(low-previous)))
            ranges.append(tr); previous_close = close
        seed = Fraction(sum(ranges[:3]), 3)
        updated = (seed*2+ranges[3])/3
        text = section('atr-basics')
        for value in [seed, updated, Fraction(sum(ranges[1:]), 3), updated/1020*100]:
            self.assertIn(f'{float(value):.2f}', text)
        self.assertIn('期間n＝3', text)

    def test_vwap_cumulative_values_and_bar_approximation(self):
        rows = Cells(section('vwap-basics')).rows[1:]
        total, volume, prices = 0, 0, []
        self.assertEqual(len(rows), 3)
        for row in rows:
            _, price, quantity, displayed_total, displayed_volume, vwap = [int(c.replace(',', '')) for c in row]
            total += price*quantity; volume += quantity; prices.append(price)
            self.assertEqual((displayed_total, displayed_volume, vwap), (total, volume, total//volume))
            self.assertEqual(total % volume, 0)
        self.assertEqual((total, volume), (505000, 500))
        self.assertEqual((max(prices)+min(prices)+prices[-1])/3, 1000)
        self.assertEqual(total/volume, 1010)
        self.assertIn(f'{(total+1030*100)/(volume+100):,.2f}', section('vwap-basics'))
        self.assertIn('累計数量そのものが0', section('vwap-basics'))

    def test_sources_scope_and_cross_article_links(self):
        for slug in ['rsi-basics', 'atr-basics', 'vwap-basics']:
            s = section(slug)
            self.assertIn('2026年11月17日', s)
            self.assertIn('仮', s)
            self.assertIn('https://www.tradingview.com/', s)
            self.assertEqual(s.count('tabindex="0"'), 1)
            self.assertEqual(s.count('<caption>'), 1)
            for other in ['rsi-basics', 'atr-basics', 'vwap-basics']:
                if other != slug: self.assertIn(f'/{other}#worked-reading', s)

    def test_original_bytes_are_preserved(self):
        originals = ORIGINAL_BLOBS
        for slug, expected in originals.items():
            text = (ROOT/(slug+'.html')).read_text()
            text = re.sub(r'<section id="worked-reading".*?</section>', '', text, flags=re.S)
            text = re.sub(r'<style id="indicator-worked-style">.*?</style>', '', text, flags=re.S)
            raw = text.encode()
            self.assertEqual(hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest(), expected)


ORIGINAL_BLOBS = {'rsi-basics': '58d10c58873d49e260ec07c263f7261555ad7772',
                  'atr-basics': 'd9556c87f7bb211640250591e0c0d49c0864641f',
                  'vwap-basics': 'fcab45ff2cceb430b239cfa77506d63ce1146736'}
