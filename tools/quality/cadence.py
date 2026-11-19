"""Calendar cadence survives delayed schedules and records actual modes, JST."""
from datetime import datetime,timezone,timedelta
JST=timezone(timedelta(hours=9))
def choose(previous,event,requested=None,now=None):
 if requested:return requested
 if event!='schedule':return 'daily'
 now=now or datetime.now(JST);now=now.astimezone(JST)
 stamps=previous.get('completed_modes',{})
 def date(mode):
  try:return datetime.fromisoformat(stamps[mode]).astimezone(JST)
  except (KeyError,ValueError):return None
 if now.hour>=3:
  m=date('monthly');w=date('weekly');d=date('daily')
  if not m or (m.year,m.month)!=(now.year,now.month):return 'monthly'
  if not w or w.isocalendar()[:2]!=now.isocalendar()[:2]:return 'weekly'
  if not d or d.date()!=now.date():return 'daily'
 return 'hourly'
if __name__=='__main__':
 import os,json
 from pathlib import Path
 p=Path('/tmp/quality-state/latest.json');previous=json.loads(p.read_text()) if p.exists() else {}
 print(choose(previous,os.environ['GITHUB_EVENT_NAME'],os.environ.get('REQUESTED')))
