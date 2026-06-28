/**
 * GLP-1 news feed for signalplushealth.com (website only).
 * Uses OpenAI web search + OPENAI_API_KEY on Render.
 */

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const SEED_QUERY = 'GLP-1';
const TOP_TERMS_COUNT = 3;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_MODEL = 'gpt-4o-mini';

const FALLBACK_SEARCH_TERMS = [
  'glp-1 insurance coverage',
  'glp-1 side effects',
  'tirzepatide vs semaglutide',
];

const FEED_SCHEMA = {
  type: 'object',
  properties: {
    searchTerms: {
      type: 'array',
      items: { type: 'string' },
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          href: { type: 'string' },
          date: { type: 'string' },
          source: { type: 'string' },
          searchTerm: { type: 'string' },
        },
        required: ['title', 'href', 'date', 'source', 'searchTerm'],
        additionalProperties: false,
      },
    },
  },
  required: ['searchTerms', 'items'],
  additionalProperties: false,
};

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

function buildPrompt(limitPerTerm) {
  const maxItems = TOP_TERMS_COUNT * limitPerTerm;

  return (
    'You are building a GLP-1 news feed for signalplushealth.com.\n\n' +
    '1. Find the top ' +
    TOP_TERMS_COUNT +
    ' related Google search topics for "' +
    SEED_QUERY +
    '" in the United States (what people are searching now).\n' +
    '2. For each topic, find up to ' +
    limitPerTerm +
    ' recent, real news headlines from reputable publishers.\n\n' +
    'Rules:\n' +
    '- Only include stories with a real https URL to the original article.\n' +
    '- Prefer stories from the last 14 days.\n' +
    '- No duplicates.\n' +
    '- Return at most ' +
    maxItems +
    ' total items.\n' +
    '- date should be a human-readable US date like "Jun 28, 2026".\n' +
    '- source is the publisher name (e.g. Reuters, NYT, Healthline).\n' +
    '- searchTerm is the Google search topic that found that story.'
  );
}

async function fetchFeedFromOpenAi(limitPerTerm) {
  const apiKey = getOpenAiKey();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getModel(),
      tools: [{ type: 'web_search' }],
      tool_choice: 'required',
      input: buildPrompt(limitPerTerm),
      text: {
        format: {
          type: 'json_schema',
          name: 'glp1_feed',
          strict: true,
          schema: FEED_SCHEMA,
        },
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      (payload.error && payload.error.message) ||
      payload.message ||
      'OpenAI HTTP ' + response.status;
    throw new Error(message);
  }

  const rawText = extractOutputText(payload);
  if (!rawText) {
    throw new Error('OpenAI returned no feed content');
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new Error('OpenAI returned invalid JSON');
  }

  return normalizeFeed(parsed, limitPerTerm);
}

function normalizeFeed(parsed, limitPerTerm) {
  const searchTerms = Array.isArray(parsed.searchTerms)
    ? parsed.searchTerms.map((term) => String(term).trim()).filter(Boolean)
    : [];

  const terms =
    searchTerms.length > 0 ? searchTerms.slice(0, TOP_TERMS_COUNT) : FALLBACK_SEARCH_TERMS.slice();

  const items = [];
  const seen = new Set();

  for (const raw of parsed.items || []) {
    const title = String(raw.title || '').trim();
    const href = String(raw.href || '').trim();
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

  items.sort(function (a, b) {
    const dateA = new Date(a.date).getTime() || 0;
    const dateB = new Date(b.date).getTime() || 0;
    return dateB - dateA;
  });

  const maxItems = TOP_TERMS_COUNT * limitPerTerm;

  return {
    items: items.slice(0, maxItems),
    searchTerms: terms,
    searchTermsFromFallback: searchTerms.length === 0,
  };
}

async function getGlp1Feed(options) {
  const limitPerTerm = Math.max(1, Math.min(Number(options?.limitPerTerm) || 1, 5));
  const cacheKey = String(limitPerTerm);
  const now = Date.now();

  if (cache && cache.key === cacheKey && now - cache.at < CACHE_TTL_MS) {
    return cache.feed;
  }

  const feed = await fetchFeedFromOpenAi(limitPerTerm);
  cache = { key: cacheKey, at: now, feed };
  return feed;
}

module.exports = { getGlp1Feed };
