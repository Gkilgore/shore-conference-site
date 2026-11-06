// Formats approved season postings and public game changes without reading drafts or staff fields.
function schoolSeasonLabel(season, year) {
  return season + ' ' + (season === 'Winter' ? year + '–' + String(Number(year) + 1).slice(-2) : year);
}

function schoolPublicTeam(team) {
  return [team.gender, team.level, team.sport].filter(Boolean).join(' ');
}

function schoolSeasonNotices(schedule) {
  return (schedule.seasons ?? []).flatMap(group => {
    if (!group.season || !Number.isInteger(group.season_year)) return [];
    const seen = new Set();
    const teams = (group.teams ?? []).filter(team => {
      const key = team.team_id ?? schoolPublicTeam(team);
      if (!team.sport || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map(team => ({ name: schoolPublicTeam(team), published_at: team.published_at }));
    if (!teams.length) return [];
    const gameDates = (schedule.events ?? []).filter(game => {
      const date = game.start?.slice(0, 10);
      if (game.season !== group.season || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return false;
      const year = Number(date.slice(0, 4)) - (game.season === 'Winter' && Number(date.slice(5, 7)) < 7 ? 1 : 0);
      return year === group.season_year;
    }).map(game => game.start.slice(0, 10)).sort();
    return [{ season: group.season, season_year: group.season_year, published_at: group.published_at,
      headline: schoolSeasonLabel(group.season, group.season_year) + ' schedules are now posted', teams,
      detail: teams.length + (teams.length === 1 ? ' team posted: ' : ' teams posted: ') + teams.map(team => team.name).join('; ') + '.',
      // Open a month with posted games; empty postings use the season's starting month.
      date: gameDates[0] ?? group.season_year + (group.season === 'Winter' ? '-12-01' : group.season === 'Spring' ? '-03-01' : '-08-01'),
    }];
  }).sort((first, second) => second.date.localeCompare(first.date));
}

function schoolPublicTime(value) {
  if (!value) return 'To be announced';
  const [hour, minute] = value.split(':');
  return (Number(hour) % 12 || 12) + ':' + minute + (Number(hour) < 12 ? ' AM' : ' PM');
}

function schoolPublicDate(value, timestamp = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric',
    timeZone: timestamp ? 'America/New_York' : 'UTC',
  }).format(new Date(value));
}

function schoolPublicChanges(before, after, schoolNames = {}) {
  if (!before || !after) return [];
  const opponent = game => schoolNames[game.opponent_school_id]?.name ?? game.opponent_name ?? game.opponent_school_id;
  const fields = [
    ['Date', game => schoolPublicDate(game.game_date)], ['Start time', game => schoolPublicTime(game.start_time)],
    ['Opponent', opponent], ['Home or away', game => game.home_away], ['Venue', game => game.location],
    ['Status', game => game.status], ['Sport', game => game.teams?.sport],
    ['Team', game => game.teams?.gender], ['Level', game => game.teams?.level], ['Season', game => game.teams?.season],
    ['Bus departure', game => schoolPublicTime(game.transportation?.bus_departure)],
    ['Pickup', game => game.transportation?.pickup_location],
    ['Return time', game => schoolPublicTime(game.transportation?.return_time)],
  ];
  return fields.flatMap(([label, read]) => {
    const was = read(before) || 'To be announced', now = read(after) || 'To be announced';
    return was === now ? [] : [label + ': ' + was + ' → ' + now];
  });
}

function schoolPublicUpdates(schedule, schoolNames = {}) {
  const kinds = { team_posted: 'Team schedule posted', team_unpublished: 'Team schedule withdrawn',
    game_added: 'Game added', game_changed: 'Game updated', game_removed: 'Game removed', game_canceled: 'Game canceled', game_postponed: 'Game postponed' };
  return (schedule.updates ?? []).filter(update => Object.hasOwn(kinds, update.kind) && Number.isFinite(Date.parse(update.occurred_at)))
    .sort((first, second) => Date.parse(second.occurred_at) - Date.parse(first.occurred_at)).slice(0, 20)
    .map(update => {
      const game = update.after ?? update.before;
      const opponent = schoolNames[game?.opponent_school_id]?.name ?? game?.opponent_name;
      const details = game ? [schoolPublicDate(game.game_date), game.start_time ? schoolPublicTime(game.start_time) + ' ET' : '',
        opponent ? (game.home_away === 'Away' ? 'at ' : 'vs. ') + opponent : '', game.location].filter(Boolean).join(' · ') : '';
      return { id: update.id, headline: kinds[update.kind], occurred_at: update.occurred_at,
        team: schoolPublicTeam(update) + ' · ' + schoolSeasonLabel(update.season, update.season_year),
        details, changes: schoolPublicChanges(update.before, update.after, schoolNames),
      };
    });
}

function renderSchoolSeasons(target, schedule, onSelect) {
  const notices = schoolSeasonNotices(schedule);
  target.replaceChildren(...notices.map(notice => {
    const article = document.createElement('article');
    const heading = document.createElement('h3');
    const link = document.createElement('a');
    link.href = '#school-calendar';
    link.textContent = notice.headline;
    link.onclick = () => onSelect?.(notice);
    heading.append(link);
    const teams = document.createElement('p');
    teams.textContent = notice.detail;
    article.append(heading, teams);
    if (notice.published_at && Number.isFinite(Date.parse(notice.published_at))) {
      const posted = document.createElement('p');
      const date = document.createElement('time');
      date.dateTime = notice.published_at;
      date.textContent = schoolPublicDate(notice.published_at, true);
      posted.append('Posted ', date);
      article.append(posted);
    }
    return article;
  }));
  if (!notices.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Choose a season to view posted schedules.';
    target.append(empty);
  }
}

function renderSchoolUpdates(target, schedule, schoolNames) {
  const updates = schoolPublicUpdates(schedule, schoolNames);
  target.replaceChildren(...updates.map(update => {
    const row = document.createElement('li');
    const date = document.createElement('time');
    date.dateTime = update.occurred_at;
    date.textContent = schoolPublicDate(update.occurred_at, true);
    const heading = document.createElement('h3');
    heading.textContent = update.headline;
    const team = document.createElement('p');
    team.textContent = update.team;
    row.append(date, heading, team);
    if (update.details) {
      const details = document.createElement('p');
      details.textContent = update.details;
      row.append(details);
    }
    if (update.changes.length) {
      const changes = document.createElement('ul');
      changes.append(...update.changes.map(text => {
        const field = document.createElement('li');
        field.textContent = text;
        return field;
      }));
      row.append(changes);
    }
    return row;
  }));
  if (!updates.length) {
    const empty = document.createElement('li');
    empty.textContent = 'Published changes will appear here.';
    target.append(empty);
  }
}
