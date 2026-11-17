// Selects published schedule fields and serializes subscription calendars without dependencies.
// Non-ASCII characters are written as \u escapes, so a deploy that misreads the file encoding
// cannot garble them (a middle dot once arrived as "\u00c2\u00b7").
export function parseOptions(url) {
  const allowed = ['scope', 'school', 'sport', 'gender', 'level', 'season', 'search', 'format', 'download'];
  for (const key of url.searchParams.keys()) {
    if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1) throw new Error('Invalid calendar option.');
  }
  const options = Object.fromEntries(url.searchParams);
  options.scope ||= options.school ? 'school' : 'conference';
  if (!['school', 'conference'].includes(options.scope)) throw new Error('Choose a school or conference calendar.');
  if (options.scope === 'school' && !options.school) throw new Error('Choose a school.');
  if (options.school && !/^[a-z0-9-]{1,80}$/.test(options.school)) throw new Error('Invalid school.');
  for (const key of ['sport', 'search']) if (options[key]?.length > 100) throw new Error('Calendar option is too long.');
  for (const [key, values] of Object.entries({
    gender: ['Boys', 'Girls', 'Coed'], level: ['Varsity', 'JV', 'Freshman'], season: ['Fall', 'Winter', 'Spring'],
    format: ['ics', 'json'], download: ['1'],
  })) if (options[key] && !values.includes(options[key])) throw new Error('Invalid ' + key + '.');
  return options;
}

function matchKey(game) {
  if (!game.start_time) return null;
  const home = game.home_away === 'Home';
  return JSON.stringify([home ? game.school_id : game.opponent_school_id,
    home ? game.opponent_school_id : game.school_id, game.game_date, game.start_time, game.location,
    game.teams.sport, game.teams.gender, game.teams.level]);
}

function tournamentEvents(games, options) {
  const unique = new Map();
  for (const game of games) {
    if (!game.game_date || !game.start_time || !game.teams) continue;
    if (!unique.has(game.id) || game.revision > unique.get(game.id).revision) unique.set(game.id, game);
  }
  return [...unique.values()].flatMap(game => {
    const schools = [...new Set([game.a.school_id, game.b.school_id].filter(Boolean))];
    if (options.school && !schools.includes(options.school)) return [];
    const team = game.teams;
    const home = game.home_side === 'a' ? game.a : game.home_side === 'b' ? game.b : null;
    const away = home === game.a ? game.b : game.a;
    const opponent = game.a.school_id === options.school ? game.b : game.a;
    const pairing = options.scope === 'school'
      ? (home && home.school_id !== options.school ? 'at ' : 'vs. ') + opponent.name
      : home ? away.name + ' at ' + home.name : game.a.name + ' vs. ' + game.b.name;
    const event = {
      id: game.id, revision: game.revision, updated_at: game.updated_at,
      title: [team.gender, team.level, team.sport].join(' ') + ' \u00b7 ' + game.tournament_name +
        ' \u00b7 ' + game.match_label + ' \u00b7 ' + pairing + (game.status === 'Scheduled' ? '' : ' \u00b7 ' + game.status),
      start: game.game_date + 'T' + game.start_time, location: game.location,
      status: game.status, notes: '', school: options.scope === 'school' ? options.school : home?.school_id ?? schools[0] ?? null,
      schools, sport: team.sport, gender: team.gender, level: team.level, season: team.season,
      tournament_id: game.tournament_id, tournament_name: game.tournament_name,
      match_id: game.match_id, match_label: game.match_label, round: game.round,
      duration_minutes: game.duration_minutes, ics_start_utc: game.ics_start_utc,
    };
    if (options.scope === 'school') {
      // The database returns only this school's bus row. Also reject a foreign row if one is supplied.
      const rows = Array.isArray(game.transportation) ? game.transportation : [game.transportation];
      const bus = rows.find(row => row && (!row.school_id || row.school_id === options.school));
      if (bus) event.transportation = {
        bus_departure: bus.bus_departure, pickup_location: bus.pickup_location,
        return_time: bus.return_time, early_dismissal_time: bus.early_dismissal_time,
      };
    }
    return [event];
  });
}

