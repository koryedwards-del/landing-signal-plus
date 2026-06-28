(function () {
  var NAV_ITEMS = [
    { id: 'home', label: 'Home', href: function (ctx) { return ctx.base + 'index.html'; } },
    { id: 'news', label: 'GLP-1 News', href: function (ctx) { return ctx.base + 'glp-1-changes.html'; } },
    {
      id: 'subscribe',
      label: 'Subscribe',
      href: function (ctx) {
        return ctx.onHome ? '#subscribe' : ctx.base + 'index.html#subscribe';
      },
    },
    { id: 'app', label: 'Signal+ App', href: function (ctx) { return ctx.base + 'signal-app.html'; } },
  ];

  var FOOTER_ITEMS = NAV_ITEMS.concat([
    {
      id: 'legal',
      label: 'Privacy & Support',
      href: function (ctx) {
        return ctx.base + 'signal-privacy.html';
      },
    },
  ]);

  function buildContext(el) {
    var active = el.getAttribute('data-active') || '';
    var base = el.getAttribute('data-base') || '';
    return { active: active, base: base, onHome: active === 'home' };
  }

  function renderLinks(items, ctx, activeClass) {
    return items
      .map(function (item) {
        var cls = item.id === ctx.active ? ' class="' + activeClass + '"' : '';
        return '<li><a href="' + item.href(ctx) + '"' + cls + '>' + item.label + '</a></li>';
      })
      .join('');
  }

  function initHeaderNav() {
    var nav = document.querySelector('[data-site-nav]');
    if (!nav) return;

    var ctx = buildContext(nav);
    var links = renderLinks(NAV_ITEMS, ctx, 'active');

    nav.innerHTML =
      '<a class="nav-brand" href="' + ctx.base + 'index.html">SIGNAL<sup>+</sup></a>' +
      '<button class="nav-toggle" onclick="this.nextElementSibling.classList.toggle(\'open\')" aria-label="Menu">' +
      '<span></span><span></span><span></span></button>' +
      '<ul class="nav-links">' + links + '</ul>';

    nav.querySelectorAll('.nav-links a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.querySelector('.nav-links').classList.remove('open');
      });
    });
  }

  function initFooterNav() {
    document.querySelectorAll('[data-site-footer-nav]').forEach(function (footerNav) {
      var ctx = buildContext(footerNav);
      footerNav.innerHTML = renderLinks(FOOTER_ITEMS, ctx, 'active');
    });
  }

  function init() {
    initHeaderNav();
    initFooterNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
