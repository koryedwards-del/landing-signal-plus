/** Direct RSS feeds — supply lane (not search-driven). */
const GLP1_SUPPLY_FEEDS = [
  {
    id: 'fda-press',
    name: 'FDA',
    url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml',
    scanLimit: 30,
    tier: 3,
  },
  {
    id: 'fierce-pharma',
    name: 'Fierce Pharma',
    url: 'https://www.fiercepharma.com/rss/xml',
    scanLimit: 25,
    tier: 2,
  },
  {
    id: 'biopharma-dive',
    name: 'BioPharma Dive',
    url: 'https://www.biopharmadive.com/feeds/news/',
    scanLimit: 25,
    tier: 2,
  },
  {
    id: 'novo-globenewswire',
    name: 'Novo Nordisk',
    url: 'https://www.globenewswire.com/rssfeed/organization/sjZ13-wzxB-w4SjYnjUxfQ==',
    scanLimit: 40,
    tier: 2,
  },
];

/** Strong match — drug, class, or trial name. */
const GLP1_PRIMARY_KEYWORDS = [
  'glp-1',
  'glp1',
  'glp 1',
  'semaglutide',
  'tirzepatide',
  'retatrutide',
  'orforglipron',
  'cagrisema',
  'cagrisem',
  'wegovy',
  'ozempic',
  'zepbound',
  'mounjaro',
  'rybelsus',
  'saxenda',
  'victoza',
  'foundayo',
  'surmount',
  'step up',
  '503b',
  'bulks list',
];

/** Weaker signals — need a primary drug/name nearby in the same headline. */
const GLP1_COMPANY_KEYWORDS = ['novo nordisk', 'novo', 'eli lilly'];

const MS_PER_DAY = 86400000;

/** Drop supply items older than this. */
const SUPPLY_MAX_AGE_DAYS = 120;

/** Journals move slower — allow slightly older research hits. */
const RESEARCH_MAX_AGE_DAYS = 180;

const SUPPLY_NOISE_PATTERNS = [
  /career search/i,
  /job search/i,
  /medwatch.*adverse event reporting program/i,
  /it security incident/i,
  /security incident at novo/i,
  /share repurchase/i,
  /repurchase programme/i,
  /trading in .* shares/i,
  /board members, executives/i,
  /operating profit reached/i,
];

/** Celebrity ads and brand campaigns — not news. */
const MARKETING_NOISE_PATTERNS = [
  /shaquille|shaq o'?neal/i,
  /celebrity endorsement|brand ambassador|paid spokesperson/i,
  /ad campaign|tv commercial|super bowl ad|marketing campaign/i,
  /teams up with.*(promot|launch|campaign|ad)/i,
  /enlists .*(promot|campaign|endorse)/i,
  /launch national campaign/i,
  /nba legend/i,
];

/** Headlines that read like journal papers, not news for patients. */
const ACADEMIC_DEEP_PATTERNS = [
  /narrative review/i,
  /^glp-1 receptor agonists$/i,
  /receptor agonists?\s*$/i,
  /double-blind,?\s*random/i,
  /randomised,?\s*placebo-controlled trial/i,
  /randomized,?\s*placebo-controlled trial/i,
  /phase [23] trial:/i,
  /\([A-Z][A-Z0-9-]{3,}\):/,
  /in people with type 2 diabetes and inadequate glycaemic control/i,
];

/** Peer-reviewed / regulatory publishers for outcomes research. */
const TRUSTED_PUBLISHER_HOSTS = [
  'fda.gov',
  'nih.gov',
  'cancer.gov',
  'ncbi.nlm.nih.gov',
  'pubmed.ncbi.nlm.nih.gov',
  'nejm.org',
  'jamanetwork.com',
  'thelancet.com',
  'nature.com',
  'bmj.com',
  'bmjopen.bmj.com',
  'ahajournals.org',
  'diabetesjournals.org',
  'sciencedirect.com',
  'cell.com',
  'acc.org',
  'cdc.gov',
];

/** Weight-loss knock-on effects — sleep, cancer, cardio, etc. */
const OUTCOMES_RESEARCH_KEYWORDS = [
  'sleep apnea',
  'cpap',
  'cardiovascular',
  'heart failure',
  'blood pressure',
  'hypertension',
  'cancer',
  'oncology',
  'tumor',
  'carcinoma',
  'kidney',
  'renal',
  'liver',
  'nafld',
  'mash',
  'diabetes',
  'remission',
  'osteoarthritis',
  'mobility',
  'mortality',
  'stroke',
  'metabolic',
  'randomized',
  'meta-analysis',
  'cohort study',
  'clinical trial',
  'phase 3',
  'phase 2',
  'researchers found',
  'study finds',
  'study found',
  'patients who lost',
  'weight loss',
  'weight-loss',
  'obesity',
  'overweight',
];

