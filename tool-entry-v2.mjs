// Guarded, opt-in proof flows. Uses existing auth_rate_limits schema; no schema creation.
const HOME='https://todoroki-gold.com';
const TOOLS=Object.freeze({
 equity:{origin:'https://todoroki-equity-lab.easysquid66.chatgpt.site',aud:'todoroki-equity-lab',cookie:'__Host-todoroki_equity_source',prefix:'toolv2:'},
 jp:{origin:'https://todoroki-economy-data.easysquid66.chatgpt.site',aud:'todoroki-economy-data',cookie:'__Host-todoroki_jp_source',prefix:'toolv2:jp:'},
 us:{origin:'https://todoroki-us-economy-data.easysquid66.chatgpt.site',aud:'todoroki-us-economy-data',cookie:'__Host-todoroki_us_source',prefix:'toolv2:us:'}
});
const hex=/^[a-f0-9]{64}$/;
const uuid=/^[a-f0-9-]{36}$/;
const encoder=new TextEncoder();
const stamp=()=>Math.floor(Date.now()/1000);
const raw=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
function json(data,status=200){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
const deny=()=>{const r=json({valid:false},403);r.headers.set('X-Todoroki-Verify','v1');r.headers.set('X-Todoroki-Verify-Result','invalid_ticket');return r;};
const unavailable=()=>json({valid:false},503);
export function createEquityV2(deps){return createToolV2(deps,'equity');}
export function createToolV2({sign,hash,toolToken,toolFingerprint},slug){
 if(!Object.hasOwn(TOOLS,slug))throw new Error('Unknown guarded tool');
 const {origin:SITE,aud:AUD,cookie:COOKIE,prefix:PREFIX}=TOOLS[slug];
const cookie=(value,age)=>`${COOKIE}=${value}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`;
function proof(request){const values=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(COOKIE+'='));return values.length===1&&hex.test(values[0].slice(COOKIE.length+1))?values[0].slice(COOKIE.length+1):null;}
function redirect(location,clear=false){const headers={'Location':location,'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};if(clear)headers['Set-Cookie']=cookie('',0);return new Response(null,{status:303,headers});}
 async function seal(secret,p){const b= btoa(String.fromCharCode(...encoder.encode(JSON.stringify(p)))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');return b+'.'+await sign(secret,'tool-'+p.kind+':'+b);}
 async function open(secret,t,kind){
  if(typeof t!=='string'||t.length>1800)return null;const a=t.split('.');if(a.length!==2||!/^[A-Za-z0-9_-]+$/.test(a[0])||!hex.test(a[1]))return null;
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('HMAC',key,Uint8Array.from(a[1].match(/../g),x=>parseInt(x,16)),encoder.encode('tool-'+kind+':'+a[0])))return null;
  try{const p=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(a[0].replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))));
   if(p.kind!==kind||p.aud!==AUD||!uuid.test(p.nonce)||!Number.isInteger(p.exp)||p.exp<=stamp()||p.exp>stamp()+120)return null;
   return p;
  }catch{return null;}
 }
 async function stage(db,nonce,from,to){const row=await db.prepare('UPDATE auth_rate_limits SET hits = ? WHERE id = ? AND hits = ? AND expires_at > ? RETURNING id').bind(to,PREFIX+'intent:'+nonce,from,stamp()).first();return !!row;}
 return {
  async start(request,env){
   // Caller must already pass unchanged v1 origin/metadata admission checks.
   if(!['GET','POST'].includes(request.method))return json({valid:false},405);
   if(/prefetch/i.test((request.headers.get('Sec-Purpose')||'')+' '+(request.headers.get('Purpose')||'')))return deny();
   if(new URL(request.url).origin!==HOME||!env.DB)return unavailable();
   try{
    const ip=request.headers.get('CF-Connecting-IP');if(!ip)return unavailable();
    const day=Math.floor(stamp()/86400),globalKey=PREFIX+'global:'+day;
    // Stop before cleanup or per-IP mutations once the small daily pilot is full.
    const current=await env.DB.prepare('SELECT hits FROM auth_rate_limits WHERE id = ?').bind(globalKey).first();
    if(current&&current.hits>=60)return json({valid:false},429);
    const globalSlot=await env.DB.prepare('INSERT INTO auth_rate_limits (id,hits,expires_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET hits=hits+1 WHERE hits<60 RETURNING id').bind(globalKey,(day+1)*86400).first();
    if(!globalSlot)return json({valid:false},429);
    // Bounded cleanup; never touch login limits or another subsystem's rows.
    await env.DB.prepare("DELETE FROM auth_rate_limits WHERE id IN (SELECT id FROM auth_rate_limits WHERE id LIKE 'toolv2:%' AND expires_at <= ? LIMIT 100)").bind(stamp()).run();
    const bucket=Math.floor(stamp()/60),key=PREFIX+'rate:'+await sign(env.AUTH_SECRET,'tool-v2-rate-ip:'+(slug==='equity'?'':slug+':')+ip+':'+bucket);
    const allowed=await env.DB.prepare('INSERT INTO auth_rate_limits (id,hits,expires_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET hits=hits+1 WHERE hits<5 RETURNING id').bind(key,(bucket+1)*60).first();
    if(!allowed)return json({valid:false},429);
    const source=raw(),nonce=crypto.randomUUID(),exp=stamp()+120;
    const inserted=await env.DB.prepare('INSERT INTO auth_rate_limits (id,hits,expires_at) VALUES (?,0,?) ON CONFLICT(id) DO NOTHING RETURNING id').bind(PREFIX+'intent:'+nonce,exp).first();if(!inserted)return unavailable();
    const t=await seal(env.AUTH_SECRET,{kind:'intent-v2',aud:AUD,nonce,exp,src:await hash(source)});
    const r=redirect(SITE+'/prepare?t='+t);r.headers.set('Set-Cookie',cookie(source,120));return r;
   }catch{return unavailable();}
  },
  async prepare(input,env){
   if(!env.DB||input?.aud!==AUD||typeof input.ua!=='string'||input.ua.length>700||!input.ua||!hex.test(input.destProof||''))return deny();
   try{const p=await open(env.AUTH_SECRET,input.token,'intent-v2');if(!p||!hex.test(p.src||''))return deny();
    const prepared=await seal(env.AUTH_SECRET,{...p,kind:'prepared-v2',dst:input.destProof,ua:await hash(input.ua)});
    if(!await stage(env.DB,p.nonce,0,1))return deny();return json({valid:true,prepared,expires:p.exp});
   }catch{return unavailable();}
  },
  async finish(request,env){
   const url=new URL(request.url);if(url.origin!==HOME)return deny();if(request.method!=='GET')return json({valid:false},405);if(!env.DB)return unavailable();
   try{const source=proof(request);if(!source||url.searchParams.getAll('t').length!==1)return deny();
    const p=await open(env.AUTH_SECRET,url.searchParams.get('t'),'prepared-v2');if(!p||!hex.test(p.src||'')||!hex.test(p.dst||'')||!hex.test(p.ua||'')||p.src!==await hash(source))return deny();
    const t=await seal(env.AUTH_SECRET,{kind:'entry-v2',aud:AUD,nonce:p.nonce,exp:Math.min(stamp()+60,p.exp),dst:p.dst,ua:p.ua});
    if(!await stage(env.DB,p.nonce,1,2))return deny();return redirect(SITE+'/enter?t='+t,true);
   }catch{return unavailable();}
  },
  async enter(input,env){
   if(!env.DB||input?.aud!==AUD||typeof input.ua!=='string'||!input.ua||input.ua.length>700||!hex.test(input.destSecret||''))return deny();
   try{const p=await open(env.AUTH_SECRET,input.token,'entry-v2');if(!p||!hex.test(p.dst||'')||!hex.test(p.ua||'')||p.dst!==await hash(input.destSecret)||p.ua!==await hash(input.ua))return deny();
    const fp=await toolFingerprint(env.AUTH_SECRET,input.ua),expires=stamp()+1800;
    const session=await toolToken(env.AUTH_SECRET,{aud:AUD,kind:'session',iat:stamp(),exp:expires,fp,nonce:crypto.randomUUID()});
    if(!await stage(env.DB,p.nonce,2,3))return deny();return json({valid:true,session,expires});
   }catch{return unavailable();}
  }
 };
}
