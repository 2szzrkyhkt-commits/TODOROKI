// Rendered-image decoding only; not an audit of all assets or responsive art direction.
export function imageState({complete,naturalWidth},status){
 if(complete&&naturalWidth>0)return 'ready';
 if([401,403,429].includes(status)||!complete)return 'unverified';
 if(Number.isInteger(status)&&status>=200&&status<600)return 'broken';
 return 'unverified';
}

export function imageInspector(page,{timeoutMs=2000,budgetMs=10000,maxImages=100}={}){
 const statuses=new Map();
 page.on('response',r=>{if(r.request().resourceType()==='image')statuses.set(r.url(),r.status())});
 return async()=>{
  const before=await page.evaluate(()=>({x:scrollX,y:scrollY}));
  const result={ready:[],broken:[],unverified:[],excludedHidden:0};
  const deadline=Date.now()+budgetMs;
  const images=await page.locator('img').all();
  try{for(const [index,img] of images.entries()){
   if(index>=maxImages){result.unverified.push({reason:'image_limit',count:images.length-index});break}
   let state=await img.evaluate(e=>{
    let hidden=false;for(let p=e;p;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse'){hidden=true;break}}
    return {hidden,src:e.currentSrc||e.getAttribute('src')||'',complete:e.complete,naturalWidth:e.naturalWidth};
   });
   if(state.hidden){result.excludedHidden++;continue}
   const inline=state.src.startsWith('data:');
   const src=inline?'inline-image':state.src;
   if(!src){result.unverified.push({reason:'unselected_source'});continue}
   let target;try{target=new URL(state.src,page.url())}catch{result.unverified.push({src,reason:'invalid_source'});continue}
   const own=target.origin===new URL(page.url()).origin;
   if(!state.complete){
    if(!own&&!inline){result.unverified.push({reason:'external_image_not_probed'});continue}
    if(Date.now()>=deadline){result.unverified.push({src,reason:'page_budget'});continue}
    try{
     await img.scrollIntoViewIfNeeded({timeout:Math.min(timeoutMs,Math.max(1,deadline-Date.now()))});
     await img.evaluate(async(e,ms)=>{let timer;try{await Promise.race([e.decode(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('decode timeout')),ms)})])}catch{}finally{clearTimeout(timer)}},Math.min(timeoutMs,Math.max(1,deadline-Date.now())));
    }catch{}
    state=await img.evaluate(e=>({src:e.currentSrc||e.getAttribute('src')||'',complete:e.complete,naturalWidth:e.naturalWidth}));
    if(!inline&&state.src!==target.href&&state.src!==src){result.unverified.push({src,reason:'source_changed'});continue}
   }
   const status=statuses.get(target.href);
   const kind=imageState(state,status);
   result[kind].push({src,...(status===undefined?{}:{status})});
  }}finally{
   await page.evaluate(p=>window.scrollTo(p.x,p.y),before);
   await page.waitForFunction(p=>Math.abs(scrollX-p.x)<1&&Math.abs(scrollY-p.y)<1,before,{timeout:2000});
  }
  return result;
 };
}
