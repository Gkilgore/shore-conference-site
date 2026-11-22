// Shows school social media beneath the upcoming games, including a conference-wide option on Home.
// Posts stay on the platform. This site saves only each account's link and loads Instagram's own embed when
// the section is about to scroll into view. Facebook and X are shown as links.
async function loadSocialRows(school) {
  if (typeof shoreSupabase === 'undefined' || !shoreSupabase.url) return [];
  const query = 'select=school_id,platform,url,account_name' + (school ? '&school_id=eq.' + encodeURIComponent(school) : '');
  try {
    const rows = [];
    while (true) {
      const response = await fetch(shoreSupabase.url + '/rest/v1/school_social_accounts?' + query +
        '&order=id.asc&limit=500&offset=' + rows.length, {
        headers: { apikey: shoreSupabase.publishableKey, Authorization: 'Bearer ' + shoreSupabase.publishableKey },
        signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Social accounts request failed (' + response.status + ').');
      const page = await response.json();
      if (!Array.isArray(page)) throw new Error('Social accounts response was not a list.');
      if (!page.length) return rows;
      rows.push(...page);
    }
  } catch (error) {
    console.error('Could not load social accounts:', error);
    return [];
  }
}

// Instagram's embed script is added once, the first time an embed is needed.
let instagramScript;
function loadInstagramEmbeds() {
  instagramScript ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.instagram.com/embed.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
  return instagramScript.then(() => window.instgrm?.Embeds?.process());
}

let stopSocialScrolling = [];
function autoScrollSocial(list, controls, ready = () => true) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const label = list.getAttribute('aria-label');
  const makeButton = (text, description) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button secondary social-scroll-button';
    button.textContent = text;
    button.setAttribute('aria-label', description);
    return button;
  };
  const previous = makeButton('‹', 'Previous ' + label);
  const button = makeButton('', '');
  const next = makeButton('›', 'Next ' + label);
  controls.replaceChildren(previous, button, next);
  let paused = reducedMotion.matches;
  let hovering = false;
  let focused = false;
  let autoDirection = 1;
  const updateButton = () => {
    button.textContent = paused ? 'Play' : 'Pause';
    button.setAttribute('aria-label', button.textContent + ' ' + label + ' scrolling');
  };
  const onClick = () => { paused = !paused; updateButton(); };
  const move = direction => {
    const max = list.scrollWidth - list.clientWidth;
    if (max <= 0) return;
    const step = list.children[1]?.offsetLeft - list.children[0]?.offsetLeft || list.clientWidth;
    const target = direction > 0
      ? (list.scrollLeft >= max - 1 ? 0 : Math.min(list.scrollLeft + step, max))
      : (list.scrollLeft <= 1 ? max : Math.max(list.scrollLeft - step, 0));
    list.scrollTo({ left: target, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  };
  const onPrevious = () => { paused = true; updateButton(); move(-1); };
  const onNext = () => { paused = true; updateButton(); move(1); };
  const onEnter = () => { hovering = true; };
  const onLeave = () => { hovering = false; };
  const onFocus = () => { focused = true; };
  const onBlur = event => { if (!list.contains(event.relatedTarget)) focused = false; };
  const onMotionChange = event => { if (event.matches) { paused = true; updateButton(); } };
  button.addEventListener('click', onClick);
  previous.addEventListener('click', onPrevious);
  next.addEventListener('click', onNext);
  list.addEventListener('pointerenter', onEnter);
  list.addEventListener('pointerleave', onLeave);
  list.addEventListener('focusin', onFocus);
  list.addEventListener('focusout', onBlur);
  reducedMotion.addEventListener('change', onMotionChange);
  updateButton();
  const timer = setInterval(() => {
    if (paused || hovering || focused || document.hidden || !list.clientWidth || !ready()) return;
    const max = list.scrollWidth - list.clientWidth;
    if (list.scrollLeft >= max - 1) autoDirection = -1;
    else if (list.scrollLeft <= 1) autoDirection = 1;
    move(autoDirection);
  }, 5000);
  return () => {
    clearInterval(timer);
    button.removeEventListener('click', onClick);
    previous.removeEventListener('click', onPrevious);
    next.removeEventListener('click', onNext);
    list.removeEventListener('pointerenter', onEnter);
    list.removeEventListener('pointerleave', onLeave);
    list.removeEventListener('focusin', onFocus);
    list.removeEventListener('focusout', onBlur);
    reducedMotion.removeEventListener('change', onMotionChange);
  };
}

function renderSocialAccounts(host, accounts) {
  stopSocialScrolling.forEach(stop => stop());
  stopSocialScrolling = [];
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };
  const accountName = account => (account.schoolName ? account.schoolName + ' · ' : '') + account.name;
  const linkGroups = [];
  const scrollGroups = [];
  for (const platform of ['facebook', 'x']) {
    const group = accounts.filter(account => account.platform === platform);
    if (!group.length) continue;
    const links = node('ul', 'social-links');
    if (group.length >= 4) {
      links.classList.add('social-scroll');
      links.setAttribute('tabindex', '0');
      links.setAttribute('aria-label', group[0].label + ' accounts');
    }
    for (const account of group) {
      const link = node('a', 'button secondary', accountName(account) + ' · ' + account.label + ' ' + account.handle);
      link.href = account.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.append(node('span', 'visually-hidden', ' (opens in a new tab)'));
      const item = node('li');
      item.append(link);
      links.append(item);
    }
    linkGroups.push(links);
    if (group.length >= 4) {
      const controls = node('div', 'social-scroll-controls');
      linkGroups.push(controls);
      scrollGroups.push([links, controls]);
    }
  }
  document.getElementById('social-links').replaceChildren(...linkGroups);
  const instagramAccounts = accounts.filter(account => account.platform === 'instagram');
  const scrollInstagram = instagramAccounts.length >= 4;
  const instagramControls = document.getElementById('social-instagram-controls');
  instagramControls.hidden = !scrollInstagram;
  instagramControls.replaceChildren();
  host.classList.toggle('social-scroll', scrollInstagram);
  if (scrollInstagram) {
    host.setAttribute('tabindex', '0');
    host.setAttribute('role', 'region');
    host.setAttribute('aria-label', 'Instagram accounts');
    scrollGroups.push([host, instagramControls]);
  } else {
    host.removeAttribute('tabindex');
    host.removeAttribute('role');
    host.removeAttribute('aria-label');
  }
  host.scrollLeft = 0;
  const frames = instagramAccounts.map(instagram => {
    const frame = node('div', 'social-embed');
    const status = node('p', 'social-note', 'Loading Instagram…');
    status.setAttribute('role', 'status');
    frame.append(node('p', 'eyebrow', accountName(instagram) + ' · Instagram ' + instagram.handle), status);
    return { frame, status, instagram };
  });
  host.replaceChildren(...frames.map(item => item.frame));
  let instagramReady = !frames.length;
  stopSocialScrolling = scrollGroups.map(([list, controls]) =>
    autoScrollSocial(list, controls, () => list !== host || instagramReady));

  if (frames.length) {
    let active = true;
    let pending = frames.length;
    const cleanup = [];
    const show = () => {
      const failures = frames.map(({ frame, status, instagram }) => {
        const quote = node('blockquote', 'instagram-media');
        quote.dataset.instgrmPermalink = instagram.url;
        quote.dataset.instgrmVersion = '14';
        const fallback = node('a', '', 'View ' + instagram.handle + ' on Instagram');
        fallback.href = instagram.url;
        quote.append(fallback);
        frame.append(quote);
        let settled = false;
        let embed;
        const onLoad = () => finish(false);
        const finish = failed => {
          if (settled || !active) return;
          settled = true;
          watcher.disconnect();
          embed?.removeEventListener('load', onLoad);
          clearTimeout(timeout);
          if (failed) {
            quote.remove();
            frame.querySelector('iframe')?.remove();
            const open = node('a', '', 'Open ' + instagram.handle + ' on Instagram');
            open.href = instagram.url;
            open.target = '_blank';
            open.rel = 'noopener';
            status.replaceChildren('Instagram didn’t load here. ', open);
          } else {
            status.hidden = true;
          }
          if (--pending === 0) instagramReady = true;
        };
        const watcher = new MutationObserver(() => {
          embed = frame.querySelector('iframe.instagram-media-rendered');
          if (!embed) return;
          embed.title = 'Instagram posts from ' + (instagram.schoolName ? instagram.schoolName + ' · ' : '') + instagram.handle;
          watcher.disconnect();
          embed.addEventListener('load', onLoad, { once: true });
        });
        watcher.observe(frame, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        const timeout = setTimeout(() => finish(!embed), 12000);
        cleanup.push(() => { watcher.disconnect(); embed?.removeEventListener('load', onLoad); clearTimeout(timeout); });
        return () => finish(true);
      });
      loadInstagramEmbeds().catch(() => failures.forEach(fail => fail()));
    };
    if (!('IntersectionObserver' in window)) {
      show();
    } else {
      const near = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        near.disconnect();
        if (active) show();
      }, { rootMargin: '300px' });
      near.observe(host);
      cleanup.push(() => near.disconnect());
    }
    stopSocialScrolling.push(() => { active = false; cleanup.forEach(stop => stop()); });
  }
}

