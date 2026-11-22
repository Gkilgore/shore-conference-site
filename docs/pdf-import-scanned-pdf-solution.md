# PDF Import: Understanding Scanned PDF Limitations

## What Happened

When you tried to upload your "Gbball varisty.pdf" file, you likely received an error message saying the PDF couldn't be read. This is because **your PDF is a scanned document** (an image of a schedule) rather than a document with searchable text.

## Why This Happens

PDFs come in two types:

### Type 1: Searchable PDF ✅ (Works with Shore Conference)
- Created by exporting from Word, Excel, Google Docs, or similar
- Contains actual text that can be selected and searched
- File size: Usually smaller
- Our system can extract the text automatically

### Type 2: Scanned PDF ❌ (Needs conversion first)
- Created by scanning a printed document with a printer or phone
- Contains only images of text, not actual text characters
- File size: Usually larger (like your 128 KB file)
- Requires OCR (Optical Character Recognition) to convert images to text

## How to Fix It

### Option 1: Use Free Online OCR (Recommended) ⭐
1. Go to [ILovePDF.com OCR](https://www.ilovepdf.com/ocr)
2. Click "Select PDF file" and choose your Gbball Varsity PDF
3. Keep the language set to "English"
4. Click "Convert to PDF"
5. Download the new PDF
6. Upload it to Shore Conference

**Time required:** 2-3 minutes
**Cost:** Free

### Option 2: Use Google Docs
1. Upload your PDF to [Google Drive](https://drive.google.com)
2. Right-click the file → "Open with" → "Google Docs"
3. Wait for Google to automatically OCR the PDF (1-2 minutes)
4. When done, go to "File" → "Download" → "PDF Document"
5. Upload the new PDF to Shore Conference

**Time required:** 5-10 minutes
**Cost:** Free (requires Google account)

### Option 3: Create CSV Manually (Most Reliable)
If OCR isn't working or you want complete control:
1. In Shore Conference admin → Schedule → Import games → Download template
2. Open the template CSV in Excel or Google Sheets
3. Manually enter or copy your games from the PDF:
   - Date (YYYY-MM-DD format)
   - Start time (HH:MM format)
   - Home or Away
   - Opponent school
   - Location
   - Sport, Gender, Level
   - Status, Notes
4. Save as CSV
5. Upload to Shore Conference

**Time required:** 10-15 minutes depending on number of games
**Cost:** Free

## How to Check if Your PDF Will Work

Before spending time on conversion, test if your PDF needs OCR:

1. **On Windows:** Open the PDF, press Ctrl+A, and try copying text
2. **On Mac:** Open the PDF, press Cmd+A, and try copying text
3. **On any device:** Try selecting text with your mouse/trackpad

**If text highlights and can be selected:** Your PDF is searchable ✓ (upload directly)
**If you get a selection box but no text:** Your PDF is scanned ✗ (needs OCR first)

## Tips for Future Schedules

1. **When exporting schedules:**
   - Export from Excel/Google Sheets as PDF ✓
   - Screenshot or print-to-PDF ✗
   
2. **If printing is required:**
   - Print/save as PDF from the original digital file ✓
   - Scan a printed printout ✗

3. **Share digital versions:**
   - Ask your scheduler to send the Excel/Google Sheets file directly
   - Ask for a fresh export from their system
   - Saves time for everyone

## Still Having Issues?

If your PDF still won't work after OCR conversion:

1. **Try different OCR tool:** Some tools work better with certain PDFs
2. **Split large PDFs:** If the PDF has many pages, process them separately
3. **Ask for the original file:** Request the Excel or Word document instead
4. **Use CSV:** Fall back to creating a CSV manually—it always works

## Technical Details

- **PDF.js version:** 4.3.136 (industry standard, used by Firefox)
- **Text extraction:** Character-level, with line position preservation
- **Maximum file size:** 1 MB per PDF
- **Maximum games per import:** 500 total across all files

For more information, see [pdf-import-testing.md](pdf-import-testing.md).