// "Nov 20, 3:30 PM" from a stored date and time, for the moved-game notes.
function slotText(date, time) {
  const day = new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  if (!time) return day + ', time TBD';
  const [hour, minute] = time.split(':');
  return day + ', ' + (Number(hour) % 12 || 12) + ':' + minute + (Number(hour) < 12 ? ' AM' : ' PM');
}

// moves: games that were Postponed and then posted at a new date or time ({ game_id, from_date, from_time }).
export function publicSchedule(schools, games, options, tournamentGames = [], moves = []) {
  const movedFrom = new Map(moves.filter(move => move?.game_id && move.from_date).map(move => [move.game_id, move]));
  const directory = new Map(schools.map(school => [school.slug, school]));
  const school = directory.get(options.school);
  if (options.school && !school) throw new Error('School not found.');
  const isConference = options.scope === 'conference';
  const tournaments = tournamentEvents(tournamentGames, options);
  const publicGames = games.filter(game => directory.get(game.school_id)?.schedule_published === true && game.teams);
  let selected;
  if (isConference) {
    const members = publicGames.filter(game => game.start_time && directory.get(game.school_id).is_conference_member &&
      directory.get(game.opponent_school_id)?.is_conference_member && game.school_id !== game.opponent_school_id);
    const awayByKey = new Map();
    for (const game of [...members].sort((a, b) => a.id.localeCompare(b.id))) {
      if (game.home_away === 'Away' && !awayByKey.has(matchKey(game))) {
        awayByKey.set(matchKey(game), game);
      }
    }
    const emitted = new Set();
    // A matched game stays listed when either school postpones or cancels it, and carries that status.
    const shared = (...statuses) => statuses.includes('Canceled') ? 'Canceled'
      : statuses.includes('Postponed') ? 'Postponed' : 'Scheduled';
    selected = members.filter(game => game.home_away === 'Home')
      .sort((a, b) => a.id.localeCompare(b.id))
      .flatMap(home => {
        const key = matchKey(home);
        const away = awayByKey.get(key);
        if (!away || emitted.has(key)) return [];
        emitted.add(key);
        return [{ ...home, away_id: away.id, status: shared(home.status, away.status), feed_id: [home.id, away.id].sort().join('-'),
          revision: home.revision + away.revision,
          updated_at: home.updated_at > away.updated_at ? home.updated_at : away.updated_at }];
      });
  } else selected = publicGames.filter(game => game.school_id === options.school);

  const events = selected.flatMap(game => {
    const team = game.teams;
    const opponent = directory.get(game.opponent_school_id)?.name ?? game.opponent_name ?? 'Opponent';
    const teamName = [team.gender, team.level, team.sport].join(' ');
    const title = isConference
      ? teamName + ' \u00b7 ' + opponent + ' at ' + directory.get(game.school_id).name
      : teamName + (game.home_away === 'Home' ? ' vs. ' : ' at ') + opponent;
    const event = {
      id: game.feed_id ?? game.id, revision: game.revision, updated_at: game.updated_at,
      title: title + (game.status === 'Scheduled' ? '' : ' \u00b7 ' + game.status),
      start: game.start_time ? game.game_date + 'T' + game.start_time : game.game_date, location: game.location,
      status: game.status, notes: game.notes ?? '', school: game.school_id, home_away: game.home_away,
      schools: [game.school_id, game.opponent_school_id].filter(Boolean),
      sport: team.sport, gender: team.gender, level: team.level, season: team.season,
    };
    if (!isConference) {
      const bus = Array.isArray(game.transportation) ? game.transportation[0] : game.transportation;
      if (bus) {
        event.transportation = {
          bus_departure: bus.bus_departure, pickup_location: bus.pickup_location, return_time: bus.return_time,
        };
        if (bus.early_dismissal_time) event.transportation.early_dismissal_time = bus.early_dismissal_time;
      }
    }
    // A postponed game posted at a new slot carries where it was, and leaves a note on the old date.
    // The note is for the website only; subscribed calendars just see the event move (see buildCalendar).
    const move = movedFrom.get(game.id) ?? movedFrom.get(game.away_id);
    if (!move) return [event];
    event.moved_from = { date: move.from_date, time: move.from_time ?? null, text: slotText(move.from_date, move.from_time) };
    const note = {
      id: event.id + '-moved', revision: event.revision, updated_at: event.updated_at,
      title: title + ' \u00b7 Moved to ' + slotText(game.game_date, game.start_time),
      start: move.from_time ? move.from_date + 'T' + move.from_time : move.from_date, location: '',
      status: 'Moved', notes: '', school: event.school, home_away: event.home_away, schools: event.schools,
      sport: team.sport, gender: team.gender, level: team.level, season: team.season,
      moved_to: { start: event.start, text: slotText(game.game_date, game.start_time) },
    };
    return [event, note];
  }).concat(tournaments).filter(event => (!options.school || event.schools.includes(options.school)) &&
    ['sport', 'gender', 'level', 'season'].every(key => !options[key] || event[key] === options[key]) &&
    (!options.search || (event.title + ' ' + event.location).toLowerCase().includes(options.search.toLowerCase())))
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
  return {
    scope: options.scope, name: [isConference ? 'Shore Conference' : school.name,
      options.gender, options.level, options.sport, options.season].filter(Boolean).join(' \u00b7 '),
    published: isConference || school.schedule_published === true || tournaments.length > 0,
    events,
  };
}

