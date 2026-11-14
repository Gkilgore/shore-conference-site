// Shows one saved PDF on document.html: its title, the file itself on wide screens, and download and open buttons.
(() => {
  const content = document.getElementById('document-content');
  if (!content) return;
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  // Only a plain file name, or a school-year folder and a file name, inside assets/documents/.
  const file = new URLSearchParams(location.search).get('file') || '';
  if (!/^(\d{4}-\d{2}\/)?[\w.-]+\.pdf$/.test(file) || file.includes('..')) {
    content.replaceChildren(node('p', 'This document was not found. Go back to Documents to pick one.'));
    return;
  }
  const url = 'assets/documents/' + file;
  const record = allDocuments(shoreDocumentArchive, shorePublicResources, shoreConferenceResources.divisionLists)
    .find(item => item.url === url);
  const title = record?.title || file.split('/').pop().replace(/\.pdf$/, '').replace(/_+/g, ' ').trim();
  document.getElementById('document-title').textContent = title;
  document.title = title + ' | The Shore Conference';
  document.getElementById('document-meta').textContent = [record?.type, record?.sport,
    record?.schoolYear && schoolYearLabel(record.schoolYear), 'PDF'].filter(Boolean).join(' · ');

  const button = (text, className) => {
    const link = node('a', text, 'button ' + className);
    link.href = url;
    link.dataset.direct = '';
    return link;
  };
  const download = button('Download', 'primary');
  download.download = file.split('/').pop();
  const open = button('Open in new tab', 'secondary');
  open.target = '_blank';
  open.rel = 'noopener';
  const actions = node('div', '', 'actions');
  actions.append(download, open);
  const parts = [actions];

  // Phones show only the first page of a PDF placed inside a page, so they get the buttons and the text below.
  if (matchMedia('(min-width: 700px) and (pointer: fine)').matches) {
    const frame = node('iframe', '', 'doc-frame');
    frame.src = url;
    frame.title = title;
    parts.push(frame);
  } else {
    parts.push(node('p', 'Use Open in new tab to read this file on your phone.'));
  }

  // A division list also gets its schools as text, which is easier to read than the PDF on a small screen.
  // A file holding two lists (boys' and girls' swimming) gets one block per list, under that list's title.
  const sets = documentDivisionSets(record, shoreSchools);
  for (const set of sets) {
    const groups = node('div', '', 'division-groups');
    for (const division of set.divisions) {
      const group = node('section');
      const list = node('ul');
      list.append(...division.members.map(name => node('li', name)));
      group.append(node('h3', division.name), list);
      groups.append(group);
    }
    const card = node('section', '', 'panel');
    card.append(node('h2', sets.length > 1 ? set.title : 'Divisions in this list'), groups);
    parts.push(card);
  }
  content.replaceChildren(...parts);
})();
