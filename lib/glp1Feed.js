/**
 * GLP-1 news feed for signalplushealth.com (website only).
 * Uses OpenAI web search + OPENAI_API_KEY on Render.
 */

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const SEED_QUERY = 'GLP-1';
const TOP_TERMS_COUNT = 3;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const OPENAI_TIMEOUT_MS = 120000;
const DEFAULT_MODEL = 'gpt-4o';

const FALLBACK_SEARCH_TERMS = [
  'glp-1 insurance coverage',
  'glp-1 side effects',
  'tirzepatide vs semaglutide',
];

let cache = null;

function getOpenAiKey() {
  return process.env.OPENAI_API_KEY || '';
}

function getModel() {
  return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

function formatDisplayDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value || '').trim();
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function cleanUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('utm_source');
    parsed.searchParams.delete('utm_medium');
    parsed.searchParams.delete('utm_campaign');
    return parsed.toString();
  } catch (err) {
    return String(url || '').trim();
  }
}

function buildPrompt(limitPerTerm) {
  const maxItems = TOP_TERMS_COUNT * limitPerTerm;

  return (
    'Build a GLP-1 news feed for signalplushealth.com.\n\n' +
    'Step 1: Find the top ' +
    TOP_TERMS_COUNT +
    ' related Google search topics for "' +
    SEED_QUERY +
    '" in the United States right now.\n' +
    'Step 2: For each topic, find up to ' +
    limitPerTerm +
    ' recent news stories from reputable publishers (last 14 days preferred).\n\n' +
    'Return ONLY valid JSON (no markdown) in this shape:\n' +
    '{"searchTerms":["term1","term2","term3"],"items":[{"title":"...","href":"https://...","date":"Jun 28, 2026","source":"Publisher","searchTerm":"term1"}]}\n\n' +
    'Rules: real https article URLs only, no duplicates, max ' +
    maxItems +
    ' items total.'
  );
}

function extractOutputText(payload) {
  const chunks = [];

  for (const item of payload.output || []) {
    if (item.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const block of item.content) {
      if (block.type === 'output_text' && block.text) {
        chunks.push(block.text);
      }
    }
  }

  return chunks.join('\n').trim();
}

function extractCitationItems(payload) {
  const items = [];
  const seen = new Set();

  for (const item of payload.output || []) {
    if (item.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const block of item.content) {
      if (block.type !== 'output_text') continue;
      for (const ann of block.annotations || []) {
        if (ann.type !== 'url_citation') continue;
        const title = String(ann.title || '').trim();
        const href = cleanUrl(ann.url || '');
        if (!title || !href || !/^https?:\/\//i.test(href)) continue;
        if (seen.has(href)) continue;
        seen.add(href);
        items.push({
          title,
          href,
          date: '',
          source: '',
          searchTerm: '',
        });
      }
    }
  }

  return items;
}

function parseJsonFromText(text) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (err) {
    // continue
  }

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch (err) {
    return null;
  }
}

function normalizeFeed(parsed, limitPerTerm, citationItems) {
  const searchTerms = Array.isArray(parsed && parsed.searchTerms)
    ? parsed.searchTerms.map((term) => String(term).trim()).filter(Boolean)
    : [];

  const terms =
    searchTerms.length > 0 ? searchTerms.slice(0, TOP_TERMS_COUNT) : FALLBACK_SEARCH_TERMS.slice();

  const items = [];
  const seen = new Set();
  const rawItems = (parsed && parsed.items) || [];

  for (const raw of rawItems) {
    const title = String(raw.title || '').trim();
    const href = cleanUrl(raw.href || raw.url || '');
    if (!title || !href || !/^https?:\/\//i.test(href)) continue;
    if (seen.has(href)) continue;
    seen.add(href);

    items.push({
      title,
      href,
      date: formatDisplayDate(raw.date),
      source: String(raw.source || '').trim(),
      searchTerm: String(raw.searchTerm || '').trim(),
    });
  }

  if (!items.length && citationItems.length) {
    for (const item of citationItems) {
      if (seen.has(item.href)) continue;
      seen.add(item.href);
      items.push(item);
    }
  }

  const maxItems = TOP_TERMS_COUNT * limitPerTerm;

  return {
    items: items.slice(0, maxItems),
    searchTerms: terms,
    searchTermsFromFallback: searchTerms.length === 0,
  };
}

function decodeEntities(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractTag(block, tag) {
  const match = block.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'i'));
  return match ? decodeEntities(match[1].trim()) : '';
}

