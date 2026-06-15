(function () {
  var dialogEl = null;
  var pendingHref = null;

  function injectStyles() {
    if (document.getElementById('external-news-link-styles')) return;
    var style = document.createElement('style');
    style.id = 'external-news-link-styles';
    style.textContent =
      '.leave-site-backdrop{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.72);display:flex;align-items:center;justify-content:center;padding:20px}' +
      '.leave-site-dialog{max-width:420px;width:100%;background:#111822;border:1px solid rgba(0,200,232,0.22);border-radius:12px;padding:24px 22px;box-shadow:0 0 40px rgba(0,200,232,0.12)}' +
      '.leave-site-dialog h3{font-family:Oswald,sans-serif;font-size:22px;font-weight:600;color:#F0EDE8;margin:0 0 10px;text-transform:uppercase;letter-spacing:0.04em}' +
      '.leave-site-dialog p{font-family:"Open Sans",sans-serif;font-size:15px;line-height:1.55;color:#8A97A8;margin:0 0 22px}' +
      '.leave-site-actions{display:flex;gap:10px;flex-wrap:wrap}' +
      '.leave-site-actions button{flex:1 1 140px;padding:12px 14px;border-radius:8px;font-family:"Space Mono",monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;transition:opacity 0.2s}' +
      '.leave-site-stay{background:transparent;border:1px solid rgba(0,200,232,0.35);color:#00C8E8}' +
      '.leave-site-go{background:#00C8E8;border:1px solid #00C8E8;color:#080C12;font-weight:700}' +
      '.leave-site-actions button:hover{opacity:0.88}';
    document.head.appendChild(style);
  }

  function ensureDialog() {
    if (dialogEl) return dialogEl;
    injectStyles();
    dialogEl = document.createElement('div');
    dialogEl.className = 'leave-site-backdrop';
    dialogEl.hidden = true;
    dialogEl.innerHTML =
      '<div class="leave-site-dialog" role="dialog" aria-modal="true" aria-labelledby="leave-site-title">' +
        '<h3 id="leave-site-title">Leaving Signal+</h3>' +
        '<p id="leave-site-message"></p>' +
        '<div class="leave-site-actions">' +
          '<button type="button" class="leave-site-stay">Stay on Signal+</button>' +
          '<button type="button" class="leave-site-go">Continue to story</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(dialogEl);

    dialogEl.querySelector('.leave-site-stay').addEventListener('click', closeDialog);
    dialogEl.querySelector('.leave-site-go').addEventListener('click', function () {
      if (pendingHref) {
        window.open(pendingHref, '_blank', 'noopener,noreferrer');
      }
      closeDialog();
    });
    dialogEl.addEventListener('click', function (e) {
      if (e.target === dialogEl) closeDialog();
    });
    document.addEventListener('keydown', function (e) {
      if (!dialogEl.hidden && e.key === 'Escape') closeDialog();
    });
    return dialogEl;
  }

  function closeDialog() {
    if (!dialogEl) return;
    dialogEl.hidden = true;
    pendingHref = null;
  }

  function openDialog(href, source) {
    ensureDialog();
    pendingHref = href;
    var destination = source || 'the original publisher';
    dialogEl.querySelector('#leave-site-message').textContent =
      'This link opens on ' + destination + ' in a new tab. You\u2019ll leave Signal+.';
    dialogEl.hidden = false;
    dialogEl.querySelector('.leave-site-go').focus();
  }

  function initExternalNewsLinks(container) {
    if (!container) return;
    container.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="http"]');
      if (!link || !container.contains(link)) return;
      e.preventDefault();
      var item = link.closest('.news-item');
      var sourceEl = item && item.querySelector('.news-source');
      var source = sourceEl ? sourceEl.textContent.trim() : '';
      openDialog(link.href, source);
    });
  }

  window.initExternalNewsLinks = initExternalNewsLinks;
})();
