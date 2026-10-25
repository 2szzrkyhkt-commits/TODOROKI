(async () => {
  'use strict';
  const text = {
    ja:['← PDF一覧へ','保存 ↓','表示されない場合は「PDFを直接開く」または「保存」をお試しください。','PDFを直接開く ↗','関連記事へ →','PDFを確認しています…','このPDFは見つかりませんでした。PDF一覧から選び直してください。'],
    en:['← PDF Library','Save ↓','If the document does not appear, open the PDF directly or save it.','Open PDF directly ↗','Related article →','Loading PDF…','PDF not found. Please choose a document from the library.'],
    es:['← Biblioteca PDF','Guardar ↓','Si el documento no aparece, abre el PDF directamente o guárdalo.','Abrir PDF directamente ↗','Artículo relacionado →','Cargando PDF…','PDF no encontrado. Elige un documento de la biblioteca.'],
    pt:['← Biblioteca PDF','Salvar ↓','Se o documento não aparecer, abra o PDF diretamente ou salve-o.','Abrir PDF diretamente ↗','Artigo relacionado →','Carregando PDF…','PDF não encontrado. Escolha um documento na biblioteca.'],
    'zh-Hans':['← PDF资料库','保存 ↓','如果无法显示，请直接打开或保存PDF。','直接打开PDF ↗','相关文章 →','正在加载PDF…','找不到PDF。请返回资料库重新选择。'],
    'zh-Hant':['← PDF資料庫','儲存 ↓','如果無法顯示，請直接開啟或儲存PDF。','直接開啟PDF ↗','相關文章 →','正在載入PDF…','找不到PDF。請返回資料庫重新選擇。']
  };
  const query = new URLSearchParams(location.search);
  const lang = Object.hasOwn(text, query.get('lang')) ? query.get('lang') : 'ja';
  const t = text[lang], base = lang === 'ja' ? '/' : '/' + lang + '/';
  document.documentElement.lang = lang;
  const get = id => document.getElementById(id);
  const state = new URLSearchParams();
  if (query.get('category') && query.get('category') !== 'all') state.set('category', query.get('category'));
  if (query.get('q')) state.set('q', query.get('q'));
  get('home').href = base;
  get('back').href = base + 'pdf-library.html' + (state.size ? '?' + state : '');
  ['back','download','help','direct','article','status'].forEach((id,i) => get(id).textContent = t[i]);
  try {
    const response = await fetch('/assets/pdf-catalog.json');
    if (!response.ok) throw new Error('catalog');
    const catalog = await response.json();
    const url = new URL(query.get('file') || '', location.origin);
    const path = decodeURIComponent(url.pathname);
    if (url.origin !== location.origin || url.search || !Object.hasOwn(catalog,path)) throw new Error('file');
    const item = catalog[path];
    get('title').textContent = item.title; document.title = item.title + '｜TODOROKI';
    for (const id of ['direct','download']) {get(id).href = url.pathname;get(id).hidden = false;}
    get('download').download = path.split('/').pop();
    const frame = document.createElement('iframe');
    frame.title = item.title;frame.src = url.pathname + '#view=FitH';
    get('document').append(frame); get('status').textContent = '';
    const articles = {
      'MBOを狙う_企業価値と株価の差を読む.pdf':'mbo-investing.html', 'mbo.pdf':'mbo-investing.html',
      '日本企業_M&A産業再編_黒金4P.pdf':'business-ma.html','japan-ma.pdf':'business-ma.html',
      'dotsとは何か_常時稼働AIの仕組みと使い方.pdf':'dots.html',
      'GPT-6_Astraとは_特徴と活用法.pdf':'gpt-6-astra.html',
      'PHPの重大な脆弱性と対策_PHP2Shell.pdf':'php2shell.html',
      '割引効用理論_黒金_改訂版.pdf':'discounted-utility.html',
      '社会的選好と情報共有_仕事仲間の協力_改訂版.pdf':'social-preferences.html'
    };
    const related = articles[path.split('/').pop()];
    if (related) {get('article').href = base + related;get('article').hidden = false;}
  } catch {
    get('status').textContent = t[6];get('help').hidden = true;
  }
})();
