import {matchesPage} from './page-search.mjs';
const list=document.querySelector('#site-map-entries'),form=document.querySelector('#page-search-form');
const query=document.querySelector('#page-query'),language=document.querySelector('#page-language'),count=document.querySelector('#page-search-count'),empty=document.querySelector('#page-search-empty');
const items=[...list.querySelectorAll('li')].map(node=>({node,link:node.querySelector('a[href]'),text:node.textContent})).filter(x=>x.link);
const groups=[...list.querySelectorAll('section')];
function update(){
 const found=new Set();
 for(const item of items){const path=item.link.getAttribute('href'),match=matchesPage(item.text,path,query.value,language.value);item.node.hidden=!match;if(match)found.add(path);}
 for(const group of groups)group.hidden=![...group.querySelectorAll('li')].some(li=>!li.hidden);
 count.textContent=found.size+'ページが該当';empty.hidden=found.size!==0;
}
for(const control of form.elements)control.disabled=false;
form.addEventListener('submit',event=>{event.preventDefault();update();});
query.addEventListener('input',update);language.addEventListener('change',update);
form.addEventListener('reset',event=>{event.preventDefault();query.value='';language.value='all';update();query.focus();});
update();
