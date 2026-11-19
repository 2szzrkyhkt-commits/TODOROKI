// National Tax Agency sources. No outside-host navigation, forms, scripts or images.
export const NTA_SEEDS = [
  'https://www.nta.go.jp/taxes/shiraberu/taxanswer/code/index.htm',
  'https://www.nta.go.jp/law/tsutatsu/menu.htm',
];
const PREFIX='nta:', MAX_URLS=5000, MAX_BYTES=64*1024*1024;
const NOTICE='国税庁公式索引から辿れるTax Answer・法令解釈通達の収集中。法的適用判断・全資料の網羅・廃止確認ではない。';
export function robotsAllows(text,url) {
  const groups=[];let group=null,hasRules=false;
  for(const line of text.split(/\r?\n/)) {
    const m=line.replace(/#.*$/,'').trim().match(/^([\w-]+)\s*:\s*(.*)$/);if(!m)continue;
    const key=m[1].toLowerCase(),value=m[2].trim();
    if(key==='user-agent'){
      if(!group||hasRules){group={agents:[],rules:[]};groups.push(group);hasRules=false;}
      group.agents.push(value.toLowerCase());
    }else if(group&&['allow','disallow'].includes(key)){hasRules=true;group.rules.push({allow:key==='allow',path:value});}
  }
  if(!groups.length)throw Error('INVALID_ROBOTS');
  const agent='todoroki-tax-collector',specific=groups.filter(g=>g.agents.some(a=>a!=='*'&&agent.includes(a)));
  const selected=specific.length?specific:groups.filter(g=>g.agents.includes('*'));
  const path=new URL(url).pathname;let best=-1,allowed=true;
  for(const g of selected)for(const r of g.rules){
    if(!r.path)continue;
    const exact=r.path.endsWith('$'),pattern=(exact?r.path.slice(0,-1):r.path).split('*').map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*');
    if(new RegExp('^'+pattern+(exact?'$':'')).test(path)){
      const len=r.path.replace(/[\*$]/g,'').length;
      if(len>best||(len===best&&r.allow)){best=len;allowed=r.allow;}
    }
  }
  return allowed;
}
export function ntaURL(value,base=NTA_SEEDS[0]) {
  try {
    const u=new URL(value,base);
    if(u.protocol!=='https:'||u.hostname!=='www.nta.go.jp'||u.port||u.username||u.password||u.search)return null;
    if(!/^\/(?:taxes\/shiraberu\/taxanswer|law\/tsutatsu)\//.test(u.pathname)||!/[.](?:html?|pdf)$/i.test(u.pathname))return null;
    if(/%2f|%5c|%00|%2e/i.test(u.pathname))return null;
    u.hash='';return u.href;
  }catch{return null;}
}
export function ntaLinks(html,base) {
  const found=new Set();
  // Ignore script/comment text, accept quoted and unquoted HTML href attributes.
  const clean=html.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
  for(const m of clean.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    const raw=(m[1]??m[2]??m[3]).replace(/&amp;|&#38;|&#x26;/gi,'&');
    const url=ntaURL(raw,base);if(url)found.add(url);
  }
  return [...found];
}
export function ntaEncoding(bytes,contentType='') {
  const prefix=new TextDecoder().decode(bytes.slice(0,4096));
  return (contentType.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]||prefix.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]||'utf-8').toLowerCase();
}
export function ntaHTML(bytes,contentType='') {
  const charset=ntaEncoding(bytes,contentType);
  const html=new TextDecoder(charset,{fatal:true}).decode(bytes);
  if(!/<html\b/i.test(html)||!/<\/html\s*>/i.test(html)||!/<h1\b/i.test(html)||/<title[^>]*>\s*(?:403|404|Access Denied|Error)/i.test(html))throw Error('INVALID_HTML');
  return html;
}
const sha=async raw=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
async function bounded(r,max) {
  if(!r.body)throw Error('EMPTY_BODY');
  const reader=r.body.getReader(), chunks=[];let size=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw Error('SIZE_LIMIT');chunks.push(value);}}
  finally{await reader.cancel();}
  const out=new Uint8Array(size);let pos=0;for(const c of chunks){out.set(c,pos);pos+=c.length;}return out;
}
async function saveVerified(kv,key,value) {
  await kv.put(key,value);
  const got=await kv.get(key,'arrayBuffer');
  const want=typeof value==='string'?new TextEncoder().encode(value):value;
  if(!got||await sha(got)!==await sha(want))throw Error('READBACK_MISMATCH');
}
// Host-wide cooldown stays in the existing state key. It does not authorize retries.
function rateLimitUntil(header,now,fallback,previous=0) {
  const value=(header||'').trim();let deadline=0;
  if(/^\d+$/.test(value)){
    const seconds=Number(value);deadline=now+seconds*1000;
    if(!Number.isSafeInteger(deadline)||deadline>8640000000000000)throw Error('RETRY_AFTER_UNREPRESENTABLE');
  }else if(/^(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT|(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), \d{2}-[A-Z][a-z]{2}-\d{2} \d{2}:\d{2}:\d{2} GMT|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) [A-Z][a-z]{2} [ \d]\d \d{2}:\d{2}:\d{2} \d{4})$/.test(value)){
    const date=Date.parse(value);if(Number.isFinite(date))deadline=date;
  }
  return Math.max(previous||0,fallback,deadline);
}
export async function ntaTick(env,{fetcher=fetch,now,clock}={}) {
  // Explicit now keeps existing fixtures deterministic; production samples real
  // time again at response receipt rather than shortening Retry-After by latency.
  const readClock=clock||(now===undefined?()=>Date.now():()=>now);
  now??=readClock();
  const kv=env.TAX;
  let state=await kv.get(PREFIX+'state','json')||{schema:1,queue:NTA_SEEDS.map(url=>({url,attempts:0,due:0})),known:[...NTA_SEEDS],saved:0,bytes:0,scans:0};
  let report={at:new Date(now).toISOString(),state:'collecting',saved:0,checked:0,failed:[],verified:[],notice:NOTICE};
  if(state.blocked||state.rate_limit_until>now||state.next_at>now)return {...report,state:state.blocked?'blocked':state.rate_limit_until>now?'rate_limited':'waiting',...summary(state,now)};
  let robotsReady=true;
  if(!state.robots||now-state.robots.at>=24*3600000){
    try{
      const r=await fetcher('https://www.nta.go.jp/robots.txt',{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{'User-Agent':'TODOROKI-Tax-Collector/1.0'}});
      const receivedAt=Math.max(now,readClock());
      if(r.status===401||r.status===403){state.blocked='UPSTREAM_ACCESS_DENIED';throw Error('HTTP_'+r.status);}
      if(r.status===429){
        try{state.rate_limit_until=rateLimitUntil(r.headers.get('retry-after'),receivedAt,receivedAt+3600000,state.rate_limit_until);}
        catch(e){state.blocked='RETRY_AFTER_UNREPRESENTABLE';throw e;}
        throw Error('HTTP_429');
      }
      if(r.status!==200)throw Error('ROBOTS_HTTP');
      const raw=await bounded(r,64*1024),text=new TextDecoder('utf-8',{fatal:true}).decode(raw);
      robotsAllows(text,NTA_SEEDS[0]);state.robots={at:now,text,sha256:await sha(raw)};
    }catch(e){robotsReady=false;report.failed.push({url:'https://www.nta.go.jp/robots.txt',code:/^(HTTP_(401|403|429)|RETRY_AFTER_UNREPRESENTABLE)$/.test(e.message)?e.message:'ROBOTS_UNAVAILABLE'});}
  }
  const knownURLs=new Set(state.known);
  // Two documents at most, plus one robots refresh per day, on the existing cadence.
  for(let n=0;robotsReady&&n<2;n++) {
    // Existing queues may contain hundreds of Tax Answer URLs before any circular.
    // Alternate families without adding requests or moving not-yet-due failures.
    const family=url=>new URL(url).pathname.startsWith('/law/tsutatsu/')?'tsutatsu':'taxanswer';
    let at=state.queue.findIndex(q=>q.due<=now&&family(q.url)===(state.next_family||'taxanswer'));
    if(at<0)at=state.queue.findIndex(q=>q.due<=now);if(at<0)break;
    const item=state.queue[at];if(!ntaURL(item.url))throw Error('INVALID_QUEUE_URL');
    const selectedFamily=family(item.url);
    state.next_family=selectedFamily==='taxanswer'?'tsutatsu':'taxanswer';
    try {
      if(!robotsAllows(state.robots.text,item.url)){state.blocked='ROBOTS_DISALLOW';throw Error('ROBOTS_DISALLOW');}
      const r=await fetcher(item.url,{redirect:'manual',headers:{'User-Agent':'TODOROKI-Tax-Collector/1.0','Accept':'text/html,application/pdf'},signal:AbortSignal.timeout(15000)});
      const receivedAt=Math.max(now,readClock());
      report.checked++;
      if(r.status===401||r.status===403){state.blocked='UPSTREAM_ACCESS_DENIED';throw Error('HTTP_'+r.status);}
      if(r.status!==200){
        const error=Error('HTTP_'+r.status),retry=r.headers.get('retry-after');
        if(r.status===429){error.rateLimited=true;error.retryAfter=retry;error.receivedAt=receivedAt;}
        else if(retry){const seconds=Number(retry),date=Date.parse(retry);error.retryAt=Number.isFinite(seconds)&&seconds>=0?now+seconds*1000:Number.isFinite(date)?date:0;}
        throw error;
      }
      const type=r.headers.get('content-type')||'',pdf=/[.]pdf$/i.test(item.url);
      if(!(pdf?/^application\/pdf\b/i:/^text\/html\b/i).test(type))throw Error('CONTENT_TYPE');
      const raw=await bounded(r,pdf?4*1024*1024:1024*1024);
      let html=null;
      if(pdf){if(new TextDecoder().decode(raw.slice(0,5))!=='%PDF-'||!new TextDecoder().decode(raw.slice(-1024)).includes('%%EOF'))throw Error('INVALID_PDF');}
      else html=ntaHTML(raw,type);
      const links=html?ntaLinks(html,item.url):[];
      const additions=links.filter(u=>!knownURLs.has(u));
      if(state.known.length+additions.length>MAX_URLS){state.blocked='URL_BUDGET';throw Error('URL_BUDGET');}
      const id=await sha(new TextEncoder().encode(item.url)),hash=await sha(raw),key=PREFIX+'raw:'+id+':'+hash;
      const previous=await kv.get(PREFIX+'page:'+id,'json');
      const changed=previous?.sha256!==hash;
      // Queue-local reservations survive failed metadata saves. Never reduce legacy totals.
      const reserved=Array.isArray(item.reserved_raw_keys)&&item.reserved_raw_keys.includes(key);
      if(changed&&!reserved&&state.bytes+raw.length>MAX_BYTES){state.blocked='STORAGE_BUDGET';throw Error('STORAGE_BUDGET');}
      const title=html?html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i)?.[1].replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim():null;
      const encoding=pdf?null:ntaEncoding(raw,type);
      const meta={url:item.url,source:'国税庁',source_url:item.url,checked_at:report.at,sha256:hash,bytes:raw.length,raw_key:key,content_type:type,encoding,title:title||'国税庁公式資料',links,license_url:'https://www.nta.go.jp/chuijiko/copy.htm',notice:NOTICE};
      if(changed){
        // Reserve before writing so a failed metadata write cannot undercount storage.
        if(!reserved){
          state.bytes+=raw.length;
          item.reserved_raw_keys=[...(Array.isArray(item.reserved_raw_keys)?item.reserved_raw_keys:[]),key];
        }
        await saveVerified(kv,key,raw);
      }
      else {const old=await kv.get(key,'arrayBuffer');if(!old||await sha(old)!==hash)throw Error('READBACK_MISMATCH');}
      await saveVerified(kv,PREFIX+'page:'+id,JSON.stringify(meta));
      if(changed)report.saved++;
      if(!previous)state.saved++;
      state.queue.splice(at,1);state.known.push(...additions);
      for(const url of additions)knownURLs.add(url);
      state.queue.push(...additions.map(url=>({url,attempts:0,due:0})));
      report.last_verified={url:item.url,sha256:hash,bytes:raw.length,encoding,title:meta.title.slice(0,300),source_family:selectedFamily,readback:true};
      report.verified.push(report.last_verified);
    } catch(e) {
      // Do not rotate/dequeue a failed target or mistake it for a completed scan.
      const code=/^(HTTP_\d+|SIZE_LIMIT|CONTENT_TYPE|INVALID_HTML|INVALID_PDF|READBACK_MISMATCH|URL_BUDGET|STORAGE_BUDGET|ROBOTS_DISALLOW)$/.test(e.message)?e.message:'FETCH_OR_STORAGE_FAILED';
      item.attempts++;item.due=Math.max(Number.isFinite(e.retryAt)?e.retryAt:0,now+Math.min(24*3600000,3600000*2**Math.min(item.attempts-1,5)));
      if(e.rateLimited){
        try{state.rate_limit_until=rateLimitUntil(e.retryAfter,e.receivedAt,Math.max(item.due,e.receivedAt+Math.min(24*3600000,3600000*2**Math.min(item.attempts-1,5))),state.rate_limit_until);item.due=state.rate_limit_until;}
        catch{state.blocked='RETRY_AFTER_UNREPRESENTABLE';}
      }
      report.failed.push({url:item.url,code});
      // A host 429 suppresses the second document, regardless of source family.
      if(state.blocked||e.rateLimited)break;
    }
  }
  if(robotsReady&&!state.blocked&&!(state.rate_limit_until>now)&&!state.queue.length){state.scans++;state.next_at=now+24*3600000;state.queue=state.known.map(url=>({url,attempts:0,due:0}));report.state='scan_complete';}
  const diagnostics=summary(state,now);
  // Priority: permanent block, host cooldown, observed failure, completed scan, due-wait.
  // Queue deadlines are diagnostic only; never advance retries or add requests.
  if(state.blocked)report.state='blocked';else if(state.rate_limit_until>now)report.state='rate_limited';else if(report.failed.length)report.state='retry_wait';
  else if(report.state!=='scan_complete'&&state.queue.length&&diagnostics.due_count===0&&diagnostics.deferred_count===state.queue.length)report.state='retry_wait';
  state.last_run=report.at;
  await saveVerified(kv,PREFIX+'state',JSON.stringify(state));
  report={...report,...diagnostics};
  await saveVerified(kv,PREFIX+'status',JSON.stringify(report));
  return report;
}
function summary(s,now){
  let due_count=0,deferred_count=0,next_retry_at=null;
  // One bounded pass over the existing queue; no URLs or per-target data exposed.
  // next_retry_at is the earliest future queue deadline in epoch milliseconds,
  // not a promise to run then: blocked and next_at still take precedence.
  for(const item of s.queue){
    if(item.due<=now)due_count++;
    else if(item.due>now){deferred_count++;if(next_retry_at===null||item.due<next_retry_at)next_retry_at=item.due;}
  }
  return {known:s.known.length,pages_saved:s.saved,queue_remaining:s.queue.length,stored_version_bytes:s.bytes,completed_scans:s.scans,blocked:s.blocked||null,next_at:s.next_at||null,rate_limit_until:s.rate_limit_until||null,due_count,deferred_count,next_retry_at};
}

