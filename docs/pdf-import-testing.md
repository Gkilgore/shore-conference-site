# PDF Import Testing Guide

## Overview
The AD import system now accepts PDF files containing sports schedules. When an AD uploads a PDF, the system extracts its text content and displays it in the import preview.

**Important:** Only PDFs with **searchable text** (not scanned images) can be imported. If your PDF appears to be a scanned image or screenshot, you'll need to convert it first—see the Troubleshooting section below.

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

### "This is a scanned PDF image" Error
This means your PDF is an image (like a photograph or scan) rather than searchable text. **This is the most common issue.**

**Solutions:**
1. **Use online OCR tool** (easiest):
   - Try [ILovePDF.com OCR](https://www.ilovepdf.com/ocr) (free)
   - Upload your scanned PDF → Select "English" → Download the OCR'd PDF
   - Then upload the new PDF to Shore Conference

2. **Use Google Docs** (alternative):
   - Upload your PDF to Google Drive
   - Right-click → "Open with" → "Google Docs"
   - Google automatically runs OCR
   - After processing, download as PDF and upload here

3. **Convert to CSV manually** (most reliable):
   - Open the PDF in Excel or Google Sheets
   - Create columns: date, start_time, home_away, opponent, location, sport, gender, level, status, notes
   - Save as CSV and upload

**How to tell if your PDF is scannable:**
- Try selecting text in the PDF (Ctrl+A or Cmd+A)
- If text highlights, it's searchable ✓
- If nothing highlights or you get a selection box, it's a scanned image ✗

### No games extracted
- Check the PDF format matches expected structure (see "Expected PDF Schedule Format" above)
- Verify the PDF contains readable text (not just images)
- If the error message says "scanned PDF image," see the solution above
- Try a CSV import first to verify your data format works

### Some games missing
- The parser may skip games with unusual formatting
- Check the original PDF for the missing games
- Try reformatting the PDF document and re-exporting
- Contact support with an example if problems persist

### Time format issues
- Ensure times include AM/PM indicator (4:00pm, 3:30 AM, etc.)
- Times like "TBD" are preserved as-is
- 24-hour format times without indicators (16:00) should work but may have issues

### Opponent or location problems
- Check for special characters or unusual formatting
- Parentheses and extra info are stripped automatically
- Short names or abbreviations should work fine

### PDF extraction fails
- File is corrupted: Try re-exporting or saving the PDF again
- Very large PDFs (>1 MB): Split into smaller PDFs first
- Unusual fonts or encoding: Try saving the PDF from a different program

## How to Check if Your PDF Works

1. **In the import dialog, select your PDF**
2. **Look for error messages:**
   - If you see "This is a scanned PDF image," convert with OCR first
   - If you see another extraction error, check the format
   - If no games show, the parsing didn't recognize the layout

## Combining PDFs and CSVs
You can upload PDFs and CSVs in the same import batch:
- Select multiple files at once
- PDFs are extracted and processed
- All games appear in one preview
- Duplicates across file types are detected automatically

## If All Else Fails
Create a CSV file instead:
1. Download the template from the Import section
2. Fill it in manually or by copying from your PDF
3. Upload the CSV instead
4. This always works and gives you full control