function escapeText(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

function fold(line) {
  const encoder = new TextEncoder();
  let result = '', length = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (length + size > 75) { result += '\r\n '; length = 1; }
    result += character;
    length += size;
  }
  return result;
}

export function buildCalendar(schedule) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Shore Conference//Schedules//EN', 'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:' + escapeText(schedule.name), 'X-WR-TIMEZONE:America/New_York',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
    'BEGIN:VTIMEZONE', 'TZID:America/New_York',
    'BEGIN:DAYLIGHT', 'DTSTART:20070311T020000', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0400',
    'TZNAME:EDT', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'DTSTART:20071104T020000', 'TZOFFSETFROM:-0400', 'TZOFFSETTO:-0500',
    'TZNAME:EST', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD', 'END:VTIMEZONE',
  ];
  // Moved-game notes are for the website; a subscribed calendar simply sees the game's event move.
  for (const game of schedule.events.filter(event => !event.moved_to)) {
    const description = [game.notes];
    if (game.moved_from) description.push('Originally ' + game.moved_from.text + '.');
    if (schedule.scope === 'school' && game.transportation) {
      const bus = game.transportation;
      const time = value => {
        const [hour, minute] = value.split(':');
        return (Number(hour) % 12 || 12) + ':' + minute + (Number(hour) < 12 ? ' AM' : ' PM') + ' ET';
      };
      if (bus.bus_departure) description.push('Bus departure: ' + time(bus.bus_departure));
      if (bus.pickup_location) description.push('Pickup: ' + bus.pickup_location);
      if (bus.return_time) description.push('Return: ' + time(bus.return_time));
      if (bus.early_dismissal_time) description.push('Early dismissal: ' + time(bus.early_dismissal_time));
    }
    const modified = new Date(game.updated_at).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    // A repeated Eastern clock hour needs its checked UTC instant to preserve the chosen occurrence.
    const allDay = !game.start.includes('T');
    const nextDay = new Date(game.start.slice(0, 10) + 'T00:00:00Z');
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    lines.push('BEGIN:VEVENT', 'UID:' + schedule.scope + '-' + game.id + '@shore-calendar',
      'DTSTAMP:' + modified, 'LAST-MODIFIED:' + modified, 'SEQUENCE:' + game.revision,
      allDay ? 'DTSTART;VALUE=DATE:' + game.start.replace(/-/g, '')
        : game.ics_start_utc ? 'DTSTART:' + game.ics_start_utc
          : 'DTSTART;TZID=America/New_York:' + (game.start.length === 16 ? game.start + ':00' : game.start).replace(/[-:]/g, '').slice(0, 15),
      ...(allDay ? ['DTEND;VALUE=DATE:' + nextDay.toISOString().slice(0, 10).replace(/-/g, '')] : []),
      'SUMMARY:' + escapeText(game.title + (allDay ? ' \u00b7 TBD' : '')), 'LOCATION:' + escapeText(game.location),
      'DESCRIPTION:' + escapeText(description.filter(Boolean).join('\n')),
      'STATUS:' + (game.status === 'Canceled' ? 'CANCELLED' : game.status === 'Postponed' ? 'TENTATIVE' : 'CONFIRMED'),
      'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
