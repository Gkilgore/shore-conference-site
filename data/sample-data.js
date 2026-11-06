// Fictional schools and game entries for the two prototype calendars.
const sampleSchools = {
  'colts-neck': { name: 'Colts Neck', color: '#2f4a29', accent: '#dad8d9',
    venues: ['Colts Neck Courts', 'Colts Neck Field 2', 'Colts Neck Gym'] },
  marlboro: { name: 'Marlboro', color: '#183366', accent: '#ffcc00',
    venues: ['Marlboro Gym', 'Marlboro Turf Field'] },
  'shore-regional': { name: 'Shore Regional', color: '#004990', accent: '#d4e0ec',
    venues: ['Shore Regional East Field', 'Shore Regional Gym', 'Shore Regional Turf Field'] },
};

const sampleGames = [
  // These two games link. The first has a bus time on the away entry only.
  ...sampleMatch('marlboro', 'colts-neck', 'Soccer', 'Girls', 'Varsity',
    '2026-11-09T15:45', 'Marlboro Turf Field', '14:45'),
  ...sampleMatch('shore-regional', 'marlboro', 'Field Hockey', 'Girls', 'JV',
    '2026-11-12T16:00', 'Shore Regional Turf Field', '15:00'),
  // A busy date exercises the month grid's overflow and the full-day schedule.
  ...sampleMatch('colts-neck', 'marlboro', 'Soccer', 'Boys', 'Freshman',
    '2026-11-12T14:30', 'Colts Neck Field 2'),
  ...sampleMatch('marlboro', 'shore-regional', 'Volleyball', 'Girls', 'JV',
    '2026-11-12T15:00', 'Marlboro Gym'),
  ...sampleMatch('shore-regional', 'colts-neck', 'Soccer', 'Girls', 'JV',
    '2026-11-12T15:15', 'Shore Regional East Field'),
  ...sampleMatch('colts-neck', 'shore-regional', 'Tennis', 'Girls', 'Varsity',
    '2026-11-12T15:30', 'Colts Neck Courts'),
  ...sampleMatch('marlboro', 'colts-neck', 'Football', 'Boys', 'Freshman',
    '2026-11-12T16:30', 'Marlboro Turf Field'),
  ...sampleMatch('marlboro', 'shore-regional', 'Volleyball', 'Girls', 'Varsity',
    '2026-11-12T16:30', 'Marlboro Gym'),
  ...sampleMatch('shore-regional', 'colts-neck', 'Field Hockey', 'Girls', 'Varsity',
    '2026-11-12T17:30', 'Shore Regional Turf Field'),
  // These entries stay on their own school calendars because the times differ.
  {
    school: 'colts-neck', opponent: 'shore-regional', home: true,
    sport: 'Soccer', gender: 'Boys', level: 'JV', start: '2026-11-16T15:30',
    location: 'Colts Neck Field 2', status: 'Scheduled',
  },
  {
    school: 'shore-regional', opponent: 'colts-neck', home: false,
    sport: 'Soccer', gender: 'Boys', level: 'JV', start: '2026-11-16T16:00',
    location: 'Colts Neck Field 2', status: 'Scheduled', busTime: '14:50',
  },
];

function sampleMatch(homeSchool, awaySchool, sport, gender, level, start, location, busTime) {
  const game = { sport, gender, level, start, location, status: 'Scheduled' };
  return [
    { ...game, school: homeSchool, opponent: awaySchool, home: true },
    { ...game, school: awaySchool, opponent: homeSchool, home: false, busTime },
  ];
}
