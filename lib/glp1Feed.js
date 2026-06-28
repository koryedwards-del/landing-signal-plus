/**
 * GLP-1 news feed for signalplushealth.com (website only).
 * Curated sources — no Google, no CNBC.
 */

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const OPENAI_TIMEOUT_MS = 120000;
const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_AGE_DAYS = 30;
const SEED_QUERY = 'GLP-1';
const TOP_TERMS_COUNT = 4;

const ALLOWED_DOMAINS = [
  'statnews.com',
  'reuters.com',
  'fda.gov',
  'npr.org',
  'apnews.com',
  'medscape.com',
];

const BLOCKED_DOMAINS = [
  'news.google.com',
  'google.com',
  'cnbc.com',
  'healthline.com',
  'goodrx.com',
  'healthcentral.com',
  'forbes.com',
];

const RSS_FEEDS = [
  { name: 'STAT', domain: 'statnews.com', url: 'https://www.statnews.com/feed/' },
  {
    name: 'FDA',
    domain: 'fda.gov',
    url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml',
  },
  { name: 'NPR', domain: 'npr.org', url: 'https://feeds.npr.org/1128/rss.xml' },
];

/** Block junk domains at search time — ALLOWED_DOMAINS enforced after. */
const OPENAI_BLOCKED_DOMAINS = [
  'cnbc.com',
  'healthline.com',
  'goodrx.com',
  'healthcentral.com',
  'forbes.com',
  'news.google.com',
];

const GLP1_PATTERN =
  /\b(glp-?1s?|ozempic|wegovy|mounjaro|tirzepatide|semaglutide|zepbound|retatrutide|liraglutide|saxenda|victoza|rybelsus|novo nordisk|eli lilly|weight[\s-]loss drugs?|obesity drugs?|anti-obesity)\b/i;

const CLICKBAIT_TITLE =
  /\b(\d+\s+(tips|ways|things|reasons)|what to know|what'?s the difference|week by week|how to|everything you need|beginner'?s guide|guide to|side effects to expect)\b/i;

let cache = null;

function getOpenAiKey() {
  return process.env.OPENAI_API_KEY || '';
}

function getModel() {
  return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

function decodeEntities(value) {
  return String(value)
    .replace(/&#(\d+);/g, function (_, code) {
      return String.fromCharCode(Number(code));
    })
    .replace(/&#x([0-9a-f]+);/gi, function (_, hex) {
      return String.fromCharCode(parseInt(hex, 16));
    })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#xA0;/g, ' ');
}

function extractTag(block, tag) {
  const match = block.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'i'));
  return match ? decodeEntities(match[1].trim()) : '';
}

function stripHtml(value) {
  return decodeEntities(String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
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
    parsed.searchParams.delete('utm_campaign');
    return parsed.toString();
  } catch (err) {
    return String(url || '').trim();
  }
}

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch (err) {
    return '';
  }
}

function domainIsAllowed(url) {
  const host = hostnameFromUrl(url);
  if (!host) return false;
  if (BLOCKED_DOMAINS.some(function (blocked) { return host === blocked || host.endsWith('.' + blocked); })) {
    return false;
  }
  return ALLOWED_DOMAINS.some(function (allowed) {
    return host === allowed || host.endsWith('.' + allowed);
  });
}

function matchesGlp1(text) {
  return GLP1_PATTERN.test(String(text || ''));
}

function isClickbait(title) {
  return CLICKBAIT_TITLE.test(String(title || ''));
}

function isRecentEnough(sortDate) {
  if (!sortDate) return true;
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return sortDate >= cutoff;
}

function sourceFromDomain(url, fallback) {
  const host = hostnameFromUrl(url);
  const map = {
    'statnews.com': 'STAT',
    'reuters.com': 'Reuters',
    'fda.gov': 'FDA',
    'npr.org': 'NPR',
    'apnews.com': 'AP',
    'medscape.com': 'Medscape',
  };
  for (const domain of ALLOWED_DOMAINS) {
    if (host === domain || host.endsWith('.' + domain)) {
      return map[domain] || fallback || domain;
    }
  }
  return fallback || host;
}

function parseSortDate(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function titleFromUrl(url) {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    let slug = segments.pop() || '';
    slug = slug.replace(/\.(html?|shtml|php|aspx)$/i, '');
    slug = decodeURIComponent(slug).replace(/[-_+]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!slug || slug.length < 8) return '';
    return slug.charAt(0).toUpperCase() + slug.slice(1);
  } catch (err) {
    return '';
  }
}

