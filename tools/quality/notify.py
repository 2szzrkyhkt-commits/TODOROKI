"""Issue-only incident reporting, never email/webhook without configuration."""
import json,os,subprocess
from pathlib import Path
report=json.loads(Path('quality-results/latest.json').read_text())
repo=os.environ['GITHUB_REPOSITORY']
def gh(*args):return subprocess.check_output(['gh',*args],text=True)
# Search all open issues to avoid duplicating incidents created by this monitor.
issues=json.loads(gh('issue','list','--repo',repo,'--state','open','--limit','1000','--json','number,body'))
for key,value in report['notification_candidates'].items():
 marker='<!-- todoroki-quality:'+key+' -->'
 if any(marker in (i['body'] or '') for i in issues):continue
 body=marker+'\n\n新規の監査検出です。自動修正・公開はしていません。\n\n'+json.dumps(value,ensure_ascii=False,indent=2)+'\n\n実行証跡: https://github.com/'+repo+'/actions/runs/'+os.environ['GITHUB_RUN_ID']
 subprocess.run(['gh','issue','create','--repo',repo,'--title','[品質監査] '+value['id']+' 新規問題','--body-file','-'],input=body,text=True,check=True)
# Recovery is recorded in the ledger, without repeated recovery notifications.
