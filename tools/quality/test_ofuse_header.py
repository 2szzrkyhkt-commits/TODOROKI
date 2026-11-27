import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]

class OfuseHeaderTests(unittest.TestCase):
    def test_runtime_preserves_authored_header_but_updates_legacy(self):
        subprocess.run(['node', '--input-type=module', '-e', r'''
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
for (const path of ['assets/privacy-controls.js','assets/site-header.js']) {
 let source=fs.readFileSync(path,'utf8');
 if(path.includes('privacy')) source=source.slice(source.indexOf('/* All pages use the homepage header'));
 for(const preserve of [true,false]) for(const loading of [true,false]) {
  let writes=0; const callbacks=[];
  const header={dataset:preserve?{preserveHeader:'ofuse'}:{},set outerHTML(v){writes++;assert.match(v,/site-header/);},querySelector:()=>({})};
  const document={readyState:loading?'loading':'complete',querySelector:s=>s.startsWith('link')?{}:header,querySelectorAll:()=>[],createElement:()=>({}),head:{append(){}},addEventListener:(event,fn)=>{assert.equal(event,'DOMContentLoaded');callbacks.push(fn);}};
  vm.runInNewContext(source,{document,location:{pathname:'/'}});
  if(loading) for(const callback of callbacks) callback();
  assert.equal(writes,preserve?0:1,`${path}: preserve=${preserve}, loading=${loading}`);
 }
}
'''], cwd=ROOT, check=True)

    def test_homepage_image_and_responsive_styles(self):
        s=(ROOT/'index.html').read_text()
        self.assertIn('data-preserve-header="ofuse"',s)
        self.assertEqual(s.count('src="/assets/todoroki-ofuse-button-3.png"'),1)
        self.assertEqual(s.count('href="https://ofuse.me/todoroki_gold"'),1)
        css=s.index('.ofuse-header-slot{')
        self.assertGreater(css,s.index('href="/assets/site-header.css"'))
        self.assertIn("@media(max-width:1200px)",s[css:])
        self.assertIn('.ofuse-header-slot{order:1;',s[css:])
        self.assertIn('@media(min-width:1201px)',s[css:])
        self.assertTrue((ROOT/'assets/todoroki-ofuse-button-3.png').is_file())

if __name__=='__main__': unittest.main()
