(()=>{'use strict';
if(window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true)return;
const ua=navigator.userAgent,ios=/iPhone|iPad|iPod/.test(ua),android=/Android/.test(ua);
if(!ios&&!android)return;
const css=document.createElement('style');css.textContent=`
#td-install{position:fixed;bottom:calc(14px + env(safe-area-inset-bottom));left:12px;right:12px;z-index:9000;background:#15130d;color:#f5edda;border:1px solid #c9a34b;border-radius:14px;padding:12px 14px;box-shadow:0 6px 30px #0009;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Noto Sans JP",sans-serif;display:flex;align-items:center;gap:12px}
#td-install strong{color:#f1d27b;display:block;font-size:15px}#td-install span{display:block;font-size:12px;color:#d3ccbb}
#td-install button{font:inherit;cursor:pointer;border-radius:8px;padding:9px 11px;border:1px solid #a98736;background:#d7b65e;color:#171309;font-weight:700;white-space:nowrap}
#td-install .td-close{background:transparent;color:#f1d27b;border:0;padding:7px;font-size:22px}
#td-guide[hidden]{display:none}#td-guide{position:fixed;inset:0;z-index:9100;background:#000b;display:grid;place-items:center;padding:20px}
#td-guide section{background:#151515;color:#f6f1e6;border:1px solid #c9a34b;border-radius:16px;padding:22px;max-width:390px;width:100%;font:15px/1.7 -apple-system,BlinkMacSystemFont,"Noto Sans JP",sans-serif}
#td-guide h2{color:#edc96b;font-size:21px;margin:0 0 12px}#td-guide ol{padding-left:23px}#td-guide li{margin:10px 0}#td-guide button{background:#d7b65e;color:#171309;border:0;border-radius:8px;padding:11px 18px;font-weight:bold;width:100%;cursor:pointer}
@media(min-width:700px){#td-install{max-width:440px;left:auto}}
`;document.head.append(css);
const bar=document.createElement('aside');bar.id='td-install';bar.setAttribute('aria-label','アプリ追加の案内');
bar.innerHTML='<div style="flex:1"><strong>📱 TODOROKIをアプリに</strong><span>ホーム画面からワンタップで起動・無料</span></div><button type="button" class="td-open">追加方法</button><button type="button" class="td-close" aria-label="案内を閉じる">×</button>';
const dialog=document.createElement('div');dialog.id='td-guide';dialog.hidden=true;dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','td-guide-title');
dialog.innerHTML='<section><h2 id="td-guide-title">ホーム画面に追加</h2><ol id="td-steps"></ol><button type="button" class="td-done">閉じる</button></section>';
let promptEvent=null,previousFocus=null;
const steps=dialog.querySelector('#td-steps');
function setSteps(){steps.replaceChildren();const lines=ios?['Safariでこのページを開きます','画面下の共有ボタン（□から↑）をタップ','「ホーム画面に追加」を選択','右上の「追加」をタップ']:['Chromeの右上メニュー（︙）を開きます','「アプリをインストール」または「ホーム画面に追加」を選択','確認画面で「インストール」または「追加」をタップ'];for(const line of lines){const li=document.createElement('li');li.textContent=line;steps.append(li)}}
function close(){dialog.hidden=true;previousFocus?.focus()}
function open(){previousFocus=document.activeElement;setSteps();dialog.hidden=false;dialog.querySelector('.td-done').focus()}
bar.querySelector('.td-close').addEventListener('click',()=>{bar.remove();try{sessionStorage.setItem('td-install-dismissed','1')}catch{}});
bar.querySelector('.td-open').addEventListener('click',async()=>{if(promptEvent){const p=promptEvent;promptEvent=null;await p.prompt();return}open()});
dialog.querySelector('.td-done').addEventListener('click',close);
dialog.addEventListener('click',e=>{if(e.target===dialog)close()});
dialog.addEventListener('keydown',e=>{if(e.key==='Escape')close();if(e.key==='Tab'){e.preventDefault();dialog.querySelector('.td-done').focus()}});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptEvent=e;bar.querySelector('.td-open').textContent='アプリを追加'});
window.addEventListener('appinstalled',()=>{bar.remove();close()});
try{if(sessionStorage.getItem('td-install-dismissed')==='1')return}catch{}
document.body.append(bar,dialog);
})();