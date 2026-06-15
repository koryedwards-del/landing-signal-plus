(function () {
  var backdropEl = null;
  var goLinkEl = null;

  function injectStyles() {
    if (document.getElementById('external-news-link-styles')) return;
    var style = document.createElement('style');
    style.id = 'external-news-link-styles';
    style.textContent =
      '.leave-site-backdrop{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,0.72)}' +
      '.leave-site-backdrop[hidden]{display:none!important}' +
      '.leave-site-panel{max-width:420px;width:100%;background:#111822;border:1px solid rgba(0,200,232,0.22);border-radius:12px;padding:24px 22px;box-shadow:0 0 40px rgba(0,200,232,0.12);color:#F0EDE8}' +
      '.leave-site-panel h3{font-family:Oswald,sans-serif;font-size:22px;font-weight:600;color:#F0EDE8;margin:0 0 10px;text-transform:uppercase;letter-spacing:0.04em}' +
      '.leave-site-panel p{font-family:"Open Sans",sans-serif;font-size:15px;line-height:1.55;color:#8A97A8;margin:0 0 22px}' +
      '.leave-site-actions{display:flex;gap:10px;flex-wrap:wrap}' +
      '.leave-site-actions button,.leave-site-actions a{flex:1 1 140px;padding:14px 14px;border-radius:8px;font-family:"Space Mono",monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;transition:opacity 0.2s;text-align:center;text-decoration:none;display:inline-block;line-height:1.2;box-sizing:border-box}' +
      '.leave-site-stay{background:transparent;border:1px solid rgba(0,200,232,0.35);color:#00C8E8}' +
      '.leave-site-go{background:#00C8E8;border:1px solid #00C8E8;color:#080C12;font-weight:700}' +
      '.leave-site-actions button:hover,.leave-site-actions a:hover{opacity:0.88}';
    document.head.appendChild(style);
  }

  function closeDialog() {
    if (!backdropEl) return;
    backdropEl.hidden = true;
  }

  function ensureDialog() {
    if (backdropEl) return backdropEl;
    injectStyles();

    backdropEl = document.createElement('div');
    backdropEl.className = 'leave-site-backdrop';
    backdropEl.hidden = true;
    backdropEl.innerHTML =
      '<div class="leave-site-panel" role="dialog" aria-modal="true" aria-labelledby="leave-site-title">' +
        '<h3 id="leave-site-title">Leaving Signal+</h3>' +
        '<p id="leave-site-message"></p>' +
        '<div class="leave-site-actions">' +
          '<button type="button" class="leave-site-stay">Stay on Signal+</button>' +
          '<a class="leave-site-go" href="#" target="_blank" rel="noopener noreferrer">Continue to story</a>' +
        '</div>' +
      '</div>';

    document.body.appendChild(backdropEl);
    goLinkEl = backdropEl.querySelector('.leave-site-go');

    backdropEl.querySelector('.leave-site-stay').addEventListener('click', function (e) {
      e.preventDefault();
      closeDialog();
    });

    goLinkEl.addEventListener('click', function () {
      window.setTimeout(closeDialog, 0);
    });

    backdropEl.addEventListener('click', function (e) {
      if (e.target === backdropEl) closeDialog();
    });

    document.addEventListener('keydown', function (e) {
      if (!backdropEl.hidden && e.key === 'Escape') closeDialog();
    });

    return backdropEl;
  }

  function openDialog(href, source) {
    ensureDialog();
    var destination = source || 'the original publisher';
    backdropEl.querySelector('#leave-site-message').textContent =
      'This link opens on ' + destination + ' in a new tab. You\u2019ll leave Signal+.';
    goLinkEl.href = href;
    backdropEl.hidden = false;
    backdropEl.querySelector('.leave-site-stay').focus();
  }

  function initExternalNewsLinks(container) {
    if (!container) return;
    container.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="http"]');
      if (!link || !container.contains(link)) return;
      e.preventDefault();
      e.stopPropagation();
      var item = link.closest('.news-item');
      var sourceEl = item && item.querySelector('.news-source');
      var source = sourceEl ? sourceEl.textContent.trim() : '';
      openDialog(link.href, source);
    });
  }

  window.initExternalNewsLinks = initExternalNewsLinks;
})();
