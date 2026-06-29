const { getNewsPoolForSearchTerms } = require('./glp1NewsFeed');
const { isListicleHeadline } = require('./glp1NewsFilters');
const { getGlp1SupplyPool } = require('./glp1SupplyFeed');

const QUERY_LIMIT = 3;
const MIN_SCORE = 40;

/** Med + muscle/fitness crossover queries for the app GLP-1 News feed. */
const GLP1_BLENDED_QUERIES = [
  'glp-1 insurance coverage',
  'glp-1 side effects muscle',
  'glp-1 FDA Wegovy Ozempic',
  'GLP-1 weight loss muscle protein exercise',
  'strength training muscle loss weight loss',
  'exercise habits longevity health',
];

const BOOST_KEYWORDS = [
  'glp-1', 'glp1', 'semaglutide', 'tirzepatide', 'wegovy', 'ozempic', 'zepbound',
  'fda', 'medicare', 'medicaid', 'insurance', 'coverage', 'novo', 'lilly', 'approval',
  'muscle', 'protein', 'exercise', 'fitness', 'workout', 'strength', 'training',
  'sarcopenia', 'movement', 'longevity',
];

const NOISE = ['grocery', 'kroger', 'walmart', 'costco', 'shaquille', 'endorsement', 'super bowl ad'];

const TRUSTED = [
  'harvard health', 'stanford', 'mayo clinic', 'nih', 'fda', 'ama', 'american medical',
  'cdc', 'axios', 'fierce pharma', 'medscape',
];

function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function scoreItem(item) {
  const text = `${item.title} ${item.searchTerm || ''}`.toLowerCase();
  const sourceLower = (item.source || '').toLowerCase();
  const isSpine = item.lane === 'supply' || item.lane === 'spine';
  let score = isSpine ? 40 : 8;

  if (item.publishedAt) {
    score += Math.max(0, 25 - ((Date.now() - item.publishedAt) / 86400000) * 2);
  }

  for (const kw of BOOST_KEYWORDS) {
    if (text.includes(kw)) score += 10;
  }

  if (TRUSTED.some((t) => sourceLower.includes(t))) score += 12;

  for (const kw of NOISE) {
    if (text.includes(kw)) score -= 40;
  }

  return score;
}

function isExcluded(item) {
  const text = item.title.toLowerCase();
  if (isListicleHeadline(item.title)) return true;
  if (NOISE.some((k) => text.includes(k))) return true;
  return false;
}

/**
 * GLP-1 + fitness blended feed: supply spine, crossover queries, no item cap, no listicles.
 * @returns {Promise<Array<{ title: string, href: string, date: string, source: string, searchTerm: string }>>}
 */
async function curateBlendedGlp1FeedItems() {
  const [supplyPool, queryPool] = await Promise.all([
    getGlp1SupplyPool(),
    getNewsPoolForSearchTerms(GLP1_BLENDED_QUERIES, QUERY_LIMIT, 'query'),
  ]);

  const pool = [...supplyPool, ...queryPool];
  const seen = new Set();

  return pool
    .filter((item) => !isExcluded(item))
    .filter((item) => {
      const key = normalizeTitle(item.title);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item) => ({ item, score: scoreItem(item) }))
    .filter(({ score }) => score >= MIN_SCORE)
    .sort(
      (a, b) =>
        (b.item.publishedAt || 0) - (a.item.publishedAt || 0) || b.score - a.score,
    )
    .map(({ item }) => {
      const { publishedAt, lane, ...publicItem } = item;
      return publicItem;
    });
}

module.exports = {
  GLP1_BLENDED_QUERIES,
  curateBlendedGlp1FeedItems,
};
