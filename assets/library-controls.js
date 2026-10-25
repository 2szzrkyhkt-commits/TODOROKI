(() => {
  'use strict';
  const labels = {
    ja: ['条件をクリア', '該当する資料はありません。検索語やカテゴリを変えてください。'],
    en: ['Clear filters', 'No documents found. Try another search or category.'],
    es: ['Borrar filtros', 'No se encontraron documentos. Cambia la búsqueda o la categoría.'],
    pt: ['Limpar filtros', 'Nenhum documento encontrado. Tente outra busca ou categoria.'],
    'zh-Hans': ['清除筛选', '没有找到资料。请更换搜索词或类别。'],
    'zh-Hant': ['清除篩選', '沒有找到資料。請更換搜尋詞或類別。']
  };
  const t = labels[document.documentElement.lang] || labels.en;
  const controls = document.querySelector('.controls');
  const input = document.getElementById('search');
  const category = document.getElementById('category');
  const count = document.getElementById('count');
  const grid = document.getElementById('grid');
  if (!controls || !input || !category || !grid) return;
  const reset = document.createElement('button');
  reset.type = 'button'; reset.textContent = t[0];
  reset.style.cssText = 'min-height:44px;padding:10px 16px;border:1px solid #78612e;border-radius:6px;background:#17140d;color:#f4d77b;font:inherit;cursor:pointer';
  controls.append(reset);
  const empty = document.getElementById('status') || document.createElement('p');
  if (!empty.id) { empty.id = 'library-empty'; grid.after(empty); }
  const refresh = () => {
    reset.hidden = !input.value && category.value === 'all';
    empty.textContent = grid.children.length ? '' : t[1];
  };
  count.setAttribute('role', 'status'); count.setAttribute('aria-live', 'polite');
  reset.addEventListener('click', () => {
    input.value = ''; category.value = 'all';
    input.dispatchEvent(new Event('input', {bubbles:true})); input.focus();
  });
  input.addEventListener('input', refresh); category.addEventListener('change', refresh);
  refresh();
})();
