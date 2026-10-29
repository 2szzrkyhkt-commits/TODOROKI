(function(){'use strict';
const locales=[['ja','日本語'],['en','English'],['es','Español'],['pt','Português'],['zh-Hant','繁體中文'],['zh-Hans','简体中文']];
const prefixes=['en','es','pt','zh-Hant','zh-Hans'];
const supported=new Set(['anthropic-ipo-ai-safety-2026','investment','price-value','margin-of-safety','investment-list','economy-list','business-list','inflation','interest-rate','inflation-asset-gap','business-ma','mbo-investing','glossary','pdf-library']);
const parts=location.pathname.replace(/\/$/,'').replace(/\.html$/,'').split('/').filter(Boolean);
const reader=/^pdf-viewer(?:\.html)?$/.test(parts[0]||'');
const readerLang=new URLSearchParams(location.search).get('lang');
const current=reader&&locales.some(pair=>pair[0]===readerLang)?readerLang:(prefixes.includes(parts[0])?parts[0]:'ja');
let slug=current==='ja'?(parts[0]||''):(parts[1]||'');
if(slug==='index')slug='';
function destination(lang){if(lang==='ja')return supported.has(slug)?'/'+slug: '/';if(supported.has(slug))return '/'+lang+'/'+slug;if(slug==='japanese-stocks'&&lang!=='ja')return '/'+lang+'/japanese-stocks';return '/'+lang+'/';}
const pdfNames={"米国中間選挙と株価の関係.pdf":"us-midterm-elections.pdf","DRAMとは何か_半導体メモリの仕組み.pdf":"dram.pdf","EUVとは何か_半導体の微細化を支える技術.pdf":"euv.pdf","NANDフラッシュメモリとは_市場構造と関連企業.pdf":"nand.pdf","SOX指数とは_半導体株と日本株の関係.pdf":"sox.pdf","マネーサプライとは何か_お金の量と経済の関係.pdf":"money-supply.pdf","ビッグマック指数から見る円とドル.pdf":"big-mac-index.pdf","FRBとは_米国金融政策と株価・為替の関係.pdf":"fed.pdf","金利上昇と株価の関係_株価に影響する4つの仕組み.pdf":"rising-rates.pdf","graham_7_criteria.pdf":"graham-criteria.pdf","graham_earnings_power.pdf":"graham-earnings.pdf","マーチンゲール法_仕組みと資金管理のリスク.pdf":"martingale.pdf","貸借倍率_信用需給と株価の読み方.pdf":"margin-ratio.pdf","半導体の種類_材料と用途から理解する.pdf":"semiconductor-types.pdf","エヌビディアはどんな企業か.pdf":"nvidia.pdf","インタレストカバレッジレシオ_利息支払能力の見方.pdf":"interest-coverage.pdf","サクセスラーニング_成功事例から学ぶ方法.pdf":"success-learning.pdf","ToDoリスト_行動を管理する基本.pdf":"todo-list.pdf","MBOを狙う_企業価値と株価の差を読む.pdf":"mbo.pdf","dotsとは何か_常時稼働AIの仕組みと使い方.pdf":"dots.pdf","GPT-6_Astraとは_特徴と活用法.pdf":"gpt6-astra.pdf","PHPの重大な脆弱性と対策_PHP2Shell.pdf":"php-security.pdf","割引効用理論_黒金_改訂版.pdf":"discounted-utility.pdf","社会的選好と情報共有_仕事仲間の協力_改訂版.pdf":"social-preferences.pdf","欲望が経済を動かす_消費と購買心理.pdf":"consumer-desire.pdf","情報漏洩の仕組みと対策_主要システムと関連企業.pdf":"data-security.pdf","TOPIX_new_members_35_TOP10_black_gold.pdf":"topix-new-members.pdf","inflation_capital_cost_best_owner_black_gold.pdf":"capital-cost-best-owner.pdf","mRNAとAI創薬とは_技術の仕組みと関連企業.pdf":"mrna-ai-drug-discovery.pdf","japan_rate_hike_black_gold.pdf":"japan-rate-hikes.pdf","責任ある積極財政とは_政府投資の財源と財政の持続可能性.pdf":"fiscal-sustainability.pdf","nikkei_100k_black_gold.pdf":"nikkei-100k.pdf","高市政権の戦略17分野_官民投資と成長戦略.pdf":"strategic-sectors.pdf","tax_cuts_schroeder_reform_black_gold.pdf":"schroeder-reforms.pdf","AI時代の現場技能と価格決定力_適正価格をつくる仕組み.pdf":"skills-pricing-power.pdf","グローバル化_黒金PDF.pdf":"globalization.pdf","blue_collar_wages.pdf":"blue-collar-wages.pdf","consolidation.pdf":"consolidation.pdf","robot_hand_technology.pdf":"robotic-hands.pdf","russia_ukraine_war.pdf":"russia-ukraine.pdf","mammal_attachment_infidelity.pdf":"attachment-infidelity.pdf","spacex_starship_japan.pdf":"spacex-starship.pdf","デフレとインフレ_資産格差_黒金4枚.pdf":"inflation-wealth-gap.pdf","diode_transistor_mosfet.pdf":"diodes-transistors.pdf","spintronics_mram.pdf":"spintronics-mram.pdf","ヒト・モノ・カネ_企業価値の源泉_黒金.pdf":"people-assets-capital.pdf","physical_ai.pdf":"physical-ai.pdf","japan_stock_megatrends.pdf":"japan-equity-megatrends.pdf","企業も自習だけでは伸びない_黒金4枚.pdf":"corporate-learning.pdf","japan_companies_top10_20260929.pdf":"japan-companies-comparison.pdf","singularity.pdf":"singularity.pdf","japan_stock_theme_map.pdf":"japan-theme-map.pdf","Switch2関連半導体株の見通し_2026年9月23日.pdf":"switch2-semiconductors.pdf","quantum_computer_japan.pdf":"quantum-computing.pdf","半導体設計を担う日本企業_関連5銘柄.pdf":"japanese-chip-design.pdf","大衆心理_群集が判断を狂わせる理由_黒金.pdf":"crowd-psychology.pdf","成功体験が人と企業を弱くする理由_黒金.pdf":"success-trap.pdf","日本企業_M&A産業再編_黒金4P.pdf":"japan-ma.pdf","日本企業_資本の使い方_黒金_X4枚版.pdf":"capital-allocation.pdf","経営者の世代交代_黒金.pdf":"leadership-succession.pdf"};
function filterState(){const source=new URLSearchParams(location.search),state=new URLSearchParams();for(const key of ['q','category'])if(source.get(key))state.set(key,source.get(key));return state;}
async function changeLanguage(lang){let target=destination(lang);
const state=filterState();
if(reader){
 target=(lang==='ja'?'/':'/'+lang+'/')+'pdf-library'+(state.size?'?'+state:'');
 try{
  const source=new URL(new URLSearchParams(location.search).get('file')||'',location.origin);
  const path=decodeURIComponent(source.pathname),name=path.split('/').pop();
  const original=path.startsWith('/pdf/')&&path.split('/').length===3?name:Object.keys(pdfNames).find(key=>pdfNames[key]===name);
  const file=lang==='ja'?(original?'/pdf/'+original:null):(original&&pdfNames[original]?'/pdf/'+lang+'/'+pdfNames[original]:null);
  const response=await fetch('/assets/pdf-catalog.json');if(!response.ok)throw new Error('catalog');
  const catalog=await response.json();
  if(source.origin===location.origin&&file&&Object.hasOwn(catalog,file)){
   state.set('file',file);state.set('lang',lang);target='/pdf-viewer.html?'+state;
  }
 }catch(e){}
 location.assign(target);return;
}
if(slug==='pdf-library'&&state.size)target+='?'+state;
const samePage=(slug===''||supported.has(slug)||(lang!=='ja'&&slug==='japanese-stocks'));
if(!samePage){location.assign(target);return;}
const ratio=window.scrollY/Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
try{sessionStorage.setItem('todoroki-language-scroll',JSON.stringify({target:target,ratio:ratio,from:Date.now()}));}catch(e){}
location.assign(target);
}
try{const saved=JSON.parse(sessionStorage.getItem('todoroki-language-scroll')||'null');if(saved){sessionStorage.removeItem('todoroki-language-scroll');const normalizedPath=value=>value.replace(/\.html$/,'').replace(/\/$/,'').replace(/\/index$/,'');const sameTarget=normalizedPath(location.pathname)===normalizedPath(saved.target);if(sameTarget&&Date.now()-saved.from<20000){let attempts=0;const restore=function(){const height=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);window.scrollTo(0,Math.round(height*Math.min(1,Math.max(0,saved.ratio))));};const ready=function(){restore();requestAnimationFrame(restore);};if(document.readyState==='complete')ready();else window.addEventListener('load',ready,{once:true});}}}catch(e){}
if(current==='ja'){document.querySelectorAll('.site-header .desktop-links, .site-header .mobile-links').forEach(function(nav){if(!nav.querySelector('a[href="/boki1"]')){const a=document.createElement('a');a.href='/boki1';a.textContent='簿記を学ぶ';const first=nav.querySelector('a');if(first)first.insertAdjacentElement('afterend',a);else nav.appendChild(a)}})}
document.querySelectorAll('[data-todoroki-language]').forEach(function(select){select.replaceChildren();locales.forEach(function(pair){const opt=document.createElement('option');opt.value=pair[0];opt.textContent=pair[1];select.appendChild(opt)});select.value=current;select.addEventListener('change',function(){changeLanguage(select.value)})});
})();
(function(){'use strict';
function addAnalysisLink(){
 const url='https://todoroki-equity-lab.easysquid66.chatgpt.site';
 const names={en:'Company analysis',es:'Análisis de empresas',pt:'Análise de empresas','zh-Hans':'企业分析工具','zh-Hant':'企業分析工具'};
 const locale=document.documentElement.lang||'ja';
 document.querySelectorAll('.site-header .desktop-links,.site-header .mobile-links').forEach(function(nav){
  const existing=Array.from(nav.querySelectorAll('a')).filter(function(link){
   const target=new URL(link.href,location.origin);
   return link.hasAttribute('data-equity-tool')||target.origin===url||(target.origin===location.origin&&target.hash==='#company-analysis');
  });
  if(existing.length){const keep=existing.find(function(link){return new URL(link.href,location.origin).hash==='#company-analysis'})||existing[0];existing.forEach(function(link){if(link!==keep)link.remove()});keep.dataset.equityTool='';return;}
  const a=document.createElement('a');a.href=url;a.textContent=names[locale]||'企業分析ツール';a.target='_blank';a.rel='noopener';a.dataset.equityTool='';a.setAttribute('aria-label',a.textContent+' β版（日本語・新しいタブ）');
  const pdf=Array.from(nav.querySelectorAll('a')).find(function(link){return /\/pdf-library(?:\.html)?\/?$/.test(new URL(link.href,location.origin).pathname)});
  const study=Array.from(nav.querySelectorAll('a')).find(function(link){return /\/boki1(?:\.html)?\/?$/.test(new URL(link.href,location.origin).pathname)});const anchor=study||pdf;if(anchor)anchor.insertAdjacentElement('afterend',a);else nav.appendChild(a);
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addAnalysisLink,{once:true});else addAnalysisLink();
})();
