(function () {
  var ARCHIVE_PATH = (function () {
    var path = window.location.pathname.replace(/\\/g, '/');
    if (path.includes('/newsletter/')) return '../data/newsletters.json';
    return 'data/newsletters.json';
  })();

  function formatDate(iso) {
    if (!iso) return '';
    var parts = iso.split('-');
    if (parts.length !== 3) return iso;
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[Number(parts[1]) - 1] + ' ' + Number(parts[2]) + ', ' + parts[0];
  }

  function headlineTitle(str) {
    if (!str) return '';
    return str.replace(/\S+/g, function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    });
  }

  function resolveUrl(url) {
    if (!url || /^https?:\/\//.test(url)) return url;
    if (window.location.pathname.includes('/newsletter/')) {
      if (url.indexOf('newsletter/') === 0) return url.slice('newsletter/'.length);
      if (url.indexOf('../') === 0) return url;
      return '../' + url;
    }
    return url;
  }

  function renderArchive(container, data, currentSlug) {
    if (!container || !data || !data.issues || !data.issues.length) return;

    var label = data.name || 'Newsletter';
    var html = '<p class="newsletter-archive-label">' + label + '</p><ul class="newsletter-archive-list">';
    data.issues.forEach(function (issue) {
      var active = issue.slug === currentSlug ? ' class="active"' : '';
      html +=
        '<li' + active + '><a href="' + resolveUrl(issue.url) + '">' +
        '<span class="newsletter-archive-date">' + formatDate(issue.date) + '</span>' +
        '<span class="newsletter-archive-title">' + headlineTitle(issue.title) + '</span></a></li>';
    });
    html += '</ul>';

    container.innerHTML = html;
  }

  function renderLatest(container, data) {
    if (!container || !data || !data.issues || !data.issues.length) return;

    var latest = data.issues[0];
    var href = resolveUrl(latest.url);
    container.innerHTML =
      'Latest issue: <a href="' + href + '">' + headlineTitle(latest.title) + '</a>' +
      '<span>' + formatDate(latest.date) + '</span>';
    container.hidden = false;
  }

  function init() {
    var containers = document.querySelectorAll('[data-newsletter-archive]');
    var latestContainers = document.querySelectorAll('[data-newsletter-latest]');
    if (!containers.length && !latestContainers.length) return;

    fetch(ARCHIVE_PATH)
      .then(function (res) {
        if (!res.ok) throw new Error('Could not load newsletter archive.');
        return res.json();
      })
      .then(function (data) {
        containers.forEach(function (container) {
          renderArchive(container, data, container.getAttribute('data-current') || '');
        });
        latestContainers.forEach(function (container) {
          renderLatest(container, data);
        });
      })
      .catch(function () {
        containers.forEach(function (container) {
          container.innerHTML = '<p class="newsletter-archive-label">Signal+ Weekly Newsletters</p><p class="newsletter-archive-date">Archive loading…</p>';
        });
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
