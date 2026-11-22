# PDF Import Troubleshooting Guide

## Symptoms & Solutions

### Upload button is disabled (won't become enabled)

**What to check:**
1. Open browser DevTools (F12 → Console tab)
2. Select a PDF file
3. Look for a message: `[PDF Import] File input changed, files: 1`

**If you see the message:**
- The button should become enabled
- Try clicking it

**If you DON'T see the message:**
- The file input change listener didn't fire
- Check that you're selecting a file in the correct field
- Try refreshing the page

---

### Upload button is enabled but clicking it does nothing

**What to check:**
1. Click the Upload button
2. Look in console for: `[PDF Import] Upload button clicked`

**If you see it:**
- The click handler IS running
- Look for the next message to see where it stops

**If you DON'T see it:**
- The button click listener isn't attached
- Refresh the page and try again
- Check that JavaScript is enabled

---

### Upload button works but PDF doesn't convert

**What to check:**
1. Click Upload with a PDF selected
2. Look for: `[PDF Import] Starting PDF conversion...`
3. Then look for either:
   - `[PDF Import] Successfully converted 1 PDFs` (success)
   - `[PDF Import] PDF conversion error:` (error message follows)

**If you see a conversion error:**
- The PDF might be scanned (image-based, not text-based)
- Try a different PDF or convert it first
- Check the error message for details

**If conversion succeeds but preview doesn't show:**
- Look for: `[PDF Import] Triggering import preview...`
- Look for: `[PDF Import] Calling fileInput.onchange directly`
- If that doesn't appear, the preview handler may not exist yet
- Refresh and try again

---

### PDF converts but no preview appears

**What to check:**
1. After clicking Upload and seeing "Successfully converted", look for:
   - `[PDF Import] Triggering import preview...`
   - `[PDF Import] Calling fileInput.onchange directly`
   - `[PDF Import] Dispatching change event`

**If all three appear:**
- The preview handler should have been triggered
- Check if the preview table appears below (may be loading)
- Wait a few seconds

**If they don't appear:**
- The import preview code may have crashed
- Look for JavaScript errors in the console
- Check the Network tab to see if any requests failed

---

### No console messages at all

**What to check:**
1. The script might not have loaded
2. Look for: `[PDF Import] Script loaded` (at the very top of console)

**If you DON'T see it:**
- Refresh the page completely (Ctrl+Shift+R or Cmd+Shift+R)
- Check that admin.html includes the script tag
- Look for network errors in Network tab

**If you see "Script loaded" but no "Setup function started":**
- The async setup function didn't run
- This is usually a timing issue with the page loading
- Refresh the page

---

## Console Messages Reference

Here's what a successful flow looks like in the console:

```
[PDF Import] Script loaded
[PDF Import] Setup function started
[PDF Import] PDF.js available
[PDF Import] Both file input and upload button found, initializing
[PDF Import] File input changed, files: 1
[PDF Import] Upload button disabled: false
[PDF Import] Upload button clicked
[PDF Import] Files from input: 1
[PDF Import] Processing files: my-schedule.pdf
[PDF Import] CSV files: 0 PDF files: 1
[PDF Import] Starting PDF conversion...
[PDF Import] Successfully converted 1 PDFs
[PDF Import] Total files to process: 1
[PDF Import] File input updated, now has: 1 files
[PDF Import] Triggering import preview...
[PDF Import] Calling fileInput.onchange directly
[PDF Import] Dispatching change event
```

Then the import preview should appear in the browser.

---

## PDF Format Requirements

The PDF must contain text (not just images). If you can:
- Select and copy text from the PDF → it's text-based ✓ (should work)
- Only see images and can't copy text → it's scanned ✗ (won't work)

If you have a scanned PDF, you'll need to either:
1. Convert it to text (OCR) first
2. Upload a CSV file instead
3. Use a different PDF file

---

## If Nothing Works

1. **Collect console output**: Screenshot or copy all console messages
2. **Check the Network tab**: Are there any failed requests?
3. **Clear browser cache**: Sometimes cached versions cause issues (Ctrl+Shift+Delete)
4. **Try a different browser**: Chrome, Firefox, Safari - helps narrow down the issue
5. **Test with a CSV first**: Verify the import system works with CSV files
6. **Contact support with**:
   - Screenshot of console messages
   - Name and size of your PDF
   - Which browser you're using
   - Any error messages shown

---

## Testing Locally

If you want to test the PDF import code directly in Node.js:

```bash
cd /workspaces/shore-conference-site
node tests/pdf-import.test.mjs
```

All tests should pass, confirming the PDF parsing logic works correctly.

The issue is likely in the browser environment or PDF.js library loading, not the parsing logic itself.
