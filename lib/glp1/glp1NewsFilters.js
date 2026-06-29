const {
  isMarketingNoise,
  isPaywalledJournalPublisher,
  isAcademicDeepArticle,
  isPubMedOrNihPublisher,
} = require('./glp1SupplySources');

/** Numbered hooks, "best/top N", comparison bait — drop on sight. */
const LISTICLE_PATTERNS = [
  /\b\d+\s+(best|top|easy|simple|surprising|science-backed|must-try|must-read)\b/i,
  /\b(best|top)\s+\d+\b/i,
  /\b\d+\s+(ways|tips|things|reasons|habits|pills|foods|exercises|moves|steps)\b/i,
  /\bwhich is the best\b/i,
  /\bthat work:\s*/i,
  /\branked\b/i,
  /\bcountdown\b/i,
  /\bslide show\b|\bslideshow\b/i,
  /\byou need to know\b/i,
  /\bhere'?s what matters more\b/i,
];

const OPINION_PATTERNS = [
  /\bwhat to know\b/i,
  /\bwhat they need to know\b/i,
  /\bhere'?s what you\b/i,
  /\bbad thing\b/i,
  /\bmay be a bad\b/i,
  /\bwhy .+ may\b/i,
  /\bwhat you should\b/i,
  /\bexperts say\b/i,
  /\bwhat experts\b/i,
  /\bnarrative review\b/i,
  /\b101:/i,
  /\bglp-1s 101\b/i,
];

/** Signal+ owns muscle, protein, exercise — not the news feed. */
const NUTRITION_FITNESS_PATTERNS = [
  /\bmuscle loss\b/i,
  /\bpreserv(e|ing) muscle\b/i,
  /\blose fat without losing muscle\b/i,
  /\bprotein\b/i,
  /\bworkout\b/i,
  /\bexercis(e|ing)\b/i,
  /\bfitness\b/i,
  /\bstrength training\b/i,
  /\blongevity habits\b/i,
  /\bhow to get the most out of glp/i,
  /\bmetabolic rehabilitation\b/i,
  /\bsarcopenia\b/i,
];

const PAYWALLED_NEWS_HOSTS = [
  'washingtonpost.com',
  'wsj.com',
  'nytimes.com',
  'ft.com',
  'economist.com',
  'medscape.com',
  'statnews.com',
];

/** Campus magazines, local TV health features, PR — not evening-news sources. */
const NON_NEWS_PUBLISHERS = [
  'msu denver',
  'msu denver red',
  'stanford report',
  'wxii',
  'wxii12.com',
];

/** Branded local-TV wellness slots — not news desk reporting. */
const LOCAL_TV_HEALTH_SEGMENT = [
  /\b\d+\s+on your health\b/i,
  /\bon your health\s*:/i,
  /\bhealth watch\b/i,
  /\bhealth minute\b/i,
  /\bwellness wednesday\b/i,
];

function isLocalTvHealthSegment(title = '') {
  return LOCAL_TV_HEALTH_SEGMENT.some((pattern) => pattern.test(title));
}

function isNonNewsPublisher(href = '', source = '', title = '') {
  const haystack = `${href} ${source}`.toLowerCase();
  if (NON_NEWS_PUBLISHERS.some((name) => haystack.includes(name))) return true;
  if (isLocalTvHealthSegment(title)) return true;
  // Google News query hits from .edu are campus PR/magazines, not wire reporting.
  if (/\.edu\b|\/edu\//.test(haystack)) return true;
  return false;
}

function isListicleHeadline(title) {
  return LISTICLE_PATTERNS.some((pattern) => pattern.test(title));
}

function isOpinionHeadline(title) {
  const text = String(title || '');
  return OPINION_PATTERNS.some((pattern) => pattern.test(text));
}

function isNutritionFitnessContent(title, description = '') {
  const text = `${title} ${description}`;
  return NUTRITION_FITNESS_PATTERNS.some((pattern) => pattern.test(text));
}

function isPaywalledSource(href = '', source = '') {
  const haystack = `${href} ${source}`.toLowerCase();
  if (isPaywalledJournalPublisher(href, source)) return true;
  return PAYWALLED_NEWS_HOSTS.some((host) => haystack.includes(host));
}

/**
 * @param {{ title: string, href?: string, source?: string, description?: string, lane?: string }} item
 */
function isBlockedNewsItem(item) {
  const title = String(item.title || '');
  const href = String(item.href || '');
  const source = String(item.source || '');

  if (!title || !href) return true;
  if (isListicleHeadline(title)) return true;
  if (isOpinionHeadline(title)) return true;
  if (isMarketingNoise(title, item.description || '')) return true;
  if (isNutritionFitnessContent(title, item.description || '')) return true;
  if (isAcademicDeepArticle(title, href, source)) return true;
  if (isPubMedOrNihPublisher(href, source)) return true;

  if (item.lane !== 'supply' && isNonNewsPublisher(href, source, title)) return true;
  if (item.lane !== 'supply' && isPaywalledSource(href, source)) return true;

  return false;
}

module.exports = {
  isListicleHeadline,
  isOpinionHeadline,
  isNutritionFitnessContent,
  isPaywalledSource,
  isNonNewsPublisher,
  isLocalTvHealthSegment,
  isBlockedNewsItem,
};