(async () => {
  const section = document.getElementById('social');
  if (!section) return;
  const host = document.getElementById('social-accounts');
  const directory = typeof shoreSchools !== 'undefined' ? shoreSchools : {};
  const picker = document.getElementById('social-school');

  // A school page shows that school's accounts. The section stays hidden when it has none.
  if (!picker) {
    if (typeof schoolSlug !== 'string' || !Object.hasOwn(directory, schoolSlug)) return;
    const accounts = socialAccountsFor(await loadSocialRows(schoolSlug), schoolSlug);
    if (!accounts.length) return;
    renderSocialAccounts(host, accounts);
    section.hidden = false;
    if (location.hash === '#social') requestAnimationFrame(() => section.scrollIntoView());
    return;
  }

  // Home starts with all conference schools; visitors can choose one school instead.
  const schools = socialSchools(await loadSocialRows(), directory);
  if (!schools.length) return;
  const allSchools = '';
  const conferenceAccounts = conferenceSocialAccounts(schools).filter(account => account.platform === 'instagram');
  const schoolLink = document.getElementById('social-school-link');
  const more = document.getElementById('social-more');
  const next = document.getElementById('social-next');
  const showSchool = slug => {
    if (slug === allSchools) {
      picker.value = allSchools;
      schoolLink.textContent = 'All Conference Schools';
      schoolLink.href = 'schools.html';
      more.href = 'schools.html';
      more.textContent = 'Browse schools →';
      next.hidden = false;
      renderSocialAccounts(host, conferenceAccounts);
      if (!conferenceAccounts.length) {
        const note = document.createElement('p');
        note.className = 'social-note';
        note.textContent = 'No Instagram accounts yet. Choose a school to see its social media.';
        document.getElementById('social-links').append(note);
      }
      return;
    }
    const school = schools.find(item => item.slug === slug) ?? schools[0];
    picker.value = school.slug;
    schoolLink.textContent = school.name;
    schoolLink.href = 'school.html?school=' + encodeURIComponent(school.slug);
    more.href = schoolLink.href + '#social';
    more.textContent = 'See more from ' + school.name + ' →';
    next.hidden = schools.length < 2;
    renderSocialAccounts(host, school.accounts);
  };
  picker.replaceChildren(new Option('All Conference Schools', allSchools),
    ...schools.map(school => new Option(school.name, school.slug)));
  picker.onchange = () => showSchool(picker.value);
  next.onclick = () => showSchool(randomSocialSchool(schools, Math.random, picker.value).slug);
  showSchool(allSchools);
  section.hidden = false;
})();
