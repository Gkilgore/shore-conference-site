// Runs staff schedule, transportation, settings, access tabs and the game editor.
function startStaffSchedule(client, invite) {
  const selector = document.getElementById('schedule-school');
  const preview = document.getElementById('view-as');
  const previewPanel = document.getElementById('role-preview');
  const previewStatus = document.getElementById('preview-status');
  const title = document.getElementById('workspace-title');
  const roleLabel = document.getElementById('workspace-role');
  const roleLabels = { ad: 'Athletic director', conference_office: 'Conference admin', site_admin: 'Site admin' };
  const publicLink = document.getElementById('public-page-link');
  const importButton = document.getElementById('import-games');
  const unpublishedBar = document.getElementById('unpublished-bar');
  const discardDialog = document.getElementById('discard-dialog');
  let unpublished = new Map();
  let dirty = false;
  let leave = null;
  const account = document.getElementById('workspace-account');
  const signedInAccount = account.textContent;
  const isSiteAdmin = invite.role === 'site_admin';
  const mayManageAccess = isSiteAdmin || invite.role === 'conference_office';
  const accessTab = document.getElementById('staff-access-tab');
  const accessPanel = document.getElementById('staff-access-workspace');
  const access = startStaffAccess(client, invite, () => schools);
  const tournamentsTab = document.getElementById('staff-tournaments-tab');
  // Tournament tools are off for now, except a conference or site admin uploading a finished schedule.
  tournamentsTab.hidden = !mayManageAccess;
  const tournamentsPanel = document.getElementById('staff-tournaments-panel');
  const tournaments = startStaffTournaments(client, { schools: () => schools });
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
  const filtersToggle = document.getElementById('staff-filters-toggle');
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
  const publication = startStaffPublication(client, currentSchool, {
    canEdit: () => canEdit, schools: () => schools,
    onPublished: () => {
      showUnpublished();
      if (calendar) showCalendar(visibleGames());
      // Publishing from the editor leaves the AD on Games, so confirm it here too.
      scheduleFeedback.textContent = 'Published. The school page shows it now.';
    },
    filterValues: () => Object.fromEntries(new FormData(filterForm)),
  });
  const transportation = startStaffTransportation(client, invite,
    () => schools.find(school => school.slug === selector.value), gameTitle);
  const form = document.getElementById('game-form');
  const formStatus = document.getElementById('game-form-status');
  const fields = form.elements;
  const saveButton = form.querySelector('#save-draft');
  const venues = startStaffVenues(client, { currentSchool, schools: () => schools, fields });
  let canEdit = invite.role !== 'conference_office';
  const options = (schools) => schools.map(school => new Option(school.name, school.slug));
  const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const weekdayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
  let calendar;
  let stopFollowingView = () => {};
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
    accessTab.hidden = !mayManageAccess || Boolean(choice);
    access.reset();
    const school = schools.find(item => item.slug === schoolId);
    canEdit = role !== 'conference_office';
    roleLabel.textContent = roleLabels[role];
    // Conference admins cannot publish a school's schedule; for them this tab only shows the match checks.
    document.getElementById('publish-label').textContent = canEdit ? 'Publish' : 'Match checks';
    overviewTitle.textContent = canEdit ? 'Publish' : 'Match checks';
    title.textContent = roleLabels[role];
    account.textContent = choice ? '' : signedInAccount;
    previewStatus.textContent = choice === 'office'
      ? 'Previewing conference school calendars (read-only). Staff access tools use the actual signed-in account.'
      : choice && school
        ? 'Previewing the ' + school.name + ' AD view. Saves change the schedule under your site admin account.'
        : '';
    const allowed = role === 'ad' ? schools.filter(item => item.slug === schoolId) : schools;
    selector.replaceChildren(...options(allowed));
    selector.disabled = allowed.length < 2;
    // An AD has one school, already named in the heading, so the picker would be a dead control.
    selector.parentElement.classList.toggle('is-single', allowed.length < 2);
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
    // Say whose game this is and whether families can see it, so nobody edits the wrong record.
    const state = game ? unpublished.get(game.id) : null;
    document.getElementById('game-form-context').textContent = [currentSchool()?.name,
      game ? gameTitle(game) : 'New game',
      game ? weekdayFormat.format(new Date(game.game_date + 'T' + game.start_time)) : '',
      !game ? '' : state === 'Draft' ? 'Not public yet' : state === 'Changed' ? 'Has changes that are not public yet' : 'Published',
    ].filter(Boolean).join(' · ');
    // For a game families already see, publishing is the usual next step; for new work, saving a draft is.
    const publishFirst = Boolean(game) && state !== 'Draft';
    saveButton.className = 'button ' + (publishFirst ? 'secondary' : 'primary');
    document.getElementById('save-and-review-publication').className = 'button ' + (publishFirst ? 'primary' : 'secondary');
    dirty = false;
    document.getElementById('delete-game').hidden = !game;
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
    syncStatusHint();
    venues.sync(game?.location ?? '');
    transportation.setPreview(game, true);
  }

  function syncStatusHint() {
    document.getElementById('status-hint').textContent = fields.status.value === 'Postponed'
      ? 'Postponed: leave the original date for now. When the new date is set, change Date and switch Status back to Scheduled.'
      : fields.status.value === 'Canceled' ? 'Canceled: families see this game marked Canceled once you publish. To remove a game entered by mistake, use Delete game.' : '';
  }

  function setHeading() {
    title.textContent = currentSchool()?.name ?? roleLabel.textContent;
    publicLink.hidden = !selector.value;
    if (selector.value) publicLink.href = 'school.html?school=' + encodeURIComponent(selector.value);
  }

  // Counts what families cannot see yet and shows it above the games and on the Publish tab.
  function showUnpublished() {
    const { map, removed } = canEdit ? publication.states() : { map: new Map(), removed: 0 };
    unpublished = map;
    const count = map.size + removed;
    unpublishedBar.hidden = !count;
    document.getElementById('unpublished-text').textContent = count === 1
      ? '1 game isn’t public yet. It’s outlined below.' : count + ' games aren’t public yet. They’re outlined below.';
    document.getElementById('publish-count').textContent = count ? ' · ' + count : '';
  }

  function askToLeave(action) {
    if (form.hidden || !dirty) return action();
    leave = action;
    discardDialog.showModal();
  }

  function selectSchool() {
    const showContact = canEdit && !transportationPanel.hidden;
    const showSettings = canEdit && !settingsPanel.hidden;
    const showOverview = !overviewPanel.hidden;
    const showTournaments = !tournamentsPanel.hidden;
    const showCoaches = canEdit && !coachesPanel.hidden;
    transportation.reset();
    publication.reset();
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
    setHeading();
    scheduleFeedback.textContent = '';
    addGame.hidden = !canEdit;
    importButton.hidden = !canEdit;
    transportationTab.hidden = !canEdit;
    settingsTab.hidden = !canEdit;
    coachesTab.hidden = !canEdit;
    if (showContact) openTransportation(false);
    if (showCoaches) openCoaches(false);
    if (showSettings) openSettings(false);
    if (showOverview) openOverview(false);
    if (showTournaments) openTournaments(false);
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
    if (canEdit) await publication.load();
    if (stopped || request !== loadNumber) return;
    showUnpublished();
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
    const active = ['season', 'sport', 'level', 'gender'].filter(name => filterFields[name].value).length;
    filtersToggle.textContent = 'Filters' + (active ? ' · ' + active : '');
    filterCount.textContent = visible.length === allGames.length
      ? '' : 'Showing ' + visible.length + ' of ' + allGames.length + ' games';
  }

  // The division for the team picked in the filters, for the school year in progress.
  function showTeamInfo() {
    const today = new Date();
    renderTeamInfo(document.getElementById('staff-team-info'), {
      school: selector.value, sport: filterFields.sport.value, gender: filterFields.gender.value, level: filterFields.level.value,
      date: today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0'),
    }, { quietWhenAll: true });
  }

  function applyFilters() {
    const visible = visibleGames();
    showTeamInfo();
    showCount(visible);
    overview.render(visible);
    publication.render();
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
      classNames: ['staff-game', 'staff-game-' + game.status.toLowerCase(), ...(unpublished.has(game.id) ? ['staff-unpublished'] : [])],
      extendedProps: { game, location: game.location, status: game.status, unpublished: unpublished.get(game.id) },
    }));
    if (!calendar) {
      const showDetails = createGameDetails(calendarTarget);
      calendar = new FullCalendar.Calendar(calendarTarget, {
        initialView: preferredCalendarView(),
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
        eventDidMount({ el, event }) {
          el.tabIndex = 0;
          el.setAttribute('role', 'button');
          el.addEventListener('keydown', key => {
            if (key.key !== 'Enter' && key.key !== ' ') return;
            key.preventDefault();
            key.stopPropagation();
            el.click();
          });
          // Outlined games are not public yet. The list view and screen readers also get the word.
          const state = event.extendedProps.unpublished;
          if (!state) return;
          el.title = state === 'Draft' ? 'Not public yet' : 'Has changes that are not public yet';
          const tag = document.createElement('span');
          tag.className = 'staff-tag';
          tag.textContent = state;
          (el.querySelector('.fc-event-title, .fc-list-event-title') ?? el).prepend(tag, ' ');
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
      stopFollowingView = followPreferredView(calendar);
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
      [transportationPanel, transportationTab], [coachesPanel, coachesTab], [settingsPanel, settingsTab], [tournamentsPanel, tournamentsTab]]) {
      panel.hidden = true;
      tab.removeAttribute('aria-current');
    }
    accessPanel.hidden = true;
    accessTab.removeAttribute('aria-current');
    access.reset();
    tournaments.reset();
    selector.parentElement.hidden = false;
    addGame.hidden = !canEdit;
    importButton.hidden = !canEdit;
    setHeading();
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
    publication.load();
    if (focus) overviewTitle.focus();
  }

  function openTransportation(focus = true) {
    if (!canEdit || !selector.value) return;
    hidePanels();
    transportationPanel.hidden = false;
    transportationTab.setAttribute('aria-current', 'true');
    filterForm.hidden = false;
    overview.render(visibleGames());
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
    scheduleTab.setAttribute('aria-current', 'true');
    // A new game starts at the top; an existing one is most often opened to change its date.
    (game ? fields.game_date : fields.sport).focus();
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

  function openTournaments(focus = true) {
    hidePanels();
    tournamentsPanel.hidden = false;
    tournamentsTab.setAttribute('aria-current', 'true');
    selector.parentElement.hidden = true;
    addGame.hidden = true;
    importButton.hidden = true;
    title.textContent = 'Shore Conference';
    publicLink.hidden = true;
    tournaments.load();
    if (focus) document.getElementById('tournaments-title').focus();
  }
  tournamentsTab.onclick = () => openTournaments();

  function openStaffAccess() {
    if (!mayManageAccess || accessTab.hidden) return;
    hidePanels();
    accessPanel.hidden = false;
    accessTab.setAttribute('aria-current','true');
    selector.parentElement.hidden = true;
    addGame.hidden = true;
    importButton.hidden = true;
    title.textContent = 'Shore Conference';
    publicLink.hidden = true;
    access.load();
    document.getElementById('staff-access-title').focus();
  }
  accessTab.onclick = openStaffAccess;

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
  closeEditor.onclick = () => askToLeave(() => showSchedule(true));
  form.oninput = () => { dirty = true; syncStatusHint(); };
  document.getElementById('discard-confirm').onclick = () => {
    dirty = false;
    discardDialog.close();
    const action = leave;
    leave = null;
    action?.();
  };
  // Switching tabs with unsaved edits in the editor asks first, instead of silently dropping them.
  const sidebar = document.querySelector?.('.staff-sidebar');
  const guardTabs = event => {
    const button = event.target.closest?.('button');
    if (!button || form.hidden || !dirty) return;
    event.stopPropagation();
    event.preventDefault();
    askToLeave(() => button.click());
  };
  sidebar?.addEventListener('click', guardTabs, true);
  document.getElementById('unpublished-review').onclick = () => openOverview();
  // Small screens keep the four filters behind one button so the games come sooner.
  filtersToggle.onclick = () => {
    const open = filterForm.classList.toggle('is-open');
    filtersToggle.setAttribute('aria-expanded', String(Boolean(open)));
  };
  importButton.onclick = () => {
    showSchedule();
    const section = document.getElementById('import-section');
    section.scrollIntoView({ block: 'start' });
    document.getElementById('import-file').focus();
  };
  scheduleTab.onclick = () => showSchedule(true);
  // Deleting is for mistakes. A published copy stays public until the AD publishes the removal.
  const deleteDialog = document.getElementById('delete-game-dialog');
  const deleteStatus = document.getElementById('delete-game-status');
  const deleteConfirm = document.getElementById('delete-game-confirm');
  document.getElementById('delete-game').onclick = () => {
    if (!activeGame || !canEdit) return;
    document.getElementById('delete-game-summary').textContent = gameTitle(activeGame) + ' · ' +
      dateFormat.format(new Date(activeGame.game_date + 'T' + activeGame.start_time));
    deleteStatus.textContent = '';
    deleteConfirm.disabled = false;
    deleteDialog.showModal();
  };
  deleteConfirm.onclick = async () => {
    const game = activeGame;
    if (!game) return;
    deleteConfirm.disabled = true;
    deleteStatus.textContent = 'Deleting game…';
    const { error } = await client.rpc('delete_staff_game', { p_id: game.id, p_revision: game.revision });
    if (stopped) return;
    deleteConfirm.disabled = false;
    if (error) {
      deleteStatus.textContent = error.code === '40001'
        ? 'This game changed. Close this, choose the game again and review the latest version.'
        : 'The game could not be deleted. Please try again.';
      return;
    }
    deleteDialog.close();
    edit(null);
    showSchedule(true);
    scheduleFeedback.textContent = 'Game deleted. If it was published, review and publish its team to remove it from public calendars.';
    await loadGames(game.game_date);
  };

  form.onsubmit = async event => {
    event.preventDefault();
    const reviewAfterSave = event.submitter?.id === 'save-and-review-publication';
    const input = Object.fromEntries(new FormData(form));
    for (const name of Object.keys(input)) input[name] = input[name].trim() || null;
    input.school_id = selector.value;
    input.id = activeGame?.id ?? null;
    input.revision = activeGame?.revision ?? null;
    saveButton.disabled = true;
    document.getElementById('save-and-review-publication').disabled = true;
    const fieldsets = form.querySelectorAll('fieldset');
    fieldsets.forEach(fieldset => fieldset.disabled = true);
    closeEditor.disabled = true;
    scheduleTab.disabled = true;
    overviewTab.disabled = true;
    coachesTab.disabled = true;
    addGame.disabled = true;
    transportationTab.disabled = true;
    settingsTab.disabled = true;
    accessTab.disabled = true;
    tournamentsTab.disabled = true;
    preview.disabled = true;
    selector.disabled = true;
    list.querySelectorAll('button').forEach(button => button.disabled = true);
    formStatus.textContent = 'Saving game…';
    const { data: savedId, error } = await client.rpc('save_staff_game', { input });
    if (stopped) return;
    saveButton.disabled = false;
    document.getElementById('save-and-review-publication').disabled = false;
    fieldsets.forEach(fieldset => fieldset.disabled = false);
    closeEditor.disabled = false;
    scheduleTab.disabled = false;
    overviewTab.disabled = false;
    coachesTab.disabled = false;
    addGame.disabled = false;
    transportationTab.disabled = false;
    settingsTab.disabled = false;
    accessTab.disabled = false;
    tournamentsTab.disabled = false;
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
    scheduleFeedback.textContent = 'Saved as a draft. It is not public until you publish.';
    list.replaceChildren();
    await loadGames(input.game_date, false, savedId);
    if (reviewAfterSave && !stopped) await publication.reviewGame(savedId);
  };

  return () => {
    stopped = true;
    sidebar?.removeEventListener('click', guardTabs, true);
    transportation.stop();
    settings.stop();
    publication.stop();
    access.stop();
    tournaments.stop();
    tournamentsTab.onclick = null;
    tournamentsTab.disabled = false;
    accessTab.onclick = null;
    accessTab.disabled = false;
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
    stopFollowingView();
    calendar?.destroy();
    calendarTarget.parentElement.querySelector('.game-details')?.remove();
    preview.onchange = null;
    saveButton.disabled = false;
    form.querySelectorAll('fieldset').forEach(fieldset => fieldset.disabled = false);
    document.getElementById('save-and-review-publication').disabled = false;
    closeEditor.disabled = false;
    scheduleTab.disabled = false;
    addGame.disabled = false;
    transportationTab.disabled = false;
    list.replaceChildren();
  };
}