function parseRss(xml) {
  const items = [];
  const itemPattern = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemPattern.exec(xml)) !== null) {
    const block = match[1];
    const rawTitle = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const pubDate = extractTag(block, 'pubDate');
    const source = extractTag(block, 'source');
    const title = rawTitle.includes(' - ')
      ? rawTitle.slice(0, rawTitle.lastIndexOf(' - ')).trim()
      : rawTitle;

    if (!title || !link) continue;

    items.push({
      title,
      href: link,
      date: formatDisplayDate(pubDate),
      source: source || '',
      searchTerm: '',
      sortDate: new Date(pubDate).getTime() || 0,
    });
  }

  return items;
}

async function fetchRssForTerm(term, limit) {
  const url =
    'https://news.google.com/rss/search?q=' +
    encodeURIComponent(term) +
    '&hl=en-US&gl=US&ceid=US:en';
  const response = await fetch(url, {
    headers: { 'User-Agent': 'SignalPlusLanding/1.0' },
  });
  if (!response.ok) throw new Error('RSS HTTP ' + response.status);
  const xml = await response.text();
  return parseRss(xml).slice(0, limit);
}

async function fetchRssFallback(limitPerTerm) {
  const items = [];
  const seen = new Set();

  for (const term of FALLBACK_SEARCH_TERMS) {
    try {
      const termItems = await fetchRssForTerm(term, limitPerTerm);
      for (const item of termItems) {
        if (seen.has(item.href)) continue;
        seen.add(item.href);
        items.push({
          title: item.title,
          href: item.href,
          date: item.date,
          source: item.source,
          searchTerm: term,
        });
      }
    } catch (err) {
      console.warn('GLP-1 RSS fallback term failed:', term, err.message);
    }
  }

  items.sort(function (a, b) {
    return (b.sortDate || 0) - (a.sortDate || 0);
  });

  return {
    items: items.slice(0, TOP_TERMS_COUNT * limitPerTerm).map(function (item) {
      return {
        title: item.title,
        href: item.href,
        date: item.date,
        source: item.source,
        searchTerm: item.searchTerm,
      };
    }),
    searchTerms: FALLBACK_SEARCH_TERMS.slice(),
    searchTermsFromFallback: true,
  };
}

async function fetchFeedFromOpenAi(limitPerTerm) {
  const apiKey = getOpenAiKey();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const controller = new AbortController();
  const timer = setTimeout(function () {
    controller.abort();
  }, OPENAI_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: getModel(),
        tools: [{ type: 'web_search' }],
        tool_choice: 'auto',
        input: buildPrompt(limitPerTerm),
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      (payload.error && payload.error.message) ||
      payload.message ||
      'OpenAI HTTP ' + response.status;
    throw new Error(message);
  }

  const rawText = extractOutputText(payload);
  const citationItems = extractCitationItems(payload);
  const parsed = parseJsonFromText(rawText);
  const feed = normalizeFeed(parsed, limitPerTerm, citationItems);

  if (!feed.items.length) {
    throw new Error('OpenAI returned no usable headlines');
  }

  return feed;
}

async function getGlp1Feed(options) {
  const limitPerTerm = Math.max(1, Math.min(Number(options?.limitPerTerm) || 1, 5));
  const cacheKey = String(limitPerTerm);
  const now = Date.now();

  if (cache && cache.key === cacheKey && now - cache.at < CACHE_TTL_MS) {
    return cache.feed;
  }

  let feed;
  try {
    feed = await fetchFeedFromOpenAi(limitPerTerm);
  } catch (err) {
    console.error('GLP-1 OpenAI feed failed, using RSS fallback:', err.message);
    feed = await fetchRssFallback(limitPerTerm);
    if (!feed.items.length) {
      throw err;
    }
  }

  cache = { key: cacheKey, at: now, feed };
  return feed;
}

module.exports = { getGlp1Feed };
