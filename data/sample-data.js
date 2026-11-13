// Fictional schools and games for the prototype, in the same shape an AD saves in the game editor.
// Dates count from today so the demo never goes stale. supabase/seed/sample-games.sql loads the
// same games into the test database; keep the two in step.
const sampleSchools = {
  'colts-neck': { name: 'Colts Neck', color: '#2f4a29', accent: '#dad8d9',
    venues: ['Colts Neck Courts', 'Colts Neck Field 2', 'Colts Neck Gym'] },
  marlboro: { name: 'Marlboro', color: '#183366', accent: '#ffcc00',
    venues: ['Marlboro Gym', 'Marlboro Turf Field'] },
  'shore-regional': { name: 'Shore Regional', color: '#004990', accent: '#d4e0ec',
    venues: ['Shore Regional East Field', 'Shore Regional Gym', 'Shore Regional Turf Field'] },
};

function sampleDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0');
}

function sampleBus(departure, pickup, back, notes = null) {
  return { bus_departure: departure, pickup_location: pickup, return_time: back, notes };
}

// One school's saved entry. The opponent is a school slug or, for non-member schools, a name.
function sampleEntry({ school, opponent, homeAway, day, time, status = 'Scheduled', notes = null, bus = null, ...team }) {
  const member = Object.hasOwn(sampleSchools, opponent);
  return {
    school, ...team, game_date: sampleDate(day), start_time: time, home_away: homeAway,
    opponent_school_id: member ? opponent : null, opponent_name: member ? null : opponent,
    location: team.location, status, notes, transportation: bus,
  };
}

// Both schools' entries for one game. awayChanges makes the away entry differ, so it doesn't link.
function sampleMatch({ home, away, homeNotes = null, awayBus = null, awayChanges = {}, ...game }) {
  return [
    sampleEntry({ ...game, school: home, opponent: away, homeAway: 'Home', notes: homeNotes }),
    { ...sampleEntry({ ...game, school: away, opponent: home, homeAway: 'Away', bus: awayBus }), ...awayChanges },
  ];
}

