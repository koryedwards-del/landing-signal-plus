/**
 * GLP-1 news feed for signalplushealth.com (website only).
 * Primary sources only — FDA, manufacturers, insurance/Medicare.
 * No news aggregators, trends, or OpenAI.
 */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_AGE_DAYS = 90;
const MAX_FEED_ITEMS = 20;

const PRIMARY_DOMAINS = [
  'fda.gov',
  'cms.gov',
  'medicare.gov',
  'medicaid.gov',
  'investor.lilly.com',
  'lilly.com',
  'novonordisk.com',
  'globenewswire.com',
  'prnewswire.com',
];

const GLP1_PATTERN =
  /\b(glp-?1s?|ozempic|wegovy|mounjaro|tirzepatide|semaglutide|zepbound|retatrutide|liraglutide|saxenda|victoza|rybelsus|novo nordisk|eli lilly|weight[\s-]loss drugs?|obesity drugs?|anti-obesity|orforglipron|foundayo)\b/i;

const MANUFACTURER_TOPIC_PATTERN =
  /\b(glp-?1s?|ozempic|wegovy|mounjaro|tirzepatide|semaglutide|zepbound|retatrutide|liraglutide|saxenda|victoza|rybelsus|orforglipron|foundayo|weight[\s-]loss|obesity|medicare|medicaid|part d)\b/i;

const ACCESS_PATTERN =
  /\b(medicare|medicaid|part d|prescription access|drug coverage|copay|coinsurance|premium|insurance|formulary|pbm|prior authorization|out-of-pocket|coverage gap)\b/i;

const MANUFACTURER_NOISE =
  /\b(share repurchase|repurchase programme|annual general meeting|financial calendar|conference call|investor presentation)\b/i;

const CLICKBAIT_TITLE =
  /\b(\d+\s+(tips|ways|things|reasons)|what to know|what'?s the difference|week by week|how to|everything you need|beginner'?s guide|guide to|side effects to expect)\b/i;

/** @type {{ key: string, at: number, feed: object } | null} */
let cache = null;

const PRIMARY_FEEDS = [
  {
    name: 'FDA',
    url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml',
    topic: 'regulatory',
  },
  {
    name: 'FDA',
    url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/drugs/rss.xml',
    topic: 'regulatory',
  },
  {
    name: 'Eli Lilly',
    url: 'https://investor.lilly.com/rss/news-releases.xml?items=40',
    topic: 'manufacturer',
    publisherMatch: 'lilly',
  },
  {
    name: 'Novo Nordisk',
    url: 'https://www.prnewswire.com/rss/news-releases-list.rss',
    topic: 'novo',
  },
];

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

function extractContributors(block) {
  const names = [];
  const patterns = [/<dc:contributor>([\s\S]*?)<\/dc:contributor>/gi, /<dc:creator>([\s\S]*?)<\/dc:creator>/gi];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(block)) !== null) {
      names.push(decodeEntities(match[1].trim()));
    }
  }
  return names;
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

function domainIsPrimary(url) {
  const host = hostnameFromUrl(url);
  if (!host) return false;
  return PRIMARY_DOMAINS.some(function (domain) {
    return host === domain || host.endsWith('.' + domain);
  });
}

function parseSortDate(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isRecentEnough(sortDate) {
  if (!sortDate) return true;
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return sortDate >= cutoff;
}

function isClickbait(title) {
  return CLICKBAIT_TITLE.test(String(title || ''));
}

function matchesTopic(text, topic, title) {
  const blob = String(text || '');
  const headline = String(title || '');
  if (topic === 'manufacturer') {
    if (MANUFACTURER_NOISE.test(blob)) return false;
    return MANUFACTURER_TOPIC_PATTERN.test(headline);
  }
  if (topic === 'novo') {
    if (MANUFACTURER_NOISE.test(blob)) return false;
    if (!MANUFACTURER_TOPIC_PATTERN.test(headline)) return false;
    return /\b(novo nordisk|wegovy|ozempic|rybelsus|saxenda|victoza)\b/i.test(blob);
  }
  return GLP1_PATTERN.test(blob) || ACCESS_PATTERN.test(blob);
}

function publisherMatches(contributors, expected) {
  if (!expected) return true;
  const needle = expected.toLowerCase();
  return contributors.some(function (name) {
    return String(name || '').toLowerCase().includes(needle);
  });
}

function parseRssItems(xml, feedConfig) {
  const items = [];
  const itemPattern = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemPattern.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const pubDate = extractTag(block, 'pubDate');
    const description = stripHtml(extractTag(block, 'description') || extractTag(block, 'content:encoded'));
    const contributors = extractContributors(block);

    items.push({
      title: title.includes(' - ') ? title.slice(0, title.lastIndexOf(' - ')).trim() : title,
      href: link,
      pubDate,
      description,
      source: feedConfig.name,
      contributors,
      sortDate: parseSortDate(pubDate),
    });
  }

  return items;
}

