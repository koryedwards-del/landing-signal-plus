const PWA_FEED_BASE =
  process.env.GLP1_FEED_URL || 'https://pwa-signal-plus-v2.onrender.com/api/glp1-feed';

async function getGlp1Feed(options) {
  const limitPerTerm = Math.max(1, Math.min(Number(options?.limitPerTerm) || 1, 5));
  const url =
    PWA_FEED_BASE +
    '?mode=demand&limitPerTerm=' +
    encodeURIComponent(String(limitPerTerm));

  const response = await fetch(url, {
    headers: { 'User-Agent': 'SignalPlusLanding/1.0' },
  });
  if (!response.ok) {
    throw new Error('PWA feed HTTP ' + response.status);
  }

  const feed = await response.json();
  if (!feed || !Array.isArray(feed.items)) {
    throw new Error('PWA feed returned invalid JSON');
  }

  return {
    items: feed.items,
    searchTerms: feed.searchTerms || [],
  };
}

module.exports = { getGlp1Feed };
