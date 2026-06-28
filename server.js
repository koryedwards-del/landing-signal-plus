const express = require('express');
const path = require('path');
const { getGlp1Feed } = require('./lib/glp1Feed');

const app = express();
const PORT = process.env.PORT || 10000;

const ALLOWED_ORIGINS = new Set([
  'https://www.signalplushealth.com',
  'https://signalplushealth.com',
  'http://localhost:10000',
  'http://127.0.0.1:10000',
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

function resendErrorMessage(payload, status) {
  if (!payload || typeof payload !== 'object') return 'Resend returned ' + status;
  if (typeof payload.message === 'string') return payload.message;
  if (payload.error && typeof payload.error.message === 'string') return payload.error.message;
  if (typeof payload.error === 'string') return payload.error;
  return 'Resend returned ' + status;
}

async function addResendContact(email) {
  const apiKey = process.env.RESEND_API_KEY;

  const response = await fetch('https://api.resend.com/contacts', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      unsubscribed: false,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (response.ok) {
    const id = payload.id || (payload.data && payload.data.id) || null;
    if (!id) {
      return { ok: false, error: 'Resend did not return a contact id.' };
    }
    return { ok: true, id: id };
  }

  const message = resendErrorMessage(payload, response.status);

  if (/already exists|duplicate/i.test(message)) {
    const verify = await fetch('https://api.resend.com/contacts/' + encodeURIComponent(email), {
      headers: { Authorization: 'Bearer ' + apiKey },
    });
    if (verify.ok) {
      const existing = await verify.json().catch(() => ({}));
      const existingId = existing.id || (existing.data && existing.data.id) || null;
      return { ok: true, existing: true, id: existingId };
    }
    return { ok: false, error: 'Contact already exists but could not be verified.' };
  }

  return { ok: false, error: message };
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'signalplushealthlandingpage',
    resendConfigured: !!process.env.RESEND_API_KEY,
    glp1FeedUrl: process.env.GLP1_FEED_URL || 'https://pwa-signal-plus-v2.onrender.com/api/glp1-feed',
  });
});

app.get('/api/glp1-feed', async (req, res) => {
  const limitPerTerm = Math.max(1, Math.min(parseInt(req.query.limitPerTerm, 10) || 1, 5));

  try {
    const feed = await getGlp1Feed({ limitPerTerm });
    res.json(feed);
  } catch (err) {
    console.error('GLP-1 feed error:', err);
    res.status(502).json({ ok: false, error: 'Could not load GLP-1 news.' });
  }
});

app.post('/api/newsletter/subscribe', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();

  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: 'Invalid email address.' });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not configured');
    return res.status(503).json({
      ok: false,
      error: 'Newsletter signup is not configured yet. Email support@signalplushealth.com to subscribe.',
    });
  }

  try {
    const result = await addResendContact(email);
    if (!result.ok) {
      console.error('Resend error:', result.error);
      return res.status(502).json({ ok: false, error: 'Could not subscribe. Please try again.' });
    }
    return res.status(200).json({
      ok: true,
      id: result.id || null,
      existing: !!result.existing,
    });
  } catch (err) {
    console.error('Newsletter subscribe error:', err);
    return res.status(500).json({ ok: false, error: 'Server error. Please try again.' });
  }
});

app.get('/newsletter.html', (req, res) => {
  res.redirect(301, '/#archive');
});

app.use(express.static(path.join(__dirname), { index: 'index.html' }));

app.listen(PORT, () => {
  console.log('Signal+ landing listening on ' + PORT);
});
