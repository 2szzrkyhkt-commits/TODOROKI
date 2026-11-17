export function normalizeSearch(value){return String(value||'').normalize('NFKC').toLocaleLowerCase('ja').replace(/[\u30a1-\u30f6]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60)).replace(/\s+/g,' ').trim();}
export function pageLanguage(path){const prefix=String(path).split('/')[1];return ['en','es','pt','zh-Hans','zh-Hant'].includes(prefix)?prefix:'ja';}
export function matchesPage(text,path,query,language='all'){
 if(language!=='all'&&pageLanguage(path)!==language)return false;
 const haystack=normalizeSearch(text+' '+path),tokens=normalizeSearch(query).split(' ').filter(Boolean);
 return tokens.every(token=>haystack.includes(token));
}
