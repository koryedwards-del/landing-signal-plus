/**
 * GLP-1 news feed for signalplushealth.com — same blended pipeline as the Signal+ app.
 * Supply spine (FDA, Fierce Pharma, BioPharma Dive) + curated Google News queries + scoring.
 */

const {
  curateBlendedGlp1FeedItems,
  GLP1_BLENDED_QUERIES,
} = require('./glp1/glp1BlendedFeed');
const { GLP1_SUPPLY_FEEDS } = require('./glp1/glp1SupplySources');

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** @type {{ at: number, feed: object } | null} */
let cache = null;

function getGlp1WeekLabel(date = new Date()) {
  const end = new Date(date);
  const start = new Date(date);
  start.setDate(start.getDate() - 6);
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' });
  const year = end.getFullYear();
  return 'Week of ' + fmt.format(start) + ' – ' + fmt.format(end) + ', ' + year;
}

async function buildFeed() {
  const items = await curateBlendedGlp1FeedItems();
  if (!items.length) {
    throw new Error('No GLP-1 news matched blended sources');
  }

  return {
    weekLabel: getGlp1WeekLabel(),
    searchTerms: GLP1_BLENDED_QUERIES,
    supplySources: GLP1_SUPPLY_FEEDS.map(function (feed) {
      return feed.name;
    }),
    mode: 'blended',
    items,
  };
}

/**
 * @param {{ refresh?: boolean }} [options]
 */
async function getGlp1Feed(options) {
  const refresh = !!(options && options.refresh);
  const now = Date.now();

  if (!refresh && cache && now - cache.at < CACHE_TTL_MS) {
    return cache.feed;
  }

  const feed = await buildFeed();
  feed.fetchedAt = new Date(now).toISOString();
  cache = { at: now, feed: feed };
  return feed;
}

module.exports = { getGlp1Feed };