function normalizeItem(raw, options) {
  const title = String(raw.title || '').trim();
  const href = cleanUrl(raw.href || raw.link || '');
  const pubDate = raw.pubDate || raw.date || '';
  const sortDate = raw.sortDate || new Date(pubDate).getTime() || 0;

  if (!title || !href || !/^https?:\/\//i.test(href)) return null;
  if (!domainIsAllowed(href)) return null;
  if (isClickbait(title)) return null;
  if (!isRecentEnough(sortDate)) return null;

  const textBlob = title + ' ' + String(raw.description || raw.searchTerm || '');
  if (!options?.trustSource && !matchesGlp1(textBlob)) return null;

  return {
    title,
    href,
    date: formatDisplayDate(pubDate || sortDate),
    source: String(raw.source || sourceFromDomain(href, '')).trim(),
    searchTerm: String(raw.searchTerm || sourceFromDomain(href, '')).trim(),
    sortDate,
  };
}

function parseRssItems(xml, sourceName) {
  const items = [];
  const itemPattern = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemPattern.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const pubDate = extractTag(block, 'pubDate');
    const description = stripHtml(extractTag(block, 'description') || extractTag(block, 'content:encoded'));

    items.push({
      title,
      href: link,
      pubDate,
      description,
      source: sourceName,
      sortDate: new Date(pubDate).getTime() || 0,
    });
  }

  return items;
}

async function fetchRssFeed(feed) {
  const response = await fetch(feed.url, {
    headers: { 'User-Agent': 'SignalPlusLanding/1.0' },
  });
  if (!response.ok) throw new Error(feed.name + ' RSS HTTP ' + response.status);
  const xml = await response.text();
  return parseRssItems(xml, feed.name);
}

async function fetchRssItems() {
  const items = [];

  for (const feed of RSS_FEEDS) {
    try {
      const feedItems = await fetchRssFeed(feed);
      for (const raw of feedItems) {
        const item = normalizeItem(raw);
        if (item) items.push(item);
      }
    } catch (err) {
      console.warn('GLP-1 RSS source failed:', feed.name, err.message);
    }
  }

  return items;
}

function buildOpenAiPrompt(limitPerTerm, maxItems) {
  return (
    'Build a GLP-1 news feed for signalplushealth.com.\n\n' +
    '1. Find the top ' +
    TOP_TERMS_COUNT +
    ' GLP-1-related news topics people are searching in the US right now (seed: "' +
    SEED_QUERY +
    '").\n' +
    '2. For each topic, find up to ' +
    limitPerTerm +
    ' recent news stories from the last ' +
    MAX_AGE_DAYS +
    ' days.\n\n' +
    'Only include articles hosted on these publisher domains:\n' +
    '- statnews.com (STAT)\n' +
    '- reuters.com (Reuters)\n' +
    '- fda.gov (FDA)\n' +
    '- npr.org (NPR)\n' +
    '- apnews.com (AP)\n' +
    '- medscape.com (Medscape)\n\n' +
    'Rules:\n' +
    '- Real https article URLs only — no Google News, CNBC, Healthline, GoodRx, or Forbes.\n' +
    '- Real news only: FDA actions, trials, policy, approvals, shortages — not explainers, tips, or clickbait.\n' +
    '- No duplicates. Return at most ' +
    maxItems +
    ' total items.\n' +
    '- date: US format like "Jun 28, 2026".\n' +
    '- source: publisher name.\n' +
    '- searchTerm: the topic that found the story.\n\n' +
    'Return ONLY valid JSON (no markdown):\n' +
    '{"searchTerms":["topic1"],"items":[{"title":"...","href":"https://...","date":"Jun 28, 2026","source":"Reuters","searchTerm":"topic1"}]}'
  );
}

function extractOutputText(payload) {
  const chunks = [];
  for (const item of payload.output || []) {
    if (item.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const block of item.content) {
      if (block.type === 'output_text' && block.text) chunks.push(block.text);
    }
  }
  return chunks.join('\n').trim();
}

function extractCitationItems(payload) {
  const items = [];
  for (const item of payload.output || []) {
    if (item.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const block of item.content) {
      if (block.type !== 'output_text') continue;
      for (const ann of block.annotations || []) {
        if (ann.type !== 'url_citation') continue;
        const href = cleanUrl(ann.url || '');
        const title = String(ann.title || '').trim() || titleFromUrl(href);
        items.push({
          title,
          href,
          pubDate: '',
          source: sourceFromDomain(href, ''),
          sortDate: 0,
          trustSource: true,
        });
      }
    }
  }
  return items;
}

function extractWebSearchSourceItems(payload) {
  const items = [];
  for (const output of payload.output || []) {
    if (output.type !== 'web_search_call') continue;
    const sources = (output.action && output.action.sources) || [];
    for (const src of sources) {
      if (!src || typeof src !== 'object') continue;
      const href = cleanUrl(src.url || src.link || src.href || '');
      const title =
        String(src.title || src.name || src.snippet || '').trim() || titleFromUrl(href);
      items.push({
        title,
        href,
        pubDate: src.published_date || src.date || '',
        source: sourceFromDomain(href, ''),
        sortDate: parseSortDate(src.published_date || src.date),
        trustSource: true,
      });
    }
  }
  return items;
}