/** Health conditions beyond weight — used to block tabloid outcomes stories. */
const COMORBIDITY_OUTCOMES_KEYWORDS = [
  'sleep apnea',
  'cpap',
  'cardiovascular',
  'heart failure',
  'blood pressure',
  'hypertension',
  'cancer',
  'oncology',
  'tumor',
  'carcinoma',
  'kidney',
  'renal',
  'liver',
  'nafld',
  'mash',
  'diabetes',
  'remission',
  'osteoarthritis',
  'mobility',
  'mortality',
  'stroke',
  'metabolic',
];

/** Fixed Google News queries — free public sources only (no paywalled journals). */
const GLP1_RESEARCH_NEWS_QUERIES = [
  '(sleep apnea OR CPAP OR cardiovascular OR cancer OR hypertension) (semaglutide OR tirzepatide OR "weight loss" OR obesity) when:90d site:fda.gov',
];

/** Subscription journals — links are not useful for this audience. */
const PAYWALLED_JOURNAL_HOSTS = [
  'nejm.org',
  'jamanetwork.com',
  'thelancet.com',
  'nature.com',
  'bmj.com',
  'cell.com',
  'sciencedirect.com',
];

const PAYWALLED_JOURNAL_NAMES = [
  'nejm',
  'new england journal of medicine',
  'jama',
  'jamanetwork',
  'the lancet',
  'lancet',
  'nature',
  'bmj',
];

function isSupplyNoise(title, description = '') {
  const text = `${title} ${description}`;
  return SUPPLY_NOISE_PATTERNS.some((pattern) => pattern.test(text));
}

function isMarketingNoise(title, description = '') {
  const text = `${title} ${description}`;
  return MARKETING_NOISE_PATTERNS.some((pattern) => pattern.test(text));
}

/** Display names Google News attaches after the headline dash. */
const TRUSTED_PUBLISHER_NAMES = [
  'fda',
  'nih',
  'national institutes of health',
  'national cancer institute',
  'ncbi',
  'pubmed',
  'nejm',
  'new england journal of medicine',
  'jama',
  'jamanetwork',
  'the lancet',
  'lancet',
  'nature',
  'bmj',
  'american heart association',
  'american college of cardiology',
  'cdc',
  'cancer.gov',
];

function isTrustedPublisher(href = '', source = '') {
  const haystack = `${href} ${source}`.toLowerCase();
  if (TRUSTED_PUBLISHER_HOSTS.some((host) => haystack.includes(host))) return true;
  return TRUSTED_PUBLISHER_NAMES.some((name) => haystack.includes(name));
}

function isPubMedOrNihPublisher(href = '', source = '') {
  const haystack = `${href} ${source}`.toLowerCase();
  return (
    haystack.includes('pubmed') ||
    haystack.includes('ncbi.nlm.nih.gov') ||
    haystack.includes('nih.gov') ||
    haystack.includes('national institutes of health')
  );
}

function isPaywalledJournalPublisher(href = '', source = '') {
  const haystack = `${href} ${source}`.toLowerCase();
  if (PAYWALLED_JOURNAL_HOSTS.some((host) => haystack.includes(host))) return true;
  return PAYWALLED_JOURNAL_NAMES.some((name) => haystack.includes(name));
}

function isAccessibleResearchPublisher(href = '', source = '') {
  const haystack = `${href} ${source}`.toLowerCase();
  return haystack.includes('fda.gov') || haystack.includes('cdc.gov') || source === 'FDA';
}

function isAcademicDeepArticle(title, href = '', source = '') {
  if (isPubMedOrNihPublisher(href, source)) return true;
  const text = title.trim();
  if (ACADEMIC_DEEP_PATTERNS.some((pattern) => pattern.test(text))) return true;
  if (text.length > 155 && /trial|randomi[sz]ed|cohort|meta-analysis/i.test(text)) return true;
  return false;
}

function hasOutcomesResearchSignal(title, description = '') {
  const text = `${title} ${description}`.toLowerCase();
  return OUTCOMES_RESEARCH_KEYWORDS.some((keyword) => text.includes(keyword));
}

function hasComorbidityOutcomesSignal(title, description = '') {
  const text = `${title} ${description}`.toLowerCase();
  return COMORBIDITY_OUTCOMES_KEYWORDS.some((keyword) => text.includes(keyword));
}

