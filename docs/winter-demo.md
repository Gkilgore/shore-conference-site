# Winter 2026–27 test season

The published test site uses Supabase project `jrtcyihpdrcnhxgproyw`. On November 16, 2026, we added a fictional winter season for Marlboro, Colts Neck, Howell, Manalapan, Freehold Township, and Freehold Boro. No live Supabase project was changed.

The season has ten team programs per school: boys and girls Varsity and JV basketball; boys and girls Varsity wrestling and swimming; Coed Varsity bowling and winter track. Each program plays a ten-game home-and-away round robin among the six schools. Both Varsity basketball programs also have eight games per school against plainly fictional Demo Academy opponents. That makes 116 new school entries per school, 696 total, with 300 matched conference events. Dates run from December 2026 through February 2027, with a break from December 21 through January 3. The December 10 Marlboro–Colts Neck basketball entries were retained.

Every new entry has a `DEMO ONLY:` note and a `DEMO VENUE:` location. The public calendar function puts `[DEMO]` at the start of its title on school calendars, the conference calendar, and `.ics` subscriptions. The two sample postponed/canceled matchups show those statuses. No transportation was added. These fixtures are fictional and must not be treated as official school schedules.

## What changed in the test project

- The `public-calendar` Edge Function was deployed as version 9 before the data was inserted.
- The six schools' `schedule_published` flags are now true. Before this demo, only Colts Neck was true; the other five were false.
- Existing games and team records were kept. The test project already had 13 Marlboro and 11 Colts Neck games. Turning on Marlboro also makes those older published entries visible.
- The generator uses stable IDs and conflict checks so rerunning its SQL does not create duplicate demo games.

## Repeat or verify

Run these commands from the repository root. The SQL command prints the seed transaction; run it only against the named **test** Supabase project.

```text
node tools/winter-demo.mjs
node tools/winter-demo.mjs --sql
node tools/check-winter-demo.mjs https://jrtcyihpdrcnhxgproyw.supabase.co/functions/v1/public-calendar
```

The public verification on November 16 found 116 labeled demo events on each school calendar and 300 on the conference calendar, in both JSON and `.ics`. The conference calendar had 308 events total, including eight preexisting matched events. The six school calendars had 129 Marlboro, 127 Colts Neck, and 116 for each of the other four schools.

## Remove the demo

Run `node tools/winter-demo.mjs --cleanup-sql` against the **test** project. The generated transaction deletes only the deterministic demo game IDs and their publication history and removes any demo-created teams left unused. It preserves the older games and their teams. After checking that no school has since intentionally published its schedule, restore the original publication flags with:

```sql
update public.schools set schedule_published = false
where slug in ('marlboro', 'howell', 'manalapan', 'freehold-township', 'freehold-boro');
```

Colts Neck was already public, so leave its flag true. Redeploy an earlier `public-calendar` version only if the `[DEMO]` title rule is no longer useful; the rule has no effect on games without a `DEMO ONLY:` note.