function normalizeItem(raw, feedConfig) {
  const title = String(raw.title || '').trim();
  const href = cleanUrl(raw.href || '');
  const pubDate = raw.pubDate || '';
  const sortDate = raw.sortDate || parseSortDate(pubDate);
  const textBlob = title + ' ' + String(raw.description || '');

  if (!title || !href || !/^https?:\/\//i.test(href)) return null;
  if (!domainIsPrimary(href)) return null;
  if (isClickbait(title)) return null;
  if (!isRecentEnough(sortDate)) return null;
  if (feedConfig.topic === 'novo' && publisherMatches(raw.contributors || [], 'eli lilly')) return null;
  if (!publisherMatches(raw.contributors || [], feedConfig.publisherMatch)) return null;
  if (!matchesTopic(textBlob, feedConfig.topic, title)) return null;

  return {
    title,
    href,
    date: formatDisplayDate(pubDate || sortDate),
    source: feedConfig.name,
    searchTerm: feedConfig.name,
    sortDate,
  };
}

function dedupeItems(rawItems, feedConfig) {
  const items = [];
  const seen = new Set();

  for (const raw of rawItems) {
    const normalized = normalizeItem(raw, feedConfig);
    if (!normalized || seen.has(normalized.href)) continue;
    seen.add(normalized.href);
    items.push(normalized);
  }

  return items;
}

async function fetchRssFeed(feedConfig) {
  const response = await fetch(feedConfig.url, {
    headers: { 'User-Agent': 'SignalPlusLanding/1.0' },
  });
  if (!response.ok) throw new Error(feedConfig.name + ' RSS HTTP ' + response.status);
  const xml = await response.text();
  return parseRssItems(xml, feedConfig);
}

async function fetchPrimaryItems() {
  const items = [];

  for (const feedConfig of PRIMARY_FEEDS) {
    try {
      const feedItems = await fetchRssFeed(feedConfig);
      items.push.apply(items, dedupeItems(feedItems, feedConfig));
    } catch (err) {
      console.warn('GLP-1 primary source failed:', feedConfig.name, err.message);
    }
  }

  return items;
}

function sortAndLimit(items, maxItems) {
  items.sort(function (a, b) {
    return (b.sortDate || 0) - (a.sortDate || 0);
  });

  return items.slice(0, maxItems).map(function (item) {
    return {
      title: item.title,
      href: item.href,
      date: item.date,
      source: item.source,
      searchTerm: item.searchTerm,
    };
  });
}

async function buildFeed() {
  const items = sortAndLimit(await fetchPrimaryItems(), MAX_FEED_ITEMS);
  if (!items.length) {
    throw new Error('No GLP-1 news matched primary sources');
  }

  const sources = [];
  const seenSources = new Set();
  for (const item of items) {
    if (!item.source || seenSources.has(item.source)) continue;
    seenSources.add(item.source);
    sources.push(item.source);
  }

  return {
    items,
    searchTerms: sources,
    primarySources: true,
  };
}

async function getGlp1Feed(options) {
  const refresh = !!(options && options.refresh);
  const cacheKey = 'primary';
  const now = Date.now();

  if (!refresh && cache && cache.key === cacheKey && now - cache.at < CACHE_TTL_MS) {
    return cache.feed;
  }

  const feed = await buildFeed();
  feed.fetchedAt = new Date(now).toISOString();
  cache = { key: cacheKey, at: now, feed };
  return feed;
}

module.exports = { getGlp1Feed };
