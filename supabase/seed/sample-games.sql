-- Loads the prototype's sample games into the TEST Supabase project so each test AD has games to edit.
-- Generated from data/sample-data.js; dates count from the day you run it.
--
-- TEST PROJECT ONLY. Never run this on the live project. It first DELETES every game (and its
-- transportation) for Colts Neck, Marlboro and Shore Regional, plus their sample coaches.
--
-- Run it in the Supabase SQL editor of the test project after the migrations. Coach fixtures load only
-- when those optional tables exist. The legacy bus-confirmation field is not used.

begin;

delete from public.games where school_id in ('colts-neck', 'marlboro', 'shore-regional');

create temporary table sample_games (
  school_id text, sport text, gender text, level text, season text, day int, start_time time,
  home_away text, opponent_school_id text, opponent_name text, location text, status text, notes text,
  bus_departure time, pickup_location text, return_time time, transport_notes text
) on commit drop;

insert into sample_games values
  ('colts-neck', 'Soccer', 'Girls', 'JV', 'Fall', -3, '15:45', 'Home', 'marlboro', null, 'Colts Neck Field 2', 'Scheduled', null, null, null, null, null),
  ('marlboro', 'Soccer', 'Girls', 'JV', 'Fall', -3, '15:45', 'Away', 'colts-neck', null, 'Colts Neck Field 2', 'Scheduled', null, '14:30', 'Gym lot', '18:00', null),
  ('marlboro', 'Soccer', 'Girls', 'Varsity', 'Fall', 3, '15:45', 'Home', 'colts-neck', null, 'Marlboro Turf Field', 'Scheduled', 'Senior night. Players arrive by 3:00 PM.', null, null, null, null),
  ('colts-neck', 'Soccer', 'Girls', 'Varsity', 'Fall', 3, '15:45', 'Away', 'marlboro', null, 'Marlboro Turf Field', 'Scheduled', null, '14:30', 'Front loop', '18:30', null),
  ('colts-neck', 'Tennis', 'Girls', 'JV', 'Fall', 4, '15:30', 'Home', 'marlboro', null, 'Colts Neck Courts', 'Postponed', 'Postponed for rain. New date to come.', null, null, null, null),
  ('marlboro', 'Tennis', 'Girls', 'JV', 'Fall', 4, '15:30', 'Away', 'colts-neck', null, 'Colts Neck Courts', 'Postponed', null, null, null, null, null),
  ('marlboro', 'Soccer', 'Boys', 'Varsity', 'Fall', 5, '16:00', 'Away', null, 'Freehold Township', 'Freehold Township High School', 'Scheduled', null, '14:45', 'Front loop', '18:45', null),
  ('colts-neck', 'Soccer', 'Boys', 'Freshman', 'Fall', 6, '14:30', 'Home', 'marlboro', null, 'Colts Neck Field 2', 'Scheduled', null, null, null, null, null),
  ('marlboro', 'Soccer', 'Boys', 'Freshman', 'Fall', 6, '14:30', 'Away', 'colts-neck', null, 'Colts Neck Field 2', 'Scheduled', null, '13:30', 'Gym lot', '17:00', null),
  ('marlboro', 'Volleyball', 'Girls', 'JV', 'Fall', 6, '15:00', 'Home', 'shore-regional', null, 'Marlboro Gym', 'Scheduled', null, null, null, null, null),
  ('shore-regional', 'Volleyball', 'Girls', 'JV', 'Fall', 6, '15:00', 'Away', 'marlboro', null, 'Marlboro Gym', 'Scheduled', null, null, null, null, null),
  ('colts-neck', 'Tennis', 'Girls', 'Varsity', 'Fall', 6, '15:30', 'Home', 'shore-regional', null, 'Colts Neck Courts', 'Scheduled', null, null, null, null, null),
  ('shore-regional', 'Tennis', 'Girls', 'Varsity', 'Fall', 6, '15:30', 'Away', 'colts-neck', null, 'Colts Neck Courts', 'Scheduled', null, '14:30', 'Main lot', '18:00', null),
  ('shore-regional', 'Field Hockey', 'Girls', 'JV', 'Fall', 6, '16:00', 'Home', 'marlboro', null, 'Shore Regional Turf Field', 'Scheduled', null, null, null, null, null),
  ('marlboro', 'Field Hockey', 'Girls', 'JV', 'Fall', 6, '16:00', 'Away', 'shore-regional', null, 'Shore Regional Turf Field', 'Scheduled', null, '15:00', 'Gym lot', '18:15', null),
  ('marlboro', 'Football', 'Boys', 'Freshman', 'Fall', 6, '16:30', 'Home', 'colts-neck', null, 'Marlboro Turf Field', 'Scheduled', null, null, null, null, null),
  ('colts-neck', 'Football', 'Boys', 'Freshman', 'Fall', 6, '16:30', 'Away', 'marlboro', null, 'Marlboro Turf Field', 'Scheduled', null, null, null, null, null),
  ('marlboro', 'Volleyball', 'Girls', 'Varsity', 'Fall', 6, '16:30', 'Home', 'shore-regional', null, 'Marlboro Gym', 'Scheduled', null, null, null, null, null),
  ('shore-regional', 'Volleyball', 'Girls', 'Varsity', 'Fall', 6, '16:30', 'Away', 'marlboro', null, 'Marlboro Gym', 'Scheduled', null, '15:30', 'Main lot', '19:00', null),
  ('shore-regional', 'Field Hockey', 'Girls', 'Varsity', 'Fall', 6, '17:30', 'Home', 'colts-neck', null, 'Shore Regional Turf Field', 'Scheduled', null, null, null, null, null),
  ('colts-neck', 'Field Hockey', 'Girls', 'Varsity', 'Fall', 6, '17:30', 'Away', 'shore-regional', null, 'Shore Regional Turf Field', 'Scheduled', null, '16:30', 'Front loop', '20:00', null),
  ('marlboro', 'Football', 'Boys', 'Varsity', 'Fall', 8, '18:00', 'Home', 'shore-regional', null, 'Marlboro Turf Field', 'Scheduled', 'Homecoming game.', null, null, null, null),
  ('shore-regional', 'Football', 'Boys', 'Varsity', 'Fall', 8, '18:00', 'Away', 'marlboro', null, 'Marlboro High School Stadium', 'Scheduled', null, '16:15', 'Main lot', '21:30', null),
  ('shore-regional', 'Soccer', 'Girls', 'Varsity', 'Fall', 9, '15:15', 'Home', 'colts-neck', null, 'Shore Regional East Field', 'Scheduled', null, null, null, null, null),
  ('colts-neck', 'Soccer', 'Girls', 'Varsity', 'Fall', 9, '15:15', 'Away', 'shore-regional', null, 'Shore Regional East Field', 'Scheduled', null, '14:15', 'Front loop', '18:00', null),
  ('colts-neck', 'Soccer', 'Boys', 'JV', 'Fall', 10, '15:30', 'Home', 'shore-regional', null, 'Colts Neck Field 2', 'Scheduled', null, null, null, null, null),
  ('shore-regional', 'Soccer', 'Boys', 'JV', 'Fall', 10, '16:00', 'Away', 'colts-neck', null, 'Colts Neck Field 2', 'Scheduled', null, '14:50', 'Main lot', '18:30', null),
  ('marlboro', 'Soccer', 'Boys', 'Varsity', 'Fall', 11, '16:00', 'Home', 'shore-regional', null, 'Marlboro Turf Field', 'Canceled', 'Canceled: field closed.', null, null, null, null),
  ('shore-regional', 'Soccer', 'Boys', 'Varsity', 'Fall', 11, '16:00', 'Away', 'marlboro', null, 'Marlboro Turf Field', 'Canceled', null, null, null, null, null),
  ('colts-neck', 'Field Hockey', 'Girls', 'JV', 'Fall', 12, '16:00', 'Home', null, 'Red Bank Catholic', 'Colts Neck Field 2', 'Scheduled', null, null, null, null, null),
  ('marlboro', 'Soccer', 'Girls', 'JV', 'Fall', 13, '15:45', 'Away', 'shore-regional', null, 'Shore Regional Turf Field', 'Scheduled', null, null, null, null, null),
  ('colts-neck', 'Basketball', 'Boys', 'Varsity', 'Winter', 34, '19:00', 'Home', 'marlboro', null, 'Colts Neck Gym', 'Scheduled', null, null, null, null, null),
  ('marlboro', 'Basketball', 'Boys', 'Varsity', 'Winter', 34, '19:00', 'Away', 'colts-neck', null, 'Colts Neck Gym', 'Scheduled', null, '17:45', 'Front loop', '21:30', null);

