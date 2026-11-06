// Runs the staff dashboard tabs: Calendar, Schedule, Transportation, Coaches, School settings, and the game editor.
function startStaffSchedule(client, invite) {
  const selector = document.getElementById('schedule-school');
  const preview = document.getElementById('view-as');
  const previewPanel = document.getElementById('role-preview');
  const previewStatus = document.getElementById('preview-status');
  const title = document.getElementById('workspace-title');
  const account = document.getElementById('workspace-account');
  const signedInAccount = account.textContent;
  const isSiteAdmin = invite.role === 'site_admin';
  const status = document.getElementById('schedule-status');
  const list = document.getElementById('schedule-games');
  const calendarTarget = document.getElementById('calendar');
  const addGame = document.getElementById('add-calendar-game');
  const scheduleTab = document.getElementById('staff-schedule-tab');
  const schedulePanel = document.getElementById('staff-schedule-panel');
  const scheduleTitle = document.getElementById('schedule-title');
  const scheduleFeedback = document.getElementById('schedule-feedback');
  const closeEditor = document.getElementById('close-game-editor');
  const transportationTab = document.getElementById('staff-transportation-tab');
  const transportationPanel = document.getElementById('staff-transportation-panel');
  const transportationTitle = document.getElementById('transportation-title');
  const settingsTab = document.getElementById('staff-settings-tab');
  const settingsPanel = document.getElementById('staff-settings-panel');
  const settingsTitle = document.getElementById('settings-title');
  const overviewTab = document.getElementById('staff-overview-tab');
  const overviewPanel = document.getElementById('staff-overview-panel');
  const overviewTitle = document.getElementById('overview-title');
  const filterForm = document.getElementById('staff-filters');
  const filterFields = filterForm.elements;
  const filterCount = document.getElementById('staff-filter-count');
  const currentSchool = () => schools.find(school => school.slug === selector.value);
  const overview = startStaffOverview(client, {
    currentSchool, gameTitle, canEdit: () => canEdit, openEditor: game => openEditor(game),
  });
  const coachesTab = document.getElementById('staff-coaches-tab');
  const coachesPanel = document.getElementById('staff-coaches-panel');
  const coachesTitle = document.getElementById('coaches-title');
  const coachList = startStaffCoaches(client, { currentSchool, schools: () => schools, existingGames: () => allGames });
  const coachImport = startCoachImport(client, {
    currentSchool, coaches: () => coachList.coaches(), onImported: () => coachList.load(),
  });
  const importer = startStaffImport(client, {
    currentSchool, schools: () => schools, existingGames: () => allGames,
    onImported: date => loadGames(date),
  });
  const settings = startStaffSettings(client, currentSchool, school => applySchoolTheme(client, school));
  const transportation = startStaffTransportation(client, invite,
    () => schools.find(school => school.slug === selector.value), gameTitle);
  const form = document.getElementById('game-form');
  const formStatus = document.getElementById('game-form-status');
  const fields = form.elements;
  const saveButton = form.querySelector('[type="submit"]');
  const venues = startStaffVenues(client, { currentSchool, schools: () => schools, fields });
  let canEdit = invite.role !== 'conference_office';
  const options = (schools) => schools.map(school => new Option(school.name, school.slug));
  const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
  let calendar;
  let schools = [];
  let allGames = [];
  let activeGame = null;
  let loadNumber = 0;
  let stopped = false;

  previewPanel.hidden = !isSiteAdmin;
  preview.replaceChildren(new Option('Site admin (my workspace)', ''));
  preview.disabled = true;
  previewStatus.textContent = '';
  selector.replaceChildren();
  list.replaceChildren();
  list.hidden = false;
  calendarTarget.hidden = true;
  addGame.hidden = true;
  transportationTab.hidden = true;
  settingsTab.hidden = true;
  coachesTab.hidden = true;
  selector.disabled = true;
  form.hidden = true;
  showSchedule();
  status.textContent = 'Loading schools…';
  loadSchools();

  async function loadSchools() {
    // Branding columns arrive with the school branding migration; fall back until it is applied.
    let { data, error } = await client.from('schools')
      .select('slug,name,primary_color,accent_color,logo_path').order('name');
    if (error) ({ data, error } = await client.from('schools').select('slug,name').order('name'));
    if (stopped) return;
    if (error) {
      status.textContent = 'The school list could not load. Refresh to try again.';
      return;
    }
    schools = data;
    venues.load();
    if (isSiteAdmin) {
      preview.add(new Option('Conference office', 'office'));
      for (const school of schools) preview.add(new Option(school.name + ' AD', 'ad:' + school.slug));
      preview.disabled = false;
    }
    selectView();
  }

  function selectView() {
    const choice = isSiteAdmin ? preview.value : '';
    const schoolId = choice.startsWith('ad:') ? choice.slice(3) : invite.school_id;
    const role = choice === 'office' ? 'conference_office' : choice.startsWith('ad:') ? 'ad' : invite.role;
    const school = schools.find(item => item.slug === schoolId);
    canEdit = role !== 'conference_office';
    title.textContent = workspaceTitles[role];
    account.textContent = choice ? school?.name ?? '' : signedInAccount;
    previewStatus.textContent = choice === 'office'
      ? 'Previewing the read-only conference office view. You are still signed in as a site admin.'
      : choice && school
        ? 'Previewing the ' + school.name + ' AD view. Saves change the schedule under your site admin account.'
        : '';
    const allowed = role === 'ad' ? schools.filter(item => item.slug === schoolId) : schools;
    selector.replaceChildren(...options(allowed));
    selector.disabled = allowed.length < 2;
    if (allowed.length) selectSchool();
    else status.textContent = 'No school is assigned to this account.';
  }

  function syncOpponent() {
    const other = !fields.opponent_school_id.value;
    document.getElementById('opponent-other').hidden = !other;
    fields.opponent_name.required = other;
    fields.opponent_name.disabled = !other;
  }

  function edit(game) {
    activeGame = game;
    form.reset();
    formStatus.textContent = '';
    document.getElementById('game-form-title').textContent = game ? 'Edit game' : 'Add a game';
    if (game) {
      const bus = game.transportation;
      const values = { ...game, ...game.teams, ...bus, notes: game.notes, transport_notes: bus?.notes };
      for (const field of fields) {
        if (!field.name || !Object.hasOwn(values, field.name)) continue;
        if (field.type === 'checkbox') field.checked = Boolean(values[field.name]);
        else field.value = values[field.name] ?? '';
      }
    }
    syncOpponent();
    venues.sync(game?.location ?? '');
    transportation.setPreview(game, true);
  }

  function selectSchool() {
    const showContact = canEdit && !transportationPanel.hidden;
    const showSettings = canEdit && !settingsPanel.hidden;
    const showOverview = !overviewPanel.hidden;
    const showCoaches = canEdit && !coachesPanel.hidden;
    transportation.reset();
    coachList.reset();
    coachImport.reset();
    overview.reset();
    importer.reset();
    allGames = [];
    filterForm.reset();
    applySchoolTheme(client, currentSchool());
    list.replaceChildren();
    calendar?.removeAllEvents();
    fields.opponent_school_id.replaceChildren(
      new Option('Other opponent', ''),
      ...options(schools.filter(school => school.slug !== selector.value)),
    );
    edit(null);
    showSchedule();
    scheduleFeedback.textContent = '';
    addGame.hidden = !canEdit;
    transportationTab.hidden = !canEdit;
    settingsTab.hidden = !canEdit;
    coachesTab.hidden = !canEdit;
    if (showContact) openTransportation(false);
    if (showCoaches) openCoaches(false);
    if (showSettings) openSettings(false);
    if (showOverview) openOverview(false);
    document.getElementById('import-section').hidden = !canEdit;
    loadGames(null, true);
  }

  async function loadGames(focusDate, newSchool = false, savedId) {
    const request = ++loadNumber;
    const school = selector.value;
    status.textContent = 'Loading schedule…';
    const { data, error } = await client.from('games')
      .select('*,teams(sport,gender,level,season)' + (canEdit ? ',transportation(*)' : ''))
      .eq('school_id', school).order('game_date').order('start_time').order('id');
    if (stopped || request !== loadNumber) return;
    if (error) {
      list.replaceChildren();
      calendar?.removeAllEvents();
      status.textContent = 'The schedule could not load. Refresh to try again.';
      return;
    }
    allGames = data;
    fillSeasonFilters(filterFields.season, filterFields.sport, filterOptions());
    status.textContent = data.length
      ? data.length + (data.length === 1 ? ' saved game.' : ' saved games.') + (canEdit ? ' Select a game to edit it.' : '')
      : 'No games saved for this school.' + (canEdit ? ' Use Add game to enter the first one.' : '');
    if (newSchool && data.length) {
      const today = new Date();
      const dateKey = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') +
        '-' + String(today.getDate()).padStart(2, '0');
      focusDate = (data.find(game => game.game_date >= dateKey) ?? data.at(-1)).game_date;
    }
    if (savedId) transportation.setPreview(data.find(game => game.id === savedId));
    const visible = visibleGames();
    showCount(visible);
    overview.load(visible);
    showCalendar(visible, focusDate ?? (newSchool ? new Date() : null));
    if (!calendar) showList(visible);
  }

  // Season, Sport, Level and Gender filters shared by the Calendar and Schedule tabs.
  function filterOptions() {
    return allGames.map(game => ({ season: game.teams.season, sport: game.teams.sport }));
  }

  function visibleGames() {
    const { season, sport, level, gender } = filterFields;
    return allGames.filter(game =>
      (!season.value || game.teams.season === season.value) &&
      (!sport.value || game.teams.sport === sport.value) &&
      (!level.value || game.teams.level === level.value) &&
      (!gender.value || game.teams.gender === gender.value));
  }

  function showCount(visible) {
    filterCount.textContent = visible.length === allGames.length
      ? '' : 'Showing ' + visible.length + ' of ' + allGames.length + ' games';
  }

  function applyFilters() {
    const visible = visibleGames();
    showCount(visible);
    overview.render(visible);
    if (calendar) showCalendar(visible);
    else showList(visible);
  }

  function showList(games) {
    const rows = games.map(game => {
      const row = document.createElement('li');
      const date = document.createElement('time');
      const title = document.createElement('strong');
      const details = document.createElement('span');
      const start = new Date(game.game_date + 'T' + game.start_time);
      date.dateTime = game.game_date;
      date.textContent = dateFormat.format(start);
      title.textContent = gameTitle(game);
      const departure = game.transportation?.bus_departure;
      const bus = departure ? 'Bus ' + timeFormat.format(new Date(game.game_date + 'T' + departure)) : '';
      details.textContent = [timeFormat.format(start), game.location, game.status, bus].filter(Boolean).join(' · ');
      row.append(date, title, details);
      if (canEdit) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'button secondary';
        button.textContent = 'Edit';
        button.setAttribute('aria-label', 'Edit ' + title.textContent);
        button.onclick = () => openEditor(game);
        details.append(document.createElement('br'), button);
      }
      return row;
    });
    const gameList = document.createElement('ul');
    gameList.className = 'game-list';
    gameList.append(...rows);
    list.replaceChildren(gameList);
  }

  function showCalendar(entries, focusDate) {
    if (!calendar && !window.FullCalendar) return;
    const events = entries.map(game => ({
      id: game.id,
      start: game.game_date + 'T' + game.start_time,
      title: gameTitle(game) + (game.status === 'Scheduled' ? '' : ' · ' + game.status),
      classNames: ['staff-game', 'staff-game-' + game.status.toLowerCase()],
      extendedProps: { game, location: game.location, status: game.status },
    }));
    if (!calendar) {
      const showDetails = createGameDetails(calendarTarget);
      calendar = new FullCalendar.Calendar(calendarTarget, {
        initialView: matchMedia('(max-width: 640px)').matches ? 'listMonth' : 'dayGridMonth',
        headerToolbar: {
          start: 'title', center: 'dayGridMonth,listMonth,listDay', end: 'prev,next',
        },
        views: {
          dayGridMonth: { buttonText: 'Month', dayMaxEvents: 2 },
          listMonth: { buttonText: 'List' },
          listDay: { buttonText: 'Day' },
        },
        height: 'auto',
        moreLinkClick: 'listDay',
        navLinks: true,
        navLinkDayClick: 'listDay',
        eventInteractive: true,
        noEventsText: 'No saved games in this view.',
        eventDidMount({ el }) {
          el.tabIndex = 0;
          el.setAttribute('role', 'button');
          el.addEventListener('keydown', key => {
            if (key.key !== 'Enter' && key.key !== ' ') return;
            key.preventDefault();
            key.stopPropagation();
            el.click();
          });
        },
        eventClick({ event }) {
          if (canEdit) openEditor(event.extendedProps.game);
          else showDetails(event);
        },
        dateClick({ dateStr }) {
          if (canEdit) openEditor(null, dateStr);
        },
      });
      calendarTarget.hidden = false;
      list.hidden = true;
      calendar.render();
    }
    calendar.batchRendering(() => {
      calendar.getEventSources().forEach(source => source.remove());
      calendar.addEventSource(events);
      if (focusDate) calendar.gotoDate(focusDate);
    });
  }

  function gameTitle(game) {
    const opponent = schools.find(item => item.slug === game.opponent_school_id)?.name ?? game.opponent_name;
    return [game.teams.gender, game.teams.level, game.teams.sport,
      game.home_away === 'Home' ? 'vs.' : 'at', opponent].join(' ');
  }

  // Hides every panel and clears the selected tab; each opener then shows its own panel.
  function hidePanels() {
    for (const [panel, tab] of [[schedulePanel, scheduleTab], [overviewPanel, overviewTab],
      [transportationPanel, transportationTab], [coachesPanel, coachesTab], [settingsPanel, settingsTab]]) {
      panel.hidden = true;
      tab.removeAttribute('aria-current');
    }
    form.hidden = true;
    filterForm.hidden = true;
  }

  // The Calendar tab. Its elements keep their original "schedule" ids.
  function showSchedule(focus = false) {
    hidePanels();
    schedulePanel.hidden = false;
    scheduleTab.setAttribute('aria-current', 'true');
    filterForm.hidden = false;
    calendar?.updateSize();
    if (focus) scheduleTitle.focus();
  }

  function openOverview(focus = true) {
    hidePanels();
    overviewPanel.hidden = false;
    overviewTab.setAttribute('aria-current', 'true');
    filterForm.hidden = false;
    overview.render(visibleGames());
    if (focus) overviewTitle.focus();
  }

  function openTransportation(focus = true) {
    if (!canEdit || !selector.value) return;
    hidePanels();
    transportationPanel.hidden = false;
    transportationTab.setAttribute('aria-current', 'true');
    document.getElementById('transportation-school').textContent = selector.selectedOptions[0].text;
    transportation.load();
    if (focus) transportationTitle.focus();
  }

  function openEditor(game, date) {
    if (!canEdit || saveButton.disabled) return;
    edit(game);
    if (date) fields.game_date.value = date;
    hidePanels();
    form.hidden = false;
    fields.sport.focus();
  }

  function openCoaches(focus = true) {
    if (!canEdit || !selector.value) return;
    hidePanels();
    coachesPanel.hidden = false;
    coachesTab.setAttribute('aria-current', 'true');
    coachList.load();
    if (focus) coachesTitle.focus();
  }

  function openSettings(focus = true) {
    if (!canEdit || !selector.value) return;
    hidePanels();
    settingsPanel.hidden = false;
    settingsTab.setAttribute('aria-current', 'true');
    settings.load();
    venues.showSettings();
    if (focus) settingsTitle.focus();
  }

  transportationTab.onclick = () => openTransportation();
  overviewTab.onclick = () => openOverview();
  coachesTab.onclick = () => openCoaches();
  filterForm.onsubmit = event => event.preventDefault();
  filterForm.oninput = event => {
    if (event.target === filterFields.season) fillSportOptions(filterFields.season, filterFields.sport, filterOptions());
    applyFilters();
  };
  filterForm.onreset = () => setTimeout(() => {
    fillSportOptions(filterFields.season, filterFields.sport, filterOptions());
    applyFilters();
  }, 0);
  settingsTab.onclick = () => openSettings();
  addGame.onclick = () => openEditor(null);
  preview.onchange = selectView;
  selector.onchange = selectSchool;
  fields.opponent_school_id.onchange = syncOpponent;
  closeEditor.onclick = () => showSchedule(true);
  scheduleTab.onclick = () => showSchedule(true);
  form.onsubmit = async event => {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(form));
    for (const name of Object.keys(input)) input[name] = input[name].trim() || null;
    input.school_id = selector.value;
    input.id = activeGame?.id ?? null;
    input.revision = activeGame?.revision ?? null;
    saveButton.disabled = true;
    const fieldsets = form.querySelectorAll('fieldset');
    fieldsets.forEach(fieldset => fieldset.disabled = true);
    closeEditor.disabled = true;
    scheduleTab.disabled = true;
    overviewTab.disabled = true;
    coachesTab.disabled = true;
    addGame.disabled = true;
    transportationTab.disabled = true;
    settingsTab.disabled = true;
    preview.disabled = true;
    selector.disabled = true;
    list.querySelectorAll('button').forEach(button => button.disabled = true);
    formStatus.textContent = 'Saving game…';
    const { data: savedId, error } = await client.rpc('save_staff_game', { input });
    if (stopped) return;
    saveButton.disabled = false;
    fieldsets.forEach(fieldset => fieldset.disabled = false);
    closeEditor.disabled = false;
    scheduleTab.disabled = false;
    overviewTab.disabled = false;
    coachesTab.disabled = false;
    addGame.disabled = false;
    transportationTab.disabled = false;
    settingsTab.disabled = false;
    preview.disabled = !isSiteAdmin;
    selector.disabled = selector.options.length < 2;
    if (error) {
      list.querySelectorAll('button').forEach(button => button.disabled = false);
      formStatus.textContent = error.code === '40001'
        ? 'This game changed. Choose Edit again and review the latest version.'
        : 'The game could not be saved. Check the required fields and try again.';
      if (error.code === '40001') await loadGames();
      return;
    }
    edit(null);
    showSchedule(true);
    scheduleFeedback.textContent = 'Game saved.';
    list.replaceChildren();
    await loadGames(input.game_date, false, savedId);
  };

  return () => {
    stopped = true;
    transportation.stop();
    settings.stop();
    overview.stop();
    importer.stop();
    coachList.stop();
    venues.stop();
    coachImport.stop();
    coachesTab.onclick = null;
    coachesTab.disabled = false;
    overviewTab.onclick = null;
    overviewTab.disabled = false;
    filterForm.oninput = filterForm.onreset = filterForm.onsubmit = null;
    transportationTab.onclick = null;
    settingsTab.onclick = null;
    settingsTab.disabled = false;
    calendar?.destroy();
    calendarTarget.parentElement.querySelector('.game-details')?.remove();
    preview.onchange = null;
    saveButton.disabled = false;
    form.querySelectorAll('fieldset').forEach(fieldset => fieldset.disabled = false);
    closeEditor.disabled = false;
    scheduleTab.disabled = false;
    addGame.disabled = false;
    transportationTab.disabled = false;
    list.replaceChildren();
  };
}
