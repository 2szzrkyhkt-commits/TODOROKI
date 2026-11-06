"""Append-only report commits to an isolated branch, with compare-and-swap update."""
import os,json,subprocess,base64
from pathlib import Path
def api(path,data=None):
 args=['gh','api',path]
 if data is not None:args+=['--method','POST','--input','-']
 p=subprocess.run(args,input=json.dumps(data) if data is not None else None,text=True,capture_output=True,check=True)
 return json.loads(p.stdout)
repo=os.environ['GITHUB_REPOSITORY'];root=f'repos/{repo}';branch='quality-history'
# A missing branch is the only expected absence; every other read failure aborts.
branches=api(root+'/branches?per_page=100')
exists=any(b['name']==branch for b in branches)
head=api(root+'/git/ref/heads/'+branch)['object']['sha'] if exists else None
base=api(root+'/git/commits/'+head)['tree']['sha'] if head else None
report=json.loads(Path('quality-results/latest.json').read_text())
name=os.environ['GITHUB_RUN_ID']+'-'+os.environ['GITHUB_RUN_ATTEMPT']
entries=[]
for target,source in [('latest.json','latest.json'),('history/'+name+'.json','latest.json'),('summary.md','summary.md')]:
 blob=api(root+'/git/blobs',{'content':Path('quality-results/'+source).read_text(),'encoding':'utf-8'})
 entries.append({'path':target,'mode':'100644','type':'blob','sha':blob['sha']})
tree=api(root+'/git/trees',{'tree':entries,**({'base_tree':base} if base else {})})
commit=api(root+'/git/commits',{'message':'audit: '+report['at'],'tree':tree['sha'],'parents':[head] if head else []})
if head:
 # Non-forced fast-forward rejects races; no concurrent report is overwritten.
 args=['gh','api',root+'/git/refs/heads/'+branch,'--method','PATCH','--input','-']
 subprocess.run(args,input=json.dumps({'sha':commit['sha'],'force':False}),text=True,check=True)
else:api(root+'/git/refs',{'ref':'refs/heads/'+branch,'sha':commit['sha']})
