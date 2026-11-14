// Runs the Information page (resources.html): left-hand tabs, the division pop-up, and the tournament and document lists.
(() => {
  const tabs = [...document.querySelectorAll('.side-tab')];
  if (!tabs.length) return;
  const panels = tabs.map(tab => document.getElementById(tab.hash.slice(1)));
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const link = (text, href, className) => {
    const anchor = node('a', text, className);
    anchor.href = href;
    return anchor;
  };

  // Tabs: the address hash names the open panel, so each tab can be shared. Anything else opens About.
  function show(focus) {
    const target = document.getElementById(location.hash.slice(1));
    const current = panels.find(panel => panel === target || panel.contains(target)) || panels[0];
    panels.forEach((panel, index) => {
      panel.hidden = panel !== current;
      if (panel === current) tabs[index].setAttribute('aria-current', 'true');
      else tabs[index].removeAttribute('aria-current');
    });
    if (focus) current.querySelector('h2').focus();
    return target !== current && current.contains(target) ? target : null; // A chapter inside the panel.
  }
  for (const tab of tabs) {
    tab.addEventListener('click', event => {
      event.preventDefault(); // Swap the panel in place instead of jumping down the page.
      if (tab.hash !== location.hash) history.pushState(null, '', tab.hash);
      show(true);
    });
  }
  for (const panel of panels) panel.querySelector('h2').tabIndex = -1;
  addEventListener('hashchange', () => show());
  addEventListener('popstate', () => show());
  const chapter = show();
  if (chapter) chapter.scrollIntoView();
  else if (location.hash) scrollTo(0, 0);

  // Divisions: one button per team, by season. A button opens that sport's divisions in a pop-up.
  const dialog = node('dialog', '', 'game-details division-details');
  dialog.setAttribute('aria-labelledby', 'division-details-title');
  dialog.innerHTML = `
    <p class="eyebrow"></p>
    <h2 id="division-details-title"></h2>
    <div class="division-groups"></div>
    <p class="doc-meta"></p>
    <div class="actions"><a class="button dark">Official list</a><form method="dialog"><button class="button secondary" autofocus>Close</button></form></div>`;
  document.body.append(dialog);
  const members = schools => {
    const list = node('ul');
    list.append(...schools.map(slug => {
      const item = node('li');
      if (Object.hasOwn(shoreSchools, slug)) item.append(link(shoreSchools[slug].name, 'school.html?school=' + encodeURIComponent(slug)));
      else item.textContent = slug;
      return item;
    }));
    return list;
  };
  function openDivisions(team, season) {
    const list = team.list;
    const names = Object.keys(list.divisions || {});
    dialog.querySelector('.eyebrow').textContent = season + ' · ' + list.level;
    dialog.querySelector('h2').textContent = team.label;
    dialog.querySelector('.division-groups').replaceChildren(...names.map(name => {
      const group = node('section');
      group.append(node('h3', name), list.complete ? members(list.divisions[name])
        : node('p', 'Schools not copied here yet. See the official list.'));
      return group;
    }));
    dialog.querySelector('.doc-meta').textContent = (names.length
      ? 'Only some divisions are copied here so far. The official list has them all.'
      : 'Divisions are not copied here yet. The official list has them all.') + ' Checked ' + list.reviewed + '.';
    dialog.querySelector('a').href = list.url;
    dialog.showModal();
  }
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  document.getElementById('division-teams').replaceChildren(...divisionGroups(shoreConferenceResources.divisionLists).flatMap(group => {
    const buttons = node('div', '', 'division-teams');
    buttons.append(...group.teams.map(team => {
      const button = node('button', team.label, 'button secondary');
      button.type = 'button';
      button.setAttribute('aria-haspopup', 'dialog');
      button.addEventListener('click', () => openDivisions(team, group.label));
      return button;
    }));
    return [node('h3', group.label, 'eyebrow'), buttons];
  }));

  // Tournament files and conference documents: one framed row each, linking to the copy saved on this site.
  for (const kind of ['tournaments', 'documents']) {
    document.getElementById(kind + '-list').replaceChildren(...shorePublicResources[kind].map(record => {
      const item = node('li');
      item.append(link(record.title, record.url),
        node('span', [record.format, record.category, record.version].join(' · '), 'doc-meta'),
        node('p', record.description));
      if (record.note) item.append(node('p', record.note, 'doc-meta'));
      return item;
    }));
  }
})();
