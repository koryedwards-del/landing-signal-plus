const {
  isMarketingNoise,
  isPaywalledJournalPublisher,
  isAcademicDeepArticle,
  isPubMedOrNihPublisher,
} = require('./glp1SupplySources');

/**
 * News = the event happened ("three-car crash on I-40").
 * Analysis = why it matters, what to think, what might happen next.
 * We block analysis/explainer shapes — not outlets — so factual wire reporting can pass.
 */

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
  /\bhere'?s what matters more\b/i,
];

/** Explainers, predictions, and takes — not straight reporting of an event. */
const ANALYSIS_PATTERNS = [
  /\bwhat to know\b/i,
  /\b(what|everything) (you|they|patients|employers|doctors) need to know\b/i,
  /\bhere'?s what (you|we|they|to know)\b/i,
  /\b(may|might|could) be a (bad|good|big|major|game[- ]?changing)\b/i,
  /\bwhy .+ (may|might|could|will|should)\b/i,
  /\bwhy .+ (happened|happens|matters|means|could mean|could affect)\b/i,
  /\bwhat .+ (means|could mean|could affect|may mean) (for|to)\b/i,
  /\bhow .+ (could|may|might) (change|affect|impact|reshape)\b/i,
  /^why\b/i,
  /\bwhat you should\b/i,
  /\bexperts say\b/i,
  /\bwhat experts\b/i,
  /\b(opinion|editorial|commentary)\b/i,
  /\bnarrative review\b/i,
  /\b101:/i,
  /\bglp-1s 101\b/i,
  /\b(breakdown|explainer|analysis)\s*:/i,
];

/** Declarative event reporting — the accident happened, not why it happened. */
const FACTUAL_NEWS_PATTERNS = [
  /\b(fda|medicare|cms|hhs) (approves|approved|warns|warned|issues|issued|announces|announced|moves|moved)\b/i,
  /\bwarning letter\b/i,
  /\b(to cover|will cover|coverage (begins|starts|expands|demonstration))\b/i,
  /\b(phase 3|pivotal|trial|study) (results|readout|finds|found|shows|showed|demonstrates|demonstrated)\b/i,
  /\b(recalls|recalled|approves|approved|rejects|rejected|launches|launched)\b/i,
  /\babout to cover\b/i,
  /\bpart d\b/i,
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

const OPINION_DESK_PATHS = [
  '/opinion/',
  '/editorial/',
  '/commentary/',
  '/columnists/',
  '/columns/',
  '/editorials/',
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

function isOpinionDeskUrl(href = '') {
  const lower = String(href).toLowerCase();
  return OPINION_DESK_PATHS.some((segment) => lower.includes(segment));
}

function isNonNewsPublisher(href = '', source = '', title = '') {
  const haystack = `${href} ${source}`.toLowerCase();
  if (NON_NEWS_PUBLISHERS.some((name) => haystack.includes(name))) return true;
  if (isLocalTvHealthSegment(title)) return true;
  if (/\.edu\b|\/edu\//.test(haystack)) return true;
  return false;
}

function isListicleHeadline(title) {
  return LISTICLE_PATTERNS.some((pattern) => pattern.test(title));
}

function isFactualNewsHeadline(title) {
  const text = String(title || '');
  return FACTUAL_NEWS_PATTERNS.some((pattern) => pattern.test(text));
}

function isAnalysisHeadline(title) {
  const text = String(title || '');
  const hasAnalysis = ANALYSIS_PATTERNS.some((pattern) => pattern.test(text));
  if (!hasAnalysis) return false;

  if (/\bwhat to know\b/i.test(text) || /\bneed to know\b/i.test(text)) return true;
  if (/^why\b/i.test(text)) return true;

  if (isFactualNewsHeadline(text)) return false;

  return true;
}

function isOpinionHeadline(title) {
  return isAnalysisHeadline(title);
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
  if (isAnalysisHeadline(title)) return true;
  if (isMarketingNoise(title, item.description || '')) return true;
  if (isNutritionFitnessContent(title, item.description || '')) return true;
  if (isAcademicDeepArticle(title, href, source)) return true;
  if (isPubMedOrNihPublisher(href, source)) return true;

  if (item.lane !== 'supply') {
    if (isNonNewsPublisher(href, source, title)) return true;
    if (isPaywalledSource(href, source)) return true;
    if (isOpinionDeskUrl(href)) return true;
  }

  return false;
}

module.exports = {
  isListicleHeadline,
  isFactualNewsHeadline,
  isAnalysisHeadline,
  isOpinionHeadline,
  isNutritionFitnessContent,
  isPaywalledSource,
  isNonNewsPublisher,
  isLocalTvHealthSegment,
  isBlockedNewsItem,
};
