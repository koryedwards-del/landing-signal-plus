#!/usr/bin/env node
/**
 * Fetches GLP-1 feed and injects crawlable HTML + JSON-LD into glp-1-changes.html.
 * Run at deploy time: npm run build
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FEED_API = 'https://pwa-signal-plus-v2.onrender.com/api/glp1-feed';
const FEED_MODE = 'demand';
const SITE = 'https://www.signalplushealth.com';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  const url =
    FEED_API + '?mode=' + FEED_MODE + '&limitPerTerm=' + encodeURIComponent(String(limitPerTerm));
  const response = await fetch(url);
  if (!response.ok) throw new Error('Feed HTTP ' + response.status);
  return response.json();
}

async function main() {
  let newsFeed;
  try {
    newsFeed = await fetchFeed(3);
  } catch (err) {
    console.warn('GLP-1 feed unavailable at build time; skipping prerender:', err.message);
    return;
  }

  if (!newsFeed.items || newsFeed.items.length === 0) {
    console.warn('No news page feed items returned; skipping prerender.');
    return;
  }

  const sortedNewsItems = sortNewsItems(newsFeed.items);

  let newsHtml = fs.readFileSync(path.join(ROOT, 'glp-1-changes.html'), 'utf8');
  newsHtml = replaceBetween(
    newsHtml,
    '<!-- GLP1_NEWS_PAGE_LIST_START -->',
    '<!-- GLP1_NEWS_PAGE_LIST_END -->',
    renderNewsPageRows(sortedNewsItems)
  );
  newsHtml = replaceBetween(
    newsHtml,
    '<!-- GLP1_NEWS_PAGE_JSONLD_START -->',
    '<!-- GLP1_NEWS_PAGE_JSONLD_END -->',
    '  <script type="application/ld+json">' +
      JSON.stringify(buildNewsPageSchema(sortedNewsItems, newsFeed.searchTerms || [])) +
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
  console.log('Updated glp-1-changes.html with ' + sortedNewsItems.length + ' news rows.');
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
