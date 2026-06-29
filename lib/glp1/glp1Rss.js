const USER_AGENT = 'SignalPlusLanding/1.0 (+https://www.signalplushealth.com)';

function decodeXml(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(value) {
  return decodeXml(String(value))
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatNewsDate(parsed) {
  if (!parsed || Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function parsePubDate(pubDate) {
  if (!pubDate) return null;
  const trimmed = String(pubDate).trim();
  let parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const match = trimmed.match(
    /^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(am|pm))?/i,
  );
  if (!match) return null;

  const months = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const month = months[match[1].toLowerCase()];
  if (month === undefined) return null;

  let hour = match[4] ? Number.parseInt(match[4], 10) : 12;
  const minute = match[5] ? Number.parseInt(match[5], 10) : 0;
  const meridiem = match[6]?.toLowerCase();
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;

  return new Date(
    Number.parseInt(match[3], 10),
    month,
    Number.parseInt(match[2], 10),
    hour,
    minute,
  );
}

/**
 * @param {string} xml
 * @param {number} limit
 */
function parseRssXml(xml, limit) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match = itemRegex.exec(xml);

  while (match && items.length < limit) {
    const block = match[1];
    const rawTitle = block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '';
    const href =
      block.match(/<link>([\s\S]*?)<\/link>/i)?.[1]?.trim() ||
      block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1]?.trim() ||
      '';
    const date = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() ?? '';
    const description = block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? '';

    const title = stripHtml(rawTitle);
    if (!title || !href) {
      match = itemRegex.exec(xml);
      continue;
    }

    const parsed = parsePubDate(date);
    items.push({
      title,
      href,
      description: stripHtml(description),
      date: formatNewsDate(parsed),
      publishedAt: parsed?.getTime() ?? 0,
    });
    match = itemRegex.exec(xml);
  }

  return items;
}

/**
 * @param {string} feedUrl
 * @param {{ limit?: number }} [options]
 */
async function fetchRssFeed(feedUrl, options = {}) {
  const limit = options.limit ?? 20;
  const response = await fetch(feedUrl, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!response.ok) return [];
  const xml = await response.text();
  return parseRssXml(xml, limit);
}

module.exports = {
  parsePubDate,
  parseRssXml,
  USER_AGENT,
  fetchRssFeed,
};
