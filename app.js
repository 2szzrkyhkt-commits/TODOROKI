const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const labels={investment:'投資・市場',economy:'経済・金融',business:'企業・経営',technology:'科学・技術',psychology:'心理・行動'};
const params=new URLSearchParams(location.search), state={q:params.get('q')||'',theme:params.get('theme')||document.body.dataset.theme||'all',type:params.get('type')||document.body.dataset.type||'all',sort:params.get('sort')||'recommended',limit:12};
if(!['all',...Object.keys(labels)].includes(state.theme))state.theme='all';if(!['all','article','pdf','saved'].includes(state.type))state.type='all';if(!['recommended','title'].includes(state.sort))state.sort='recommended';
let data=[],saved=new Set();try{saved=new Set(JSON.parse(localStorage.getItem('todoroki-saved')||'[]'))}catch{}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bookmark='<svg viewBox="0 0 18 22" aria-hidden="true"><path d="M3 2h12v18l-6-4-6 4z"/></svg>';
function toast(msg){$('#toast').textContent=msg;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,2400)}
function save(id,btn){if(saved.has(id))saved.delete(id);else saved.add(id);try{localStorage.setItem('todoroki-saved',JSON.stringify([...saved]))}catch{toast('この環境では保存を保持できません');return}btn.setAttribute('aria-pressed',saved.has(id));btn.setAttribute('aria-label',saved.has(id)?'保存を解除':'あとで読むに保存');toast(saved.has(id)?'「保存したもの」に追加しました':'保存を解除しました');if(state.type==='saved'&&!params.get('read')&&!document.body.dataset.read)render()}
function url(id){const doc=data.find(x=>x.id===id);if(doc?.url){const p=new URLSearchParams();if(state.q)p.set('q',state.q);if(state.theme!=='all')p.set('theme',state.theme);if(state.type!=='all')p.set('type',state.type);if(state.sort!=='recommended')p.set('sort',state.sort);return doc.url+(p.size?'?'+p:'')} const p=new URLSearchParams();if(state.q)p.set('q',state.q);if(state.theme!=='all')p.set('theme',state.theme);if(state.type!=='all')p.set('type',state.type);if(state.sort!=='recommended')p.set('sort',state.sort);p.set('read',id);return '/?'+p}
function backUrl(){const p=new URLSearchParams();if(state.q)p.set('q',state.q);if(state.theme!=='all')p.set('theme',state.theme);if(state.type!=='all')p.set('type',state.type);if(state.sort!=='recommended')p.set('sort',state.sort);return '/'+(p.size?'?'+p:'')+'#library'}
function card(d){return `<article class="content-card ${d.type==='pdf'?'pdf-card':''}"><div class="card-top"><span class="tag">${esc(labels[d.theme])}</span><button class="save" data-save="${d.id}" aria-label="${saved.has(d.id)?'保存を解除':'あとで読むに保存'}" aria-pressed="${saved.has(d.id)}">${bookmark}</button></div><h3><a href="${esc(url(d.id))}">${esc(d.title)}</a></h3><p>${esc(d.description)}</p><div class="card-bottom"><span class="format-label">${d.type==='article'?'ARTICLE <span>／ 約'+d.minutes+'分</span>':'黒金PDF <span>／ '+d.pages+'ページ</span>'}</span><b aria-hidden="true">↗</b></div></article>`}
function bindSave(root=document){root.querySelectorAll('[data-save]').forEach(b=>b.addEventListener('click',()=>save(b.dataset.save,b)))}
function trackEvent(name,details={}){
  try{
    if(typeof window.gtag==='function')window.gtag('event',name,{...details,page_path:location.pathname,transport_type:'beacon'});
  }catch{}
}
document.addEventListener('click',event=>{
  const link=event.target?.closest?.('a[href]');
  if(!link)return;
  const target=new URL(link.href,location.origin);
  if(target.origin!==location.origin)return;
  if(link.hasAttribute('download')&&target.pathname.startsWith('/pdf/')&&/\.pdf$/i.test(target.pathname)){
    let path;try{path=decodeURI(target.pathname)}catch{return;}
    const doc=data.find(d=>d.type==='pdf'&&d.file===path);
    const id=doc?.id||(document.body.dataset.read?.startsWith('pdf-')?document.body.dataset.read:undefined);
    trackEvent('pdf_download_click',{...(id?{content_id:id}:{}),file_path:target.pathname});
  }else if(/^\/premium(?:\.html)?\/?$/.test(target.pathname)){
    trackEvent('premium_detail_click',{destination_path:target.pathname});
  }
});
function updateURL(){const p=new URLSearchParams();if(state.q)p.set('q',state.q);if(state.type!=='all')p.set('type',state.type);if(state.theme!=='all')p.set('theme',state.theme);if(state.sort!=='recommended')p.set('sort',state.sort);history.replaceState(null,'',location.pathname+(p.size?'?'+p:'')+location.hash)}
function render(){const terms=state.q.normalize('NFKC').toLowerCase().split(/\s+/).filter(Boolean);let shown=data.filter(d=>(state.theme==='all'||d.theme===state.theme)&&(state.type==='all'||(state.type==='saved'?saved.has(d.id):d.type===state.type))&&terms.every(t=>(d.title+' '+d.description+' '+d.keywords).normalize('NFKC').toLowerCase().includes(t)));if(state.sort==='title')shown.sort((a,b)=>a.title.localeCompare(b.title,'ja'));$('#grid').innerHTML=shown.slice(0,state.limit).map(card).join('');$('#result-count').textContent=(state.q?'「'+state.q+'」の検索結果　':'')+shown.length+'件'+(shown.length>state.limit?' ／ '+Math.min(state.limit,shown.length)+'件を表示':'');$('#more').hidden=shown.length<=state.limit;$('#empty').hidden=shown.length>0;$('#clear').hidden=!state.q&&state.theme==='all'&&state.type==='all';$$('[data-type]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.type===state.type));$$('[data-theme]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.theme===state.theme));bindSave($('#grid'));updateURL()}
function reset(){Object.assign(state,{q:'',theme:'all',type:'all',limit:12});$('#search').value='';render()}
function related(d){const rank=x=>{let score=x.theme===d.theme?10:0;const ts=(d.title+' '+d.description).match(/[一-龠ぁ-んァ-ン]{2,}|[a-zA-Z]{2,}/g)||[];for(const t of ts)if((x.title+' '+x.keywords).includes(t))score++;return score};const items=data.filter(x=>x.id!==d.id).sort((a,b)=>rank(b)-rank(a)).slice(0,3);return `<section class="related"><p class="eyebrow">KEEP EXPLORING</p><h2>このテーマを、もう少し。</h2><div class="content-grid">${items.map(card).join('')}</div><p><a class="text-button" href="/${d.theme}-list.html">${labels[d.theme]}のコンテンツをすべて見る →</a></p></section>`}
async function showReader(d){$('#home').hidden=true;$('#reader').hidden=false;document.title=d.title+'｜TODOROKI';let body=d.body||'';let toc='';if(d.type==='article'){const dom=new DOMParser().parseFromString(body,'text/html');const hs=[...dom.querySelectorAll('h2')];hs.forEach((h,i)=>h.id='chapter-'+i);toc=`<details class="toc"><summary>この記事の目次</summary><ol>${hs.map((h,i)=>`<li><a href="#chapter-${i}">${esc(h.textContent)}</a></li>`).join('')}</ol></details>`;body=dom.body.innerHTML}
$('#reader').innerHTML=`<div class="breadcrumb"><a href="${esc(backUrl())}">← コンテンツ一覧へ</a><span>/</span><a href="/${d.theme}-list.html">${labels[d.theme]}</a><span>/ ${d.type==='pdf'?'黒金PDF':'記事'}</span></div><div class="reader-heading"><span class="tag">${labels[d.theme]} / ${d.type==='pdf'?'BLACK & GOLD PDF':'ARTICLE'}</span><h1>${esc(d.title)}</h1><div class="reader-meta"><span>${d.type==='pdf'?d.pages+'ページ / '+(d.size/1024).toFixed(0)+' KB':'約'+d.minutes+'分で読めます'}</span><span>TODOROKI</span></div><div class="reader-actions"><button class="button outline" id="reader-save" data-save="${d.id}" aria-pressed="${saved.has(d.id)}">${bookmark}<span>あとで読む</span></button>${d.type==='pdf'?`<a class="button gold" href="${esc(encodeURI(d.file))}" download>PDFをダウンロード ↓</a><a class="button outline" href="${esc(encodeURI(d.file))}" target="_blank" rel="noopener">別タブで開く ↗</a>`:''}</div></div>${d.type==='article'?toc+`<article class="article-body">${body}</article>`:`<div class="pdf-toolbar" aria-label="PDFページ操作"><button id="prev" disabled aria-label="前のページ">←</button><span id="page-count" aria-live="polite">読み込み中</span><button id="next" disabled aria-label="次のページ">→</button><label class="sr-only" for="zoom">表示倍率</label><select id="zoom"><option value="fit">画面に合わせる</option><option value="1">100%</option><option value="1.5">150%</option></select></div><div class="canvas-wrap"><canvas id="pdf-canvas" role="img" aria-label="PDFページ"></canvas><p id="pdf-status" class="pdf-status" role="status">PDFを読み込んでいます…</p></div><p class="pdf-note">サイト内で閲覧できます。表示が難しい場合は「別タブで開く」または「ダウンロード」をご利用ください。</p><details class="pdf-text"><summary>このページのテキストを読む</summary><p id="pdf-page-text"></p></details>`}${d.type==='pdf'?'<details class="pdf-transcript"><summary>収録内容をテキストで読む</summary><p>'+esc(d.keywords)+'</p></details>':''}${related(d)}`;
bindSave($('#reader'));if(d.type==='pdf')await loadPDF(d)}
async function loadPDF(d){const status=$('#pdf-status');try{const lib=await import('/vendor/pdf.mjs');lib.GlobalWorkerOptions.workerSrc='/vendor/pdf.worker.mjs';const pdf=await lib.getDocument({url:encodeURI(d.file),isEvalSupported:false}).promise;let number=1,busy=false,pending=false;const canvas=$('#pdf-canvas');async function paint(){if(busy){pending=true;return}busy=true;$('#prev').disabled=true;$('#next').disabled=true;status.hidden=false;status.textContent='ページを表示しています…';try{const page=await pdf.getPage(number),base=page.getViewport({scale:1}),width=$('.canvas-wrap').clientWidth-32,chosen=$('#zoom').value;const scale=chosen==='fit'?Math.min(width/base.width,1.7):Number(chosen);const view=page.getViewport({scale}),pixel=Math.min(devicePixelRatio||1,2);canvas.width=Math.floor(view.width*pixel);canvas.height=Math.floor(view.height*pixel);canvas.style.width=view.width+'px';canvas.style.height=view.height+'px';await page.render({canvasContext:canvas.getContext('2d'),viewport:view,transform:[pixel,0,0,pixel,0,0]}).promise;const txt=await page.getTextContent();$('#pdf-page-text').textContent=txt.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('');canvas.setAttribute('aria-label',d.title+' '+number+'ページ目');$('#page-count').textContent=number+' / '+pdf.numPages+' ページ';status.hidden=true;}catch(err){status.textContent='このページを表示できません。別タブまたはダウンロードでご覧ください。';console.error(err)}finally{busy=false;$('#prev').disabled=number===1;$('#next').disabled=number===pdf.numPages;if(pending){pending=false;await paint()}}}
$('#prev').onclick=()=>{if(number>1){number--;paint()}};$('#next').onclick=()=>{if(number<pdf.numPages){number++;paint()}};$('#zoom').onchange=paint;let timer;addEventListener('resize',()=>{clearTimeout(timer);timer=setTimeout(paint,180)});await paint()}catch(err){status.textContent='PDFを読み込めませんでした。「別タブで開く」からご覧ください。';console.error(err)}}
function showInfo(name){location.replace(name==='privacy'?'/privacy.html':'/about.html')}
async function init(){
  // Informational pages already contain their complete static content.
  if(document.body.dataset.info)return;
  if(params.has('page')&&!params.has('read')&&!document.body.dataset.read){showInfo(params.get('page'));return;}
  try{
    const r=await fetch('/content.json');if(!r.ok)throw Error('content');data=await r.json();
    if(params.has('read')||document.body.dataset.read){
      const d=data.find(x=>x.id===(params.get('read')||document.body.dataset.read));
      if(d)await showReader(d);
      else{$('#home').hidden=true;$('#info').hidden=false;$('#info').innerHTML='<h1>コンテンツが見つかりません</h1><p><a class="button gold" href="/#library">一覧から探す</a></p>';}
    }else{
      $('#search').value=state.q;$('#sort').value=state.sort;render();
      if(location.hash==='#library')requestAnimationFrame(()=>$('#library').scrollIntoView());
    }
  }catch(e){
    // Keep the existing article, PDF links and list usable when loading fails.
    const count=$('#result-count');
    if(count)count.textContent='検索データを読み込めませんでした。表示中のリンクから閲覧できます。';
    else toast('追加データを読み込めませんでした。再読み込みしてお試しください。');
    console.error(e);
  }
}
$('#search-form')?.addEventListener('submit',e=>{e.preventDefault();state.q=$('#search').value.trim();state.limit=12;render()});let searchTimer;$('#search')?.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.q=$('#search').value.trim();state.limit=12;render()},220)});$$('[data-type]').forEach(b=>b.onclick=()=>{state.type=b.dataset.type;state.limit=12;render()});$$('[data-theme]').forEach(b=>b.onclick=()=>{state.theme=b.dataset.theme;state.limit=12;render()});if($('#sort'))$('#sort').onchange=()=>{state.sort=$('#sort').value;render()};if($('#clear'))$('#clear').onclick=reset;if($('#empty-reset'))$('#empty-reset').onclick=reset;if($('#more'))$('#more').onclick=()=>{state.limit+=12;render()};init();
