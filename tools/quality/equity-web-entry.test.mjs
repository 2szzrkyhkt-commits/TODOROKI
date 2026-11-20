import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';

const script = readFileSync(new URL('../../assets/equity-web-entry.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const href='/api/tools/equity';
const iPhone='Mozilla/5.0 (iPhone; CPU iPhone OS 18_5) AppleWebKit/605.1.15 Version/18.5 Mobile Safari/604.1';
const Android='Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';
function link(userAgent, {iosStandalone=false, displayMode=false}={}) {
  let target=href;
  vm.runInNewContext(script, {
    navigator: {userAgent, standalone:iosStandalone},
    matchMedia: (query) => {
      assert.match(query, /display-mode: standalone/);
      return {matches:displayMode};
    },
    document: {querySelector(selector) {
      assert.equal(selector, 'a[href="/api/tools/equity"]');
      return {setAttribute(name, value) {
        assert.equal(name, 'href');
        target=value;
      }};
    }},
  });
  return target;
}
test('iPhone Safari and Android Chrome web equity links select the mobile proof route', () => {
  assert.equal(link(iPhone), href+'?flow=auto');
  assert.equal(link(Android), href+'?flow=auto');
});
test('installed iOS/Android, desktop and unknown clients keep the original route', () => {
  assert.equal(link(iPhone,{iosStandalone:true}),href);
  assert.equal(link(Android,{displayMode:true}),href);
  assert.equal(link(iPhone,{displayMode:true}),href);
  for(const userAgent of ['Mozilla/5.0 Macintosh Safari','Mozilla/5.0 Windows Chrome','Mozilla/5.0 Windows Edg','']){
    assert.equal(link(userAgent),href);
  }
});
test('no-script HTML retains the original equity and two economy links and tab behavior', () => {
  assert.ok(html.includes('<script src="/assets/equity-web-entry.js" defer></script>'));
  assert.match(html, /href="\/api\/tools\/equity" class="card-link" referrerpolicy="origin">/);
  for(const slug of ['jp','us']){
    assert.ok(html.includes(`href="/api/tools/${slug}" class="card-link" referrerpolicy="origin" target="_blank" rel="noopener"`));
  }
  assert.ok(!html.includes('flow=auto'));
});
