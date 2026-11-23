# Schedule import formats

The Import games screen reads CSV files in more than one layout. Each layout is an entry in the `importFormats` list at the top of `js/staff-import.js`.

## What the importer looks for

Every file needs six pieces of game information: **date, start time, sport, home or away, opponent, and location**. The importer finds the row that names all six, even if title lines sit above it, and ignores any other columns.

It also cleans up common export quirks:

- Time zones after a time ("2:30 PM EST") are dropped.
- A repeated opponent ("vs Manalapan  vs Manalapan") becomes one name.
- An event title after a spaced slash ("vs Saint Rose / Senior Night") becomes the game note.
- Gender and level written into the sport ("BOYS VARSITY BASKETBALL", "Boys and Girls VARSITY SWIMMING") fill in the team when no team is picked. "Boys and Girls" means Coed.

## Formats it knows

| Format | Column names it reads |
| --- | --- |
| Shore Conference template | date, start_time, sport, home_away, opponent, location, plus optional transportation and notes columns |
| Sports Schedule Report export | Start Date, Start Time, Sport, H/A, Opponents/Title, Facility (Number and Type are ignored) |

## Teaching it a new format

When an AD sends a file the importer rejects, the error lists the missing pieces, for example "missing columns: date, location". Open the file, note what it calls those columns, and add an entry to `importFormats`:

```js
{ name: 'Example district export', columns: {
  'game day': 'date', 'time of game': 'start_time', 'site': 'location',
} },
```

Write each column name in lowercase, exactly as the file spells it. The fields you can map to are `date`, `start_time`, `sport`, `home_away`, `opponent`, `location`, `bus_departure`, `pickup_location`, `early_dismissal_time`, `return_time`, `transport_notes` and `notes`. Add a test in `tests/schedule-import.test.mjs` with a few made-up rows in the new layout.
