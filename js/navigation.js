// Enhances the shared HTML navigation with a phone disclosure; links work without JavaScript.
(() => {
  const nav = document.querySelector('.main-navigation');
  if (!nav) return;
  const toggle = nav.querySelector('.nav-toggle');
  const links = nav.querySelector('.nav-more');
  const phone = matchMedia('(max-width: 800px)');
  const setOpen = open => {
    toggle.setAttribute('aria-expanded', String(open));
    links.hidden = phone.matches && !open;
  };
  const layout = () => {
    const focused = document.activeElement;
    if (phone.matches) {
      toggle.hidden = false;
      if (links.contains(focused)) toggle.focus();
      setOpen(false);
    } else {
      links.hidden = false;
      if (focused === toggle || focused?.classList.contains('nav-home')) {
        nav.querySelector('a').focus();
      }
      toggle.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    }
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('keydown', event => {
    if (event.key === 'Escape' && phone.matches && !links.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });
  phone.addEventListener('change', layout);
  layout();
})();
