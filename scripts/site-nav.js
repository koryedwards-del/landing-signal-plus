(function () {
  var nav = document.querySelector('[data-site-nav]');
  if (!nav) return;

  var active = nav.getAttribute('data-active') || '';
  var base = nav.getAttribute('data-base') || '';
  var onHome = active === 'home';

  var items = [
    { id: 'home', label: 'Home', href: base + 'index.html' },
    { id: 'newsletter', label: 'Newsletter', href: base + 'newsletter.html' },
    { id: 'archive', label: 'Archive', href: onHome ? '#archive' : base + 'index.html#archive' },
    { id: 'subscribe', label: 'Subscribe', href: onHome ? '#subscribe' : base + 'index.html#subscribe' },
    { id: 'app', label: 'App', href: base + 'signal-support.html' },
  ];

  var links = items.map(function (item) {
    var cls = item.id === active ? ' class="active"' : '';
    return '<li><a href="' + item.href + '"' + cls + '>' + item.label + '</a></li>';
  }).join('');

  nav.innerHTML =
    '<a class="nav-brand" href="' + base + 'index.html">SIGNAL<sup>+</sup></a>' +
    '<button class="nav-toggle" onclick="this.nextElementSibling.classList.toggle(\'open\')" aria-label="Menu">' +
    '<span></span><span></span><span></span></button>' +
    '<ul class="nav-links">' + links + '</ul>';

  nav.querySelectorAll('.nav-links a').forEach(function (link) {
    link.addEventListener('click', function () {
      nav.querySelector('.nav-links').classList.remove('open');
    });
  });
})();
