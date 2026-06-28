const SEARCH_TERMS = [
  'GLP-1',
  'GLP-1 muscle loss',
  'ozempic mounjaro',
];

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

function formatDate(pubDate) {
  const parsed = new Date(pubDate);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
      date: formatDate(pubDate),
      source: source || '',
      pubDate,
    });
  }

  return items;
}

async function fetchTermFeed(term, limit) {
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

async function getGlp1Feed(options) {
  const limitPerTerm = Math.max(1, Math.min(Number(options?.limitPerTerm) || 1, 5));
  const items = [];
  const seen = new Set();

  for (const term of SEARCH_TERMS) {
    try {
      const termItems = await fetchTermFeed(term, limitPerTerm);
      for (const item of termItems) {
        if (seen.has(item.href)) continue;
        seen.add(item.href);
        items.push(item);
      }
    } catch (err) {
      console.warn('GLP-1 feed term failed:', term, err.message);
    }
  }

  items.sort(function (a, b) {
    const dateA = new Date(a.pubDate).getTime() || 0;
    const dateB = new Date(b.pubDate).getTime() || 0;
    return dateB - dateA;
  });

  return {
    items,
    searchTerms: SEARCH_TERMS,
  };
}

module.exports = { getGlp1Feed };
