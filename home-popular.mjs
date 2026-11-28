const dayMs = 86_400_000;
const pathPattern = /^\/[a-z0-9][a-z0-9-]*$/;
const tokyoDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
});
const dateAt = (time, offset = 0) => tokyoDate.format(time + offset * dayMs);

function base64url(value) {
  const binary = typeof value === 'string' ? value : String.fromCharCode(...new Uint8Array(value));
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken(credentials) {
  const { client_email, private_key } = JSON.parse(credentials);
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const issued = Math.floor(Date.now() / 1000);
  const claims = { iss: client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: tokenUrl, iat: issued, exp: issued + 300 };
  const unsigned = base64url('{"alg":"RS256","typ":"JWT"}') + '.' + base64url(JSON.stringify(claims));
  const pkcs8 = private_key.replace(/-----[^-]+-----|\s/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pkcs8), char => char.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const response = await fetch(tokenUrl, { method: 'POST', body: new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: unsigned + '.' + base64url(signature)
  }) });
  if (!response.ok) throw new Error('GA4 OAuth failed (' + response.status + ')');
  const { access_token } = await response.json();
  if (!access_token) throw new Error('GA4 OAuth returned no token');
  return access_token;
}

export async function refreshHomePopular(env, scheduledTime) {
  if (!/^\d+$/.test(env.GA4_PROPERTY_ID ?? '') || !env.GA4_SERVICE_ACCOUNT_JSON) {
    throw new Error('GA4_PROPERTY_ID and GA4_SERVICE_ACCOUNT_JSON are required');
  }

  // Exclude today and yesterday to allow GA4 ingestion to settle.
  const startDate = dateAt(scheduledTime, -8);
  const endDate = dateAt(scheduledTime, -2);
  const homepage = await env.ASSETS.fetch(new Request('https://todoroki-gold.com/'));
  if (!homepage.ok) throw new Error('Could not load the homepage article catalog');

  const articles = new Set();
  const catalog = new HTMLRewriter().on('#home-article-catalog > a.card-link', {
    element(element) {
      const href = element.getAttribute('href');
      if (pathPattern.test(href ?? '')) articles.add(href);
    }
  });
  await catalog.transform(homepage).text();
  if (!articles.size) throw new Error('Homepage article catalog is empty');

  const token = await getAccessToken(env.GA4_SERVICE_ACCOUNT_JSON);
  const views = new Map();
  const reportUrl = 'https://analyticsdata.googleapis.com/v1beta/properties/' + env.GA4_PROPERTY_ID + ':runReport';
  const limit = 10000;
  for (let offset = 0; ; offset += limit) {
    const response = await fetch(reportUrl, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        dateRanges: [{ startDate, endDate }],
        dimensionFilter: { filter: { fieldName: 'hostName', inListFilter: {
          values: ['todoroki-gold.com', 'www.todoroki-gold.com']
        } } },
        orderBys: [{ dimension: { dimensionName: 'pagePath' } }],
        limit: String(limit), offset: String(offset)
      })
    });
    if (!response.ok) throw new Error('GA4 report failed (' + response.status + ')');
    const report = await response.json();
    if (report.metadata?.dataLossFromOtherRow || report.metadata?.subjectToThresholding ||
        report.metadata?.samplingMetadatas?.some(sample => sample.samplesReadCount !== sample.samplingSpaceSize)) {
      throw new Error('GA4 report is incomplete');
    }
    for (const row of report.rows ?? []) {
      const path = row.dimensionValues[0].value.replace(/\/$/, '').replace(/\.html$/, '');
      const count = Number(row.metricValues[0].value);
      if (articles.has(path) && Number.isSafeInteger(count) && count > 0) {
        views.set(path, (views.get(path) ?? 0) + count);
      }
    }
    if (offset + limit >= (report.rowCount ?? 0)) break;
    if (offset >= 40000) throw new Error('GA4 report exceeds supported size');
  }

  const paths = [...views].sort(([a, aViews], [b, bViews]) =>
    bViews - aViews || a.localeCompare(b)).slice(0, 24).map(([path]) => path);
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS home_popular (
    id INTEGER PRIMARY KEY CHECK (id = 1), start_date TEXT NOT NULL,
    end_date TEXT NOT NULL, paths TEXT NOT NULL
  )`).run();
  await env.DB.prepare(`INSERT INTO home_popular (id, start_date, end_date, paths) VALUES (1, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET start_date = excluded.start_date,
    end_date = excluded.end_date, paths = excluded.paths
    WHERE excluded.end_date >= home_popular.end_date`).bind(startDate, endDate, JSON.stringify(paths)).run();
}

export async function readHomePopular(db, time = Date.now()) {
  try {
    const row = await db.prepare('SELECT start_date, end_date, paths FROM home_popular WHERE id = 1').first();
    if (!row || row.end_date < dateAt(time, -4) || row.end_date > dateAt(time, -2)) return null;
    return { startDate: row.start_date, endDate: row.end_date, paths: JSON.parse(row.paths) };
  } catch (error) {
    if (error.message.includes('no such table: home_popular')) return null;
    throw error;
  }
}
