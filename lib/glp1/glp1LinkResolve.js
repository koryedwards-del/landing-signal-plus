function isGoogleNewsUrl(href = '') {
  const lower = String(href).toLowerCase();
  return lower.includes('news.google.com');
}

/** Google News wrappers for these publishers often miss the article (Novo homepage, etc.). */
function isBrokenGoogleNewsLink(item) {
  if (!isGoogleNewsUrl(item.href)) return false;
  const source = String(item.source || '').toLowerCase();
  if (source.includes('novo nordisk') || source === 'novo nordisk') return true;
  if (source.includes('investor.lilly.com') || source.includes('lilly.com')) return true;
  return false;
}

function isDirectPublisherUrl(href = '') {
  return !!href && !isGoogleNewsUrl(href);
}

module.exports = {
  isGoogleNewsUrl,
  isBrokenGoogleNewsLink,
  isDirectPublisherUrl,
};
