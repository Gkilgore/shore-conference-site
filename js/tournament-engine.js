// Builds, checks, schedules and exchanges tournament bracket documents without changing input.
(function (global) {
  'use strict';
  const idPattern = /^[A-Za-z0-9_-]{1,60}$/;
  const statuses = ['Scheduled', 'Postponed', 'Canceled', 'Final', 'Forfeit'];
  const metadata = ['name', 'sport', 'gender', 'level', 'season', 'season_year',
    'duration_minutes', 'turnaround_minutes', 'rest_minutes'];
  const slotFields = ['participant_id', 'name', 'school_id', 'team_id', 'seed', 'winner_of'];
  const csvHeaders = ['csv_format', 'tournament_id', ...metadata, 'windows', 'participants', 'match_id', 'round', 'label',
    ...['a', 'b'].flatMap(side => slotFields.map(field => side + '_' + field)),
    'game_date', 'start_time', 'venue', 'home_side', 'status', 'winner_id', 'score_a', 'score_b'];
  const copy = value => JSON.parse(JSON.stringify(value));
  const completed = match => ['Final', 'Forfeit'].includes(match.status);
  const active = match => !['Canceled', 'Postponed'].includes(match.status);
  const integer = value => Number.isInteger(value) && value >= 0;
  const key = value => String(value || '').trim().toLowerCase();
  const easternFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const easternDates = new Map();

  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function minutes(value) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')) return null;
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  }
  function easternOffset(absoluteMinute) {
    const fields = Object.fromEntries(easternFormatter.formatToParts(new Date(absoluteMinute * 60000))
      .filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
    return Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute) / 60000 - absoluteMinute;
  }
  function easternDay(date) {
    if (easternDates.has(date)) return easternDates.get(date);
    const base = Date.parse(date + 'T00:00:00Z') / 60000, end = base + 2880;
    const before = easternOffset(base), after = easternOffset(end);
    let segments = [{ start: base, end, offset: before }];
    // New York has at most one clock change in this two-day range. Locate its exact minute once.
    if (before !== after) {
      let low = base, high = end;
      while (high - low > 1) {
        const middle = Math.floor((low + high) / 2);
        if (easternOffset(middle) === before) low = middle;
        else high = middle;
      }
      segments = [{ start: base, end: high, offset: before }, { start: high, end, offset: after }];
    }
    const day = { base, segments };
    if (easternDates.size >= 128) easternDates.delete(easternDates.keys().next().value);
    easternDates.set(date, day);
    return day;
  }
  function instant(date, time, normalizeLegacyGap = false) {
    const minute = minutes(time);
    if (!validDate(date) || minute === null) return null;
    const day = easternDay(date);
    let result = null;
    for (const segment of day.segments) {
      const candidate = day.base + minute - segment.offset;
      if (candidate >= segment.start && candidate < segment.end) {
        // PostgreSQL interprets a repeated fall-back walltime as its later, standard-time occurrence.
        result = result === null ? candidate : Math.max(result, candidate);
      }
    }
    // Existing ordinary games may contain a skipped-hour time. PostgreSQL applies the pre-change offset.
    if (result === null && normalizeLegacyGap) result = Math.max(...day.segments.map(segment => day.base + minute - segment.offset));
    return result;
  }
  function easternWalltime(absoluteMinute, date) {
    const segment = easternDay(date).segments.find(part => absoluteMinute >= part.start && absoluteMinute < part.end);
    const local = new Date((absoluteMinute + segment.offset) * 60000).toISOString();
    return { game_date: local.slice(0, 10), start_time: local.slice(11, 16) };
  }
  function matchDefaults(id, round, a, b) {
    return { id, round, label: 'Round ' + round, a, b, game_date: null, start_time: null,
      venue: '', home_side: 'neutral', status: 'Scheduled', winner_id: null, score_a: null, score_b: null };
  }
  function participantProblems(participants) {
    const errors = [], ids = new Set(), seeds = new Set(), identities = new Set();
    for (const participant of participants) {
      if (!participant || !idPattern.test(participant.id || '') || ids.has(participant.id)) errors.push('Each participant needs a unique ID of up to 60 letters, numbers, underscores or hyphens.');
      if (!participant || !String(participant.name || '').trim()) errors.push('Every participant needs a name.');
      if (!participant || !Number.isInteger(participant.seed) || participant.seed < 1 || seeds.has(participant.seed)) errors.push('Seeds must be unique positive integers.');
      const identity = participant?.school_id || key(participant?.name);
      if (identity && identities.has(identity)) errors.push('Duplicate teams are not allowed. Each school or guest may enter only once.');
      ids.add(participant?.id); seeds.add(participant?.seed);
      identities.add(identity);
    }
    return errors;
  }
  function identifySchool(name, schools, context, errors, allowPrefix = true) {
    const query = key(name);
    if (!query) return null;
    const exact = schools.filter(school => [school.name, school.slug, school.id].some(value => value && key(value) === query));
    const choices = exact.length || !allowPrefix ? exact : schools.filter(school => key(school.name).startsWith(query + ' '));
    if (choices.length > 1) {
      errors.push(context + ' "' + name + '" matches several schools. Choose ' + choices.map(school => school.name +
        ' (' + (school.slug || school.id) + ')').join(', ') + '.');
      return null;
    }
    return exact[0] || null;
  }
  function participantsFromText(text, schools = []) {
    const errors = [], participants = [], usedSeeds = new Set();
    const rows = String(text).split(/\r?\n/).map((line, index) => ({ text: line.trim(), line: index + 1 })).filter(row => row.text);
    const parsed = rows.map(row => {
      const prefix = row.text.match(/^(\d+)[.)\s-]+(.+)$/);
      return { name: prefix ? prefix[2].trim() : row.text, seed: prefix ? Number(prefix[1]) : null, line: row.line };
    });
    parsed.forEach(row => { if (row.seed !== null) usedSeeds.add(row.seed); });
    let nextSeed = 1;
    for (const row of parsed) {
      while (usedSeeds.has(nextSeed)) nextSeed++;
      const seed = row.seed ?? nextSeed++;
      const school = identifySchool(row.name, schools, 'Line ' + row.line, errors);
      participants.push({ id: 'p' + (participants.length + 1), name: school?.name || row.name,
        school_id: school?.slug || school?.id || null, team_id: null, seed });
    }
    errors.push(...participantProblems(participants));
    if (participants.length < 2 || participants.length > 128) errors.push('Enter between 2 and 128 participants.');
    return { participants, errors: [...new Set(errors)] };
  }
  function generateBracket(participants) {
    if (!Array.isArray(participants) || participants.length < 2 || participants.length > 128) throw new Error('Choose between 2 and 128 participants.');
    const errors = participantProblems(participants);
    if (errors.length) throw new Error(errors.join(' '));
    const sorted = [...participants].sort((a, b) => a.seed - b.seed);
    let size = 2, order = [1, 2];
    while (size < sorted.length) {
      size *= 2;
      order = order.flatMap(seed => [seed, size + 1 - seed]);
    }
    let slots = order.map(seed => sorted[seed - 1] ? { participant_id: sorted[seed - 1].id } : null);
    const matches = [];
    let round = 1;
    while (slots.length > 1) {
      const next = [];
      let number = 0;
      for (let index = 0; index < slots.length; index += 2) {
        const a = slots[index], b = slots[index + 1];
        if (!a || !b) { next.push(a || b); continue; }
        const id = 'r' + round + 'm' + (++number);
        const match = matchDefaults(id, round, a, b);
        match.label = slots.length === 2 ? 'Final' : slots.length === 4 ? 'Semifinal ' + number : 'Round ' + round + ', match ' + number;
        matches.push(match);
        next.push({ winner_of: id });
      }
      slots = next; round++;
    }
    return matches;
  }
  function graph(document) {
    const matches = new Map((document.matches || []).filter(Boolean).map(match => [match.id, match]));
    const participants = new Map((document.participants || []).filter(Boolean).map(participant => [participant.id, participant]));
    function resolveSlot(slot, visiting = new Set()) {
      if (slot?.participant_id && !slot.winner_of) return participants.has(slot.participant_id) ? slot.participant_id : null;
      if (!slot?.winner_of || slot.participant_id || visiting.has(slot.winner_of)) return null;
      const source = matches.get(slot.winner_of);
      if (!source || !completed(source)) return null;
      const trail = new Set(visiting).add(source.id);
      const a = resolveSlot(source.a, trail), b = resolveSlot(source.b, trail);
      return a && b && [a, b].includes(source.winner_id) ? source.winner_id : null;
    }
    function potential(slot, visiting = new Set()) {
      const resolved = resolveSlot(slot);
      if (resolved) return new Set([resolved]);
      if (!slot?.winner_of || visiting.has(slot.winner_of)) return new Set();
      const source = matches.get(slot.winner_of);
      if (!source) return new Set();
      const trail = new Set(visiting).add(source.id);
      return new Set([...potential(source.a, trail), ...potential(source.b, trail)]);
    }
    function teams(match) {
      return new Set([...potential(match.a), ...potential(match.b)]);
    }
    return { matches, participants, resolveSlot, teams };
  }
  function resolve(document) {
    const result = copy(document), state = graph(result);
    result.matches = (result.matches || []).map(match => ({ ...match,
      resolved_a: state.resolveSlot(match.a), resolved_b: state.resolveSlot(match.b) }));
    return result;
  }
  function constraints(document, state) {
    const duration = Number.isInteger(document.duration_minutes) && document.duration_minutes > 0 ? document.duration_minutes : 90;
    const rest = integer(document.rest_minutes) ? document.rest_minutes : 60;
    const turnaround = integer(document.turnaround_minutes) ? document.turnaround_minutes : 15;
    const externalIntervals = new Map();
    function identities(match) {
      return new Set([...state.teams(match)].map(id => {
        const participant = state.participants.get(id);
        return participant?.team_id || participant?.school_id || id;
      }));
    }
    function conflicts(match, other, external = false) {
      let otherDuration = duration;
      if (external) {
        let interval = externalIntervals.get(other);
        if (!interval) {
          interval = { day: Date.parse(other.game_date + 'T00:00:00Z') / 60000,
            duration: Number.isInteger(other.duration_minutes) && other.duration_minutes > 0 ? other.duration_minutes : duration };
          externalIntervals.set(other, interval);
        }
        otherDuration = interval.duration;
        const day = easternDates.get(match.game_date)?.base ?? Date.parse(match.game_date + 'T00:00:00Z') / 60000;
        // Two extra days cover local start times, midnight and DST differences before exact conversion.
        const margin = Math.max(rest, turnaround) + 2880;
        if (day > interval.day + otherDuration + margin || interval.day > day + duration + margin) return [];
      }
      const start = instant(match.game_date, match.start_time), otherStart = instant(other.game_date, other.start_time, external);
      if (start === null || otherStart === null || !active(other)) return [];
      const reasons = [];
      const overlaps = gap => start < otherStart + otherDuration + gap && otherStart < start + duration + gap;
      if (key(match.venue) && key(match.venue) === key(other.venue) && overlaps(turnaround)) reasons.push('Venue conflict or insufficient venue turnaround with ' + other.id + '.');
      const ownTeams = identities(match);
      const shared = external ? [...state.teams(match)].some(id => (other.school_ids || []).includes(state.participants.get(id)?.school_id))
        : [...identities(other)].some(id => ownTeams.has(id));
      if (shared && overlaps(rest)) reasons.push('Team or potential-team conflict, including required rest, with ' + other.id + (external && !other.duration_minutes ? ' (ordinary game duration estimated from tournament duration).' : '.'));
      return reasons;
    }
    return { duration, rest, conflicts };
  }
  function validate(document, externalGames = []) {
    const issues = [];
    const add = (match_id, message) => issues.push({ match_id, message, blocking: true });
    if (!document || typeof document !== 'object' || !Array.isArray(document.participants) || !Array.isArray(document.matches)) {
      add(null, 'A tournament needs participant and match lists.'); return issues;
    }
    participantProblems(document.participants).forEach(message => add(null, message));
    for (const field of ['name', 'sport', 'gender', 'level', 'season']) {
      if (typeof document[field] !== 'string' || !document[field].trim()) add(null, 'Tournament ' + field + ' is required.');
    }
    if (!Number.isInteger(document.season_year) || document.season_year < 1900 || document.season_year > 2200) add(null, 'Season year must be between 1900 and 2200.');
    if (document.participants.length < 2 || document.participants.length > 128) add(null, 'Choose between 2 and 128 participants.');
    if (!document.matches.length || document.matches.length > 127) add(null, 'Choose between 1 and 127 matches.');
    if (!Number.isInteger(document.duration_minutes) || document.duration_minutes < 1 || document.duration_minutes > 1440) add(null, 'Game duration must be between 1 and 1440 minutes.');
    for (const field of ['rest_minutes', 'turnaround_minutes']) if (!integer(document[field]) || document[field] > 10080) add(null, field.replace(/_/g, ' ') + ' must be between 0 and 10080.');
    if (!Array.isArray(document.windows)) add(null, 'Available windows must be a list.');
    for (const window of Array.isArray(document.windows) ? document.windows : []) {
      if (!window || !validDate(window.date) || minutes(window.start) === null || minutes(window.end) === null ||
        minutes(window.start) >= minutes(window.end) || !String(window.venue || '').trim()) add(null, 'Each available window needs a valid date, increasing start/end times and a venue.');
      else if (instant(window.date, window.start) === null || instant(window.date, window.end) === null) add(null, 'An available window time does not exist in Eastern time because the clock moves forward. Choose another time.');
    }
    const state = graph(document), timing = constraints(document, state);
    const ids = new Set(), entrants = new Set(), advances = new Set();
    for (const match of document.matches) {
      if (!match || typeof match !== 'object') { add(null, 'Every match must be an object.'); continue; }
      if (!idPattern.test(match.id || '') || ids.has(match.id)) add(match.id, 'Each match needs a unique valid ID.');
      ids.add(match.id);
      if (!Number.isInteger(match.round) || match.round < 1) add(match.id, 'Round must be a positive integer.');
      for (const side of ['a', 'b']) {
        const slot = match[side];
        if (!slot || typeof slot !== 'object' || Object.keys(slot).length !== 1 || Boolean(slot.participant_id) === Boolean(slot.winner_of)) {
          add(match.id, 'Each slot needs exactly one participant_id or winner_of.'); continue;
        }
        if (slot.participant_id) {
          if (!state.participants.has(slot.participant_id)) add(match.id, 'Slot participant does not exist.');
          if (entrants.has(slot.participant_id)) add(match.id, 'A participant enters only one starting slot.');
          entrants.add(slot.participant_id);
        } else {
          const source = state.matches.get(slot.winner_of);
          if (!source || source.round >= match.round || source.id === match.id) add(match.id, 'Winner references must point to an existing earlier round, without cycles.');
          if (advances.has(slot.winner_of)) add(match.id, 'A match can advance into only one later slot.');
          advances.add(slot.winner_of);
        }
      }
      if (!statuses.includes(match.status)) add(match.id, 'Choose a valid match status.');
      if (!['a', 'b', 'neutral'].includes(match.home_side)) add(match.id, 'Home side must be a, b or neutral.');
      const a = state.resolveSlot(match.a), b = state.resolveSlot(match.b);
      if (match.winner_id && (!completed(match) || !a || !b || ![a, b].includes(match.winner_id))) add(match.id, 'Winner is invalid for the current resolved participants. Clear the result after changing an earlier winner.');
      if (completed(match) && (!match.winner_id || !a || !b)) add(match.id, 'A completed match requires resolved participants and their actual winner.');
      for (const field of ['score_a', 'score_b']) if (match[field] !== null && match[field] !== undefined && !integer(match[field])) add(match.id, 'Scores must be nonnegative whole numbers.');
      if (match.game_date && !validDate(match.game_date)) add(match.id, 'Enter a valid calendar date.');
      if (match.start_time && minutes(match.start_time) === null) add(match.id, 'Enter a valid Eastern time in HH:mm format.');
      if (validDate(match.game_date) && minutes(match.start_time) !== null && instant(match.game_date, match.start_time) === null) add(match.id, 'This time does not exist in Eastern time because the clock moves forward. Choose another time.');
      if (!active(match)) continue;
      if (!match.game_date || !match.start_time) add(match.id, 'Match is unscheduled. Choose a date and start time.');
      if (!String(match.venue || '').trim()) add(match.id, 'Choose a venue.');
      const start = instant(match.game_date, match.start_time);
      if (start !== null && Array.isArray(document.windows) && document.windows.length && !document.windows.some(window => {
        if (!window) return false;
        const begin = instant(window.date, window.start), end = instant(window.date, window.end);
        return begin !== null && end !== null && key(window.venue) === key(match.venue) && start >= begin && start + timing.duration <= end;
      })) add(match.id, 'Match must fit completely inside an available venue window.');
      for (const slot of [match.a, match.b]) {
        const source = state.matches.get(slot?.winner_of);
        if (!source || start === null) continue;
        const priorStart = instant(source.game_date, source.start_time);
        if (priorStart === null || !active(source) || start < priorStart + timing.duration + timing.rest) add(match.id, 'Dependency match must finish before this match, including required rest.');
      }
      for (const other of externalGames) timing.conflicts(match, other, true).forEach(message => add(match.id, message));
    }
    const scheduled = document.matches.filter(match => match && active(match));
    for (let index = 0; index < scheduled.length; index++) {
      for (let other = index + 1; other < scheduled.length; other++) timing.conflicts(scheduled[index], scheduled[other]).forEach(message => add(scheduled[index].id, message));
    }
    return issues;
  }
  function schedule(document, windows, externalGames = []) {
    const proposed = copy(document);
    proposed.windows = copy(windows || []);
    const state = graph(proposed), timing = constraints(proposed, state);
    const ordered = [...proposed.matches].sort((a, b) => a.round - b.round);
    const placed = ordered.filter(match => completed(match)), unavailable = new Set();
    const available = proposed.windows.filter(window => window && key(window.venue) && instant(window.date, window.start) !== null &&
      instant(window.date, window.end) !== null && instant(window.date, window.end) > instant(window.date, window.start)).sort((a, b) => instant(a.date, a.start) - instant(b.date, b.start));
    for (const match of ordered) {
      if (!active(match)) continue;
      if (completed(match)) continue;
      match.game_date = null; match.start_time = null; match.venue = '';
      const sources = [match.a, match.b].map(slot => state.matches.get(slot?.winner_of)).filter(Boolean);
      if (sources.some(source => unavailable.has(source.id) || !active(source) || instant(source.game_date, source.start_time) === null)) { unavailable.add(match.id); continue; }
      const ready = sources.length ? Math.max(...sources.map(source => instant(source.game_date, source.start_time) + timing.duration + timing.rest)) : -Infinity;
      let best = null;
      for (const window of available) {
        const start = Math.max(instant(window.date, window.start), ready), end = instant(window.date, window.end);
        for (let candidate = start; candidate + timing.duration <= end; candidate++) {
          if (best && candidate >= best.instant) break;
          Object.assign(match, easternWalltime(candidate, window.date));
          // Earlier repeated-hour instants cannot be represented unambiguously by the stored HH:mm.
          if (instant(match.game_date, match.start_time) !== candidate) continue;
          match.venue = window.venue;
          if (placed.some(other => timing.conflicts(match, other).length) || externalGames.some(other => timing.conflicts(match, other, true).length)) continue;
          if (placed.some(other => [other.a, other.b].some(slot => slot?.winner_of === match.id) &&
            candidate + timing.duration + timing.rest > instant(other.game_date, other.start_time))) continue;
          best = { instant: candidate, game_date: match.game_date, start_time: match.start_time, venue: match.venue };
          break;
        }
      }
      if (best) {
        Object.assign(match, { game_date: best.game_date, start_time: best.start_time, venue: best.venue });
        placed.push(match);
      }
      else { match.game_date = null; match.start_time = null; match.venue = ''; unavailable.add(match.id); }
    }
    const issues = validate(proposed, externalGames);
    for (const id of unavailable) issues.push({ match_id: id, message: 'No available window fits this match and its dependency, venue and rest constraints.', blocking: true });
    return { document: proposed, issues };
  }
  function readCsv(text) {
    const rows = [[]];
    let field = '', quoted = false, endedQuote = false;
    text = String(text).replace(/^\uFEFF/, '');
    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      if (quoted) {
        if (char === '"' && text[index + 1] === '"') { field += '"'; index++; }
        else if (char === '"') { quoted = false; endedQuote = true; }
        else field += char;
      } else if (char === '"') {
        if (field || endedQuote) throw new Error('A CSV quote must start at the beginning of a cell.');
        quoted = true;
      } else if (char === ',' || char === '\n' || char === '\r') {
        rows.at(-1).push(field); field = ''; endedQuote = false;
        if (char !== ',') { if (char === '\r' && text[index + 1] === '\n') index++; rows.push([]); }
      } else {
        if (endedQuote) throw new Error('Unexpected text after a closing CSV quote.');
        field += char;
      }
    }
    if (quoted) throw new Error('The CSV contains an unclosed quoted cell.');
    rows.at(-1).push(field);
    return rows.filter(row => row.some(cell => cell.trim()));
  }
  function parseCsv(text, mapping = {}, schools = []) {
    const errors = [];
    let rows;
    try { rows = readCsv(text); } catch (error) { return { document: null, errors: [error.message], tournament_id: null }; }
    if (rows.length < 2) return { document: null, errors: ['Choose a CSV with a header and at least one match.'], tournament_id: null };
    if (rows.length > 128) return { document: null, errors: ['Import up to 127 matches.'], tournament_id: null };
    const headers = rows.shift();
    if (new Set(headers.map(key)).size !== headers.length) errors.push('CSV header names must be unique.');
    const indexes = Object.fromEntries(csvHeaders.map(name => {
      const source = Object.hasOwn(mapping, name) ? mapping[name] : name;
      return [name, source ? headers.findIndex(header => key(header) === key(source)) : -1];
    }));
    const records = rows.map(cells => {
      const master = cells[indexes.csv_format] === 'shore-tournament-v1';
      return Object.fromEntries(csvHeaders.map(name => {
        let value = cells[indexes[name]] ?? '';
        if (master && /^'[\s]*[=+@\-\t\r\n']/.test(value)) value = value.slice(1);
        return [name, value];
      }));
    });
    const first = records[0], document = { name: first.name || 'Imported tournament', sport: first.sport || '',
      gender: first.gender || '', level: first.level || '', season: first.season || '', season_year: Number(first.season_year) || new Date().getFullYear(),
      duration_minutes: first.duration_minutes === '' ? 90 : Number(first.duration_minutes),
      turnaround_minutes: first.turnaround_minutes === '' ? 15 : Number(first.turnaround_minutes),
      rest_minutes: first.rest_minutes === '' ? 60 : Number(first.rest_minutes), windows: [], participants: [], matches: [] };
    for (const field of ['windows', 'participants']) {
      if (!first[field]) continue;
      try { document[field] = JSON.parse(first[field]); if (!Array.isArray(document[field])) throw new Error(); }
      catch { errors.push('The ' + field + ' column must contain a JSON list.'); document[field] = []; }
    }
    if (document.windows.some(window => !window || typeof window !== 'object' || Array.isArray(window))) {
      errors.push('Each playing window needs a date, start time, end time and venue. Remove empty or invalid entries.');
      document.windows = document.windows.filter(window => window && typeof window === 'object' && !Array.isArray(window));
    }
    if (document.participants.some(participant => !participant || typeof participant !== 'object' || Array.isArray(participant))) {
      errors.push('Each participant in the JSON list must be an object.');
      document.participants = document.participants.filter(participant => participant && typeof participant === 'object' && !Array.isArray(participant));
    }
    const participants = new Map(document.participants.map(participant => [participant.id, participant]));
    const names = new Map(document.participants.map(participant => [key(participant.name), participant.id]));
    const ids = new Set();
    function slot(record, side, row) {
      const value = field => record[side + '_' + field];
      if (value('winner_of')) {
        if (value('participant_id') || value('name')) errors.push('Row ' + row + ' mixes a winner reference and a named participant.');
        return { winner_of: value('winner_of') };
      }
      let id = value('participant_id') || names.get(key(value('name')));
      if (!id) { let number = participants.size + 1; do { id = 'p' + number++; } while (participants.has(id)); }
      if (!participants.has(id)) {
        if (!value('name')) errors.push('Row ' + row + ' needs a participant name or winner reference for side ' + side + '.');
        const schoolName = value('school_id') || (value('participant_id') ? '' : value('name'));
        const school = identifySchool(schoolName, schools, 'Row ' + row + ', side ' + side, errors, !value('participant_id') && !value('school_id'));
        const participant = { id, name: value('name') || id, school_id: value('school_id') || school?.slug || school?.id || null,
          team_id: value('team_id') || null, seed: value('seed') ? Number(value('seed')) : participants.size + 1 };
        participants.set(id, participant); names.set(key(participant.name), id);
      } else {
        const participant = participants.get(id);
        for (const field of ['name', 'school_id', 'team_id', 'seed']) {
          if (value(field) && String(participant[field] ?? '') !== value(field)) errors.push('Row ' + row + ' has conflicting participant details for ' + id + '.');
        }
      }
      return { participant_id: id };
    }
    records.forEach((record, index) => {
      const row = index + 2, id = record.match_id || 'match-' + (index + 1);
      if (ids.has(id)) errors.push('Row ' + row + ' repeats match ID ' + id + '.');
      ids.add(id);
      for (const field of [...metadata, 'windows', 'participants', 'tournament_id']) {
        if (record[field] && record[field] !== first[field]) errors.push('Row ' + row + ' changes shared tournament ' + field + '.');
      }
      const match = matchDefaults(id, record.round ? Number(record.round) : 1, slot(record, 'a', row), slot(record, 'b', row));
      Object.assign(match, { label: record.label || match.label, game_date: record.game_date || null, start_time: record.start_time || null,
        venue: record.venue || '', home_side: record.home_side || 'neutral', status: record.status || 'Scheduled',
        winner_id: record.winner_id || null, score_a: record.score_a === '' ? null : Number(record.score_a), score_b: record.score_b === '' ? null : Number(record.score_b) });
      document.matches.push(match);
    });
    document.participants = [...participants.values()];
    participantProblems(document.participants).forEach(error => errors.push(error));
    for (const issue of validate(document)) {
      if (issue.match_id && !/unscheduled|Choose a venue|available venue window|Dependency match must finish/.test(issue.message)) errors.push(issue.match_id + ': ' + issue.message);
    }
    // Unscheduled rows are valid import drafts and remain visible for scheduling in the preview.
    return { document, errors: [...new Set(errors)], tournament_id: first.tournament_id || null };
  }
  function exportCsv(document, tournamentId = '') {
    const participants = new Map(document.participants.map(participant => [participant.id, participant]));
    function cell(value) {
      let text = value === null || value === undefined ? '' : String(value);
      if (/^[\s]*[=+@\-\t\r\n']/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    }
    const rows = document.matches.map((match, index) => {
      const record = { csv_format: 'shore-tournament-v1', tournament_id: tournamentId,
        ...Object.fromEntries(metadata.map(field => [field, document[field]])), windows: JSON.stringify(document.windows || []),
        participants: index === 0 ? JSON.stringify(document.participants) : '', match_id: match.id, round: match.round, label: match.label,
        game_date: match.game_date, start_time: match.start_time, venue: match.venue, home_side: match.home_side,
        status: match.status, winner_id: match.winner_id, score_a: match.score_a, score_b: match.score_b };
      for (const side of ['a', 'b']) {
        const slot = match[side] || {}, participant = participants.get(slot.participant_id);
        for (const field of slotFields) record[side + '_' + field] = field === 'participant_id' || field === 'winner_of' ? slot[field] : participant?.[field];
      }
      return csvHeaders.map(header => cell(record[header])).join(',');
    });
    return [csvHeaders.join(','), ...rows].join('\r\n');
  }
  global.TournamentEngine = Object.freeze({ participantsFromText, generateBracket, validate, schedule, resolve, parseCsv, exportCsv, csvHeaders });
})(globalThis);
