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
  return (live ? /^sk_live_\S+$/ : /^sk_test_\S+$/).test(env.STRIPE_SECRET_KEY || '')
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
