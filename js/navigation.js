// Keeps desktop links in one row and enhances the phone menu; Resources works without JavaScript.
(() => {
  const nav = document.querySelector('.main-navigation');
  if (!nav) return;
  const toggle = document.querySelector('.nav-toggle');
  const resources = nav.querySelector('.nav-resources');
  const summary = resources.querySelector('summary');
  const phone = matchMedia('(max-width: 960px)');
  const close = () => {
    if (nav.contains(document.activeElement)) toggle.focus();
    nav.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    resources.open = false;
  };
  const layout = () => {
    if (phone.matches) {
      toggle.hidden = false;
      close();
    } else {
      nav.hidden = false;
      if (document.activeElement === toggle) nav.querySelector('a').focus();
      toggle.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    }
  };
  toggle.addEventListener('click', () => {
    if (!nav.hidden) close();
    else { nav.hidden = false; toggle.setAttribute('aria-expanded', 'true'); }
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (resources.open && resources.contains(document.activeElement)) {
      resources.open = false;
      summary.focus();
    } else if (phone.matches && !nav.hidden) close();
  });
  document.addEventListener('click', event => {
    if (!resources.open || resources.contains(event.target)) return;
    if (resources.contains(document.activeElement)) summary.focus();
    resources.open = false;
  });
  nav.addEventListener('focusout', () => {
    setTimeout(() => {
      if (!resources.contains(document.activeElement)) resources.open = false;
    }, 0);
  });
  phone.addEventListener('change', layout);
  layout();
})();
