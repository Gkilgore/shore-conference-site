// Staff Documents tab: conference admins upload PDFs that show on the public Information page, and remove them.
// The checks at the top have no page access, so tests can run them.
const documentBucket = 'conference-documents';
const documentMaxBytes = 10 * 1024 * 1024;

// School years to offer: next year first, back six years for older files.
function documentSchoolYears(today = new Date()) {
  const start = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
  return Array.from({ length: 8 }, (_, index) => {
    const year = start + 1 - index;
    return year + '-' + String((year + 1) % 100).padStart(2, '0');
  });
}
// Where a file is stored: its school year folder, a tidied name, and a short code so two uploads never collide.
function documentFilePath(schoolYear, fileName, code) {
  const name = fileName.replace(/\.pdf$/i, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[._-]+|[._-]+$/g, '').slice(0, 80) || 'document';
  return schoolYear + '/' + name + '-' + code + '.pdf';
}
// What is wrong with an upload, one sentence each. An empty list means it can be sent.
function documentUploadProblems(fields, file, types) {
  const problems = [];
  if (!file) problems.push('Choose a PDF file.');
  else {
    if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== 'application/pdf')) problems.push('The file must be a PDF.');
    if (file.size > documentMaxBytes) problems.push('The file is larger than 10 MB.');
    if (file.size === 0) problems.push('The file is empty.');
  }
  if (!fields.title.trim()) problems.push('Add a title.');
  if (!types.includes(fields.type)) problems.push('Choose a type.');
  if (!/^\d{4}-\d{2}$/.test(fields.school_year)) problems.push('Choose a school year.');
  if (!fields.description.trim()) problems.push('Add a one-sentence description.');
  return problems;
}

function startStaffDocuments(client) {
  const get = id => document.getElementById(id);
  const form = get('document-form');
  const status = get('document-status');
  const list = get('document-list');
  const submit = get('document-submit');
  const types = Object.keys(documentTypeTabs);
  let active = true;
  let request = 0;
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const options = (select, values, labels = values) =>
    select.replaceChildren(...values.map((value, index) => Object.assign(node('option', labels[index]), { value })));
  options(form.elements.type, ['', ...types], ['Choose a type', ...types]);
  const years = documentSchoolYears();
  options(form.elements.school_year, years, years.map(schoolYearLabel));
  form.elements.school_year.value = years[1];

  function render(rows) {
    if (!rows.length) {
      list.replaceChildren(node('p', 'No files uploaded yet.', 'staff-hint'));
      return;
    }
    const parts = [];
    for (const year of [...new Set(rows.map(row => row.school_year))].sort().reverse()) {
      const group = node('ul', '', 'doc-list');
      for (const row of rows.filter(item => item.school_year === year).sort((first, second) => first.title.localeCompare(second.title))) {
        const item = node('li');
        const link = node('a', row.title);
        link.href = 'document.html?doc=' + row.id;
        link.target = '_blank';
        link.rel = 'noopener';
        // Removing takes two clicks, so a slip does not take a file off the public site.
        const remove = node('button', 'Remove', 'button secondary');
        remove.type = 'button';
        remove.onclick = () => {
          if (remove.dataset.armed) return removeDocument(row, remove);
          remove.dataset.armed = 'true';
          remove.textContent = 'Remove from the public site';
          remove.className = 'button primary';
        };
        item.append(link, node('span', [row.type, row.sport, 'Added ' + row.added].filter(Boolean).join(' · '), 'doc-meta'), node('p', row.description), remove);
        group.append(item);
      }
      parts.push(node('h5', schoolYearLabel(year), 'eyebrow'), group);
    }
    list.replaceChildren(...parts);
  }

  async function load() {
    const current = ++request;
    const { data, error } = await client.from('conference_documents')
      .select('id,title,type,sport,school_year,file_path,description,note,added').order('school_year', { ascending: false });
    if (!active || current !== request) return;
    form.hidden = Boolean(error);
    if (error) {
      list.replaceChildren();
      status.textContent = ['42P01', 'PGRST205'].includes(error.code)
        ? 'Uploads are off until the documents table is set up in Supabase. Ask the site admin to apply the documents migration, then refresh.'
        : 'The documents could not load. Check your connection, then refresh.';
      return;
    }
    render(data);
  }

  async function removeDocument(row, button) {
    button.disabled = true;
    const { error } = await client.from('conference_documents').delete().eq('id', row.id);
    if (!active) return;
    if (error) {
      button.disabled = false;
      status.textContent = 'The file could not be removed. Try again.';
      return;
    }
    // The listing is gone, so the public can no longer find the file. Clearing the stored copy is tidying up.
    await client.storage.from(documentBucket).remove([row.file_path]);
    if (!active) return;
    status.textContent = 'Removed “' + row.title + '”.';
    load();
  }

  form.onsubmit = async event => {
    event.preventDefault();
    const fields = Object.fromEntries(['title', 'type', 'sport', 'school_year', 'description', 'note'].map(name => [name, form.elements[name].value.trim()]));
    const file = form.elements.file.files[0];
    const problems = documentUploadProblems(fields, file, types);
    // A real PDF starts with %PDF, whatever the file is called.
    if (!problems.length && await file.slice(0, 4).text() !== '%PDF') problems.push('The file is not a PDF.');
    if (problems.length) {
      status.textContent = problems.join(' ');
      return;
    }
    submit.disabled = true;
    status.textContent = 'Uploading…';
    const path = documentFilePath(fields.school_year, file.name, crypto.randomUUID().slice(0, 8));
    const upload = await client.storage.from(documentBucket).upload(path, file, { contentType: 'application/pdf', upsert: false });
    let failed = Boolean(upload.error);
    if (!failed) {
      const saved = await client.from('conference_documents').insert({ ...fields, note: fields.note || null, file_path: path });
      failed = Boolean(saved.error);
      if (failed) await client.storage.from(documentBucket).remove([path]); // Do not leave a file nothing points to.
    }
    if (!active) return;
    submit.disabled = false;
    if (failed) {
      status.textContent = 'The file could not be uploaded. Check your connection and try again.';
      return;
    }
    const year = fields.school_year;
    form.reset();
    form.elements.school_year.value = year;
    status.textContent = 'Posted “' + fields.title + '”. It is on the public site now.';
    load();
  };

  return {
    load,
    stop() {
      active = false;
      form.onsubmit = null;
    },
  };
}
