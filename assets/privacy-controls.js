(()=>{'use strict';
 const consentOnly=document.currentScript?.hasAttribute?.('data-todoroki-consent-only')===true;
 const key='todoroki_privacy_v1',sensitive=/^\/(?:login|privacy|contact|data-use)(?:\.html)?\/?$/.test(location.pathname);let region={optionalAllowed:false},prefs={analytics:false,ads:false},initial=true,ready=false,activated=false;
 try{const p=JSON.parse(localStorage.getItem(key));if(p&&p.version===1&&Date.now()-p.time<15552000000){prefs={analytics:p.analytics===true,ads:p.ads===true};initial=false}}catch{}
 function script(src){const s=document.createElement('script');s.async=true;s.src=src;s.crossOrigin='anonymous';document.head.append(s)}
 // Keep affiliate links readable while images are disabled, blocked or loading.
 document.querySelectorAll('a[href*="trafficgate.net"] img[data-consent-src]').forEach(img=>{
  const link=img.closest('a');
  const fallback=document.createElement('span');
  fallback.textContent=img.alt || (document.documentElement.lang==='ja'?'広告主のサイトを見る':'Visit advertiser');
  fallback.style.cssText='display:block;padding:10px 0;overflow-wrap:anywhere';
  img.style.display='none';
  img.addEventListener('load',()=>{img.style.display='block';fallback.style.display='none'});
  img.addEventListener('error',()=>{img.style.display='none';fallback.style.display='block'});
  link.append(fallback);
 });
 function activate(){if(!ready||activated||sensitive||navigator.globalPrivacyControl===true||!region.optionalAllowed)return;activated=true;
 if(prefs.analytics){window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments)};window.gtag('js',new Date());window.gtag('config','G-ZNSX8VRZ2S',{allow_google_signals:false,allow_ad_personalization_signals:false});script('https://www.googletagmanager.com/gtag/js?id=G-ZNSX8VRZ2S')}
 if(prefs.ads){script('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7179318481718851');document.querySelectorAll('[data-consent-src]').forEach(img=>{img.loading='eager';img.src=img.dataset.consentSrc})}}
 const en=document.documentElement.lang!=='ja';let panel,analytics,ads;
 function save(a,b){try{localStorage.setItem(key,JSON.stringify({version:1,time:Date.now(),analytics:a,ads:b}))}catch{}location.reload()}
 function ui(){const holder=document.createElement('div');holder.innerHTML=`<style>#td-privacy-open{position:fixed;bottom:10px;left:12px;z-index:9998;background:#111;color:#f4d77b;border:1px solid #846a2e;border-radius:5px;padding:8px 12px;font:12px system-ui;cursor:pointer}#td-privacy-panel{position:fixed;left:12px;bottom:58px;z-index:9999;width:min(440px,calc(100% - 24px));max-height:75vh;overflow:auto;background:#111;border:1px solid #b18d32;border-radius:10px;color:#f4f1e8;padding:20px;box-shadow:0 10px 50px #0009;font:14px/1.7 system-ui}#td-privacy-panel[hidden]{display:none}#td-privacy-panel h2{font-size:18px;margin:0 0 8px}#td-privacy-panel label{display:flex;gap:9px;margin:10px 0}#td-privacy-panel input{width:18px}#td-privacy-panel button{margin:6px 5px 0 0;border:1px solid #aa8732;background:#1c180e;color:#f4d77b;padding:9px 13px;border-radius:5px;cursor:pointer}#td-privacy-panel a{color:#f4d77b}</style><button id="td-privacy-open" type="button" aria-expanded="false">${en?'Privacy choices':'広告・解析の設定'}</button><section id="td-privacy-panel" aria-labelledby="td-privacy-title" hidden><h2 id="td-privacy-title">${en?'Advertising and analytics':'広告・アクセス解析の設定'}</h2><p>${en?'Optional tags are off until you choose. Rejecting them does not prevent reading articles or PDFs.':'選択するまで任意のタグは読み込みません。拒否しても記事・PDFは閲覧できます。'}</p><label><input id="td-analytics" type="checkbox">${en?'Allow usage analytics':'アクセス解析を許可'}</label><label><input id="td-ads" type="checkbox">${en?'Allow advertising tags and banner images':'広告タグ・広告画像を許可'}</label><p id="td-region" style="font-size:12px"></p><p><a href="/data-use">${en?'Recipients, purposes and data use':'送信先・送信内容・利用目的'}</a></p><button id="td-reject" type="button">${en?'Reject both':'両方拒否'}</button><button id="td-save" type="button">${en?'Save choices':'選択を保存'}</button><button id="td-close" type="button">${en?'Close':'閉じる'}</button></section>`;document.body.append(holder);panel=document.getElementById('td-privacy-panel');analytics=document.getElementById('td-analytics');ads=document.getElementById('td-ads');analytics.checked=prefs.analytics;ads.checked=prefs.ads;
 function open(v){panel.hidden=!v;document.getElementById('td-privacy-open').setAttribute('aria-expanded',String(v));if(v)document.getElementById(consentOnly?'td-close':'td-reject').focus()}
 document.getElementById('td-privacy-open').onclick=()=>open(panel.hidden);document.getElementById('td-reject').onclick=()=>save(false,false);document.getElementById('td-save').onclick=()=>save(analytics.checked,ads.checked);document.getElementById('td-close').onclick=()=>open(false);document.addEventListener('keydown',e=>{if(e.key==='Escape')open(false)});if(initial&&!sensitive){const trigger=document.getElementById('td-privacy-open');trigger.setAttribute('aria-label',en?'Open privacy choices (optional analytics and ads are off)':'広告・解析の設定を開く（未選択では任意タグは無効）');trigger.textContent=en?'Privacy choices · optional':'広告・解析の設定（任意）';}
 }
 ui();
 // These explicitly marked pages had no optional tags. Read-only choices
 // preserve that behavior, including for visitors who opted in elsewhere.
 if(consentOnly){
  for(const control of [analytics,ads,document.getElementById('td-reject'),document.getElementById('td-save')])control.disabled=true;
  analytics.checked=false;ads.checked=false;
  document.getElementById('td-region').textContent=en?'This page does not load advertising or analytics. Your choices remain unchanged.':'このページでは広告・解析を読み込みません。このページで選択は変更できません。';
  return;
 }
 fetch('/api/privacy/region',{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(5000)}).then(r=>r.ok?r.json():{}).then(v=>{region={optionalAllowed:v.optionalAllowed===true};}).catch(()=>{}).finally(()=>{ready=true;const allowed=region.optionalAllowed&&!sensitive&&navigator.globalPrivacyControl!==true;if(!allowed){analytics.disabled=true;ads.disabled=true;analytics.checked=false;ads.checked=false;document.getElementById('td-region').textContent=en?'Optional tags are disabled for this region, privacy signal or page.':'この地域・プライバシー設定・ページでは任意タグを配信しません。'}activate()});
})();


