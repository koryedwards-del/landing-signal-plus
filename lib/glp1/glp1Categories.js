/** @typedef {'research' | 'regulatory' | 'access' | 'industry' | 'safety'} Glp1Tag */

const TAG_LABELS = {
  research: 'Research',
  regulatory: 'Regulatory',
  access: 'Access & Insurance',
  industry: 'Industry',
  safety: 'Safety',
};

/**
 * @param {{ title: string, href?: string, source?: string, lane?: string }} item
 * @returns {{ tag: Glp1Tag, tagLabel: string }}
 */
function classifyGlp1Item(item) {
  const title = String(item.title || '');
  const text = `${title} ${item.source || ''}`.toLowerCase();
  const href = String(item.href || '').toLowerCase();

  if (
    /warning letter|adverse event|side effect|recall|safety alert|unreported.*effect|patient safety/i.test(
      text,
    )
  ) {
    return { tag: 'safety', tagLabel: TAG_LABELS.safety };
  }

  if (
    /fda|regulatory|503b|bulks list|approval|approved|label change|telehealth.*marketing|compounded glp/i.test(
      text,
    ) ||
    href.includes('fda.gov')
  ) {
    return { tag: 'regulatory', tagLabel: TAG_LABELS.regulatory };
  }

  if (
    /medicare|medicaid|insurance|coverage|part d|formulary|copay|coinsurance|pbm|employer.*cover|prior auth/i.test(
      text,
    )
  ) {
    return { tag: 'access', tagLabel: TAG_LABELS.access };
  }

  if (
    /phase [23]|pivotal trial|trial results|readout|hba1c|clinical trial|study finds|study found|demonstrated.*reduction|surmount|reimagine/i.test(
      text,
    )
  ) {
    return { tag: 'research', tagLabel: TAG_LABELS.research };
  }

  if (
    item.lane === 'supply' ||
    /novo nordisk|eli lilly|investor\.lilly|fierce pharma|biopharma|cybersecurity breach|pharmaceutical/i.test(
      text,
    )
  ) {
    return { tag: 'industry', tagLabel: TAG_LABELS.industry };
  }

  return { tag: 'industry', tagLabel: TAG_LABELS.industry };
}

module.exports = {
  TAG_LABELS,
  classifyGlp1Item,
};
