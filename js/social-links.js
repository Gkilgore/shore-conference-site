// Checks school and team social links and tidies them into one standard form.
// Shared by the staff Social media section and the public pages. No page access, so tests can run it.
const socialPlatforms = {
  instagram: {
    label: 'Instagram',
    example: 'https://www.instagram.com/yourschool',
    hosts: ['instagram.com', 'www.instagram.com', 'm.instagram.com'],
    name: /^[A-Za-z0-9._]{1,30}$/,
    posts: ['p', 'reel', 'reels', 'tv', 'stories'],
    reserved: ['explore', 'accounts', 'direct', 'about', 'developer', 'legal', 'web', 'share'],
    link: name => 'https://www.instagram.com/' + name + '/',
  },
  facebook: {
    label: 'Facebook',
    example: 'https://www.facebook.com/yourschool',
    hosts: ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'web.facebook.com'],
    name: /^[A-Za-z0-9.-]{1,80}$/,
    posts: ['watch', 'reel', 'photo', 'photo.php', 'story.php', 'permalink.php', 'share', 'sharer', 'events', 'groups'],
    reserved: ['login', 'login.php', 'home.php', 'marketplace', 'gaming', 'pages', 'help', 'policies', 'plugins', 'dialog', 'people'],
    link: name => 'https://www.facebook.com/' + name,
  },
  x: {
    label: 'X',
    example: 'https://x.com/yourschool',
    hosts: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'],
    name: /^[A-Za-z0-9_]{1,15}$/,
    posts: [],
    reserved: ['home', 'i', 'search', 'explore', 'intent', 'share', 'hashtag', 'settings', 'login', 'signup', 'messages', 'notifications'],
    link: name => 'https://x.com/' + name,
  },
};

// Returns { url, handle } for a good account link, or { problem } with one sentence saying what to fix.
function socialAccount(platform, input) {
  const site = Object.hasOwn(socialPlatforms, platform) ? socialPlatforms[platform] : null;
  if (!site) return { problem: 'Choose Instagram, Facebook or X.' };
  const text = String(input ?? '').trim();
  const wrong = { problem: 'Paste the link to the school’s ' + site.label + ' account, like ' + site.example + '.' };
  if (!text || text.length > 200 || /\s/.test(text)) return wrong;
  let link;
  try {
    link = new URL(/^https?:\/\//i.test(text) ? text : 'https://' + text);
  } catch {
    return wrong;
  }
  if (!site.hosts.includes(link.hostname.toLowerCase()) || link.port || link.username || link.password) return wrong;
  const parts = link.pathname.split('/').filter(Boolean);
  const first = (parts[0] ?? '').toLowerCase();
  const post = { problem: 'That link goes to a post. Paste the link to the account itself.' };

  if (platform === 'facebook') {
    // Pages without a short name use profile.php?id=123 or people/Name/123.
    const id = first === 'profile.php' && parts.length === 1 ? link.searchParams.get('id')
      : first === 'people' && parts.length === 3 ? parts[2] : null;
    if (id !== null) {
      return /^[0-9]{5,20}$/.test(id) ? { url: site.link('profile.php?id=' + id), handle: 'school page' } : wrong;
    }
  }
  if (site.posts.includes(first) || (platform === 'x' && (parts[1] ?? '').toLowerCase() === 'status')) return post;
  if (parts.length !== 1 || site.reserved.includes(first) || !site.name.test(parts[0])) return wrong;
  return { url: site.link(parts[0]), handle: platform === 'facebook' ? parts[0] : '@' + parts[0] };
}

// Turns saved rows into named public links. A row that fails the check is left out.
function socialAccountsFor(rows, school) {
  return rows.filter(row => row.school_id === school).flatMap(row => {
    const account = socialAccount(row.platform, row.url);
    return account.url ? [{ platform: row.platform, label: socialPlatforms[row.platform].label,
      name: row.account_name?.trim() || 'School athletics', ...account }] : [];
  }).sort((a, b) => a.name.localeCompare(b.name) ||
    Object.keys(socialPlatforms).indexOf(a.platform) - Object.keys(socialPlatforms).indexOf(b.platform) ||
    a.handle.localeCompare(b.handle));
}

// Schools with at least one account, by name. Used for the home page's school picker.
function socialSchools(rows, directory) {
  return Object.keys(directory)
    .map(slug => ({ slug, name: directory[slug].name, accounts: socialAccountsFor(rows, slug) }))
    .filter(school => school.accounts.length)
    .sort((first, second) => first.name.localeCompare(second.name));
}

// Choose among schools with links; exclude the current school when showing another one.
function randomSocialSchool(schools, random = Math.random, exceptSlug = null) {
  const pool = schools.length > 1 ? schools.filter(school => school.slug !== exceptSlug) : schools;
  if (!pool.length) return null;
  return pool[Math.floor(random() * pool.length)];
}

// Mix schools before interleaving their accounts so one school's teams do not fill the opening cards.
function conferenceSocialAccounts(schools, random = Math.random) {
  const shuffle = values => {
    const mixed = [...values];
    for (let i = mixed.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [mixed[i], mixed[j]] = [mixed[j], mixed[i]];
    }
    return mixed;
  };
  const shuffled = shuffle(schools);
  const result = [];
  for (const platform of Object.keys(socialPlatforms)) {
    const groups = shuffled.map(school => ({
      school,
      accounts: shuffle(school.accounts.filter(account => account.platform === platform)),
    }));
    for (let i = 0; groups.some(group => i < group.accounts.length); i++) {
      for (const { school, accounts } of groups) {
        if (accounts[i]) result.push({ ...accounts[i], schoolName: school.name });
      }
    }
  }
  return result;
}
