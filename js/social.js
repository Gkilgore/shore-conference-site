// Shows school social media beneath the upcoming games: one school on its own page, a school picker on Home.
// Posts stay on the platform. This site saves only each account's link and loads Instagram's own embed when
// the section is about to scroll into view. Facebook and X are shown as links.
async function loadSocialRows(school) {
  if (typeof shoreSupabase === 'undefined' || !shoreSupabase.url) return [];
  const query = 'select=school_id,platform,url,account_name' + (school ? '&school_id=eq.' + encodeURIComponent(school) : '');
  try {
    const response = await fetch(shoreSupabase.url + '/rest/v1/school_social_accounts?' + query, {
      headers: { apikey: shoreSupabase.publishableKey, Authorization: 'Bearer ' + shoreSupabase.publishableKey },
      signal: AbortSignal.timeout(15000) });
    return response.ok ? await response.json() : [];
  } catch {
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

function renderSocialAccounts(host, accounts) {
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };
  const links = node('ul', 'social-links');
  for (const account of accounts.filter(account => account.platform !== 'instagram')) {
    const link = node('a', 'button secondary', account.name + ' · ' + account.label + ' ' + account.handle);
    link.href = account.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.append(node('span', 'visually-hidden', ' (opens in a new tab)'));
    const item = node('li');
    item.append(link);
    links.append(item);
  }
  document.getElementById('social-links').replaceChildren(...(links.childElementCount ? [links] : []));
  const instagramAccounts = accounts.filter(account => account.platform === 'instagram');
  const frames = instagramAccounts.map(instagram => {
    const frame = node('div', 'social-embed');
    const status = node('p', 'social-note', 'Loading Instagram…');
    status.setAttribute('role', 'status');
    frame.append(node('p', 'eyebrow', instagram.name + ' · Instagram ' + instagram.handle), status);
    return { frame, status, instagram };
  });
  host.replaceChildren(...frames.map(item => item.frame));

  for (const { frame, status, instagram } of frames) {
  const show = async () => {
    // Instagram's script swaps this quote for its own frame holding the account's latest posts.
    const quote = node('blockquote', 'instagram-media');
    quote.dataset.instgrmPermalink = instagram.url;
    quote.dataset.instgrmVersion = '14';
    const fallback = node('a', '', 'View ' + instagram.handle + ' on Instagram');
    fallback.href = instagram.url;
    quote.append(fallback);
    frame.append(quote);
    // Instagram marks its frame "rendered" once the posts have arrived.
    const loaded = () => {
      const embed = frame.querySelector('iframe.instagram-media-rendered');
      if (!embed) return false;
      embed.title = 'Instagram posts from ' + instagram.handle;
      status.hidden = true;
      return true;
    };
    const failed = () => {
      if (loaded()) return;
      quote.remove();
      frame.querySelector('iframe')?.remove();
      const open = node('a', '', 'Open ' + instagram.handle + ' on Instagram');
      open.href = instagram.url;
      open.target = '_blank';
      open.rel = 'noopener';
      status.replaceChildren('Instagram didn’t load here. ', open);
    };
    const watcher = new MutationObserver(() => { if (loaded()) watcher.disconnect(); });
    watcher.observe(frame, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    setTimeout(() => { watcher.disconnect(); failed(); }, 12000);
    try {
      await loadInstagramEmbeds();
    } catch {
      watcher.disconnect();
      failed();
    }
  };
  if (!('IntersectionObserver' in window)) { show(); continue; }
  const near = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    near.disconnect();
    show();
  }, { rootMargin: '300px' });
  near.observe(frame);
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
    return;
  }

  // Home shows one school at a time, chosen from the picker.
  const schools = socialSchools(await loadSocialRows(), directory);
  if (!schools.length) return;
  const schoolLink = document.getElementById('social-school-link');
  const showSchool = slug => {
    const school = schools.find(item => item.slug === slug) ?? schools[0];
    picker.value = school.slug;
    schoolLink.textContent = school.name;
    schoolLink.href = 'school.html?school=' + encodeURIComponent(school.slug);
    renderSocialAccounts(host, school.accounts);
  };
  picker.replaceChildren(...schools.map(school => new Option(school.name, school.slug)));
  picker.onchange = () => showSchool(picker.value);
  showSchool(socialSchoolOfTheDay(schools).slug);
  section.hidden = false;
})();
