// Run after changing a library's titleMap or translatedPDFs.
// Keeps first-response HTML and the PDF sitemap aligned with the live renderer.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
class Element {
 constructor(tag='div'){this.tag=tag;this.children=[];this.value='';this.options=[];this.style={};this.textContent='';}
 append(...nodes){this.children.push(...nodes);}
 appendChild(node){this.append(node);return node;}
 replaceChildren(...nodes){this.children=nodes;this.textContent='';}
 addEventListener(){}
 toHTML(){const attrs=[];for(const [key,val] of Object.entries(this)){const attr={className:'class',href:'href',rel:'rel',download:'download'}[key];if(attr)attrs.push(`${attr}="${escape(val)}"`);}if(this.style.cssText)attrs.push(`style="${escape(this.style.cssText)}"`);return `<${this.tag}${attrs.length?' '+attrs.join(' '):''}>${escape(this.textContent)}${this.children.map(n=>typeof n==='string'?escape(n):n.toHTML()).join('')}</${this.tag}>`;}
}
const pdfs=new Set();
for(const lang of ['ja','en','es','pt','zh-Hans','zh-Hant']){
 const filename=lang==='ja'?'pdf-library.html':`${lang}/pdf-library.html`;
 const p=path.join(root,filename);let html=fs.readFileSync(p,'utf8');
 const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('const titleMap'));
 if(!script)throw Error(`Missing library renderer: ${filename}`);
 const nodes=Object.fromEntries(['grid','count','search','category','status'].map(id=>[id,new Element()]));
 nodes.category.value='all';nodes.category.options=[...html.matchAll(/<option value="([^"]+)"/g)].map(m=>({value:m[1]}));
 const document={getElementById:id=>{if(!nodes[id])throw Error(`Unknown element ${id}`);return nodes[id];},createElement:tag=>new Element(tag),documentElement:{lang}};
 const context={document,URLSearchParams,location:{search:'',pathname:'/'+filename.replace(/\.html$/,'')},history:{replaceState(){}}};
 vm.runInNewContext(script,context,{timeout:5000});
 if(!nodes.grid.children.length)throw Error(`Empty library: ${filename}`);
 const markup=nodes.grid.children.map(n=>n.toHTML()).join('\n');
 const marked=`<!-- pdf-discovery:start -->\n${markup}\n<!-- pdf-discovery:end -->`;
 if(html.includes('<!-- pdf-discovery:start -->'))html=html.replace(/<!-- pdf-discovery:start -->[\s\S]*?<!-- pdf-discovery:end -->/,marked);
 else{const grid=/<div\b[^>]*\bid="grid"[^>]*>\s*<\/div>/;if(!grid.test(html))throw Error(`Missing empty grid: ${filename}`);html=html.replace(grid,m=>m.replace(/>\s*<\/div>$/,`>\n${marked}\n</div>`));}
 html=html.replace(/(<(?:div|p)\b[^>]*id="count"[^>]*>)[\s\S]*?(<\/(?:div|p)>)/,(_,open,close)=>open+escape(nodes.count.textContent)+close);
 html=html.replace(/(<div id="status">)[\s\S]*?(<\/div>)/,'$1$2');
 fs.writeFileSync(p,html);
 for(const card of nodes.grid.children){const walk=node=>{if(typeof node==='string')return;if(node.href?.startsWith('/pdf/')){const raw=new URL(node.href,'https://todoroki-gold.com').pathname;const local=path.join(root,decodeURIComponent(raw));if(!fs.existsSync(local))throw Error(`Missing PDF ${raw}`);pdfs.add('https://todoroki-gold.com'+raw);}node.children.forEach(walk);};walk(card);}
 console.log(`${filename}: ${nodes.grid.children.length} static cards`);
}
const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...pdfs].sort().map(url=>`  <url><loc>${escape(url)}</loc></url>`).join('\n')}\n</urlset>\n`;
fs.writeFileSync(path.join(root,'sitemap-pdfs.xml'),xml);
console.log(`sitemap-pdfs.xml: ${pdfs.size} linked PDFs`);
