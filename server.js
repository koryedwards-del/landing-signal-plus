const express = require('express');
const path = require('path');

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function addResendContact(email, source) {
  const apiKey = process.env.RESEND_API_KEY;
  const segmentId = process.env.RESEND_NEWSLETTER_SEGMENT_ID;

  const body = {
    email,
    unsubscribed: false,
    properties: {
      source: source || 'landing',
      list: 'signal-plus-weekly',
    },
  };

  if (segmentId) {
    body.segments = [{ id: segmentId }];
  }

  const response = await fetch('https://api.resend.com/contacts', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));

  if (response.ok) {
    return { ok: true, id: payload.id || null };
  }

  const message = String(payload.message || payload.error || response.status);

  if (/already exists|duplicate/i.test(message)) {
    if (segmentId) {
      await fetch('https://api.resend.com/contacts/' + encodeURIComponent(email) + '/segments/' + segmentId, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey },
      });
    }
    return { ok: true, existing: true };
  }

  return { ok: false, error: message || 'Could not add contact.' };
}

app.post('/api/newsletter/subscribe', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const source = String(req.body?.source || 'landing').trim().slice(0, 64);

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
    const result = await addResendContact(email, source);
    if (!result.ok) {
      console.error('Resend error:', result.error);
      return res.status(502).json({ ok: false, error: 'Could not subscribe. Please try again.' });
    }
    return res.json({ ok: true, id: result.id || null, existing: !!result.existing });
  } catch (err) {
    console.error('Newsletter subscribe error:', err);
    return res.status(500).json({ ok: false, error: 'Server error. Please try again.' });
  }
});

app.use(express.static(path.join(__dirname), { index: 'index.html' }));

app.listen(PORT, () => {
  console.log('Signal+ landing listening on ' + PORT);
});
