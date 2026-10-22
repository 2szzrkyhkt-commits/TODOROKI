const ORIGIN = 'https://todoroki-gold.com';
const SESSION = '__Host-todoroki_session';
const CHALLENGE = '__Host-todoroki_challenge';
const encoder = new TextEncoder();
const now = () => Math.floor(Date.now() / 1000);
const random = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
const hash = async text => hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
async function sign(secret, text) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(text)));
}
function json(data, status = 200, cookies = []) {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(JSON.stringify(data), { status, headers });
}
const cookie = (name, value, age) => `${name}=${value}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Strict`;
function readCookie(request, name) {
  return (request.headers.get('Cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(name + '='))?.slice(name.length + 1) || '';
}
async function body(request) {
  if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) throw new Error('input');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('input');
  const chunks = []; let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 2048) { await reader.cancel(); throw new Error('input'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function limit(db, key, seconds, maximum) {
  const bucket = Math.floor(now() / seconds);
  const row = await db.prepare(`INSERT INTO auth_rate_limits (id, hits, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(id) DO UPDATE SET hits = hits + 1 WHERE hits < ? RETURNING hits`)
    .bind(`${key}:${bucket}`, (bucket + 1) * seconds, maximum).first();
  return Boolean(row);
}
// Sales stay closed unless explicitly enabled. Test and live entitlements are isolated.
const PRODUCT = Object.freeze({ key: 'okamura-7994', title: 'オカムラ｜株価指標と長期財務', amount: 300,
  currency: 'jpy' });
function paymentConfig(env) {
  const mode = env.STRIPE_MODE || 'test';
  if (mode !== 'test' && mode !== 'live') throw new Error('payment_mode');
  const live = mode === 'live';
  return { live, dbMode: live ? 1 : 0, price: live
    ? 'price_1UTDTyCBSUaWh0klNhPiYcte' : 'price_1USrnlCRZWKKb8vhsedZ65G0' };
}
function paymentReady(env) {
  const {live} = paymentConfig(env);
  return (live ? /^(?:sk|rk)_live_\S+$/ : /^(?:sk|rk)_test_\S+$/).test(env.STRIPE_SECRET_KEY || '')
    && /^whsec_\S+$/.test(env.STRIPE_WEBHOOK_SECRET || '');
}
const salesEnabled = env => env.SALES_ENABLED === 'true';
const SALES_ROUTES = new Map([['/api/shop', 'GET'], ['/api/checkout', 'POST'],
  ['/api/purchases/confirm', 'POST'], ['/api/download/okamura-7994', 'GET'], ['/api/stripe/webhook', 'POST']]);
async function memberFor(request, db) {
  const token = readCookie(request, SESSION);
  return /^[a-f0-9]{64}$/.test(token) ? db.prepare(`SELECT members.id, members.email FROM sessions
    JOIN members ON members.id=sessions.member_id WHERE token_hash=? AND expires_at>?`)
    .bind(await hash(token), now()).first() : null;
}
async function stripe(env, path, values, idempotency) {
  if (!paymentReady(env)) throw new Error('payment_config_required');
  const headers = { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY };
  const options = { headers, signal: AbortSignal.timeout(12000) };
  if (values) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    if (idempotency) headers['Idempotency-Key'] = idempotency;
    options.method = 'POST'; options.body = new URLSearchParams(values);
  }
  const response = await fetch('https://api.stripe.com/v1/' + path, options);
  if (!response.ok) throw new Error('stripe_' + response.status);
  return response.json();
}
const validSession = (id, live) => typeof id === 'string' && (live
  ? /^cs_live_[A-Za-z0-9_]{1,240}$/ : /^cs_test_[A-Za-z0-9_]{1,240}$/).test(id);
async function fulfill(env, sessionId, memberId = null) {
  const config = paymentConfig(env);
  if (!validSession(sessionId, config.live)) throw new Error('session');
  const s = await stripe(env, 'checkout/sessions/' + sessionId + '?expand[]=line_items&expand[]=payment_intent.latest_charge');
  // A webhook may arrive before checkout creation has saved its session ID.
  // Only a session retrieved from Stripe can supply the fallback order ID.
  const order = await env.DB.prepare(`SELECT * FROM digital_orders WHERE livemode=? AND
    (stripe_session_id=? OR (id=? AND stripe_session_id IS NULL))`)
    .bind(config.dbMode, sessionId, s.metadata?.order_id || '').first();
  if (!order || (memberId && order.member_id !== memberId)) return false;
  if (order.status === 'revoked') return false;
  const lines = s.line_items;
  const line = lines?.data?.[0];
  if (s.id !== sessionId || s.livemode !== config.live || s.mode !== 'payment' ||
      s.client_reference_id !== order.id || s.metadata?.order_id !== order.id ||
      s.metadata?.member_id !== order.member_id || s.metadata?.product_key !== PRODUCT.key ||
      order.product_key !== PRODUCT.key || order.stripe_price_id !== config.price ||
      order.amount !== PRODUCT.amount || order.currency !== PRODUCT.currency) throw new Error('mismatch');
  if (s.payment_status !== 'paid' || s.status !== 'complete') return false;
  if (s.amount_total !== order.amount || s.currency !== order.currency || lines?.has_more !== false ||
      lines.data.length !== 1 || line.quantity !== 1 || line.price?.id !== config.price ||
      line.price?.livemode !== config.live || line.price?.unit_amount !== PRODUCT.amount ||
      line.price?.currency !== PRODUCT.currency) throw new Error('amount');
  const pi = s.payment_intent;
  if (!pi || typeof pi !== 'object' || pi.status !== 'succeeded' || pi.livemode !== config.live ||
      pi.amount !== order.amount || pi.currency !== order.currency ||
      pi.metadata?.order_id !== order.id || !pi.latest_charge || typeof pi.latest_charge !== 'object') throw new Error('payment');
  const charge = pi.latest_charge;
  if (charge.livemode !== config.live || charge.paid !== true || charge.amount !== order.amount ||
      charge.currency !== order.currency || charge.payment_intent !== pi.id) throw new Error('charge');
  const revoked = charge.refunded || charge.amount_refunded > 0 || charge.disputed;
  await env.DB.prepare(`UPDATE digital_orders SET status=?,stripe_payment_intent_id=?,stripe_session_id=?,updated_at=?
    WHERE id=? AND status!='revoked' AND livemode=?`).bind(revoked ? 'revoked' : 'paid', pi.id, sessionId, now(), order.id, config.dbMode).run();
  return !revoked;
}
async function owned(env, memberId) {
  const config = paymentConfig(env);
  return Boolean(await env.DB.prepare(`SELECT id FROM digital_orders
    WHERE member_id=? AND product_key=? AND livemode=? AND status='paid' LIMIT 1`)
    .bind(memberId, PRODUCT.key, config.dbMode).first());
}
async function rawLimited(request, maximum) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('body');
  const parts = []; let size = 0;
  for (;;) {
    const {value,done} = await reader.read(); if (done) break;
    size += value.length;
    if (size > maximum) { await reader.cancel(); throw new Error('body'); }
    parts.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of parts) { bytes.set(part,offset); offset += part.length; }
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
function sameHex(a,b) {
  if (!/^[a-f0-9]{64}$/.test(a) || !/^[a-f0-9]{64}$/.test(b)) return false;
  let difference = 0;
  for (let i=0;i<64;i++) difference |= a.charCodeAt(i)^b.charCodeAt(i);
  return difference === 0;
}
async function webhook(request,env) {
  const config = paymentConfig(env);
  if (!env.DB || !paymentReady(env)) return json({error:'Webhook設定待ちです。'},503);
  let event;
  try {
    const signature=request.headers.get('Stripe-Signature') || '';
    if (signature.length>2048) throw new Error('signature');
    const fields=signature.split(',').map(s=>s.trim().split('='));
    const timestamps=fields.filter(([k])=>k==='t');
    if (timestamps.length!==1 || !/^\d{10,11}$/.test(timestamps[0][1])) throw new Error('timestamp');
    const t=timestamps[0][1];
    if (Math.abs(now()-Number(t))>300) throw new Error('timestamp');
    const raw=await rawLimited(request,262144);
    const expected=await sign(env.STRIPE_WEBHOOK_SECRET,t+'.'+raw);
    if (!fields.some(([k,v])=>k==='v1' && sameHex(v,expected))) throw new Error('signature');
    event=JSON.parse(raw);
    if (!/^evt_[A-Za-z0-9_]+$/.test(event.id || '') || typeof event.livemode!=='boolean') throw new Error('event');
  } catch { return json({error:'署名を確認できません。'},400); }
  if (event.livemode !== config.live) return json({received:true,ignored:true});
  if (await env.DB.prepare('SELECT stripe_event_id FROM digital_events WHERE stripe_event_id=?').bind(event.id).first()) return json({received:true});
  const object=event.data?.object;
  if (event.type==='checkout.session.completed' || event.type==='checkout.session.async_payment_succeeded') {
    if (validSession(object?.id, config.live)) await fulfill(env,object.id);
  } else if (event.type==='checkout.session.expired') {
    if (validSession(object?.id, config.live)) await env.DB.prepare(`UPDATE digital_orders SET status='expired',updated_at=?
      WHERE stripe_session_id=? AND status='pending' AND livemode=?`).bind(now(),object.id,config.dbMode).run();
  } else if (event.type==='charge.refunded' || event.type==='charge.dispute.created') {
    const piId=typeof object?.payment_intent==='string' ? object.payment_intent : object?.payment_intent?.id;
    if (/^pi_[A-Za-z0-9_]+$/.test(piId || '')) {
      const pi=await stripe(env,'payment_intents/'+piId);
      if (pi.livemode===config.live && typeof pi.metadata?.order_id==='string') {
        await env.DB.prepare(`UPDATE digital_orders SET status='revoked',stripe_payment_intent_id=?,updated_at=?
          WHERE id=? AND livemode=? AND product_key=?`).bind(piId,now(),pi.metadata.order_id,config.dbMode,PRODUCT.key).run();
      }
    }
  }
  // Mark only after success. A crash between writes can safely replay idempotent updates.
  await env.DB.prepare('INSERT INTO digital_events(stripe_event_id,processed_at) VALUES(?,?) ON CONFLICT DO NOTHING').bind(event.id,now()).run();
  return json({received:true});
}
async function sales(request,env) {
  const path=new URL(request.url).pathname;
  if (request.method !== SALES_ROUTES.get(path)) return json({error:'Method not allowed'},405);
  if (path==='/api/stripe/webhook') {
    try { return await webhook(request,env); }
    catch { return json({error:'イベントを処理できませんでした。'},500); }
  }
  if (request.method==='POST' && request.headers.get('Origin')!==ORIGIN) return json({error:'アクセス元を確認できません。'},403);
  if (!env.DB) return json({error:'保存先の設定待ちです。'},503);
  try {
    const config=paymentConfig(env);
    const member=await memberFor(request,env.DB);
    if (path==='/api/shop') {
      const file=await env.DB.prepare('SELECT byte_count FROM digital_files WHERE product_key=?').bind(PRODUCT.key).first();
      return json({test_mode:!config.live,member,product:{key:PRODUCT.key,title:PRODUCT.title,amount:PRODUCT.amount,
        available:Boolean(salesEnabled(env) && file && paymentReady(env)),
        owned:member ? await owned(env,member.id) : false}});
    }
    if (!member) return json({error:'先にログインしてください。'},401);
    if (path.startsWith('/api/download/')) {
      if (!await owned(env,member.id)) return json({error:'購入を確認できません。'},403);
      const f=await env.DB.prepare('SELECT filename,pdf,byte_count FROM digital_files WHERE product_key=?').bind(PRODUCT.key).first();
      if (!f) return json({error:'PDFを準備しています。'},503);
      const bytes=f.pdf instanceof ArrayBuffer ? new Uint8Array(f.pdf) : new Uint8Array(f.pdf);
      if (bytes.length!==f.byte_count) throw new Error('file');
      return new Response(bytes,{headers:{'Content-Type':'application/pdf','Cache-Control':'private, no-store',
        'X-Content-Type-Options':'nosniff','Content-Disposition':"attachment; filename=okamura-7994.pdf; filename*=UTF-8''"+encodeURIComponent(f.filename)}});
    }
    let input; try { input=await body(request); } catch { return json({error:'入力を確認してください。'},400); }
    if (!input || typeof input!=='object') return json({error:'入力を確認してください。'},400);
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS auth_rate_limits(id TEXT PRIMARY KEY,hits INTEGER NOT NULL,expires_at INTEGER NOT NULL)').run();
    await env.DB.prepare('DELETE FROM auth_rate_limits WHERE expires_at<=?').bind(now()).run();
    if (path==='/api/purchases/confirm') {
      if (!validSession(input.session_id, config.live)) return json({error:'決済番号を確認してください。'},400);
      if (!await limit(env.DB,'confirm:'+member.id,60,10)) return json({error:'少し時間をおいてください。'},429);
      const paid=await fulfill(env,input.session_id,member.id);
      return json({paid});
    }
    if (!salesEnabled(env)) return json({error:'販売準備中です。'},503);
    if (input.product_key!==PRODUCT.key) return json({error:'商品を確認してください。'},400);
    if (!paymentReady(env)) return json({error:'決済の設定待ちです。'},503);
    if (!await env.DB.prepare('SELECT product_key FROM digital_files WHERE product_key=?').bind(PRODUCT.key).first()) return json({error:'PDFの登録待ちです。'},503);
    if (await owned(env,member.id)) return json({owned:true});
    if (!await limit(env.DB,'checkout:'+member.id,30,1) || !await limit(env.DB,'checkout-total',86400,100)) return json({error:'少し時間をおいてから再度お試しください。'},429);
    const price=await stripe(env,'prices/'+config.price);
    if (price.id!==config.price || price.livemode!==config.live || price.active!==true ||
        price.type!=='one_time' || price.unit_amount!==PRODUCT.amount || price.currency!==PRODUCT.currency) throw new Error('price');
    const existing=await env.DB.prepare(`SELECT * FROM digital_orders WHERE member_id=? AND product_key=?
      AND livemode=? AND stripe_price_id=? AND amount=? AND currency=?
      AND status='pending' AND created_at>? ORDER BY created_at DESC LIMIT 1`)
      .bind(member.id,PRODUCT.key,config.dbMode,config.price,PRODUCT.amount,PRODUCT.currency,now()-1800).first();
    if (existing?.stripe_session_id) {
      const s=await stripe(env,'checkout/sessions/'+existing.stripe_session_id);
      if (s.status==='open' && s.livemode===config.live && typeof s.url==='string' && s.url.startsWith('https://checkout.stripe.com/')) return json({url:s.url});
      if (s.payment_status==='paid') { await fulfill(env,s.id,member.id); return json({owned:await owned(env,member.id)}); }
    }
    const id=existing && !existing.stripe_session_id ? existing.id : crypto.randomUUID();
    if (id!==existing?.id) await env.DB.prepare(`INSERT INTO digital_orders
      (id,member_id,product_key,stripe_price_id,livemode,amount,currency,created_at,updated_at)
      VALUES(?,?,?,?,?,?,'jpy',?,?)`).bind(id,member.id,PRODUCT.key,config.price,config.dbMode,PRODUCT.amount,now(),now()).run();
    const s=await stripe(env,'checkout/sessions',{
      mode:'payment','payment_method_types[0]':'card','line_items[0][price]':config.price,'line_items[0][quantity]':'1',
      client_reference_id:id,customer_email:member.email,
      'metadata[order_id]':id,'metadata[member_id]':member.id,'metadata[product_key]':PRODUCT.key,
      'payment_intent_data[metadata][order_id]':id,
      success_url:ORIGIN+'/premium.html?session_id={CHECKOUT_SESSION_ID}',cancel_url:ORIGIN+'/premium.html?cancelled=1'
    },'todoroki-order-'+id);
    if (!validSession(s.id, config.live) || s.livemode!==config.live || typeof s.url!=='string' || !s.url.startsWith('https://checkout.stripe.com/')) throw new Error('checkout');
    await env.DB.prepare('UPDATE digital_orders SET stripe_session_id=?,updated_at=? WHERE id=? AND livemode=?').bind(s.id,now(),id,config.dbMode).run();
    return json({url:s.url});
  } catch {
    return json({error:'処理できませんでした。設定を確認し、時間をおいて再度お試しください。'},503);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.origin !== ORIGIN) return json({ error: '本番サイトからアクセスしてください。' }, 403);
    const path = url.pathname;
    if (SALES_ROUTES.has(path)) return sales(request, env);
    if (!['/api/auth/request', '/api/auth/verify', '/api/auth/me', '/api/auth/logout'].includes(path)) return json({ error: 'Not found' }, 404);
    const method = path.endsWith('/me') ? 'GET' : 'POST';
    if (request.method !== method) return json({ error: 'Method not allowed' }, 405);
    if (method === 'POST' && request.headers.get('Origin') !== ORIGIN) return json({ error: 'アクセス元を確認できません。' }, 403);
    if (!env.DB || !env.RESEND_API_KEY || !env.EMAIL_FROM || !env.AUTH_SECRET || env.AUTH_SECRET.length < 40) return json({ error: 'ログイン設定を確認してください。' }, 503);
    try {
      const db = env.DB;
      if (path.endsWith('/me')) {
        const token = readCookie(request, SESSION);
        const member = /^[a-f0-9]{64}$/.test(token) ? await db.prepare(`SELECT members.id, members.email FROM sessions
          JOIN members ON members.id = sessions.member_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?`)
          .bind(await hash(token), now()).first() : null;
        return json({ member });
      }
      if (path.endsWith('/logout')) {
        const token = readCookie(request, SESSION);
        if (/^[a-f0-9]{64}$/.test(token)) await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await hash(token)).run();
        return json({ ok: true }, 200, [cookie(SESSION, '', 0), cookie(CHALLENGE, '', 0)]);
      }
      let input;
      try { input = await body(request); } catch { return json({ error: '入力内容を確認してください。' }, 400); }
      if (!input || typeof input !== 'object') return json({ error: '入力内容を確認してください。' }, 400);
      await db.prepare('CREATE TABLE IF NOT EXISTS auth_rate_limits (id TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires_at INTEGER NOT NULL)').run();
      await db.prepare('DELETE FROM auth_rate_limits WHERE expires_at <= ?').bind(now()).run();
      const ip = await sign(env.AUTH_SECRET, 'ip:' + (request.headers.get('CF-Connecting-IP') || 'unknown'));
      if (path.endsWith('/request')) {
        const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
        if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(email)) return json({ error: 'メールアドレスを確認してください。' }, 400);
        const address = await sign(env.AUTH_SECRET, 'email:' + email);
        if (!await limit(db, 'send-ip:' + ip, 600, 10) || !await limit(db, 'send-email:' + address, 60, 1) || !await limit(db, 'send-email-hour:' + address, 3600, 5) || !await limit(db, 'send-total', 86400, 80)) return json({ error: '送信回数の上限です。時間をおいてお試しください。' }, 429);
        const id = random();
        let number;
        do { number = crypto.getRandomValues(new Uint32Array(1))[0]; } while (number >= 4294000000);
        const code = String(number % 1000000).padStart(6, '0');
        const time = now();
        await db.prepare('DELETE FROM login_challenges WHERE expires_at <= ?').bind(time).run();
        await db.prepare('INSERT INTO login_challenges (id, email, code_hash, expires_at, attempts, created_at) VALUES (?, ?, ?, ?, 0, ?)')
          .bind(id, email, await sign(env.AUTH_SECRET, id + ':' + code), time + 600, time).run();
        let sent;
        let mailDiagnostic = 'MAIL_NETWORK_ERROR';
        let mailStatus = null;
        let mailErrorType = null;
        try {
          sent = await fetch('https://api.resend.com/emails', {
            method: 'POST', signal: AbortSignal.timeout(15000),
            headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json', 'Idempotency-Key': id },
            body: JSON.stringify({ from: env.EMAIL_FROM, to: [email], subject: 'TODOROKI ログイン認証コード',
              text: `TODOROKIの認証コードは ${code} です。\n有効期限は10分です。\nこのコードを他の人に教えないでください。\nお心当たりがなければ、このメールを破棄してください。` })
          });
          if (!sent.ok) {
            mailStatus = sent.status;
            mailDiagnostic = 'MAIL_HTTP_' + sent.status;
            // Only expose known error types, never raw responses, keys or email contents.
            const known = new Set(['validation_error', 'missing_api_key', 'invalid_api_key', 'restricted_api_key', 'invalid_access', 'rate_limit_exceeded', 'daily_quota_exceeded', 'monthly_quota_exceeded', 'application_error', 'internal_server_error']);
            try {
              const details = await sent.json();
              if (known.has(details.name)) mailErrorType = details.name;
            } catch {}
            throw new Error('mail');
          }
        } catch (mailError) {
          if (mailStatus === null) {
            if (mailError?.name === 'TimeoutError' || mailError?.name === 'AbortError') mailDiagnostic = 'MAIL_TIMEOUT';
            else if (mailError?.name === 'TypeError') mailDiagnostic = 'MAIL_REQUEST_ERROR';
          }
          console.error(JSON.stringify({ event: 'auth_mail_failed', code: mailDiagnostic, status: mailStatus, type: mailErrorType }));
          await db.prepare('DELETE FROM login_challenges WHERE id = ?').bind(id).run();
          return json({ error: 'メールを送信できませんでした。', code: mailDiagnostic, mail_status: mailStatus, mail_error_type: mailErrorType }, 502);
        }
        return json({ ok: true }, 200, [cookie(CHALLENGE, id, 600)]);
      }
      if (!await limit(db, 'verify-ip:' + ip, 600, 30)) return json({ error: '試行回数の上限です。時間をおいてお試しください。' }, 429);
      const id = readCookie(request, CHALLENGE);
      const code = typeof input.code === 'string' ? input.code.trim() : '';
      const invalid = () => json({ error: 'コードが違うか、有効期限・試行回数を超えています。再送信してください。' }, 400);
      if (!/^[a-f0-9]{64}$/.test(id) || !/^\d{6}$/.test(code)) return invalid();
      const attempt = await db.prepare(`UPDATE login_challenges SET attempts = attempts + 1
        WHERE id = ? AND consumed_at IS NULL AND expires_at > ? AND attempts < 5 RETURNING code_hash`)
        .bind(id, now()).first();
      const expected = await sign(env.AUTH_SECRET, id + ':' + code);
      if (!attempt || attempt.code_hash !== expected) return invalid();
      const claimed = await db.prepare(`UPDATE login_challenges SET consumed_at = ? WHERE id = ?
        AND consumed_at IS NULL AND expires_at > ? AND code_hash = ? RETURNING email`)
        .bind(now(), id, now(), expected).first();
      if (!claimed) return invalid();
      const token = random();
      await db.prepare('INSERT INTO members (id, email) VALUES (?, ?) ON CONFLICT(email) DO NOTHING')
        .bind(crypto.randomUUID(), claimed.email).run();
      await db.prepare(`INSERT INTO sessions (token_hash, member_id, expires_at)
        SELECT ?, id, ? FROM members WHERE email = ?`).bind(await hash(token), now() + 604800, claimed.email).run();
      await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now()).run();
      return json({ ok: true }, 200, [cookie(SESSION, token, 604800), cookie(CHALLENGE, '', 0)]);
    } catch {
      return json({ error: '処理に失敗しました。しばらくしてから再度お試しください。' }, 500);
    }
  }
};
