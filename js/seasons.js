// Groups sports into New Jersey's fall, winter, and spring seasons for every calendar and dashboard filter.
const seasonOrder = ['Fall', 'Winter', 'Spring', 'Other'];
const sportSeasons = {
  Fall: ['Cross Country', 'Field Hockey', 'Football', 'Soccer', 'Girls Tennis', 'Girls Volleyball', 'Cheerleading'],
  Winter: ['Basketball', 'Bowling', 'Fencing', 'Gymnastics', 'Ice Hockey', 'Swimming', 'Winter Track', 'Wrestling'],
  Spring: ['Baseball', 'Golf', 'Lacrosse', 'Softball', 'Boys Tennis', 'Boys Volleyball', 'Spring Track', 'Track'],
};

// Tennis and volleyball change season by gender, so check "Girls Tennis" before "Tennis".
function seasonOf(sport, gender) {
  for (const season of ['Fall', 'Winter', 'Spring']) {
    const names = sportSeasons[season];
    if (names.includes((gender ?? '') + ' ' + sport) || names.includes(sport)) return season;
  }
  return 'Other';
}

function currentSeason(date = new Date()) {
  const month = date.getMonth();
  return month >= 7 && month <= 10 ? 'Fall' : month === 11 || month <= 1 ? 'Winter' : 'Spring';
}

// Fills a season select and a sport select whose options are grouped by season.
// Choosing a season narrows the sport list to that season.
function fillSeasonFilters(seasonSelect, sportSelect, games) {
  const seasons = seasonOrder.filter(season => games.some(game => game.season === season));
  const keep = seasonSelect.value;
  seasonSelect.replaceChildren(new Option('All seasons', ''), ...seasons.map(season => new Option(season, season)));
  seasonSelect.value = seasons.includes(keep) ? keep : '';
  fillSportOptions(seasonSelect, sportSelect, games);
}

function fillSportOptions(seasonSelect, sportSelect, games) {
  const keep = sportSelect.value;
  const chosen = seasonSelect.value;
  const groups = seasonOrder.filter(season => !chosen || season === chosen).map(season => {
    const sports = [...new Set(games.filter(game => game.season === season).map(game => game.sport))].sort();
    if (!sports.length) return null;
    const group = document.createElement('optgroup');
    group.label = season;
    group.append(...sports.map(sport => new Option(sport, sport)));
    return group;
  }).filter(Boolean);
  sportSelect.replaceChildren(new Option(chosen ? 'All ' + chosen.toLowerCase() + ' sports' : 'All sports', ''), ...groups);
  sportSelect.value = [...sportSelect.options].some(option => option.value === keep) ? keep : '';
}
