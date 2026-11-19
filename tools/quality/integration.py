"""Explicit integration validation: isolated history branch and one marked test issue."""
import os,json,subprocess
from pathlib import Path
repo=os.environ['GITHUB_REPOSITORY'];env=dict(os.environ,QUALITY_HISTORY_BRANCH='quality-validation')
# Verify writes and read-back with exactly the same persistence path as production.
subprocess.run(['python','tools/quality/persist.py'],env=env,check=True)
subprocess.run(['python','tools/quality/persist.py'],env=env,check=True)
marker='<!-- todoroki-quality-notification-delivery-test-v1 -->'
def issues():return json.loads(subprocess.check_output(['gh','issue','list','--repo',repo,'--state','all','--limit','1000','--json','number,body,url'],text=True))
found=[i for i in issues() if marker in (i['body'] or '')]
if not found:
 body=marker+'\n\n監査通知の到達確認用です。実サイトの障害ではありません。\n\nGitHub Actionsから通知先GitHub issueへ実際に書き込み、再実行で二重作成しないことを検証します。メール・端末への配信確認とは区別します。'
 subprocess.run(['gh','issue','create','--repo',repo,'--title','[品質監査・通知テスト] GitHubへの到達確認','--body-file','-'],input=body,text=True,check=True)
found=[i for i in issues() if marker in (i['body'] or '')];assert len(found)==1
again=[i for i in issues() if marker in (i['body'] or '')];assert len(again)==1
result={'history_branch':'quality-validation','save_readback_twice':True,'test_notification_url':found[0]['url'],'same_marker_count':len(again),'scope':'GitHub destination reached; inbox/push receipt requires user confirmation'}
Path('quality-results/integration.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False))
