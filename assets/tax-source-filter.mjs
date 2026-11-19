// Static filter remains usable when the optional public metadata request fails.
export const normalize = value => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('ja');
export function matches(kind, title, selected, query) {
 return (selected === 'all' || selected === kind) && normalize(title).includes(normalize(query));
}
export function initialize(root) {
 const kind=root.querySelector('#tax-source-kind'),query=root.querySelector('#tax-source-query');
 const count=root.querySelector('#tax-source-count'),empty=root.querySelector('#tax-source-empty');
 const update=()=>{const rows=[...root.querySelectorAll('[data-tax-source-kind]')];let shown=0;for(const row of rows){row.hidden=!matches(row.dataset.taxSourceKind,row.querySelector('a').textContent,kind.value,query.value);if(!row.hidden)shown++;}
 for(const group of root.querySelectorAll('[data-tax-source-group]'))group.hidden=![...group.querySelectorAll('[data-tax-source-kind]')].some(row=>!row.hidden);
 count.textContent=`${shown}件表示／全${rows.length}件`;empty.hidden=shown!==0;};
 kind.addEventListener('change',update);query.addEventListener('input',update);kind.disabled=false;query.disabled=false;update();return update;
}
if(typeof document!=='undefined'){const root=document.getElementById('tax-source-release');if(root){const refresh=initialize(root);import('./tax-public-feed-ui.mjs').then(m=>m.enhance(root,refresh)).catch(()=>{});}}

