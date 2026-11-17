"""Incident eligibility and detail-free public issue formatting."""
import re

# External reference failures stay in the ledger for routine review; they do not
# by themselves establish an outage of a TODOROKI service.
IMPORTANT_IDS = frozenset(('TQ01','TQ02','TQ03','TQ06','TQ10','TQ18',
 'TQ26','TQ28','TQ29','TQ30','TQ31','TQ32','TQ33','TQ34','TQ35','TQ36',
 'TQ37','TQ38','TQ39','TQ53','TQ54','TQ55','TQ57','TQ59'))


def eligible(value):
    return isinstance(value, dict) and isinstance(value.get('id'), str) and value['id'] in IMPORTANT_IDS


def issue_message(key, value, repo, run_id):
    if not re.fullmatch(r'[a-f0-9]{24}', key):
        raise ValueError('Invalid incident fingerprint')
    if not eligible(value):
        raise ValueError('Not an important incident')
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repo):
        raise ValueError('Invalid repository context')
    if not re.fullmatch(r'[0-9]{1,24}', run_id):
        raise ValueError('Invalid execution context')
    marker='<!-- todoroki-quality:'+key+' -->'
    body=(marker+'\n\n新規の監査検出です。自動修正・公開はしていません。\n\n'
          +'検査項目: '+value['id']+'\n\n'
          +'URL・取得本文・エラー詳細は通知へ転記しません。実行証跡の監査結果を確認してください。\n\n'
          +'実行証跡: https://github.com/'+repo+'/actions/runs/'+run_id)
    return marker, '[品質監査] '+value['id']+' 新規問題', body
