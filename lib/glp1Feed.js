/**
 * GLP-1 news feed for signalplushealth.com (website only — not the mobile app).
 *
 * Uses SerpAPI: Google Trends related queries for "GLP-1", then Google News
 * headlines for each top search term.
 *
 * Set SERPAPI_KEY in Render (serpapi.com → API key).
 *
 * Response shape:
 *   { items: [{ title, href, date, source, searchTerm? }], searchTerms: string[] }
 */

const SERPAPI_BASE = 'https://serpapi.com/search.json';
const SEED_QUERY = 'GLP-1';
const TOP_TERMS_COUNT = 3;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const FALLBACK_SEARCH_TERMS = [
  'glp-1 insurance coverage',
  'glp-1 side effects',
  'tirzepatide vs semaglutide',
];

let cache = null;

function getSerpApiKey() {
  return process.env.SERPAPI_KEY || process.env.SERP_API_KEY || '';
}

function formatDisplayDate(isoDate) {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

async function serpApiSearch(params) {
  const apiKey = getSerpApiKey();
  if (!apiKey) {
    throw new Error('SERPAPI_KEY is not configured');
  }

  const url = new URL(SERPAPI_BASE);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  url.searchParams.set('api_key', apiKey);

  const response = await fetch(url, {
    headers: { 'User-Agent': 'SignalPlusLanding/1.0' },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      (payload && payload.error) ||
      (payload && payload.message) ||
      'SerpAPI HTTP ' + response.status;
    throw new Error(message);
  }

  if (payload.error) {
    throw new Error(payload.error);
  }

  return payload;
}

function pickRelatedQueries(payload) {
  const related = payload.related_queries || {};
  const rising = Array.isArray(related.rising) ? related.rising : [];
  const top = Array.isArray(related.top) ? related.top : [];
  const source = rising.length ? rising : top;

  const terms = [];
  const seen = new Set();

  for (const entry of source) {
    const term = String(entry.query || '').trim();
    if (!term) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
    if (terms.length >= TOP_TERMS_COUNT) break;
  }

  return terms;
}

async function fetchSearchTerms() {
  try {
    const payload = await serpApiSearch({
      engine: 'google_trends',
      q: SEED_QUERY,
      data_type: 'RELATED_QUERIES',
      geo: 'US',
      hl: 'en',
      date: 'now 7-d',
    });
    const terms = pickRelatedQueries(payload);
    if (terms.length) {
      return { terms, fromFallback: false };
    }
  } catch (err) {
    console.warn('GLP-1 Trends lookup failed:', err.message);
  }

  return { terms: FALLBACK_SEARCH_TERMS.slice(), fromFallback: true };
}

function normalizeNewsItem(result, searchTerm) {
  const title = String(result.title || '').trim();
  const href = String(result.link || '').trim();
  if (!title || !href) return null;

  const isoDate = result.iso_date || result.date || '';
  const sourceName =
    (result.source && (result.source.name || result.source)) || '';

  return {
    title,
    href,
    date: isoDate ? formatDisplayDate(isoDate) : '',
    source: String(sourceName).trim(),
    searchTerm,
    sortDate: isoDate ? new Date(isoDate).getTime() : 0,
  };
}

async function fetchNewsForTerm(term, limitPerTerm) {
  const payload = await serpApiSearch({
    engine: 'google_news',
    q: term,
    gl: 'us',
    hl: 'en',
    num: limitPerTerm,
  });

  const results = Array.isArray(payload.news_results) ? payload.news_results : [];
  return results
    .map(function (result) {
      return normalizeNewsItem(result, term);
    })
    .filter(Boolean)
    .slice(0, limitPerTerm);
}

async function buildFeed(limitPerTerm) {
  const { terms, fromFallback } = await fetchSearchTerms();
  const items = [];
  const seen = new Set();

  for (const term of terms) {
    try {
      const termItems = await fetchNewsForTerm(term, limitPerTerm);
      for (const item of termItems) {
        if (seen.has(item.href)) continue;
        seen.add(item.href);
        items.push(item);
      }
    } catch (err) {
      console.warn('GLP-1 news term failed:', term, err.message);
    }
  }

  items.sort(function (a, b) {
    return b.sortDate - a.sortDate;
  });

  return {
    items: items.map(function (item) {
      return {
        title: item.title,
        href: item.href,
        date: item.date,
        source: item.source,
        searchTerm: item.searchTerm,
      };
    }),
    searchTerms: terms,
    searchTermsFromFallback: fromFallback,
  };
}

async function getGlp1Feed(options) {
  if (!getSerpApiKey()) {
    throw new Error('SERPAPI_KEY is not configured');
  }

  const limitPerTerm = Math.max(1, Math.min(Number(options?.limitPerTerm) || 1, 5));
  const cacheKey = String(limitPerTerm);
  const now = Date.now();

  if (cache && cache.key === cacheKey && now - cache.at < CACHE_TTL_MS) {
    return cache.feed;
  }

  const feed = await buildFeed(limitPerTerm);
  cache = { key: cacheKey, at: now, feed };
  return feed;
}

module.exports = { getGlp1Feed };