insert into public.teams (school_id, sport, gender, level, season)
select distinct school_id, sport, gender, level, season from sample_games
on conflict (school_id, sport, gender, level, season) do nothing;

insert into public.games (school_id, team_id, game_date, start_time, opponent_school_id, opponent_name,
  home_away, location, status, notes)
select s.school_id, t.id, current_date + s.day, s.start_time, s.opponent_school_id, s.opponent_name,
  s.home_away, s.location, s.status, s.notes
from sample_games s
join public.teams t on t.school_id = s.school_id and t.sport = s.sport and t.gender = s.gender
  and t.level = s.level and t.season = s.season;

insert into public.transportation (game_id, bus_departure, pickup_location, return_time, notes)
select g.id, s.bus_departure, s.pickup_location, s.return_time, s.transport_notes
from sample_games s
join public.teams t on t.school_id = s.school_id and t.sport = s.sport and t.gender = s.gender
  and t.level = s.level and t.season = s.season
join public.games g on g.team_id = t.id and g.game_date = current_date + s.day and g.start_time = s.start_time
where s.bus_departure is not null;

-- Newer draft migrations: fill them in only when they are installed.
do $seed$
begin
  if to_regclass('public.coaches') is not null then
    execute $q$
      delete from public.coaches where school_id in ('colts-neck', 'marlboro', 'shore-regional');
      insert into public.coaches (school_id, name, email) values
        ('marlboro', 'Pat Rivera', 'privera@marlboro.example.org'),
        ('marlboro', 'Sam Lee', 'slee@marlboro.example.org'),
        ('marlboro', 'Chris Doe', 'cdoe@marlboro.example.org'),
        ('marlboro', 'Jordan Park', 'jpark@marlboro.example.org'),
        ('colts-neck', 'Alex Kim', 'akim@coltsneck.example.org'),
        ('colts-neck', 'Morgan Diaz', 'mdiaz@coltsneck.example.org'),
        ('shore-regional', 'Casey Moore', 'cmoore@shoreregional.example.org');
      insert into public.coach_teams (coach_id, sport, gender, level)
      select c.id, v.sport, v.gender, v.level
      from (values
        ('privera@marlboro.example.org', 'Soccer', 'Girls', 'Varsity'),
        ('privera@marlboro.example.org', 'Soccer', 'Girls', 'JV'),
        ('slee@marlboro.example.org', 'Soccer', 'Girls', 'JV'),
        ('cdoe@marlboro.example.org', 'Soccer', 'Boys', 'Varsity'),
        ('jpark@marlboro.example.org', 'Football', 'Boys', 'Varsity'),
        ('jpark@marlboro.example.org', 'Football', 'Boys', 'Freshman'),
        ('akim@coltsneck.example.org', 'Soccer', 'Girls', 'Varsity'),
        ('mdiaz@coltsneck.example.org', 'Basketball', 'Boys', 'Varsity'),
        ('cmoore@shoreregional.example.org', 'Volleyball', 'Girls', 'Varsity'),
        ('cmoore@shoreregional.example.org', 'Volleyball', 'Girls', 'JV')
      ) as v(email, sport, gender, level)
      join public.coaches c on c.email = v.email;
    $q$;
  end if;

  -- A few waiting emails so the Coaches tab outbox has something to preview.
  if to_regclass('public.coach_email_outbox') is not null then
    execute $q$
      with game_for as (
        select g.id, g.school_id, t.sport, t.gender, t.level, g.game_date - current_date as day
        from public.games g join public.teams t on t.id = g.team_id
      ), coach as (select id, email, school_id from public.coaches), batch as (select gen_random_uuid() as id)
      insert into public.coach_email_outbox (school_id, coach_id, kind, game_id, batch_id, previous)
      select 'marlboro', (select id from coach where email = 'privera@marlboro.example.org'), 'changed',
        (select id from game_for where school_id = 'marlboro' and sport = 'Soccer' and gender = 'Girls' and level = 'Varsity' and day = 3),
        null::uuid, jsonb_build_object('game_date', current_date + 3, 'start_time', '15:00:00', 'location', 'Marlboro Turf Field',
          'home_away', 'Home', 'status', 'Scheduled')
      union all
      select 'marlboro', (select id from coach where email = 'cdoe@marlboro.example.org'), 'canceled',
        (select id from game_for where school_id = 'marlboro' and sport = 'Soccer' and gender = 'Boys' and level = 'Varsity' and day = 11),
        null::uuid, jsonb_build_object('game_date', current_date + 11, 'start_time', '16:00:00', 'location', 'Marlboro Turf Field',
          'home_away', 'Home', 'status', 'Scheduled')
      union all
      select 'marlboro', (select id from coach where email = 'slee@marlboro.example.org'), 'scheduled', g.id, (select id from batch), null::jsonb
      from game_for g where g.school_id = 'marlboro' and g.sport = 'Soccer' and g.gender = 'Girls' and g.level = 'JV' and g.day >= 0;
      insert into public.coach_email_outbox (school_id, coach_id, kind)
      select 'marlboro', id, 'welcome' from public.coaches where email = 'jpark@marlboro.example.org';
    $q$;
  end if;
end;
$seed$;

commit;

-- Quick check: games per school.
select school_id, count(*) as games from public.games
where school_id in ('colts-neck', 'marlboro', 'shore-regional') group by school_id order by school_id;
