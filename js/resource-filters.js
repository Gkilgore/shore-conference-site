// Selects sourced resource records; missing coverage never implies a school has no division.
function selectDivisionLists(lists, filters = {}) {
  return lists.filter(list => (!filters.sport || list.sports.includes(filters.sport)) &&
    (!filters.gender || list.genders.includes(filters.gender)) &&
    (!filters.season || list.season === filters.season) &&
    (!filters.year || String(list.year) === filters.year));
}

function divisionCoverage(list, school) {
  const division = Object.keys(list.divisions || {}).find(name => list.divisions[name].includes(school));
  if (!division) return { state: 'source-only', division: '', members: [] };
  return { state: list.complete ? 'assigned' : 'partial', division,
    members: list.complete ? list.divisions[division] : [] };
}

function selectPublicResources(records, filters = {}) {
  const query = (filters.search || '').trim().toLocaleLowerCase();
  return records.filter(record => ['sport', 'competition', 'year', 'category'].every(key =>
    !filters[key] || String(record[key]) === filters[key]) &&
    (!query || [record.title, record.description, record.category, record.sport, record.competition]
      .join(' ').toLocaleLowerCase().includes(query)));
}
