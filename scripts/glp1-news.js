(function () {
  var FEED_API = '/api/glp1-feed?mode=demand&limitPerTerm=1';

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderItems(list, items) {
    if (!items.length) {
      list.innerHTML = '<li class="glp1-news-empty">No headlines available right now.</li>';
      return;
    }

    list.innerHTML = items
      .map(function (item) {
        var dateHtml = item.date
          ? '<time class="glp1-news-date">' + escapeHtml(item.date) + '</time>'
          : '';
        var sourceHtml = item.source
          ? '<span class="glp1-news-source">' + escapeHtml(item.source) + '</span>'
          : '';
        return (
          '<li class="glp1-news-row">' +
            dateHtml +
            '<a class="glp1-news-headline" href="' + escapeHtml(item.href) + '" target="_blank" rel="noopener noreferrer">' +
              escapeHtml(item.title) +
            '</a>' +
            sourceHtml +
          '</li>'
        );
      })
      .join('');
  }

  async function loadGlp1News() {
    var blocks = document.querySelectorAll('[data-glp1-news]');
    if (!blocks.length) return;

    blocks.forEach(function (block) {
      var list = block.querySelector('[data-glp1-news-list]');
      if (list) list.innerHTML = '<li class="glp1-news-empty">Loading headlines…</li>';
    });

    try {
      var response = await fetch(FEED_API);
      if (!response.ok) throw new Error('Feed unavailable');
      var feed = await response.json();

      blocks.forEach(function (block) {
        var list = block.querySelector('[data-glp1-news-list]');
        if (!list) return;
        var limit = parseInt(block.getAttribute('data-limit') || '3', 10);
        renderItems(list, (feed.items || []).slice(0, limit));
        if (window.initExternalNewsLinks) window.initExternalNewsLinks(list);
      });
    } catch (err) {
      blocks.forEach(function (block) {
        var list = block.querySelector('[data-glp1-news-list]');
        if (!list || !list.querySelector('.glp1-news-row')) {
          list.innerHTML = '<li class="glp1-news-empty">Headlines unavailable right now. Check back soon.</li>';
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadGlp1News);
  } else {
    loadGlp1News();
  }
})();
