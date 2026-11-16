// Social media section of the staff School settings tab: the link to a school's Instagram, Facebook and X account, one of each.
// ADs manage their own school; conference admins and site admins pick any school. Supabase enforces that.
// A saved link shows on the school page and the home page straight away. Only the link is saved.
function startStaffSocial(client, { currentSchool }) {
  const list = document.getElementById('social-list');
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
  const button = (label, className, aria, onclick) => {
    const element = node('button', label, 'button ' + className);
    element.type = 'button';
    element.setAttribute('aria-label', aria);
    element.onclick = onclick;
    return element;
  };

  async function load() {
    const school = currentSchool();
    if (!school) return;
    const current = ++request;
    const { data, error } = await client.from('school_social_accounts')
      .select('id,school_id,platform,url').eq('school_id', school.slug);
    if (!active || current !== request) return;
    if (error) {
      list.replaceChildren();
      status.textContent = ['42P01', 'PGRST205'].includes(error.code)
        ? 'Social media links are off until the social accounts table is set up in Supabase. Ask the site admin to apply the social accounts migration, then refresh.'
        : 'The social media links could not load. Check your connection, then refresh.';
      return;
    }
    rows = data;
    render(school);
  }

  function render(school) {
    list.replaceChildren(...Object.entries(socialPlatforms).map(([platform, site]) => {
      const saved = rows.find(row => row.platform === platform);
      const item = node('li');
      const label = node('label', site.label + ' ');
      const input = node('input');
      input.type = 'url';
      input.maxLength = 200;
      input.autocomplete = 'off';
      input.placeholder = site.example;
      input.value = saved?.url ?? '';
      label.append(input);

      const save = button('Save', 'primary', 'Save ' + site.label + ' link', async () => {
        const account = socialAccount(platform, input.value);
        if (account.problem) {
          input.setAttribute('aria-invalid', 'true');
          status.textContent = account.problem;
          input.focus();
          return;
        }
        save.disabled = true;
        const table = client.from('school_social_accounts');
        const { error } = saved
          ? await table.update({ url: account.url }).eq('id', saved.id)
          : await table.insert({ school_id: school.slug, platform, url: account.url });
        if (!active) return;
        status.textContent = error ? 'That link could not be saved. Try again.'
          : site.label + ' saved. It is on the public site now.';
        load();
      });
      save.hidden = Boolean(saved);
      input.oninput = () => {
        save.hidden = false;
        input.removeAttribute('aria-invalid');
      };
      item.append(label, save);

      if (saved) {
        const view = node('a', 'Open', 'button secondary');
        view.href = saved.url;
        view.target = '_blank';
        view.rel = 'noopener';
        view.setAttribute('aria-label', 'Open the ' + site.label + ' account in a new tab');
        const remove = button('Remove', 'secondary', 'Remove ' + site.label + ' link', async () => {
          remove.disabled = true;
          const { error } = await client.from('school_social_accounts').delete().eq('id', saved.id);
          if (!active) return;
          status.textContent = error ? 'That link could not be removed. Try again.'
            : site.label + ' removed. It is off the public site.';
          load();
        });
        item.append(view, remove);
      }
      return item;
    }));
  }

  return {
    load() {
      status.textContent = '';
      return load();
    },
    reset() {
      request++;
      rows = [];
      list.replaceChildren();
      status.textContent = '';
    },
    stop() {
      active = false;
    },
  };
}
