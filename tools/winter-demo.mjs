// Generates a repeatable, removable fictional Winter 2026–27 season for the test project.
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const schools = [
  ['marlboro', 'Marlboro'],
  ['colts-neck', 'Colts Neck'],
  ['howell', 'Howell'],
  ['manalapan', 'Manalapan'],
  ['freehold-township', 'Freehold Township'],
  ['freehold-boro', 'Freehold Boro'],
];

// Weekdays are offsets from Monday. Later games use a separate time at the same demo venue.
const programs = [
  { sport: 'Basketball', gender: 'Boys', level: 'Varsity', weekday: 4, time: '19:00', venue: 'Gym' },
  { sport: 'Basketball', gender: 'Girls', level: 'Varsity', weekday: 1, time: '19:00', venue: 'Gym' },
  { sport: 'Basketball', gender: 'Boys', level: 'JV', weekday: 4, time: '16:00', venue: 'Gym' },
  { sport: 'Basketball', gender: 'Girls', level: 'JV', weekday: 1, time: '16:00', venue: 'Gym' },
  { sport: 'Wrestling', gender: 'Boys', level: 'Varsity', weekday: 2, time: '19:00', venue: 'Fieldhouse' },
  { sport: 'Wrestling', gender: 'Girls', level: 'Varsity', weekday: 2, time: '16:00', venue: 'Fieldhouse' },
  { sport: 'Swimming', gender: 'Boys', level: 'Varsity', weekday: 1, time: '16:00', venue: 'Pool' },
  { sport: 'Swimming', gender: 'Girls', level: 'Varsity', weekday: 1, time: '19:00', venue: 'Pool' },
  { sport: 'Bowling', gender: 'Coed', level: 'Varsity', weekday: 0, time: '16:00', venue: 'Bowling Center' },
  { sport: 'Winter Track', gender: 'Coed', level: 'Varsity', weekday: 5, time: '10:00', venue: 'Indoor Track' },
];

const note = 'DEMO ONLY: Fictional Winter 2026-27 game for site testing. Not an official school schedule.';
const academyNames = ['North', 'South', 'East', 'West', 'Central', 'Shore', 'Pine', 'River'];
const academyDates = ['2026-12-12', '2026-12-19', '2027-01-09', '2027-01-16',
  '2027-01-23', '2027-01-30', '2027-02-06', '2027-02-13'];

