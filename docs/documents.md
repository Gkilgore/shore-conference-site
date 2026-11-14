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

## Staff Documents tab

Conference admins can upload PDFs themselves on the staff page, under **Documents**. Site admins reach it through the Conference office view, the same way as Tournaments. ADs do not see it.

- The form asks for the PDF, a title, a type, an optional sport, the school year, a one-sentence description and an optional note. Files are PDF only, up to 10 MB.
- A file shows on the public Information page as soon as it is uploaded. There is no draft step.
- **Remove** takes two clicks and takes the file off the public site.
- Uploaded files follow the same edition rule as imported ones: same sport and same title apart from the year.

### Where uploaded files live

Uploaded files are kept in Supabase, not in this repository:

- The list is the `conference_documents` table. Anyone can read it. Only conference admins and site admins can add, edit or remove rows. The public cannot see who uploaded a file.
- The PDFs are in the `conference-documents` storage bucket, in one folder per school year.
- The rules are in `supabase/migrations/20261201000100_conference_documents.sql`, with a permission test in `supabase/tests/conference-documents.sql`.

The public pages read the table when they load and add those files to the ones saved in the repository. If Supabase cannot be reached, the pages still show the saved files.

**The migration has not been applied.** Until it is, the tab says uploads are off. Apply it to the test project and run the permission test first; Greg applies it to the live project.

### Which way to add a file

Either way works and both show in the same places. The staff tab is for the conference office and needs no deploy. The import tool keeps the file in the repository, which suits files Greg adds himself and wants under version control.

Division lists are different: an uploaded alignment PDF shows in the Archive, but the schools on the Divisions tab are still typed into `data/conference-resources.js` by Greg.
