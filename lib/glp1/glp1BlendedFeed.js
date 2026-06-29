const { getNewsPoolForSearchTerms } = require('./glp1NewsFeed');
const { isBlockedNewsItem, isFactualNewsHeadline } = require('./glp1NewsFilters');
const { classifyGlp1Item } = require('./glp1Categories');
const { getGlp1SupplyPool } = require('./glp1SupplyFeed');

const QUERY_LIMIT = 2;
const MIN_SUPPLY_SCORE = 40;
const MIN_QUERY_SCORE = 48;
const MAX_ITEMS = 20;

/** Access, regulatory, safety, industry — no nutrition/fitness (Signal+ lane). */
const GLP1_NEWS_QUERIES = [
  'glp-1 medicare medicaid coverage when:90d',
  'FDA GLP-1 semaglutide tirzepatide approval when:90d',
  'GLP-1 insurance part D formulary when:90d',
  'GLP-1 drug safety warning FDA when:90d',
];

const BOOST_KEYWORDS = [
  'glp-1', 'glp1', 'semaglutide', 'tirzepatide', 'wegovy', 'ozempic', 'zepbound',
  'fda', 'medicare', 'medicaid', 'insurance', 'coverage', 'novo', 'lilly', 'approval',
  'warning', 'formulary', 'part d',
];

const NOISE = ['grocery', 'kroger', 'walmart', 'costco', 'shaquille', 'endorsement', 'super bowl ad'];

const TRUSTED = [
  'fda', 'fierce pharma', 'biopharma dive', 'reuters', 'associated press', 'axios',
  'cnn', 'nbc news', 'ap news',
];

function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function topicKey(title) {
  const normalized = normalizeTitle(title);
  const tokens = normalized.split(' ').filter(function (word) {
    return word.length > 3 && !/^(the|and|for|with|from|that|this|drug|drugs|glp|glp1)$/.test(word);
  });
  return tokens.slice(0, 6).join(' ');
}

function scoreItem(item) {
  const text = `${item.title} ${item.searchTerm || ''}`.toLowerCase();
  const sourceLower = (item.source || '').toLowerCase();
  const isSupply = item.lane === 'supply';
  let score = isSupply ? 40 : 8;

  if (item.publishedAt) {
    score += Math.max(0, 25 - ((Date.now() - item.publishedAt) / 86400000) * 2);
  }

  for (const kw of BOOST_KEYWORDS) {
    if (text.includes(kw)) score += 10;
  }

  if (TRUSTED.some(function (t) { return sourceLower.includes(t); })) score += 12;

  if (isFactualNewsHeadline(item.title)) score += 14;

  for (const kw of NOISE) {
    if (text.includes(kw)) score -= 40;
  }

  return score;
}

function isDuplicateOfSupply(queryItem, supplyTitles) {
  if (queryItem.lane === 'supply') return false;
  const queryTopic = topicKey(queryItem.title);
  if (!queryTopic) return false;

  for (const supplyTitle of supplyTitles) {
    const supplyTopic = topicKey(supplyTitle);
    if (!supplyTopic) continue;
    if (queryTopic === supplyTopic) return true;
    if (queryTopic.length > 12 && supplyTopic.includes(queryTopic.slice(0, 12))) return true;
    if (supplyTopic.length > 12 && queryTopic.includes(supplyTopic.slice(0, 12))) return true;
  }
  return false;
}

/**
 * @returns {Promise<Array<{ title: string, href: string, date: string, source: string, searchTerm: string, tag: string, tagLabel: string }>>}
 */
async function curateBlendedGlp1FeedItems() {
  const [supplyPool, queryPool] = await Promise.all([
    getGlp1SupplyPool(),
    getNewsPoolForSearchTerms(GLP1_NEWS_QUERIES, QUERY_LIMIT, 'query'),
  ]);

  const supplyTitles = supplyPool.map(function (item) { return item.title; });

  const pool = [...supplyPool, ...queryPool];
  const seenTitles = new Set();
  const seenTopics = new Set();

  const scored = pool
    .filter(function (item) { return !isBlockedNewsItem(item); })
    .filter(function (item) { return !isDuplicateOfSupply(item, supplyTitles); })
    .filter(function (item) {
      const titleKey = normalizeTitle(item.title);
      if (seenTitles.has(titleKey)) return false;
      seenTitles.add(titleKey);
      return true;
    })
    .map(function (item) { return { item: item, score: scoreItem(item) }; })
    .filter(function (row) {
      const min = row.item.lane === 'supply' ? MIN_SUPPLY_SCORE : MIN_QUERY_SCORE;
      return row.score >= min;
    })
    .sort(function (a, b) {
      return (b.item.publishedAt || 0) - (a.item.publishedAt || 0) || b.score - a.score;
    });

  const results = [];

  for (const row of scored) {
    if (results.length >= MAX_ITEMS) break;

    const topic = topicKey(row.item.title);
    if (topic && seenTopics.has(topic)) continue;
    if (topic) seenTopics.add(topic);

    const { publishedAt, lane, ...publicItem } = row.item;
    const category = classifyGlp1Item(row.item);
    results.push(Object.assign({}, publicItem, category));
  }

  return results;
}

module.exports = {
  GLP1_NEWS_QUERIES,
  curateBlendedGlp1FeedItems,
};
