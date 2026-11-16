// Shared filter for the History gallery; school-era decades and membership are independent of sport.
function filterHistoryAthletes(athletes, sport = 'all', decade = 'all', membership = 'all') {
  return athletes.filter(athlete =>
    (sport === 'all' || athlete.sports.includes(sport)) &&
    (decade === 'all' || String(athlete.decade) === String(decade)) &&
    (membership === 'all' || athlete.membership === membership));
}
