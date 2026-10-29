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

const TOOL_AUDIENCE = 'todoroki-us-economy-data';
const TOOL_URL = 'https://todoroki-us-economy-data.easysquid66.chatgpt.site';
const b64u = value => btoa(String.fromCharCode(...encoder.encode(JSON.stringify(value)))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
function unb64u(value) { return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')), c=>c.charCodeAt(0)))); }
async function toolFingerprint(secret, ua) { return sign(secret, 'tool-fingerprint-v1:' + ua); }
async function toolToken(secret, payload) { const value=b64u(payload);return value+'.'+await sign(secret,'tool-gate-v1:'+value); }
async function checkToolToken(secret, token) {
  if(typeof token!=='string'||token.length>1800)return null;
  const parts=token.split('.');if(parts.length!==2||!/^[a-zA-Z0-9_-]+$/.test(parts[0])||!/^[a-f0-9]{64}$/.test(parts[1]))return null;
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const bytes=Uint8Array.from(parts[1].match(/../g), x=>parseInt(x,16));
  if(!await crypto.subtle.verify('HMAC',key,bytes,encoder.encode('tool-gate-v1:'+parts[0])))return null;
  try {const p=unb64u(parts[0]);return p.aud===TOOL_AUDIENCE&&Number.isInteger(p.exp)&&p.exp>now()&&p.exp<=now()+1805?p:null;}catch{return null;}
}
async function toolGate(request, env, path) {
  const back=()=>new Response(null,{status:303,headers:{Location:ORIGIN+'/#company-analysis','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  if(!env.AUTH_SECRET||env.AUTH_SECRET.length<40)return json({error:'ツールの入場設定を確認してください。'},503);
  if(path==='/api/tools/us') {
    if(request.method!=='GET')return json({error:'Method not allowed'},405);
    let ref;try{ref=new URL(request.headers.get('Referer')||'');}catch{return back();}
    if(ref.origin!==ORIGIN||!['same-origin','none',''].includes(request.headers.get('Sec-Fetch-Site')||''))return back();
    const fp=await toolFingerprint(env.AUTH_SECRET,request.headers.get('User-Agent')||'');
    const token=await toolToken(env.AUTH_SECRET,{aud:TOOL_AUDIENCE,kind:'entry',iat:now(),exp:now()+60,fp,nonce:crypto.randomUUID()});
    return new Response(null,{status:303,headers:{Location:TOOL_URL+'/enter?t='+token,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'}});
  }
  if(path==='/api/tools/verify') {
    if(request.method!=='POST')return json({error:'Method not allowed'},405);
    let input;try{input=await body(request);}catch{return json({valid:false},400);}
    const p=await checkToolToken(env.AUTH_SECRET,input?.token);
    if(!p||!['entry','session'].includes(p.kind)||p.kind!==input.kind||typeof input.ua!=='string'||input.ua.length>700)return json({valid:false},403);
    const fp=await toolFingerprint(env.AUTH_SECRET,input.ua);
    if(p.fp!==fp)return json({valid:false},403);
    if(p.kind==='entry')return json({valid:true,session:await toolToken(env.AUTH_SECRET,{aud:TOOL_AUDIENCE,kind:'session',iat:now(),exp:now()+1800,fp,nonce:crypto.randomUUID()}),expires:now()+1800});
    return json({valid:true,expires:p.exp});
  }
  return json({error:'Not found'},404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.origin !== ORIGIN) return json({ error: '本番サイトからアクセスしてください。' }, 403);
    const path = url.pathname;
    if (path.startsWith('/api/tools/')) { try { return await toolGate(request, env, path); } catch { return json({error:'ツールの入場を確認できません。再度お試しください。'},503); } }
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
