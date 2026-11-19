"""Read-only source snapshot restore to temporary isolated directory; not a D1 backup."""
import subprocess,tempfile,tarfile,hashlib,json,io
from pathlib import Path
archive=subprocess.check_output(['git','archive','--format=tar','HEAD'])
with tempfile.TemporaryDirectory(prefix='todoroki-source-restore-') as d:
 with tarfile.open(fileobj=io.BytesIO(archive)) as t:
  members=t.getmembers()
  t.extractall(d,filter='data')
  for member in t.getmembers():
   if not member.isfile():continue
   expected=hashlib.sha256(t.extractfile(member).read()).hexdigest()
   actual=hashlib.sha256((Path(d)/member.name).read_bytes()).hexdigest()
   assert expected==actual,member.name
 result={'scope':'committed source only; production D1/member data not backed up or restored','archive_sha256':hashlib.sha256(archive).hexdigest(),'restored_files':sum(m.isfile() for m in members),'source_commit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()}
Path('quality-results').mkdir(exist_ok=True);Path('quality-results/source-restore.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