const sampleGames = [
  // Last week, linked: shows a past game.
  ...sampleMatch({ home: 'colts-neck', away: 'marlboro', sport: 'Soccer', gender: 'Girls', level: 'JV', season: 'Fall',
    day: -3, time: '15:45', location: 'Colts Neck Field 2', awayBus: sampleBus('14:30', 'Gym lot', '18:00') }),
  // Linked, with game notes and a scheduled bus.
  ...sampleMatch({ home: 'marlboro', away: 'colts-neck', sport: 'Soccer', gender: 'Girls', level: 'Varsity', season: 'Fall',
    day: 3, time: '15:45', location: 'Marlboro Turf Field', homeNotes: 'Senior night. Players arrive by 3:00 PM.',
    awayBus: sampleBus('14:30', 'Front loop', '18:30') }),
  // Postponed by both schools.
  ...sampleMatch({ home: 'colts-neck', away: 'marlboro', sport: 'Tennis', gender: 'Girls', level: 'JV', season: 'Fall',
    day: 4, time: '15:30', location: 'Colts Neck Courts', status: 'Postponed', homeNotes: 'Postponed for rain. New date to come.' }),
  // Against a school outside the conference: never links, bus not confirmed yet.
  sampleEntry({ school: 'marlboro', opponent: 'Freehold Township', homeAway: 'Away', sport: 'Soccer', gender: 'Boys',
    level: 'Varsity', season: 'Fall', day: 5, time: '16:00', location: 'Freehold Township High School',
    bus: sampleBus('14:45', 'Front loop', '18:45') }),
  // A busy day: fills the month grid and shows "+ more".
  ...sampleMatch({ home: 'colts-neck', away: 'marlboro', sport: 'Soccer', gender: 'Boys', level: 'Freshman', season: 'Fall',
    day: 6, time: '14:30', location: 'Colts Neck Field 2', awayBus: sampleBus('13:30', 'Gym lot', '17:00') }),
  ...sampleMatch({ home: 'marlboro', away: 'shore-regional', sport: 'Volleyball', gender: 'Girls', level: 'JV', season: 'Fall',
    day: 6, time: '15:00', location: 'Marlboro Gym' }),
  ...sampleMatch({ home: 'colts-neck', away: 'shore-regional', sport: 'Tennis', gender: 'Girls', level: 'Varsity', season: 'Fall',
    day: 6, time: '15:30', location: 'Colts Neck Courts', awayBus: sampleBus('14:30', 'Main lot', '18:00') }),
  ...sampleMatch({ home: 'shore-regional', away: 'marlboro', sport: 'Field Hockey', gender: 'Girls', level: 'JV', season: 'Fall',
    day: 6, time: '16:00', location: 'Shore Regional Turf Field', awayBus: sampleBus('15:00', 'Gym lot', '18:15') }),
  ...sampleMatch({ home: 'marlboro', away: 'colts-neck', sport: 'Football', gender: 'Boys', level: 'Freshman', season: 'Fall',
    day: 6, time: '16:30', location: 'Marlboro Turf Field' }),
  ...sampleMatch({ home: 'marlboro', away: 'shore-regional', sport: 'Volleyball', gender: 'Girls', level: 'Varsity', season: 'Fall',
    day: 6, time: '16:30', location: 'Marlboro Gym', awayBus: sampleBus('15:30', 'Main lot', '19:00') }),
  ...sampleMatch({ home: 'shore-regional', away: 'colts-neck', sport: 'Field Hockey', gender: 'Girls', level: 'Varsity', season: 'Fall',
    day: 6, time: '17:30', location: 'Shore Regional Turf Field', awayBus: sampleBus('16:30', 'Front loop', '20:00') }),
  // Not linked: the schools entered different locations.
  ...sampleMatch({ home: 'marlboro', away: 'shore-regional', sport: 'Football', gender: 'Boys', level: 'Varsity', season: 'Fall',
    day: 8, time: '18:00', location: 'Marlboro Turf Field', homeNotes: 'Homecoming game.',
    awayChanges: { location: 'Marlboro High School Stadium' }, awayBus: sampleBus('16:15', 'Main lot', '21:30') }),
  // Linked, with a scheduled bus.
  ...sampleMatch({ home: 'shore-regional', away: 'colts-neck', sport: 'Soccer', gender: 'Girls', level: 'Varsity', season: 'Fall',
    day: 9, time: '15:15', location: 'Shore Regional East Field', awayBus: sampleBus('14:15', 'Front loop', '18:00') }),
  // Not linked: the schools entered different start times.
  ...sampleMatch({ home: 'colts-neck', away: 'shore-regional', sport: 'Soccer', gender: 'Boys', level: 'JV', season: 'Fall',
    day: 10, time: '15:30', location: 'Colts Neck Field 2', awayChanges: { start_time: '16:00' },
    awayBus: sampleBus('14:50', 'Main lot', '18:30') }),
  // Canceled by both schools.
  ...sampleMatch({ home: 'marlboro', away: 'shore-regional', sport: 'Soccer', gender: 'Boys', level: 'Varsity', season: 'Fall',
    day: 11, time: '16:00', location: 'Marlboro Turf Field', status: 'Canceled', homeNotes: 'Canceled: field closed.' }),
  // Home game against a school outside the conference.
  sampleEntry({ school: 'colts-neck', opponent: 'Red Bank Catholic', homeAway: 'Home', sport: 'Field Hockey', gender: 'Girls',
    level: 'JV', season: 'Fall', day: 12, time: '16:00', location: 'Colts Neck Field 2' }),
  // Not linked: Shore Regional hasn't entered this game. No bus entered yet.
  sampleEntry({ school: 'marlboro', opponent: 'shore-regional', homeAway: 'Away', sport: 'Soccer', gender: 'Girls',
    level: 'JV', season: 'Fall', day: 13, time: '15:45', location: 'Shore Regional Turf Field' }),
  // Winter season.
  ...sampleMatch({ home: 'colts-neck', away: 'marlboro', sport: 'Basketball', gender: 'Boys', level: 'Varsity', season: 'Winter',
    day: 34, time: '19:00', location: 'Colts Neck Gym', awayBus: sampleBus('17:45', 'Front loop', '21:30') }),
];
