// Formats team labels and before/after changes for the AD's publication review.
function publicationTeamLabel(group) {
  const year = group.season === 'Winter' ? group.season_year + '–' + String(group.season_year + 1).slice(-2) : group.season_year;
  return [group.gender,group.level,group.sport].join(' ') + ' · ' + group.season + ' ' + year;
}

function publicationTime(value) {
  if (!value) return 'Not entered';
  const [hour,minute] = value.split(':');
  return (Number(hour)%12 || 12) + ':' + minute + (Number(hour)<12 ? ' AM' : ' PM');
}

function publicationDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return value || 'Not entered';
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(value + 'T12:00:00Z'));
}

function publicationChanges(entry, schoolNames = {}) {
  if (!entry.published) return ['New game'];
  if (!entry.draft) return ['Remove from the public calendar'];
  const before = entry.published, after = entry.draft;
  const opponent = game => schoolNames[game.opponent_school_id] ?? game.opponent_school_id ?? game.opponent_name ?? '';
  const fields = [
    ['Date', game=>publicationDate(game.game_date)], ['Start time', game=>game.start_time ? publicationTime(game.start_time) : 'TBD'],
    ['Opponent', opponent], ['Home or away', game=>game.home_away], ['Venue', game=>game.location],
    ['Status', game=>game.status], ['Game notes', game=>game.notes],
    ['Sport', game=>game.teams?.sport], ['Team', game=>game.teams?.gender],
    ['Level', game=>game.teams?.level], ['Season', game=>game.teams?.season],
    ['Bus departure', game=>publicationTime(game.transportation?.bus_departure)],
    ['Pickup', game=>game.transportation?.pickup_location],
    ['Return time', game=>publicationTime(game.transportation?.return_time)],
  ];
  if (Boolean(before.opponent_school_id) !== Boolean(after.opponent_school_id)) {
    fields.push(['Conference matching', game => game.opponent_school_id ? 'Member-school opponent' : 'Non-conference opponent']);
  }
  return fields.flatMap(([label,read]) => {
    const was = read(before) || 'Not entered', now = read(after) || 'Not entered';
    return was === now ? [] : [label + ': ' + was + ' → ' + now];
  });
}
