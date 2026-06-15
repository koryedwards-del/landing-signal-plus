(function () {
  var dialogEl = null;
  var goLinkEl = null;

  function injectStyles() {
    if (document.getElementById('external-news-link-styles')) return;
    var style = document.createElement('style');
    style.id = 'external-news-link-styles';
    style.textContent =
      '.leave-site-dialog{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);margin:0;border:none;max-width:420px;width:calc(100% - 40px);background:#111822;border:1px solid rgba(0,200,232,0.22)!important;border-radius:12px;padding:24px 22px;box-shadow:0 0 40px rgba(0,200,232,0.12);color:#F0EDE8;inset:auto}' +
      '.leave-site-dialog::backdrop{background:rgba(0,0,0,0.72)}' +
      '.leave-site-dialog h3{font-family:Oswald,sans-serif;font-size:22px;font-weight:600;color:#F0EDE8;margin:0 0 10px;text-transform:uppercase;letter-spacing:0.04em}' +
      '.leave-site-dialog p{font-family:"Open Sans",sans-serif;font-size:15px;line-height:1.55;color:#8A97A8;margin:0 0 22px}' +
      '.leave-site-actions{display:flex;gap:10px;flex-wrap:wrap}' +
      '.leave-site-actions button,.leave-site-actions a{flex:1 1 140px;padding:14px 14px;border-radius:8px;font-family:"Space Mono",monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;transition:opacity 0.2s;text-align:center;text-decoration:none;display:inline-block;line-height:1.2;box-sizing:border-box}' +
      '.leave-site-stay{background:transparent;border:1px solid rgba(0,200,232,0.35);color:#00C8E8}' +
      '.leave-site-go{background:#00C8E8;border:1px solid #00C8E8;color:#080C12;font-weight:700}' +
      '.leave-site-actions button:hover,.leave-site-actions a:hover{opacity:0.88}';
    document.head.appendChild(style);
  }

  function ensureDialog() {
    if (dialogEl) return dialogEl;
    injectStyles();

    dialogEl = document.createElement('dialog');
    dialogEl.className = 'leave-site-dialog';
    dialogEl.innerHTML =
      '<h3 id="leave-site-title">Leaving Signal+</h3>' +
      '<p id="leave-site-message"></p>' +
      '<div class="leave-site-actions">' +
        '<button type="button" class="leave-site-stay">Stay on Signal+</button>' +
        '<a class="leave-site-go" href="#" target="_blank" rel="noopener noreferrer">Continue to story</a>' +
      '</div>';

    document.body.appendChild(dialogEl);
    goLinkEl = dialogEl.querySelector('.leave-site-go');

    dialogEl.querySelector('.leave-site-stay').addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      dialogEl.close();
    });

    goLinkEl.addEventListener('click', function () {
      window.setTimeout(function () {
        dialogEl.close();
      }, 0);
    });

    dialogEl.addEventListener('cancel', function (e) {
      e.preventDefault();
      dialogEl.close();
    });

    return dialogEl;
  }

  function openDialog(href, source) {
    ensureDialog();
    var destination = source || 'the original publisher';
    dialogEl.querySelector('#leave-site-message').textContent =
      'This link opens on ' + destination + ' in a new tab. You\u2019ll leave Signal+.';
    goLinkEl.href = href;
    if (typeof dialogEl.showModal === 'function') {
      dialogEl.showModal();
      return;
    }

    // Fallback for browsers without dialog support
    dialogEl.setAttribute('open', '');
    dialogEl.style.position = 'fixed';
    dialogEl.style.top = '50%';
    dialogEl.style.left = '50%';
    dialogEl.style.transform = 'translate(-50%, -50%)';
    dialogEl.style.zIndex = '10001';
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
