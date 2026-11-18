// Existing build only. No network, credentials, timers, or article rewrites.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const ORIGIN='https://todoroki-gold.com',excluded=new Set(['.git','node_modules','quality-results']);
const attrs=s=>Object.fromEntries([...s.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)].map(m=>[m[1].toLowerCase(),m[2]??m[3]??m[4]??'']));
const decode=s=>s.replace(/&amp;/g,'&');
async function files(root,rel=''){
 const out=[];
 for(const item of await fs.readdir(path.join(root,rel),{withFileTypes:true})){
  if(excluded.has(item.name)||item.name.startsWith('.'))continue;
  const name=path.posix.join(rel,item.name);
  if(item.isDirectory())out.push(...await files(root,name));
  else if(item.isFile()&&name.endsWith('.html'))out.push(name);
 }return out.sort();
}
export async function synchronize(root=process.cwd(),{check=false}={}){
 const pages=new Map();
 for(const rel of await files(root)){
  const raw=await fs.readFile(path.join(root,rel),'utf8');
  const html=raw.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
  const metas=[...html.matchAll(/<meta\b([^>]*)>/gi)].map(m=>attrs(m[1]));
  if(metas.some(a=>a.name?.toLowerCase()==='robots'&&a.content?.toLowerCase().includes('noindex')))continue;
  const url=ORIGIN+(rel==='index.html'?'/':rel.endsWith('/index.html')?'/'+rel.slice(0,-10):'/'+rel.slice(0,-5));
  const canonicals=[...html.matchAll(/<link\b([^>]*)>/gi)].map(m=>attrs(m[1])).filter(a=>a.rel==='canonical').map(a=>decode(a.href||''));
  if(canonicals.length!==1||canonicals[0]!==url)throw Error('Invalid source canonical: '+rel);
  const title=raw.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1].replace(/<[^>]*>/g,'').trim();
  if(!title)throw Error('Missing source title: '+rel);
  pages.set(url,{path:url.slice(ORIGIN.length),title});
 }
 const xmlPath=path.join(root,'sitemap.xml'),htmlPath=path.join(root,'site-map.html');
 const oldXML=await fs.readFile(xmlPath,'utf8'),oldHTML=await fs.readFile(htmlPath,'utf8');
 const urls=[...oldXML.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>decode(m[1].trim()));
 if(new Set(urls).size!==urls.length||urls.some(u=>!pages.has(u)))throw Error('Existing sitemap has duplicate or non-indexable URLs; review required');
 const missing=[...pages.keys()].filter(u=>!urls.includes(u)).sort();
 if(!oldXML.includes('</urlset>'))throw Error('Missing XML insertion point');
 const xml=oldXML.replace('</urlset>',missing.map(u=>'  <url><loc>'+u.replace(/&/g,'&amp;')+'</loc></url>\n').join('')+'</urlset>');
 const list=oldHTML.split('<div id="site-map-entries">')[1]?.split('</div></main>')[0];
 if(list==null)throw Error('Missing HTML discovery insertion point');
 const linked=[...list.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(m=>decode(m[1]));
 if(linked.some(p=>!pages.has(ORIGIN+p)))throw Error('Existing HTML discovery has an unknown page; review required');
 const rows=[...pages.values()].filter(p=>!linked.includes(p.path)).map(p=>'<li><a href="'+p.path.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'">'+p.title+'</a></li>').join('');
 let html=oldHTML;
 if(rows){const marker='<section id="generated-page-discovery"><h2>追加された記事・ページ</h2><ul>';
  if(html.includes(marker))html=html.replace(/(<section id="generated-page-discovery">[\s\S]*?<ul>)([\s\S]*?)(<\/ul><\/section>)/,(_,a,b,c)=>a+b+rows+c);
  else html=html.replace('</div></main>',marker+rows+'</ul></section></div></main>');
 }
 html=html.replace(/(<p id="page-search-count"[^>]*>)\d+ページを掲載(<\/p>)/,(_,a,b)=>a+pages.size+'ページを掲載'+b);
 if(!html.includes('>'+pages.size+'ページを掲載</p>'))throw Error('Missing static page counter');
 const changed=xml!==oldXML||html!==oldHTML;
 if(check&&changed)throw Error('Page discovery requires synchronization');
 if(!check&&changed){await fs.writeFile(xmlPath,xml);await fs.writeFile(htmlPath,html);}
 return {pages:pages.size,existing_urls_retained:urls.length,added_xml_urls:missing.length,changed};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 console.log(JSON.stringify(await synchronize(process.cwd(),{check:process.argv.includes('--check')})));
}
