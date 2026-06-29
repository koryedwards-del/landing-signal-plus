const { fetchRssFeed } = require('./glp1Rss');
const { getNewsPoolForSearchTerms } = require('./glp1NewsFeed');
const { GLP1_SUPPLY_FEEDS,
  GLP1_SUPPLY_NEWS_QUERIES,
  isSupplyQueryArticle,
  isSupplyRssArticle, } = require('./glp1SupplySources');

const MAX_ITEMS_PER_FEED = 3;
const MAX_ITEMS_PER_QUERY = 2;

/**
 * @returns {Promise<Array<{
 *   title: string,
 *   href: string,
 *   date: string,
 *   source: string,
 *   searchTerm: string,
 *   lane: 'supply',
 *   publishedAt: number,
 * }>>}
 */
async function getGlp1SupplyPool() {
  const [rssPools, queryPool] = await Promise.all([
    Promise.all(
      GLP1_SUPPLY_FEEDS.map(async (feed) => {
        try {
          const rawItems = await fetchRssFeed(feed.url, { limit: feed.scanLimit });
          return rawItems
            .filter((item) => isSupplyRssArticle(item.title, item.description, item.publishedAt))
            .slice(0, MAX_ITEMS_PER_FEED)
            .map((item) => ({
              title: item.title,
              href: item.href,
              date: item.date,
              source: feed.name,
              searchTerm: feed.name,
              lane: 'supply',
              publishedAt: item.publishedAt,
            }));
        } catch {
          return [];
        }
      }),
    ),
    getNewsPoolForSearchTerms(GLP1_SUPPLY_NEWS_QUERIES, MAX_ITEMS_PER_QUERY, 'supply').then(
      (items) => items.filter((item) => isSupplyQueryArticle(item.title, item.publishedAt)),
    ),
  ]);

  return [...rssPools.flat(), ...queryPool].sort((a, b) => {
    const byDate = b.publishedAt - a.publishedAt;
    if (byDate !== 0) return byDate;
    return a.title.localeCompare(b.title);
  });
}

module.exports = {
  getGlp1SupplyPool,
};
