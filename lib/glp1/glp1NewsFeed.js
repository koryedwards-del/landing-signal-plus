
const USER_AGENT = 'SignalPlusLanding/1.0 (+https://www.signalplushealth.com)';

/**
 * @typedef {{ searchTerm: string, title: string, href: string, source: string, date: string }} Glp1NewsItem
 */

/**
 * @param {string} xml
 * @param {number} limit
 * @returns {Array<{ title: string, href: string, date: string, source: string }>}
 */
function parseGoogleNewsRss(xml, limit) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match = itemRegex.exec(xml);

  while (match && items.length < limit) {
    const block = match[1];
    const rawTitle = block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '';
    const href = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? '';
    const date = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ?? '';

    const title = decodeXml(rawTitle)
      .replace(/<!\[CDATA\[|\]\]>/g, '')
      .trim();

    if (!title || !href) {
      match = itemRegex.exec(xml);
      continue;
    }

    const splitAt = title.lastIndexOf(' - ');
    const headline = splitAt > 0 ? title.slice(0, splitAt).trim() : title;
    const source = splitAt > 0 ? title.slice(splitAt + 3).trim() : 'Google News';
    const parsed = parsePubDate(date);

    items.push({
      title: headline,
      href,
      date: formatNewsDate(parsed),
      publishedAt: parsed?.getTime() ?? 0,
      source,
    });
    match = itemRegex.exec(xml);
  }

  return items;
}

function decodeXml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function formatNewsDate(parsed) {
  if (!parsed || Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function parsePubDate(pubDate) {
  if (!pubDate) return null;
  const parsed = new Date(pubDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * @param {string} searchTerm
 * @param {number} limit
 */
async function fetchNewsForTerm(searchTerm, limit = 1) {
  const url = new URL('https://news.google.com/rss/search');
  url.searchParams.set('q', searchTerm);
  url.searchParams.set('hl', 'en-US');
  url.searchParams.set('gl', 'US');
  url.searchParams.set('ceid', 'US:en');

  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) return [];

  const xml = await response.text();
  return parseGoogleNewsRss(xml, limit).map((item) => ({
    ...item,
    searchTerm,
  }));
}

/**
 * @param {string[]} searchTerms
 * @param {number} [limitPerTerm=3]
 * @param {string} [lane='trends']
 * @returns {Promise<Array<Glp1NewsItem & { publishedAt: number, lane: string }>>}
 */
async function getNewsPoolForSearchTerms(searchTerms, limitPerTerm = 3, lane = 'trends') {
  const seenTitles = new Set();
  /** @type {Array<Glp1NewsItem & { publishedAt: number, lane: string }>} */
  const items = [];

  for (const searchTerm of searchTerms) {
    try {
      const results = await fetchNewsForTerm(searchTerm, limitPerTerm);
      for (const item of results) {
        const key = normalizeTitle(item.title);
        if (seenTitles.has(key)) continue;
        seenTitles.add(key);
        items.push({ ...item, lane });
      }
    } catch {
      // Skip failed term; other terms may still return results.
    }
  }

  return items.sort((a, b) => {
    const byDate = b.publishedAt - a.publishedAt;
    if (byDate !== 0) return byDate;
    return a.title.localeCompare(b.title);
  });
}

/**
 * @param {string[]} searchTerms
 * @param {number} [limitPerTerm=3]
 * @returns {Promise<Glp1NewsItem[]>}
 */
async function getNewsForSearchTerms(searchTerms, limitPerTerm = 3) {
  return getNewsPoolForSearchTerms(searchTerms, limitPerTerm).then((items) =>
    items.map(({ publishedAt, lane, ...item }) => item),
  );
}

module.exports = {
  parseGoogleNewsRss,
  parsePubDate,
  USER_AGENT,
  fetchNewsForTerm,
  getNewsPoolForSearchTerms,
  getNewsForSearchTerms,
};
