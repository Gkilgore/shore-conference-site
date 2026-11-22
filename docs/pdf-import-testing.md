# PDF Import Testing Guide

## Overview
The AD import system now accepts PDF files containing sports schedules. When an AD uploads a PDF, it's automatically converted to CSV format and displayed in the import preview.

## To Test PDF Imports

### 1. Access the Admin Panel
- Navigate to the admin page
- Authenticate with your school credentials
- Go to the **Schedule** tab
- Find the **Import games** section

### 2. Upload a PDF
- Click "CSV or PDF files" to select a file
- Choose a PDF containing a schedule
- Or select multiple files (mix of CSV and PDF)
- The system will convert PDFs to CSV automatically

### 3. Review the Import Preview
The system shows all extracted games in a table with:
- **File**: Which file each game came from
- **Row**: The original line number
- **Result**: Success/duplicate/error status
- **Date**: Parsed date in YYYY-MM-DD format
- **Time**: Parsed time in 24-hour format (HH:MM)
- **Team**: Your school
- **Opponent**: Extracted opponent name
- **Location**: Parsed game location
- **Problems**: Any parsing issues detected

### 4. Check for Errors
If a game has problems:
- Red highlight indicates validation issues
- Hover over or check the Problems column
- You can still import valid games while skipping problematic rows

### 5. Import or Adjust
- Adjust any fields directly in the preview table if needed
- Click the action buttons to import or cancel
- Imported games post immediately to your school's schedule

## Expected PDF Schedule Format

The parser expects a consistent structure for each game:

```
[Day of Week], [Month Abbreviation] [Day], [Year]
[Time]am/pm
H or A (or @ for Away)
[Opponent details / Location]
[Game type]
```

### Example PDF Content:
```
TUESDAY, DEC 08, 2026
4:00pm
H
@ Marlboro / Main Gym
GAME

WEDNESDAY, DEC 09, 2026
6:00pm
A
vs. Colts Neck / Colts Neck High School
SCRIMMAGE
```

## Supported Variations
- **Dates**: "TUESDAY, DEC 08, 2026" or "DECEMBER 8, 2026"
- **Times**: "4:00pm", "4:00 PM", "4:00p.m.", or "16:00"
- **Home/Away**: "H", "Home", "A", "Away", or "@"
- **Opponents**: "vs. Opponent", "@ Opponent", "opponent"
- **Game Types**: GAME, SCRIMMAGE, TOURNAMENT, Play Day

## Troubleshooting

### No games extracted
- Check the PDF format matches expected structure
- Verify the PDF contains readable text (not just images)
- Try a CSV import first to verify your data format

### Some games missing
- The parser may skip games with unusual formatting
- Try editing the PDF or convert to CSV manually
- Contact support with an example PDF

### Time format issues
- Ensure times include AM/PM indicator
- Times like "TBD" are preserved as-is
- 24-hour format times without indicators may not parse correctly

### Opponent or location problems
- Check for special characters or unusual formatting
- Parentheses and extra info are stripped automatically
- Short names or abbreviations should still work

## Combining PDFs and CSVs
You can upload PDFs and CSVs in the same import batch:
- Select multiple files at once
- PDFs are converted to CSV
- All games appear in one preview
- Duplicates across file types are detected

## Future Enhancements
Planned improvements:
- Auto-detection of sport, gender, and level from PDF content
- Support for additional PDF layouts (table-based schedules)
- Better parsing of complex venue names
- Batch import retry for partially-failed imports
