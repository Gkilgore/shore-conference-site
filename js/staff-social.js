// Lets staff add, edit and remove named social accounts for their permitted school.
function startStaffSocial(client, { currentSchool }) {
  const list = document.getElementById('social-list');
  const form = document.getElementById('social-form');
  const status = document.getElementById('social-status');
  let rows = [];
  let active = true;
  let request = 0;

  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const button = (label, aria, action) => {
    const element = node('button', label, 'button secondary');
    element.type = 'button';
    element.setAttribute('aria-label', aria);
    element.onclick = action;
    return element;
  };
  const sameSchool = school => active && currentSchool()?.slug === school;
  const validName = input => {
    const value = input.value.trim();
    if (value && value.length <= 60) return value;
    input.setAttribute('aria-invalid', 'true');
    status.textContent = 'Enter an account name, such as Football or Boys soccer (60 characters or fewer).';
    input.focus();
    return null;
  };
  const validLink = (platform, input) => {
    const account = socialAccount(platform, input.value);
    if (account.url) return account.url;
    input.setAttribute('aria-invalid', 'true');
    status.textContent = account.problem;
    input.focus();
    return null;
  };

  async function load() {
    const school = currentSchool();
    if (!school) return;
    const current = ++request;
    const { data, error } = await client.from('school_social_accounts')
      .select('id,school_id,platform,url,account_name').eq('school_id', school.slug);
    if (!sameSchool(school.slug) || current !== request) return;
    if (error) {
      list.replaceChildren();
      status.textContent = ['42P01', 'PGRST205', '42703'].includes(error.code)
        ? 'Social accounts need the latest test database migration. Ask the site admin to apply it, then refresh.'
        : 'The social media links could not load. Check your connection, then refresh.';
      return;
    }
    rows = data;
    render(school);
  }

  function render(school) {
    list.replaceChildren(...rows.sort((a, b) => (a.account_name || '').localeCompare(b.account_name || '') ||
      a.platform.localeCompare(b.platform)).map(saved => {
      const item = node('li', null, 'social-account-row');
      const heading = node('strong', socialPlatforms[saved.platform]?.label || saved.platform);
      const nameLabel = node('label', 'Account name');
      const name = node('input');
      name.maxLength = 60;
      name.value = saved.account_name || 'School athletics';
      nameLabel.append(name);
      const linkLabel = node('label', 'Account link');
      const link = node('input');
      link.type = 'url';
      link.maxLength = 200;
      link.value = saved.url;
      linkLabel.append(link);
      const save = button('Save changes', 'Save changes to ' + name.value, async () => {
        const accountName = validName(name);
        const url = validLink(saved.platform, link);
        if (!accountName || !url) return;
        save.disabled = true;
        const { data, error } = await client.from('school_social_accounts')
          .update({ account_name: accountName, url }).eq('id', saved.id).eq('school_id', school.slug).select('id');
        if (!sameSchool(school.slug)) return;
        status.textContent = error || !data?.length ? 'That account could not be saved. Try again.'
          : accountName + ' saved. It is on the public site now.';
        await load();
      });
      save.hidden = true;
      for (const input of [name, link]) input.oninput = () => {
        input.removeAttribute('aria-invalid');
        save.hidden = false;
      };
      const view = node('a', 'Open', 'button secondary');
      view.href = saved.url;
      view.target = '_blank';
      view.rel = 'noopener';
      view.setAttribute('aria-label', 'Open ' + name.value + ' on ' + heading.textContent);
      const remove = button('Remove', 'Remove ' + name.value + ' ' + heading.textContent + ' link', async () => {
        remove.disabled = true;
        const { data, error } = await client.from('school_social_accounts')
          .delete().eq('id', saved.id).eq('school_id', school.slug).select('id');
        if (!sameSchool(school.slug)) return;
        status.textContent = error || !data?.length ? 'That account could not be removed. Try again.'
          : name.value + ' removed. It is off the public site.';
        await load();
      });
      item.append(heading, nameLabel, linkLabel, save, view, remove);
      return item;
    }));
    if (!rows.length) list.append(node('li', 'No social accounts added yet.', 'staff-empty'));
  }

  form.onsubmit = async event => {
    event.preventDefault();
    const school = currentSchool();
    if (!school) return;
    const fields = form.elements;
    const accountName = validName(fields.account_name);
    const url = validLink(fields.platform.value, fields.url);
    if (!accountName || !url) return;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    const { data, error } = await client.from('school_social_accounts')
      .insert({ school_id: school.slug, account_name: accountName, platform: fields.platform.value, url }).select('id');
    if (!sameSchool(school.slug)) return;
    submit.disabled = false;
    status.textContent = error || !data?.length ? 'That account could not be added. Check for a duplicate link and try again.'
      : accountName + ' added. It is on the public site now.';
    if (!error && data?.length) form.reset();
    await load();
  };
  form.oninput = event => event.target.removeAttribute?.('aria-invalid');

  return {
    load() { status.textContent = ''; return load(); },
    reset() { request++; rows = []; list.replaceChildren(); status.textContent = ''; form.reset(); },
    stop() { active = false; request++; form.onsubmit = form.oninput = null; },
  };
}
