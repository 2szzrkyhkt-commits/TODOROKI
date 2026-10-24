(function(){'use strict';
const locales=[['ja','日本語'],['en','English'],['es','Español'],['pt','Português'],['zh-Hant','繁體中文'],['zh-Hans','简体中文']];
const prefixes=['en','es','pt','zh-Hant','zh-Hans'];
const supported=new Set(['investment','price-value','margin-of-safety','investment-list','economy-list','business-list','inflation','interest-rate','inflation-asset-gap','business-ma','glossary','pdf-library']);
const parts=location.pathname.replace(/\/$/,'').replace(/\.html$/,'').split('/').filter(Boolean);
const current=prefixes.includes(parts[0])?parts[0]:'ja';
const slug=current==='ja'?(parts[0]||''):(parts[1]||'');
function destination(lang){if(lang==='ja')return slug?'/'+slug:'/';if(supported.has(slug))return '/'+lang+'/'+slug+'.html';if(lang==='en'&&slug==='japanese-stocks')return '/en/japanese-stocks.html';return '/'+lang+'/';}
function changeLanguage(lang){const target=destination(lang);const samePage=(slug===''||supported.has(slug)||(lang==='en'&&slug==='japanese-stocks'));
if(!samePage){location.assign(target);return;}
const ratio=window.scrollY/Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
try{sessionStorage.setItem('todoroki-language-scroll',JSON.stringify({target:target,ratio:ratio,from:Date.now()}));}catch(e){}
location.assign(target);
}
try{const saved=JSON.parse(sessionStorage.getItem('todoroki-language-scroll')||'null');if(saved){sessionStorage.removeItem('todoroki-language-scroll');const sameTarget=(location.pathname.replace(/\/$/,'')===saved.target.replace(/\/$/,'')||location.pathname===saved.target);if(sameTarget&&Date.now()-saved.from<20000){let attempts=0;const restore=function(){const height=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);window.scrollTo(0,Math.round(height*Math.min(1,Math.max(0,saved.ratio))));};const ready=function(){restore();requestAnimationFrame(restore);};if(document.readyState==='complete')ready();else window.addEventListener('load',ready,{once:true});}}}catch(e){}
document.querySelectorAll('[data-todoroki-language]').forEach(function(select){select.replaceChildren();locales.forEach(function(pair){const opt=document.createElement('option');opt.value=pair[0];opt.textContent=pair[1];select.appendChild(opt)});select.value=current;select.addEventListener('change',function(){changeLanguage(select.value)})});
})();