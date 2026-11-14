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

  // Divisions: one button per team, by season. A button opens that sport's whole alignment in a pop-up:
  // every division and every school in it. Escape or Close returns focus to the button.
  const dialog = node('dialog', '', 'game-details division-details');
  dialog.setAttribute('aria-labelledby', 'division-details-title');
  dialog.innerHTML = `
    <p class="eyebrow"></p>
    <h2 id="division-details-title"></h2>
    <p class="division-summary"></p>
    <div class="division-groups"></div>
    <div class="division-notes" hidden><h3>To confirm</h3><ul></ul></div>
    <p class="doc-meta"></p>
    <div class="actions"><a class="button dark">Saved list</a><form method="dialog"><button class="button secondary" autofocus>Close</button></form></div>`;
  document.body.append(dialog);
  let opener = null;
  function openDivisions(team, season, button) {
    const breakdown = divisionBreakdown(team.list, shoreSchools);
    dialog.querySelector('.eyebrow').textContent = season + ' · ' + team.list.level;
    dialog.querySelector('h2').textContent = team.label;
    dialog.querySelector('.division-summary').textContent = breakdown.summary;
    dialog.querySelector('.division-groups').replaceChildren(...breakdown.divisions.map(division => {
      const group = node('section');
      group.setAttribute('aria-label', division.name);
      group.append(node('h3', division.name));
      if (!division.members) group.append(node('p', 'Schools not copied here yet.'));
      else {
        const schools = node('ul');
        schools.append(...division.members.map(member => {
          const item = node('li');
          if (!member.schools.length) item.append(node('span', member.name, 'printed-name'));
          member.schools.forEach((school, index) => {
            if (index) item.append(' / ');
            item.append(link(school.name, 'school.html?school=' + encodeURIComponent(school.slug)));
          });
          return item;
        }));
        group.append(schools);
      }
      return group;
    }));
    const notes = dialog.querySelector('.division-notes');
    notes.hidden = !breakdown.notes.length;
    notes.querySelector('ul').replaceChildren(...breakdown.notes.map(note => node('li', note)));
    dialog.querySelector('.doc-meta').textContent = 'From the saved conference list. Checked ' + breakdown.reviewed + '.';
    dialog.querySelector('.actions a').href = team.list.url;
    opener = button;
    dialog.showModal();
    dialog.scrollTop = 0;
  }
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { if (opener?.isConnected) opener.focus(); opener = null; });
  document.getElementById('division-teams').replaceChildren(...divisionGroups(shoreConferenceResources.divisionLists).flatMap(group => {
    const buttons = node('div', '', 'division-teams');
    buttons.append(...group.teams.map(team => {
      const button = node('button', team.label, 'button secondary');
      button.type = 'button';
      button.setAttribute('aria-haspopup', 'dialog');
      button.addEventListener('click', () => openDivisions(team, group.label, button));
      return button;
    }));
    return [node('h3', group.label, 'eyebrow'), buttons];
  }));

  // Tournament files and conference documents: one framed row each, linking to the copy saved on this site.
  // Drawn again by js/document-archive.js once files uploaded by conference staff have loaded.
  window.drawResourceLists = () => {
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
  };
  drawResourceLists();
})();