/* All pages use the homepage header and the same navigation targets. */
(()=>{'use strict';
if(document.currentScript?.hasAttribute?.('data-todoroki-consent-only')===true)return;
const markup="<header class=\"site-header\">\n  <div class=\"wrap brand-row\">\n    <a class=\"logo\" href=\"/\" aria-label=\"TODOROKI トップページ\">TODOROKI</a>\n    <nav class=\"desktop-links\" aria-label=\"メインメニュー\">\n      <a href=\"/#latest-articles\">新着記事</a>\n      <a href=\"/#articles\">基礎</a>\n      <a href=\"/#themes\">テーマ</a>\n      <a href=\"/#pdf-library\">用語・PDF</a>\n      <a href=\"/#study\">学ぶ</a>\n      <a href=\"/#company-analysis\">ツール</a>\n    </nav>\n    <label class=\"todoroki-language-picker\">🌐 <select data-todoroki-language aria-label=\"表示言語 / Language\"><option value=\"ja\" selected>日本語</option><option value=\"en\">English</option><option value=\"es\">Español</option><option value=\"pt\">Português</option><option value=\"zh-Hant\">繁體中文</option><option value=\"zh-Hans\">简体中文</option></select></label>\n    <a class=\"account-link\" href=\"/login\">\n      <svg viewBox=\"0 0 20 20\" aria-hidden=\"true\"><circle cx=\"10\" cy=\"6\" r=\"3\"/><path d=\"M4 18v-2a6 6 0 0 1 12 0v2\"/></svg>\n      ログイン\n    </a>\n  </div>\n  <nav class=\"mobile-links\" aria-label=\"メインメニュー\">\n    <a href=\"/#latest-articles\">新着記事</a>\n    <a href=\"/#articles\">基礎</a>\n    <a href=\"/#themes\">テーマ</a>\n      <a href=\"/#pdf-library\">用語・PDF</a>\n    <a href=\"/#study\">学ぶ</a>\n    <a href=\"/#company-analysis\">ツール</a>\n  </nav>\n</header>";
function update(){
 const header=document.querySelector('header.site-header')||document.querySelector('body > header');
 if(!header)return;
 // Keep the explicitly authored homepage header and its OFUSE controls.
 // This does not change privacy preferences or optional-tag activation.
 if(header.dataset.preserveHeader!=='ofuse')header.outerHTML=markup;
 if(!document.querySelector('link[href^="/assets/site-header.css"]')){
  const css=document.createElement('link');css.rel='stylesheet';css.href='/assets/site-header.css';document.head.append(css);
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',update,{once:true});else update();
})();


/* Keep OFUSE links in the page flow and reuse any existing article CTA. */
(()=>{'use strict';
if(document.currentScript?.hasAttribute('data-todoroki-consent-only'))return;
if(/^\/(?:login|privacy|contact|data-use)(?:\.html)?\/?$/.test(location.pathname))return;

const destination='https://ofuse.me/todoroki_gold';
const labels={
 ja:'とどろきを応援する',
 en:'Support TODOROKI',
 es:'Apoyar a TODOROKI',
 pt:'Apoiar TODOROKI',
 'zh-hans':'支持 TODOROKI',
 'zh-hant':'支持 TODOROKI'
};
function useSupportImage(link){
 if(link.querySelector('img'))return;
 const img=document.createElement('img');
 img.src='/assets/todoroki-ofuse-button-3.png';
 img.alt=link.textContent.trim();
 img.width=1209;
 img.height=238;
 img.decoding='async';
 link.classList.add('todoroki-support-image');
 link.replaceChildren(img);
}
function place(target,position){
 if(!target)return false;
 if(target.querySelector('a[href="'+destination+'"]') ||
    (position==='afterend' && target.nextElementSibling?.classList.contains('todoroki-support')))return false;
 const block=document.createElement('div');
 block.className='todoroki-support';
 const link=document.createElement('a');
 link.href=destination;
 link.rel='noreferrer';
 const locale=document.documentElement.lang.toLowerCase();
 link.textContent=labels[locale] || labels[locale.split('-')[0]] || labels.en;
 useSupportImage(link);
 block.append(link);
 target.insertAdjacentElement(position,block);
 return true;
}
function addSupportLinks(){
 const header=document.querySelector('header.site-header');
 const isHome=header?.dataset.preserveHeader==='ofuse';
 const main=document.querySelector('main') || document.querySelector('#main-content');
 const article=main?.querySelector('article:has(h1)') || document.querySelector('article:has(h1)');
 const placements=[
  [isHome ? null : header,'afterend'],
  [article,'beforeend'],
  [document.querySelector('body > footer, footer:not(article footer)'),'afterbegin']
 ];
 if(isHome){
  placements.push(
   [document.querySelector('#articles > .wrap'),'beforeend'],
   [document.querySelector('#company-analysis > .wrap'),'beforeend']
  );
 }
 document.querySelectorAll('.article-ofuse-link[href="'+destination+'"]').forEach(useSupportImage);
 placements.forEach(([target,position])=>place(target,position));
 const style=document.createElement('style');
 style.textContent=`
 .todoroki-support{display:flex;justify-content:center;margin:16px 0;padding:0 12px}
 .todoroki-support > a.todoroki-support-image,.article-ofuse a.article-ofuse-link.todoroki-support-image{
  display:inline-flex;align-items:center;min-height:44px;width:300px;max-width:100%;
  padding:0;border:0;border-radius:6px;background:transparent;color:#f4d77b;text-decoration:none
 }
 .todoroki-support-image > img{display:block;width:100%;height:auto}
 .todoroki-support-image:hover{filter:brightness(1.12)}
 .todoroki-support-image:focus-visible{outline:2px solid #f4d77b;outline-offset:3px}
 `;
 document.head.append(style);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addSupportLinks,{once:true});
else addSupportLinks();
})();
