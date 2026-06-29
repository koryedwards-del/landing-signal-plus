(function () {
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatFetchedAt(iso) {
    if (!iso) return '';
    var parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
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

  function setFeedStatus(block, feed, refreshing) {
    var status = block.querySelector('[data-glp1-feed-status]');
    if (!status) return;

    if (refreshing) {
      status.textContent = 'Checking sources for new headlines…';
      return;
    }

    var updated = formatFetchedAt(feed && feed.fetchedAt);
    status.textContent = updated
      ? 'Updated ' + updated + '. Refreshes every 6 hours — or use Refresh now.'
      : 'Refreshes every 6 hours — or use Refresh now.';
  }

  function setRefreshBusy(block, busy) {
    var btn = block.querySelector('[data-glp1-refresh]');
    if (!btn) return;
    btn.disabled = busy;
    btn.textContent = busy ? 'Refreshing…' : 'Refresh the news';
  }

  async function loadGlp1News(refresh) {
    var blocks = document.querySelectorAll('[data-glp1-news]');
    if (!blocks.length) return;

    blocks.forEach(function (block) {
      var list = block.querySelector('[data-glp1-news-list]');
      if (list && refresh) {
        list.innerHTML = '<li class="glp1-news-empty">Loading headlines…</li>';
      }
      setFeedStatus(block, null, refresh);
      if (refresh) setRefreshBusy(block, true);
    });

    try {
      var url = '/api/glp1-feed';
      if (refresh) url += '?refresh=1';

      var response = await fetch(url);
      if (!response.ok) throw new Error('Feed unavailable');
      var feed = await response.json();

      blocks.forEach(function (block) {
        var list = block.querySelector('[data-glp1-news-list]');
        if (!list) return;
        var limit = parseInt(block.getAttribute('data-limit') || '3', 10);
        renderItems(list, (feed.items || []).slice(0, limit));
        if (window.initExternalNewsLinks) window.initExternalNewsLinks(list);
        setFeedStatus(block, feed, false);
        setRefreshBusy(block, false);
      });
    } catch (err) {
      blocks.forEach(function (block) {
        var list = block.querySelector('[data-glp1-news-list]');
        if (!list || !list.querySelector('.glp1-news-row')) {
          list.innerHTML = '<li class="glp1-news-empty">Headlines unavailable right now. Check back soon.</li>';
        }
        setFeedStatus(block, null, false);
        setRefreshBusy(block, false);
      });
    }
  }

  function bindRefreshButtons() {
    document.querySelectorAll('[data-glp1-refresh]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        loadGlp1News(true);
      });
    });
  }

  function init() {
    bindRefreshButtons();
    loadGlp1News(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