function collectOpenAiRawItems(payload) {
  const rawItems = [];
  const seen = new Set();

  function add(raw) {
    const href = cleanUrl(raw.href || raw.url || '');
    if (!href || seen.has(href)) return;
    seen.add(href);
    const title = String(raw.title || '').trim() || titleFromUrl(href);
    rawItems.push({
      title,
      href,
      pubDate: raw.pubDate || raw.date || '',
      source: raw.source || sourceFromDomain(href, ''),
      searchTerm: raw.searchTerm || raw.source || sourceFromDomain(href, ''),
      description: title,
      sortDate: raw.sortDate || parseSortDate(raw.pubDate || raw.date),
      trustSource: true,
    });
  }

  const parsed = parseJsonFromText(extractOutputText(payload));
  if (parsed && Array.isArray(parsed.items)) {
    for (const item of parsed.items) add(item);
  }
  for (const item of extractCitationItems(payload)) add(item);
  for (const item of extractWebSearchSourceItems(payload)) add(item);

  return rawItems;
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

async function fetchOpenAiItems(maxItems, limitPerTerm) {
  const apiKey = getOpenAiKey();
  if (!apiKey) return [];

  const controller = new AbortController();
  const timer = setTimeout(function () {
    controller.abort();
  }, OPENAI_TIMEOUT_MS);

  let payload;
  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: getModel(),
        tools: [
          {
            type: 'web_search',
            filters: { blocked_domains: OPENAI_BLOCKED_DOMAINS.slice() },
            search_context_size: 'medium',
          },
        ],
        tool_choice: 'required',
        include: ['web_search_call.action.sources'],
        input: buildOpenAiPrompt(limitPerTerm, maxItems),
      }),
      signal: controller.signal,
    });

    payload = await response.json().catch(function () {
      return {};
    });
    if (!response.ok) {
      const message =
        (payload.error && payload.error.message) ||
        payload.message ||
        'OpenAI HTTP ' + response.status;
      throw new Error(message);
    }
  } finally {
    clearTimeout(timer);
  }

  const rawItems = collectOpenAiRawItems(payload);
  const items = [];
  const seen = new Set();

  for (const raw of rawItems) {
    const normalized = normalizeItem(raw, { trustSource: true });
    if (!normalized || seen.has(normalized.href)) continue;
    seen.add(normalized.href);
    items.push(normalized);
  }

  return items;
}

function mergeItems(rssItems, openAiItems, maxItems) {
  const merged = [];
  const seen = new Set();

  for (const item of rssItems.concat(openAiItems)) {
    if (seen.has(item.href)) continue;
    seen.add(item.href);
    merged.push(item);
  }

  merged.sort(function (a, b) {
    return (b.sortDate || 0) - (a.sortDate || 0);
  });

  return merged.slice(0, maxItems).map(function (item) {
    return {
      title: item.title,
      href: item.href,
      date: item.date,
      source: item.source,
      searchTerm: item.searchTerm,
    };
  });
}

async function buildFeed(limitPerTerm) {
  const maxItems = Math.max(12, Math.min(TOP_TERMS_COUNT * limitPerTerm, 20));

  const [rssItems, openAiItems] = await Promise.all([
    fetchRssItems(),
    fetchOpenAiItems(maxItems, limitPerTerm).catch(function (err) {
      console.warn('GLP-1 OpenAI source failed:', err.message);
      return [];
    }),
  ]);

  const items = mergeItems(rssItems, openAiItems, maxItems);
  if (!items.length) {
    throw new Error('No GLP-1 news matched the curated sources');
  }

  const sources = [];
  const seenSources = new Set();
  for (const item of items) {
    const name = item.source || item.searchTerm;
    if (!name || seenSources.has(name)) continue;
    seenSources.add(name);
    sources.push(name);
  }

  return {
    items,
    searchTerms: sources,
    searchTermsFromFallback: false,
  };
}

async function getGlp1Feed(options) {
  const limitPerTerm = Math.max(1, Math.min(Number(options?.limitPerTerm) || 1, 5));
  const refresh = !!(options && options.refresh);
  const cacheKey = String(limitPerTerm);
  const now = Date.now();

  if (!refresh && cache && cache.key === cacheKey && now - cache.at < CACHE_TTL_MS) {
    return cache.feed;
  }

  const feed = await buildFeed(limitPerTerm);
  feed.fetchedAt = new Date(now).toISOString();
  cache = { key: cacheKey, at: now, feed };
  return feed;
}

module.exports = { getGlp1Feed };
