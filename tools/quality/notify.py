"""Issue-only incident reporting, never email/webhook without configuration."""
import json,os,subprocess
from pathlib import Path
from notification_policy import eligible,issue_message


def main():
    report=json.loads(Path('quality-results/latest.json').read_text())
    # Recheck older reports against the current dispatch policy.
    pending=[issue_message(k,v,os.environ['GITHUB_REPOSITORY'],os.environ['GITHUB_RUN_ID'])
             for k,v in report['notification_candidates'].items() if eligible(v)]
    if not pending:
        return
    repo=os.environ['GITHUB_REPOSITORY']
    issues=json.loads(subprocess.check_output(
        ['gh','issue','list','--repo',repo,'--state','open','--limit','1000','--json','number,body'],text=True))
    for marker,title,body in pending:
        if any(marker in (i['body'] or '') for i in issues):
            continue
        subprocess.run(['gh','issue','create','--repo',repo,'--title',title,'--body-file','-'],
                       input=body,text=True,check=True)
    # Recovery is recorded in the ledger, without repeated recovery notifications.


if __name__=='__main__':
    main()
