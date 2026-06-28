(function () {
  var nav = document.querySelector('[data-site-nav]');
  if (!nav) return;

  var active = nav.getAttribute('data-active') || '';
  var base = nav.getAttribute('data-base') || '';
  var onHome = active === 'home';

  var items = [
    { id: 'home', label: 'Home', href: base + 'index.html' },
    { id: 'subscribe', label: 'Subscribe', href: onHome ? '#subscribe' : base + 'index.html#subscribe' },
    { id: 'app', label: 'The Signal+ App', href: base + 'signal-app.html' },
    { id: 'news', label: 'GLP-1 News', href: base + 'glp-1-changes.html' },
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
