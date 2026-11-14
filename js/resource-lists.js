// Groups and labels the division lists for the Resources page. No page access, so tests can run it.
function seasonLabel(list) {
  return list.season === 'Winter' ? 'Winter ' + list.year + '–' + String(list.year + 1).slice(2) : list.season + ' ' + list.year;
}

// "Boys Soccer" when a sport has more than one list, plain "Football" when it has one.
function divisionTeamLabel(list, lists) {
  const sport = list.sports[0];
  const shared = lists.filter(other => other.sports[0] === sport).length > 1;
  return shared && list.genders.length === 1 ? list.genders[0] + ' ' + sport : sport;
}

// One group per season and year, in the order the lists are recorded.
function divisionGroups(lists) {
  const groups = [];
  for (const list of lists) {
    const label = seasonLabel(list);
    let group = groups.find(item => item.label === label);
    if (!group) groups.push(group = { label, teams: [] });
    group.teams.push({ label: divisionTeamLabel(list, lists), list });
  }
  return groups;
}

// Everything the division pop-up shows for one list: each division with every school in it, in the
// list's own order. A member that is a directory slug gets that school's name and page; anything else
// (a combined team, a name the list leaves ambiguous) is shown exactly as printed, with no link.
function divisionBreakdown(list, schools) {
  const entries = Object.entries(list.divisions || {});
  const divisions = entries.map(([name, members]) => ({
    name,
    members: list.complete ? members.map(member => Object.hasOwn(schools, member)
      ? { slug: member, name: schools[member].name } : { slug: null, name: member }) : null,
  }));
  const teams = list.complete ? entries.reduce((total, [, members]) => total + members.length, 0) : 0;
  let summary;
  if (!entries.length) summary = 'Divisions are not copied here yet. The saved list has them all.';
  else if (!list.complete) summary = 'Division names only. The saved list has the schools.';
  else if (!list.allDivisions) summary = 'Only some divisions are copied here. The saved list has them all.';
  else summary = 'All ' + entries.length + (entries.length === 1 ? ' division, ' : ' divisions, ') + teams + ' teams.';
  return { divisions, summary, notes: list.notes || [], reviewed: list.reviewed };
}
