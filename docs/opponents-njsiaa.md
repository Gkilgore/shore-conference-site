# Opponent search and saved schools

An athletic director types an opponent's name in the game editor. Results appear in this order: Shore Conference, that school's saved schools, then NJSIAA schools. The school's own name is omitted. Selecting a Shore Conference school keeps its schedule identity for conference matching. Selecting another school saves its name with the game. For an away game, the selected school's address fills an empty Venue field.

The last search option adds a school. The athletic director can enter its name and optional address, then save it to that school's private list. The **Saved schools** tab shows only that list and lets the athletic director rename or delete those schools. Deleting a saved school leaves the name on games already saved. A site admin using **View as** sees the selected school's list.

The database's `opponent_directory` table holds three kinds of school: `conference`, `njsiaa`, and school-owned `custom`. Anonymous visitors and signed-in users can read the first two. Database access rules allow an AD to read only their school's saved rows, and the save, rename, and delete functions check the signed-in invitation. The old `school_opponents` table remains for history but the app does not use it.

## Quarterly NJSIAA refresh

1. Run `node tools/update-njsiaa-schools.mjs` from the repo. It reads the [NJSIAA member information pages](https://www.njsiaa.org/schools/member-information) and writes `data/njsiaa-schools.json` plus `data/njsiaa-import.json`. The script is run by hand, not during a site build.
2. Review the changed names and addresses. Each import row has a lowercase hyphenated slug, name, and address.
3. A site admin imports `data/njsiaa-import.json` using `import_opponent_directory` in the **test** Supabase project, then checks the search results. This function updates only NJSIAA rows; it cannot change conference or school-owned rows.
4. Greg handles any live project update after test checks pass.

The November 17, 2026 refresh found 452 schools. The initial roster is embedded in `20261206000100_private_opponents.sql` so a new database receives the same starting names and addresses. Future quarterly refreshes use the import function.