function stableId(value) {
  const bytes = createHash('sha256').update('shore-winter-demo-2026|' + value).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

function programKey(program) {
  return [program.sport, program.gender, program.level].join('|');
}

function leagueDate(round, weekday) {
  // Two empty weeks cover the December school break, from December 21 through January 3.
  const week = round + (round >= 2 ? 2 : 0);
  return new Date(Date.UTC(2026, 11, 7 + week * 7 + weekday)).toISOString().slice(0, 10);
}

function firstLeg() {
  const rounds = [];
  let ring = schools.map(([slug]) => slug);
  for (let round = 0; round < 5; round++) {
    rounds.push(Array.from({ length: 3 }, (_, index) => {
      const left = ring[index], right = ring[5 - index];
      return (round + index) % 2 ? [right, left] : [left, right];
    }));
    ring = [ring[0], ring[5], ...ring.slice(1, 5)];
  }
  return rounds;
}

export function buildWinterDemo() {
  const names = new Map(schools);
  const teams = schools.flatMap(([school_id]) => programs.map(program => ({
    id: stableId('team|' + school_id + '|' + programKey(program)),
    school_id, sport: program.sport, gender: program.gender, level: program.level, season: 'Winter',
  })));
  const games = [];
  const rounds = firstLeg();

  for (const program of programs) {
    const key = programKey(program);
    for (let round = 0; round < 10; round++) {
      for (const [pairIndex, pair] of rounds[round % 5].entries()) {
        const [home, away] = round < 5 ? pair : [...pair].reverse();
        const match_id = [key, round, pairIndex].join('|');
        const status = program.sport === 'Basketball' && program.gender === 'Boys' &&
          program.level === 'Varsity' && round === 4 && pairIndex === 0 ? 'Postponed'
          : program.sport === 'Swimming' && program.gender === 'Girls' && round === 7 &&
            pairIndex === 1 ? 'Canceled' : 'Scheduled';
        const shared = {
          sport: program.sport, gender: program.gender, level: program.level, season: 'Winter',
          game_date: leagueDate(round, program.weekday), start_time: program.time,
          location: 'DEMO VENUE: ' + names.get(home) + ' ' + program.venue,
          status, notes: note, kind: 'league', match_id,
        };
        for (const [school_id, opponent_school_id, home_away] of [
          [home, away, 'Home'], [away, home, 'Away'],
        ]) games.push({ ...shared, id: stableId('game|' + match_id + '|' + school_id),
          school_id, opponent_school_id, opponent_name: null, home_away });
      }
    }
  }

  for (const program of programs.filter(item => item.sport === 'Basketball' && item.level === 'Varsity')) {
    for (const [school_id, name] of schools) {
      for (const [index, game_date] of academyDates.entries()) {
        const opponent_name = 'Demo Academy ' + academyNames[index];
        const home_away = index % 2 ? 'Away' : 'Home';
        games.push({
          id: stableId('nonleague|' + programKey(program) + '|' + school_id + '|' + index),
          school_id, opponent_school_id: null, opponent_name, home_away,
          sport: program.sport, gender: program.gender, level: program.level, season: 'Winter',
          game_date, start_time: program.gender === 'Boys' ? '16:00' : '13:00',
          location: home_away === 'Home' ? 'DEMO VENUE: ' + name + ' Gym' : 'DEMO VENUE: ' + opponent_name + ' Gym',
          status: 'Scheduled', notes: note, kind: 'nonleague', match_id: null,
        });
      }
    }
  }
  return { teams, games };
}

const sqlValue = value => value == null ? 'null' : "'" + String(value).replaceAll("'", "''") + "'";
const tuple = values => '(' + values.map(sqlValue).join(',') + ')';
const ids = rows => rows.map(row => sqlValue(row.id) + '::uuid').join(',');

export function winterDemoSql({ teams, games } = buildWinterDemo()) {
  const teamRows = teams.map(team => tuple([team.id, team.school_id, team.sport, team.gender, team.level, team.season])).join(',\n');
  const gameRows = games.map(game => tuple([game.id, game.school_id, game.sport, game.gender, game.level,
    game.game_date, game.start_time, game.opponent_school_id, game.opponent_name, game.home_away,
    game.location, game.status, game.notes])).join(',\n');
  const gameIds = ids(games);
  return `begin;
insert into public.teams (id,school_id,sport,gender,level,season) values
${teamRows}
on conflict (school_id,sport,gender,level,season) do nothing;
insert into public.games (id,school_id,team_id,game_date,start_time,opponent_school_id,opponent_name,home_away,location,status,notes)
select v.id::uuid,v.school_id,t.id,v.game_date::date,v.start_time::time,v.opponent_school_id,v.opponent_name,v.home_away,v.location,v.status,v.notes
from (values
${gameRows}
) as v(id,school_id,sport,gender,level,game_date,start_time,opponent_school_id,opponent_name,home_away,location,status,notes)
join public.teams t on t.school_id=v.school_id and t.sport=v.sport and t.gender=v.gender and t.level=v.level and t.season='Winter'
on conflict (id) do nothing;
insert into public.published_games (id,school_id,team_id,season_year,payload,revision)
select g.id,g.school_id,g.team_id,2026,shore_private.public_game_payload(g),g.revision from public.games g
where g.id in (${gameIds}) on conflict (id) do nothing;
insert into public.team_publications (school_id,team_id,season_year)
select distinct g.school_id,g.team_id,2026 from public.games g where g.id in (${gameIds})
on conflict (school_id,team_id,season_year) do nothing;
update public.schools set schedule_published=true
where slug in ('marlboro','colts-neck','howell','manalapan','freehold-township','freehold-boro');
do $$ begin
  if (select count(*) from public.games where id in (${gameIds})) <> 696 then
    raise exception 'Winter demo did not insert all 696 game entries';
  end if;
end $$;
commit;
select school_id,count(*) as demo_games from public.games where id in (${gameIds}) group by school_id order by school_id;`;
}

export function winterDemoCleanupSql({ teams, games } = buildWinterDemo()) {
  const gameIds = ids(games), teamIds = ids(teams);
  return `begin;
delete from public.published_games where id in (${gameIds});
delete from public.games where id in (${gameIds});
delete from public.team_publications p where p.team_id in (${teamIds}) and p.season_year=2026
  and not exists (select 1 from public.published_games g where g.team_id=p.team_id and g.season_year=2026);
delete from public.publication_updates where game_id in (${gameIds}) or team_id in (${teamIds});
delete from public.teams t where t.id in (${teamIds})
  and not exists (select 1 from public.games g where g.team_id=t.id)
  and not exists (select 1 from public.team_publications p where p.team_id=t.id);
commit;
select count(*) as remaining_demo_games from public.games where id in (${gameIds});`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const data = buildWinterDemo();
  if (process.argv.includes('--sql')) process.stdout.write(winterDemoSql(data));
  else if (process.argv.includes('--cleanup-sql')) process.stdout.write(winterDemoCleanupSql(data));
  else process.stdout.write(JSON.stringify({ schools: schools.length, teams: data.teams.length,
    game_entries: data.games.length, league_events: data.games.filter(game => game.kind === 'league').length / 2,
    nonleague_games: data.games.filter(game => game.kind === 'nonleague').length }, null, 2) + '\n');
}
