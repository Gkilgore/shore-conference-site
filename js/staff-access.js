// Reviews invited staff access changes through the database's permission and revision checks.
function startStaffAccess(client, invite, schoolsFn) {
  const get = name => document.getElementById('staff-access-' + name);
  const panel = get('panel'), form = get('form'), list = get('list'), status = get('status');
  const email = get('email'), name = get('name'), role = get('role'), school = get('school');
  const schoolField = get('school-field'), submit = get('submit'), cancelEdit = get('cancel-edit');
  const dialog = get('review'), confirm = get('review-confirm'), cancelReview = get('review-cancel');
  const search = get('search'), count = get('count');
  const columns = ['name', 'email', 'school', 'role'];
  let sortKey = 'name', descending = false;
  let accounts = [], actorRole = null, editing = null, pending = null;
  let requestNumber = 0, busy = false, saving = false, active = true;
  const allowed = value => value === 'site_admin' || value === 'conference_office';
  const normalized = value => String(value || '').trim().toLowerCase();
  const canManage = account => account.role !== 'site_admin' &&
    (actorRole === 'site_admin' || (actorRole === 'conference_office' && account.role === 'ad'));
  const labelRole = value => value === 'ad' ? 'School AD' : value === 'conference_office' ? 'Conference admin' : 'Site admin';
  const schoolName = id => schoolsFn().find(item => item.slug === id)?.name || id || '';
  const assignment = account => labelRole(account.role) + (account.school_id ? ' — ' + schoolName(account.school_id) : '');

  function closeReview() {
    pending = null;
    confirm.disabled = true;
    if (dialog.open) dialog.close();
  }

  function syncFields() {
    const ad = role.value === 'ad';
    schoolField.hidden = !ad;
    school.required = ad;
    school.disabled = busy || !actorRole || !ad;
    email.disabled = busy || !actorRole || Boolean(editing);
    name.disabled = role.disabled = submit.disabled = busy || !actorRole;
    cancelEdit.disabled = busy;
    cancelEdit.hidden = !editing;
    submit.textContent = editing ? 'Review access change' : 'Review access';
    list.querySelectorAll('button').forEach(button => button.disabled = busy);
  }

  function clearDraft() {
    editing = null;
    email.value = name.value = '';
    role.value = 'ad';
    school.value = '';
    closeReview();
    syncFields();
  }

  function reset() {
    requestNumber++;
    accounts = [];
    actorRole = null;
    busy = saving = false;
    cancelReview.disabled = false;
    list.replaceChildren();
    role.replaceChildren();
    school.replaceChildren();
    panel.hidden = true;
    status.textContent = '';
    search.value = ''; sortKey = 'name'; descending = false; count.textContent = '';
    syncSort();
    clearDraft();
  }

  function option(value, text) {
    const item = document.createElement('option');
    item.value = value; item.textContent = text;
    return item;
  }

  function render() {
    role.replaceChildren(option('ad', 'School AD'),
      ...(actorRole === 'site_admin' ? [option('conference_office', 'Conference admin')] : []));
    school.replaceChildren(option('', 'Choose a school'),
      ...schoolsFn().map(item => option(item.slug, item.name)));
    renderList();
    clearDraft();
  }

  function syncSort() {
    for (const key of columns) {
      const selected = key === sortKey;
      get('heading-' + key).setAttribute('aria-sort', selected ? (descending ? 'descending' : 'ascending') : 'none');
      get('arrow-' + key).textContent = selected ? (descending ? '?' : '?') : '?';
      get('sort-' + key).setAttribute('aria-label', 'Sort by ' + key + (selected && !descending ? ', Z to A' : ', A to Z'));
    }
  }

  function renderList() {
    const query = normalized(search.value);
    const visible = accounts.filter(account => !query || normalized([
      account.name, account.email, schoolName(account.school_id) || 'No school assigned', labelRole(account.role),
    ].join(' ')).includes(query));
    const value = account => sortKey === 'school' ? schoolName(account.school_id) || 'No school assigned'
      : sortKey === 'role' ? labelRole(account.role) : sortKey === 'email' ? account.email : account.name || account.email;
    visible.sort((a, b) => (descending ? -1 : 1) *
      (value(a).localeCompare(value(b), undefined, {sensitivity: 'base'}) || a.email.localeCompare(b.email)));
    syncSort();
    count.textContent = visible.length + ' of ' + accounts.length + ' people';
    list.replaceChildren(...visible.map(account => {
      const row = document.createElement('tr');
      const heading = document.createElement('td');
      heading.textContent = account.name || account.email;
      const mail = document.createElement('td');
      mail.textContent = account.email;
      const assignedSchool = document.createElement('td');
      assignedSchool.textContent = schoolName(account.school_id) || 'No school assigned';
      const accessRole = document.createElement('td');
      accessRole.textContent = labelRole(account.role);
      const actionCell = document.createElement('td');
      row.append(heading, mail, assignedSchool, accessRole, actionCell);
      if (canManage(account)) {
        const actions = document.createElement('div');
        actions.className = 'staff-actions';
        const edit = document.createElement('button');
        edit.type = 'button'; edit.className = 'button secondary'; edit.textContent = 'Edit';
        edit.setAttribute('aria-label', 'Edit access for ' + account.email);
        edit.onclick = () => {
          if (busy || !active || !canManage(account)) return;
          closeReview();
          editing = { ...account };
          email.value = account.email; name.value = account.name || '';
          role.value = account.role; school.value = account.school_id || '';
          status.textContent = 'Editing ' + account.email + '. Review the change before saving.';
          syncFields(); name.focus();
        };
        const remove = document.createElement('button');
        remove.type = 'button'; remove.className = 'button secondary'; remove.textContent = 'Remove';
        remove.setAttribute('aria-label', 'Remove access for ' + account.email);
        remove.onclick = () => {
          if (busy || !active || !canManage(account)) return;
          showReview({ ...account }, { ...account }, true);
        };
        edit.disabled = remove.disabled = busy;
        actions.append(edit, remove); actionCell.append(actions);
      }
      return row;
    }));
    if (!visible.length) {
      const row = document.createElement('tr'), cell = document.createElement('td');
      cell.colSpan = 5;
      cell.textContent = 'No people match your search.';
      row.append(cell); list.append(row);
    }
  }

  async function rpc(method, args) {
    try { return await client.rpc(method, args); }
    catch (_) { return {error: {code: 'network'}}; }
  }

  async function load() {
    if (!active || saving) return false;
    if (!allowed(invite.role)) { reset(); return false; }
    const request = ++requestNumber;
    actorRole = null;
    clearDraft();
    accounts = []; list.replaceChildren(); panel.hidden = true;
    busy = true; syncFields();
    status.textContent = 'Loading staff access…';
    const {data, error} = await rpc('list_staff_access');
    if (!active || request !== requestNumber) return false;
    busy = false;
    if (error || !allowed(data?.actor_role) || !Array.isArray(data?.accounts)) {
      reset();
      status.textContent = error?.code === '42501'
        ? 'Your account cannot manage staff access. Sign in again to refresh your access.'
        : 'Staff access could not load. Reopen Staff access to try again.';
      return false;
    }
    actorRole = data.actor_role;
    accounts = data.accounts;
    render();
    panel.hidden = false;
    status.textContent = '';
    return true;
  }

  function validate() {
    const draft = {email: normalized(email.value), name: name.value.trim(), role: role.value,
      school_id: role.value === 'ad' ? school.value : null};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email) || draft.email.length > 254) return 'Enter a valid email address.';
    if (!draft.name || draft.name.length > 100) return 'Enter a name of up to 100 characters.';
    if (draft.role !== 'ad' && !(actorRole === 'site_admin' && draft.role === 'conference_office')) {
      return actorRole === 'conference_office' ? 'Conference admins can manage School AD access only.' : 'Choose School AD or Conference admin access.';
    }
    if (draft.role === 'ad' && !schoolsFn().some(item => item.slug === draft.school_id)) return 'Choose a school from the list.';
    if (editing && (draft.email !== normalized(editing.email) || !canManage(editing))) return 'Choose this person from the current access list again.';
    if (!editing && accounts.some(account => normalized(account.email) === draft.email)) return 'This email already has access. Use Edit on that person.';
    return draft;
  }

  function showReview(draft, previous, remove) {
    pending = {draft, previous, remove};
    get('review-title').textContent = remove ? 'Review access removal' : previous ? 'Review access change' : 'Review access';
    get('review-summary').textContent = remove
      ? 'Remove access for ' + draft.email + '? Current access: ' + assignment(previous) + '. They will lose staff access when this change is saved.'
      : (previous ? 'Current access: ' + previous.email + ' — ' + assignment(previous) + '.\n' : '') +
        'Requested access: ' + draft.email + ' — ' + draft.name + ' — ' + assignment(draft) + '.\n' +
        'They sign in with this email. No email is sent.';
    confirm.textContent = remove ? 'Remove access' : previous ? 'Save change' : 'Add access';
    confirm.disabled = false;
    dialog.showModal();
  }

  form.onsubmit = event => {
    event.preventDefault();
    if (!active || busy || !actorRole) return;
    const draft = validate();
    if (typeof draft === 'string') { status.textContent = draft; return; }
    showReview(draft, editing ? {...editing} : null, false);
  };
  role.onchange = syncFields;
  search.oninput = renderList;
  for (const key of columns) get('sort-' + key).onclick = () => {
    descending = sortKey === key ? !descending : false;
    sortKey = key;
    renderList();
  };
  cancelEdit.onclick = () => { if (!busy) { clearDraft(); status.textContent = 'Access edit canceled.'; } };
  cancelReview.onclick = () => { if (!saving) closeReview(); };
  dialog.oncancel = event => { if (saving) event.preventDefault(); else closeReview(); };
  dialog.onclose = () => { pending = null; confirm.disabled = true; };
  confirm.onclick = async () => {
    if (!pending || busy || !active || !actorRole) return;
    const action = pending, request = ++requestNumber;
    // Consume the review once; failures require a new review instead of resending old revisions.
    pending = null;
    busy = saving = true; syncFields(); confirm.disabled = true; cancelReview.disabled = true;
    const {error} = await rpc('manage_staff_access', {
      p_email: action.draft.email, p_name: action.draft.name, p_role: action.draft.role,
      p_school: action.draft.school_id, p_expected_revision: action.previous?.access_revision ?? null,
      p_remove: action.remove,
    });
    if (!active || request !== requestNumber) return;
    busy = saving = false; cancelReview.disabled = false; closeReview();
    // Refresh after every result, including denied writes, to discover revoked or changed access.
    if (!await load()) return;
    status.textContent = error?.code === '40001'
      ? 'Staff access changed while you were reviewing. Choose the person and review again.'
      : error?.code === '42501'
        ? 'You can’t make this change. Choose a different one and review again.'
        : error ? 'The change may not have saved. Check the list before trying again.'
          : action.remove ? 'Access removed.' : action.previous ? 'Access updated.' : 'Access added. They sign in with that email.';
  };

  reset();
  return {load, reset, stop() {
    reset(); active = false;
    form.onsubmit = role.onchange = cancelEdit.onclick = cancelReview.onclick = confirm.onclick = null;
    dialog.oncancel = dialog.onclose = null;
    search.oninput = null;
    for (const key of columns) get('sort-' + key).onclick = null;
  }};
}
