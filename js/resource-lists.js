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
