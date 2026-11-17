// Finds a team's division in the curated official lists and draws it as one line beside the schedule.
// It only names a division when school, sport, team, level and season all point to one.
const allDivisions = 'resources.html#divisions';

// A school year starts July 1. Fall and winter are named by the year they start in, spring by the year it is played.
function seasonYear(season, isoDate) {
  const [year, month] = isoDate.split('-').map(Number);
  const start = month >= 7 ? year : year - 1;
  return season === 'Spring' ? start + 1 : start;
}

function seasonLabel(season, year) {
  return season === 'Winter' ? 'Winter ' + year + '–' + String(year + 1).slice(2) : season + ' ' + year;
}

function schoolSite(slug) {
  const entry = shoreConferenceResources.schoolSites[slug];
  return entry?.status === 'verified' ? { url: entry.url } : null;
}

// Returns { state } plus what that state needs:
// 'all' no sport chosen · 'none' nothing on file · 'choose-team' boys and girls have separate lists ·
// 'not-varsity' a list exists but covers varsity only · 'list' the school is not in the divisions on file ·
// 'assigned' the division, its season label and, when the record is complete, its member schools.
function teamDivision({ school, sport, gender, level, date }) {
  if (!sport) return { state: 'all' };
  const named = /^(Boys|Girls)\s+(.+)$/.exec(sport);
  const sportName = (named ? named[2] : sport).toLowerCase();
  const team = named ? named[1] : gender;
  const sameSport = shoreConferenceResources.divisionLists.filter(list =>
    list.sports.some(name => name.toLowerCase() === sportName));
  const thisYear = sameSport.filter(list => list.year === seasonYear(list.season, date));
  const lists = team ? thisYear.filter(list => list.genders.includes(team)) : thisYear;
  if (!lists.length) {
    const seasons = [...new Set((team ? sameSport.filter(list => list.genders.includes(team)) : sameSport).map(list => list.season))];
    return { state: 'none', sport, label: seasons.length === 1 ? seasonLabel(seasons[0], seasonYear(seasons[0], date)) : '' };
  }
  if (lists.length > 1) return { state: 'choose-team', lists };
  const [list] = lists;
  const label = seasonLabel(list.season, list.year);
  if (level && level !== list.level) return { state: 'not-varsity', list, level, label };
  // An entry such as "brick-township/brick-memorial" places each of its schools in that division.
  const division = Object.keys(list.divisions ?? {}).find(name =>
    list.divisions[name].some(entry => entry.split('/').includes(school)));
  if (!division) return { state: 'list', list, label };
  return { state: 'assigned', list, label, division, level: list.level,
    members: list.complete ? list.divisions[division] : null };
}

// quietWhenAll hides the line until a sport is chosen; the staff Schedule tab uses it to stay compact.
// quietWhenAll hides the box until there is a division to show: no prompt to pick a sport or a team.
function renderTeamInfo(target, selection, { quietWhenAll = false } = {}) {
  const result = teamDivision(selection);
  if (quietWhenAll && ['all', 'choose-team'].includes(result.state)) {
    target.replaceChildren();
    target.hidden = true;
    return;
  }
  const part = (tag, text, className) => {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const link = (text, href) => {
    const anchor = part('a', text);
    anchor.href = href;
    anchor.target = '_blank';
    anchor.rel = 'noopener';
    return anchor;
  };
  const official = list => link('Official division list', list.url);
  const parts = [part('span', 'Division', 'team-info-label')];
  if (result.state === 'assigned') {
    // A breadcrumb into the Information page: all divisions, this sport's divisions, then this division,
    // which opens the sport's division pop-up at this school's group.
    const crumb = (text, href) => {
      const anchor = part('a', text);
      anchor.href = href;
      return anchor;
    };
    const lists = shoreConferenceResources.divisionLists;
    const team = typeof divisionTeamLabel === 'function' ? divisionTeamLabel(result.list, lists) : result.list.sports[0];
    const key = typeof divisionListKey === 'function' ? divisionListKey(result.list) : '';
    const sportPage = key ? 'resources.html?team=' + encodeURIComponent(key) + '#divisions' : allDivisions;
    const trail = part('nav', '', 'team-info-trail');
    trail.setAttribute('aria-label', 'Division');
    trail.append(crumb('Divisions', allDivisions), part('span', '›', 'team-info-sep'),
      crumb(team + ' · ' + result.label, sportPage), part('span', '›', 'team-info-sep'),
      crumb(result.division, key ? 'resources.html?team=' + encodeURIComponent(key) +
        '&division=' + encodeURIComponent(result.division) + '#divisions' : allDivisions));
    if (result.level !== 'Varsity') trail.append(part('span', result.level, 'team-info-level'));
    parts.push(trail);
  } else if (result.state === 'all') {
    parts.push(part('span', 'Choose a sport and team to see its division.'),
      link('All division lists', allDivisions));
  } else if (result.state === 'choose-team') {
    parts.push(part('span', 'Choose a team. Each has its own division list.'),
      ...result.lists.map(list => link(list.title, list.url)));
  } else if (result.state === 'not-varsity') {
    parts.push(part('span', 'None listed for ' + result.level + '. The official list is shown for varsity only.'), official(result.list));
  } else if (result.state === 'list') {
    parts.push(part('span', 'Not on file for this team, ' + result.label + '.'), official(result.list));
  } else {
    parts.push(part('span', 'No division list on file for ' + result.sport + (result.label ? ', ' + result.label : '') + '.'),
      link('All division lists', allDivisions));
  }
  target.replaceChildren(...parts);
  target.hidden = false;
}