function isResearchRelevant(title, description = '') {
  if (isGlp1Relevant(title, description)) return true;
  if (!hasOutcomesResearchSignal(title, description)) return false;

  const text = `${title} ${description}`.toLowerCase();
  return (
    text.includes('obesity') ||
    text.includes('weight loss') ||
    text.includes('weight-loss') ||
    text.includes('overweight') ||
    GLP1_PRIMARY_KEYWORDS.some((keyword) => text.includes(keyword))
  );
}

function isRecentSupplyItem(publishedAt, maxAgeDays = SUPPLY_MAX_AGE_DAYS) {
  if (!publishedAt || publishedAt <= 0) return false;
  return Date.now() - publishedAt <= maxAgeDays * MS_PER_DAY;
}

function isGlp1Relevant(title, description = '') {
  const text = `${title} ${description}`.toLowerCase();
  if (GLP1_PRIMARY_KEYWORDS.some((keyword) => text.includes(keyword))) return true;

  const hasCompany = GLP1_COMPANY_KEYWORDS.some((keyword) => text.includes(keyword));
  const hasObesityContext =
    text.includes('obesity') ||
    text.includes('weight loss') ||
    text.includes('weight-loss') ||
    text.includes('overweight');

  return hasCompany && hasObesityContext;
}

/** Stricter check for Google News query hits — GLP-1 signal must be in the headline. */
function isGlp1RelevantHeadline(title) {
  const text = title.toLowerCase();
  if (GLP1_PRIMARY_KEYWORDS.some((keyword) => text.includes(keyword))) return true;

  const hasCompany = GLP1_COMPANY_KEYWORDS.some((keyword) => text.includes(keyword));
  const hasObesityContext =
    text.includes('obesity') ||
    text.includes('weight loss') ||
    text.includes('weight-loss') ||
    text.includes('overweight');

  return hasCompany && hasObesityContext;
}

function isSupplyRssArticle(title, description, publishedAt) {
  return (
    isGlp1Relevant(title, description) &&
    !isSupplyNoise(title, description) &&
    !isMarketingNoise(title, description) &&
    isRecentSupplyItem(publishedAt)
  );
}

function isSupplyQueryArticle(title, publishedAt) {
  return (
    isGlp1RelevantHeadline(title) &&
    !isSupplyNoise(title) &&
    !isMarketingNoise(title) &&
    isRecentSupplyItem(publishedAt)
  );
}

function isResearchQueryArticle(title, href, source, publishedAt) {
  return (
    isAccessibleResearchPublisher(href, source) &&
    !isPaywalledJournalPublisher(href, source) &&
    !isPubMedOrNihPublisher(href, source) &&
    !isAcademicDeepArticle(title, href, source) &&
    isResearchRelevant(title) &&
    !isSupplyNoise(title) &&
    !isMarketingNoise(title) &&
    isRecentSupplyItem(publishedAt, RESEARCH_MAX_AGE_DAYS)
  );
}

/** Google News site: queries return wrapper URLs that often miss the article — use RSS instead. */
const GLP1_SUPPLY_NEWS_QUERIES = [
  'site:fda.gov (semaglutide OR tirzepatide OR Wegovy OR Ozempic) when:90d',
];

module.exports = {
  isSupplyNoise,
  isMarketingNoise,
  isTrustedPublisher,
  isPubMedOrNihPublisher,
  isPaywalledJournalPublisher,
  isAccessibleResearchPublisher,
  isAcademicDeepArticle,
  hasOutcomesResearchSignal,
  hasComorbidityOutcomesSignal,
  isResearchRelevant,
  isRecentSupplyItem,
  isGlp1Relevant,
  isGlp1RelevantHeadline,
  isSupplyRssArticle,
  isSupplyQueryArticle,
  isResearchQueryArticle,
  GLP1_SUPPLY_FEEDS,
  GLP1_PRIMARY_KEYWORDS,
  GLP1_COMPANY_KEYWORDS,
  SUPPLY_MAX_AGE_DAYS,
  RESEARCH_MAX_AGE_DAYS,
  SUPPLY_NOISE_PATTERNS,
  TRUSTED_PUBLISHER_HOSTS,
  OUTCOMES_RESEARCH_KEYWORDS,
  GLP1_RESEARCH_NEWS_QUERIES,
  PAYWALLED_JOURNAL_HOSTS,
  PAYWALLED_JOURNAL_NAMES,
  TRUSTED_PUBLISHER_NAMES,
  GLP1_SUPPLY_NEWS_QUERIES,
};
