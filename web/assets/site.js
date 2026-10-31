/* Emden Tigers Webseite: nur kleine Extras, die Seite funktioniert auch ohne JavaScript. */
document.documentElement.classList.add('js');

// Abschnitte beim Scrollen sanft einblenden
const items = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }), { rootMargin: '0px 0px -10% 0px' });
  items.forEach(el => io.observe(el));
} else {
  items.forEach(el => el.classList.add('in'));
}

// Handy-Menü nach dem Antippen eines Links schließen
document.querySelectorAll('.site-nav a').forEach(a => a.addEventListener('click', () => { document.getElementById('menu').checked = false; }));
