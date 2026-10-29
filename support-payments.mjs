const ORIGIN = 'https://todoroki-gold.com';
const AMOUNTS = [300, 500, 1000, 3000];
const reply = (data, status = 200) => Response.json(data, {status, headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const configured = env => env.SUPPORT_ENABLED === 'true' && env.SUPPORT_APPROVED === 'true' && env.STRIPE_RESTRICTED_KEY && env.STRIPE_WEBHOOK_SECRET && env.DB;
async function readLimited(request, maximum) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('input');
  const chunks = []; let size = 0;
  for (;;) { const {done,value} = await reader.read(); if (done) break; size += value.length;
    if (size > maximum) { await reader.cancel(); throw new Error('input'); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}
export async function verifySignature(raw, signature, secret, time = Date.now()/1000) {
  if (!signature || !secret) return false;
  const fields = signature.split(',').map(part => part.trim().split('='));
  const timestamp = fields.find(([k]) => k === 't')?.[1];
  const candidates = fields.filter(([k,v]) => k === 'v1' && /^[a-f0-9]{64}$/.test(v)).map(([,v])=>v);
  if (!/^\d+$/.test(timestamp || '') || Math.abs(time-Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  for (const signatureHex of candidates) {
    const bytes = Uint8Array.from(signatureHex.match(/../g), hex => parseInt(hex,16));
    if (await crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(timestamp+'.'+raw))) return true;
  }
  return false;
}
export async function supportPayments(request, env, fetchStripe = fetch) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/support/')) return null;
  if (url.origin !== ORIGIN) return reply({error:'アクセス元を確認してください。'},403);
  const path = url.pathname;
  if (path === '/api/support/status') {
    if (request.method !== 'GET') return reply({error:'Method not allowed'},405);
    return reply({enabled:Boolean(configured(env)),amounts:AMOUNTS});
  }
  if (!['/api/support/checkout','/api/support/webhook'].includes(path)) return reply({error:'Not found'},404);
  if (request.method !== 'POST') return reply({error:'Method not allowed'},405);
  if (path.endsWith('/webhook')) {
    if (!env.STRIPE_WEBHOOK_SECRET || !env.DB) return reply({error:'Not configured'},503);
    let raw;
    try { raw = await readLimited(request,262144); } catch { return reply({error:'Invalid body'},400); }
    if (!await verifySignature(raw,request.headers.get('Stripe-Signature'),env.STRIPE_WEBHOOK_SECRET)) return reply({error:'Invalid signature'},400);
    let event;
    try { event = JSON.parse(raw); } catch { return reply({error:'Invalid event'},400); }
    if (!/^evt_[a-zA-Z0-9]+$/.test(event.id || '') || typeof event.livemode !== 'boolean') return reply({error:'Invalid event'},400);
    if (event.livemode !== (env.STRIPE_MODE === 'live')) return reply({error:'Wrong mode'},400);
    if (!['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed'].includes(event.type)) return reply({received:true});
    const session = event.data?.object;
    if (session?.metadata?.purpose !== 'todoroki_support') return reply({received:true});
    if (session.currency !== 'jpy' || !AMOUNTS.includes(session.amount_total) || !/^cs_[a-zA-Z0-9_]+$/.test(session.id || '')) return reply({error:'Invalid session'},400);
    const status = session.payment_status === 'paid' ? 'paid' : event.type.endsWith('failed') ? 'failed' : 'pending';
    try {
      await env.DB.batch([
        env.DB.prepare('INSERT OR IGNORE INTO support_events (id, session_id, event_type) VALUES (?, ?, ?)').bind(event.id,session.id,event.type),
        env.DB.prepare(`INSERT INTO support_payments (session_id, amount, status) VALUES (?, ?, ?)
          ON CONFLICT(session_id) DO UPDATE SET status = CASE WHEN support_payments.status = 'paid' THEN 'paid' ELSE excluded.status END`).bind(session.id,session.amount_total,status)
      ]);
      return reply({received:true});
    } catch { return reply({error:'Storage unavailable'},500); }
  }
  if (request.headers.get('Origin') !== ORIGIN) return reply({error:'アクセス元を確認してください。'},403);
  if (!configured(env)) return reply({error:'現在、支援の受付を準備しています。'},503);
  if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) return reply({error:'入力内容を確認してください。'},400);
  let input;
  try { input = JSON.parse(await readLimited(request,2048)); } catch { return reply({error:'入力内容を確認してください。'},400); }
  if (!AMOUNTS.includes(input?.amount) || !/^[a-f0-9-]{36}$/.test(input?.requestId || '')) return reply({error:'金額を確認してください。'},400);
  // Pin each browser attempt to its first amount. Retries use one Stripe idempotency key.
  try {
    await env.DB.prepare('INSERT OR IGNORE INTO support_attempts (id, amount) VALUES (?, ?)').bind(input.requestId,input.amount).run();
    const attempt = await env.DB.prepare('SELECT amount, created_at FROM support_attempts WHERE id = ?').bind(input.requestId).first();
    if (!attempt || attempt.amount !== input.amount || Date.now()/1000-attempt.created_at > 82800) return reply({error:'新しく支援を開始してください。'},409);
    // Rate-limit creation per client and globally without retaining raw IP addresses.
    const ipKey = await crypto.subtle.importKey('raw',new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const ipHash = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',ipKey,new TextEncoder().encode(request.headers.get('CF-Connecting-IP') || 'unknown'))),b=>b.toString(16).padStart(2,'0')).join('');
    for (const bucketKey of ['ip:'+ipHash,'global']) {
      const maximum = bucketKey === 'global' ? 100 : 10;
      const allowed = await env.DB.prepare(`INSERT INTO support_limits (id, hits) VALUES (?, 1) ON CONFLICT(id) DO UPDATE SET hits = hits + 1 WHERE hits < ? RETURNING hits`).bind(bucketKey+':'+Math.floor(Date.now()/600000),maximum).first();
      if (!allowed) return reply({error:'時間をおいてお試しください。'},429);
    }
    const params = new URLSearchParams({mode:'payment',success_url:ORIGIN+'/support.html?result=returned',cancel_url:ORIGIN+'/support.html?result=cancelled',
      'line_items[0][price_data][currency]':'jpy','line_items[0][price_data][unit_amount]':String(input.amount),
      'line_items[0][price_data][product_data][name]':'TODOROKIの無料コンテンツ制作への任意支援','line_items[0][quantity]':'1',
      'metadata[purpose]':'todoroki_support',integration_identifier:'todoroki_support_qmzvpkra'});
    const response = await fetchStripe('https://api.stripe.com/v1/checkout/sessions',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+env.STRIPE_RESTRICTED_KEY,'Stripe-Version':'2026-09-30.endive','Idempotency-Key':'support:'+input.requestId,'Content-Type':'application/x-www-form-urlencoded'},body:params});
    if (!response.ok) return reply({error:'決済画面を開けませんでした。時間をおいて再度お試しください。'},502);
    const session = await response.json();
    if (session.livemode !== (env.STRIPE_MODE === 'live') || typeof session.url !== 'string' || new URL(session.url).origin !== 'https://checkout.stripe.com') return reply({error:'決済設定を確認してください。'},502);
    return reply({url:session.url});
  } catch { return reply({error:'接続に失敗しました。同じ画面から再度お試しください。'},502); }
}
