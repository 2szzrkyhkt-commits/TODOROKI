import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';

const script = readFileSync(new URL('../../assets/equity-web-entry.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const hrefs=['equity','jp','us'].map(slug=>'/api/tools/'+slug);
const iPhone='Mozilla/5.0 (iPhone; CPU iPhone OS 18_5) AppleWebKit/605.1.15 Version/18.5 Mobile Safari/604.1';
const Android='Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';
function links(userAgent, {iosStandalone=false, displayMode=false, platform='', maxTouchPoints=0}={}) {
  const targets=[...hrefs];
  vm.runInNewContext(script, {
    navigator: {userAgent, standalone:iosStandalone, platform, maxTouchPoints},
    matchMedia: (query) => {
      assert.match(query, /display-mode: standalone/);
      return {matches:displayMode};
    },
    document: {querySelector(selector) {
      const index=hrefs.findIndex(href=>selector==='a[href="'+href+'"]');
      assert.ok(index>=0);
      return {setAttribute(name, value) {
        assert.equal(name, 'href');
        targets[index]=value;
      }};
    }},
  });
  return targets;
}
test('regular iPhone and Android and desktop-style touch Apple browsers opt in for all three links', () => {
  const expected=hrefs.map(href=>href+'?flow=auto');
  assert.deepEqual(links(iPhone), expected);
  assert.deepEqual(links(Android), expected);
  assert.deepEqual(links('Desktop-class Safari',{platform:'MacIntel',maxTouchPoints:5}),expected);
});
test('installed, desktop and unknown clients keep native card hrefs (server independently selects)', () => {
  assert.deepEqual(links(iPhone,{iosStandalone:true}),hrefs);
  assert.deepEqual(links(Android,{displayMode:true}),hrefs);
  assert.deepEqual(links(iPhone,{displayMode:true}),hrefs);
  for(const userAgent of ['Mozilla/5.0 Macintosh Safari','Mozilla/5.0 Windows Chrome','Mozilla/5.0 Windows Edg','']){
    assert.deepEqual(links(userAgent),hrefs);
  }
});
test('no-script HTML retains the original equity and two economy links and tab behavior', () => {
  assert.ok(html.includes('<script src="/assets/equity-web-entry.js" defer></script>'));
  assert.match(html, /href="\/api\/tools\/equity" class="card-link" referrerpolicy="origin" id="equity-research-tool">/);
  for(const slug of ['jp','us']){
    assert.ok(html.includes(`href="/api/tools/${slug}" class="card-link" referrerpolicy="origin" target="_blank" rel="noopener"`));
  }
  assert.ok(!html.includes('flow=auto'));
});
