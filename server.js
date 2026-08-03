const express = require('express');
const path = require('path');
const { getGlp1Feed } = require('./lib/glp1Feed');

const app = express();
const PORT = process.env.PORT || 10000;
const PWA_ORIGIN = process.env.PWA_ORIGIN || 'https://pwa-signal-plus-v2.onrender.com';

const ALLOWED_ORIGINS = new Set([
  'https://www.signalplushealth.com',
  'https://signalplushealth.com',
  'http://localhost:10000',
  'http://127.0.0.1:10000',
  'https://pwa-signal-plus-v2.onrender.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

app.use(express.json({ limit: '16kb' }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'signalplushealthlandingpage',
    appSignup: true,
    pwaOrigin: PWA_ORIGIN,
    glp1NewsFeed: 'blended',
    glp1FeedConfigured: true,
  });
});

app.get('/api/glp1-feed', async (req, res) => {
  const refresh = req.query.refresh === '1' || req.query.mode === 'demand';

  try {
    const feed = await getGlp1Feed({ refresh });
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=3600');
    res.json(feed);
  } catch (err) {
    console.error('GLP-1 feed error:', err);
    res.status(502).json({ ok: false, error: 'Could not load GLP-1 news.' });
  }
});

app.post('/api/app/request', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();

  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: 'Invalid email address.' });
  }

  try {
    const response = await fetch(PWA_ORIGIN + '/api/auth/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        (payload && (payload.error || payload.message)) ||
        'Could not send app link. Please try again.';
      console.error('PWA auth/request error:', response.status, message);
      return res.status(response.status >= 500 ? 502 : response.status).json({ ok: false, error: message });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('App signup proxy error:', err);
    return res.status(500).json({ ok: false, error: 'Server error. Please try again.' });
  }
});

app.get('/newsletter.html', (req, res) => {
  res.redirect(301, '/#get-app');
});

app.use('/newsletter', (req, res) => {
  res.redirect(301, '/#get-app');
});

app.use(express.static(path.join(__dirname), { index: 'index.html' }));

app.listen(PORT, () => {
  console.log('Signal+ landing listening on ' + PORT);
});
