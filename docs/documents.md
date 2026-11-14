# Documents, the viewer and the archive

How saved PDFs are shown, how to add new ones, and how older editions are kept. Greg does the adding; the conference office fills in a sheet.

## What visitors see

- A link to a saved PDF opens [document.html](../document.html) (`document.html?file=name.pdf`). The page shows the file on wide screens, with **Download** and **Open in new tab**. Phones get the two buttons, because a phone shows only the first page of a PDF placed inside a page. A division list also shows its schools as text: an entry that names two schools shows both ("Brick Township / Brick Memorial"), and the swimming file shows the boys' and girls' lists under their own titles.
- `js/document-links.js` sends the links there. Any page that links to a file in `assets/documents/` loads it. With JavaScript off, links open the PDF itself.
- The Information page has an **Archive** tab: every saved file, by school year. The Documents and Tournaments tabs show only the newest edition of each file.

## Adding new files

1. Send the office [templates/documents.csv](../templates/documents.csv). It opens in Excel or Google Sheets. One row per PDF.
2. Put the PDFs they send back in one folder. File names may use letters, numbers, dots, dashes and underscores.
3. Check the sheet. This changes nothing:

   ```bash
   node tools/import-documents.mjs sheet.csv folder-with-pdfs
   ```

4. Fix any rows it names, then add the files:

   ```bash
   node tools/import-documents.mjs sheet.csv folder-with-pdfs --save
   ```

5. Run `node --test tests/*.test.mjs`, look at the Information page, and commit. The tool copies each PDF to `assets/documents/<school year>/` and records it in `data/document-archive.js`.

### Sheet columns

| Column | What goes in it |
| --- | --- |
| title | The name shown on the site. Keep the same title every year and change only the year: "2027 Soccer Rules and Entry Information". |
| type | Alignment, Tournament regulations, Bracket, Entry form, Governance, Leadership, Award or Other. |
| sport | The sport, or blank. |
| school_year | Like `2027-28`. |
| file | The PDF's file name. |
| description | One sentence shown under the title. |
| notes | Optional caution shown in small print. |

### How a new edition replaces an old one

Two files are editions of the same document when they have the same sport and the same title once the years are removed. The edition with the latest school year shows on the Tournaments or Documents tab; the others show only in the Archive. Nothing is deleted. Brackets, regulations and entry forms go on Tournaments. Governance, leadership, award and other files go on Documents. Alignment PDFs show in the Archive; the Divisions tab still reads its schools from `data/conference-resources.js`.

Files saved before this tool existed stay where they are in `assets/documents/`. Their school years are in `legacyYears` in `data/document-archive.js`.

## Alignment sheet

[templates/alignment.csv](../templates/alignment.csv) is for the office to type a new alignment: one row per school. Leave gender blank for a sport with one list. Check a filled sheet with:

```bash
node tools/check-alignment.mjs sheet.csv
```

It flags a school that is not in the directory or is placed in two divisions, then prints each team's divisions. It changes nothing. The full division breakdowns are merged, so a checked sheet is now copied into the Divisions tab by hand, following [conference resources](conference-resources.md): one row per school there becomes one entry, and two schools that play as one team share an entry (`'brick-township/brick-memorial'`). A tool that writes the list straight from the sheet is not built yet.

## Not built

A screen for the conference office to upload files themselves. It would need file storage, permission rules and an approval step in Supabase.
