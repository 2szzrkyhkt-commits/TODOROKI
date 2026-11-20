import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';

const script = readFileSync(new URL('../../assets/economy-mobile-launch.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const iPhone = 'Mozilla/5.0 (iPhone; CPU iPhone OS) Safari/604.1';
const Android = 'Mozilla/5.0 (Linux; Android 15) Chrome/130.0';
function setup({userAgent=iPhone, platform='', maxTouchPoints=0, coarse=false, standalone=false,
    hostname='todoroki-gold.com', submitThrows=false}={}) {
  const handlers = new Map(), submitted = [], removed = [];
  const document={
    querySelector(selector) {
      const slug=selector.match(/^a\[href="\/api\/tools\/(jp|us)"\]/)?.[1];
      assert.ok(slug);
      assert.equal(selector,`a[href="/api/tools/${slug}"], a[href="/api/tools/${slug}?flow=auto"]`);
      return {addEventListener(name, fn) {
        assert.equal(name, 'click');
        handlers.set(slug, fn);
      }};
    },
    createElement(tag) {
      assert.equal(tag, 'form');
      return {submit(){
        if(submitThrows) throw Error('fixture failure');
        assert.equal(this.attached, true);
        submitted.push({method:this.method, action:this.action, target:this.target, hidden:this.hidden});
      },remove(){removed.push(this);}};
    },
    body:{append(form){form.attached=true;}}
  };
  vm.runInNewContext(script,{location:{hostname},navigator:{userAgent,platform,maxTouchPoints,standalone},matchMedia(query){assert.equal(query,'(pointer: coarse)');return {matches:coarse};},document});
  function click(slug, fields={}){
    let prevented=false;
    handlers.get(slug)?.({isTrusted:true, button:0, preventDefault(){prevented=true;}, ...fields});
    return prevented;
  }
  return {handlers,click,submitted,removed};
}
test('both economy cards use fixed same-tab browser POSTs on iOS Safari, iPad desktop style, Android, and installed app', () => {
  for(const device of [{}, {userAgent:Android}, {userAgent:'Macintosh Safari',platform:'MacIntel',maxTouchPoints:5}, {userAgent:'Macintosh Safari',platform:'MacIntel',coarse:true}, {userAgent:'Desktop-class Safari',platform:'iPhone'}, {userAgent:'Desktop-class Safari',platform:'iPad'}, {standalone:true}]){
    const a=setup(device);
    assert.equal(a.handlers.size,2);
    for(const slug of ['jp','us']){
      // detail=0 represents the keyboard's native click.
      assert.equal(a.click(slug,{detail:0}),true);
      assert.deepEqual(a.submitted.at(-1),{method:'post',action:`/api/tools/${slug}?flow=auto`,target:'_self',hidden:true});
    }
    assert.equal(a.click('equity'),false);
  }
});
test('desktop and the established Cloudflare mirror retain the unmodified GET link', () => {
  for(const device of [{userAgent:'Macintosh Safari',platform:'MacIntel'}, {userAgent:'Windows Chrome'}, {userAgent:'Windows touch',platform:'Win32',coarse:true}, {hostname:'todoroki.8njb5bzfbz.workers.dev'}]){
    const a=setup(device);
    assert.equal(a.handlers.size,0);
    assert.equal(a.click('jp'),false);
    assert.equal(a.submitted.length,0);
  }
});
test('modified clicks, synthetic clicks, or submit errors leave the original interaction intact', () => {
  const a=setup();
  for(const fields of [{button:1},{metaKey:true},{ctrlKey:true},{shiftKey:true},{altKey:true},{isTrusted:false},{defaultPrevented:true}]){
    assert.equal(a.click('jp',fields),false);
  }
  assert.equal(a.submitted.length,0);
  const failed=setup({submitThrows:true});
  assert.equal(failed.click('us'),false);
  assert.equal(failed.removed.length,1);
});
test('the progressive enhancement does not replace native desktop/no-script links or their recovery', () => {
  assert.ok(html.includes('<script src="/assets/economy-mobile-launch.js" defer></script>'));
  for(const slug of ['jp','us']){
    assert.ok(html.includes(`href="/api/tools/${slug}" class="card-link" referrerpolicy="origin" target="_blank" rel="noopener"`));
  }
});
