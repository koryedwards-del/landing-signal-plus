/**
 * GLP-1 news feed for signalplushealth.com (website only — not the mobile app).
 *
 * Reconnect your feed provider here. Expected response shape:
 *   { items: [{ title, href, date, source }], searchTerms: string[] }
 *
 * Query params from pages: mode=demand, limitPerTerm=1..5
 */

async function getGlp1Feed(options) {
  const limitPerTerm = Math.max(1, Math.min(Number(options?.limitPerTerm) || 1, 5));

  // Feed logic goes here when you reconnect the provider.
  throw new Error('GLP-1 news feed is not configured yet');
}

module.exports = { getGlp1Feed };
