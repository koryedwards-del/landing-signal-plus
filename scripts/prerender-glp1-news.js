#!/usr/bin/env node
/**
 * Fetches GLP-1 feed and injects crawlable HTML + JSON-LD into static pages.
 * Run at deploy time: npm run build
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FEED_API = 'https://pwa-signal-plus-v2.onrender.com/api/glp1-feed';
const SITE = 'https://www.signalplushealth.com';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(text, maxLen) {
  const trimmed = String(text || '').trim();
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen - 1).trimEnd() + '\u2026';
}

function parseIsoDate(displayDate) {
  const parsed = new Date(displayDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function sortNewsItems(items) {
  return items.slice().sort(function (a, b) {
    const dateA = parseIsoDate(a.date) || '';
    const dateB = parseIsoDate(b.date) || '';
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    return String(a.title || '').localeCompare(String(b.title || ''));
  });
}

function replaceBetween(content, startMarker, endMarker, insertion) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Missing markers: ' + startMarker);
  }
  return (
    content.slice(0, start + startMarker.length) +
    '\n' +
    insertion +
    '\n      ' +
    content.slice(end)
  );
}

function renderHomepageRows(items) {
  return items
    .map(function (item) {
      const iso = parseIsoDate(item.date);
      const dateHtml = item.date
        ? '<time class="glp1-teaser-date" datetime="' +
          escapeHtml(iso || item.date) +
          '">' +
          escapeHtml(item.date) +
          '</time>'
        : '<span class="glp1-teaser-date"></span>';
      return (
        '        <li class="glp1-teaser-row">\n' +
        '          ' +
        dateHtml +
        '\n' +
        '          <a class="glp1-teaser-headline" href="' +
        escapeHtml(item.href) +
        '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(truncate(item.title, 120)) +
        '</a>\n' +
        '        </li>'
      );
    })
    .join('\n');
}

function renderNewsPageRows(items) {
  return items
    .map(function (item) {
      const iso = parseIsoDate(item.date);
      const dateHtml = item.date
        ? '<time class="news-date" datetime="' +
          escapeHtml(iso || item.date) +
          '">' +
          escapeHtml(item.date) +
          '</time>'
        : '';
      return (
        '        <li class="news-item">\n' +
        '          <div class="news-meta">' +
        dateHtml +
        '</div>\n' +
        '          <p class="news-title"><a href="' +
        escapeHtml(item.href) +
        '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(item.title) +
        '</a></p>\n' +
        '          <p class="news-source">' +
        escapeHtml(item.source || '') +
        '</p>\n' +
        '        </li>'
      );
    })
    .join('\n');
}

function buildNewsItemList(items, listName, pageUrl) {
  return {
    '@type': 'ItemList',
    name: listName,
    url: pageUrl,
    numberOfItems: items.length,
    itemListElement: items.map(function (item, index) {
      const article = {
        '@type': 'NewsArticle',
        headline: item.title,
        url: item.href,
        mainEntityOfPage: item.href,
      };
      const iso = parseIsoDate(item.date);
      if (iso) article.datePublished = iso;
      if (item.source) {
        article.publisher = { '@type': 'Organization', name: item.source };
      }
      return {
        '@type': 'ListItem',
        position: index + 1,
        item: article,
      };
    }),
  };
}

function buildHomepageSchema(homeItems) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'Signal+',
        url: SITE + '/',
        description:
          'Signal+ helps GLP-1 users protect muscle with mTOR timing, reminders, and coaching.',
      },
      {
        '@type': 'Organization',
        name: 'Signal+',
        url: SITE + '/',
        logo: SITE + '/Images/cyansignal%2Blogotransparent.png',
      },
      buildNewsItemList(homeItems, 'GLP-1 in the News', SITE + '/'),
    ],
  };
}

function buildNewsPageSchema(items, searchTerms) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'GLP-1 in the News',
        url: SITE + '/glp-1-changes.html',
        description:
          'GLP-1 news from the top related Google searches in the US, refreshed every six hours.',
        about: searchTerms.map(function (term) {
          return { '@type': 'Thing', name: term };
        }),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: SITE + '/',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'GLP-1 News',
            item: SITE + '/glp-1-changes.html',
          },
        ],
      },
      buildNewsItemList(items, 'GLP-1 News This Week', SITE + '/glp-1-changes.html'),
    ],
  };
}

async function fetchFeed(limitPerTerm) {
  const response = await fetch(FEED_API + '?limitPerTerm=' + limitPerTerm);
  if (!response.ok) throw new Error('Feed HTTP ' + response.status);
  return response.json();
}

async function main() {
  const feed = await fetchFeed(3);

  if (!feed.items || feed.items.length === 0) {
    console.warn('No feed items returned; skipping prerender.');
    return;
  }

  const sortedItems = sortNewsItems(feed.items);
  const homeItems = sortedItems.slice(0, 3);

  let indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  indexHtml = replaceBetween(
    indexHtml,
    '<!-- GLP1_HOMEPAGE_NEWS_START -->',
    '<!-- GLP1_HOMEPAGE_NEWS_END -->',
    renderHomepageRows(homeItems)
  );
  indexHtml = replaceBetween(
    indexHtml,
    '<!-- GLP1_HOMEPAGE_JSONLD_START -->',
    '<!-- GLP1_HOMEPAGE_JSONLD_END -->',
    '  <script type="application/ld+json">' +
      JSON.stringify(buildHomepageSchema(homeItems)) +
      '</script>'
  );
  indexHtml = indexHtml.replace(
    'class="glp1-teaser" id="glp1-teaser" aria-hidden="true"',
    'class="glp1-teaser visible" id="glp1-teaser"'
  );
  fs.writeFileSync(path.join(ROOT, 'index.html'), indexHtml);
  console.log('Updated index.html with ' + homeItems.length + ' news rows.');

  let newsHtml = fs.readFileSync(path.join(ROOT, 'glp-1-changes.html'), 'utf8');
  newsHtml = replaceBetween(
    newsHtml,
    '<!-- GLP1_NEWS_PAGE_LIST_START -->',
    '<!-- GLP1_NEWS_PAGE_LIST_END -->',
    renderNewsPageRows(sortedItems)
  );
  newsHtml = replaceBetween(
    newsHtml,
    '<!-- GLP1_NEWS_PAGE_JSONLD_START -->',
    '<!-- GLP1_NEWS_PAGE_JSONLD_END -->',
    '  <script type="application/ld+json">' +
      JSON.stringify(buildNewsPageSchema(sortedItems, feed.searchTerms || [])) +
      '</script>'
  );
  newsHtml = newsHtml.replace(
    '<p class="feed-status" id="feed-status">Loading GLP-1 news…</p>',
    '<p class="feed-status" id="feed-status" hidden>Loading GLP-1 news…</p>'
  );
  newsHtml = newsHtml.replace(
    /<ul class="news-list" id="news-list"\s*hidden>/,
    '<ul class="news-list" id="news-list">'
  );
  fs.writeFileSync(path.join(ROOT, 'glp-1-changes.html'), newsHtml);
  console.log('Updated glp-1-changes.html with ' + sortedItems.length + ' news rows.');
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
