// Extracts schedule data from sports schedule PDFs and converts to CSV format for import.
// Integrates with the existing CSV import preview system.

console.log('[PDF Import] Script loaded');

(async function setupPdfImport() {
  console.log('[PDF Import] Setup function started');
  
  // Wait for DOM to be ready
  await new Promise(resolve => setTimeout(resolve, 100));

  if (!window.pdfjsLib) {
    console.warn('[PDF Import] PDF.js not loaded, PDF import unavailable');
    return;
  }

  console.log('[PDF Import] PDF.js available');

  // Set the worker URL for PDF.js
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.3.136/build/pdf.worker.min.js';

  const fileInput = document.getElementById('import-file');
  const uploadBtn = document.getElementById('import-upload');
  
  if (!fileInput) {
    console.warn('[PDF Import] import-file input not found');
    return;
  }
  
  if (!uploadBtn) {
    console.warn('[PDF Import] import-upload button not found');
    return;
  }

  console.log('[PDF Import] Both file input and upload button found, initializing');

  // Enable/disable upload button when files are selected
  // Also auto-convert PDFs if selected
  fileInput.addEventListener('change', async function() {
    console.log('[PDF Import] File input changed, files:', this.files.length);
    uploadBtn.disabled = this.files.length === 0;
    console.log('[PDF Import] Upload button disabled:', uploadBtn.disabled);
    
    const files = Array.from(this.files);
    const pdfFiles = files.filter(f => /\.pdf$/i.test(f.name));
    const csvFiles = files.filter(f => /\.csv$/i.test(f.name));
    
    // Auto-convert PDFs if any are selected
    if (pdfFiles.length > 0) {
      console.log('[PDF Import] PDFs detected, auto-converting...');
      try {
        const convertedFiles = await convertPdfsToCSV(pdfFiles);
        console.log('[PDF Import] Successfully converted', convertedFiles.length, 'PDFs');
        
        // Replace files with converted CSVs + any original CSVs
        const allFiles = [...convertedFiles, ...csvFiles];
        const dataTransfer = new DataTransfer();
        allFiles.forEach(f => dataTransfer.items.add(f));
        fileInput.files = dataTransfer.files;
        console.log('[PDF Import] File input updated with', fileInput.files.length, 'converted CSVs');
        
        // Trigger the onchange handler to process converted files
        if (fileInput.onchange) {
          console.log('[PDF Import] Triggering onchange handler');
          fileInput.onchange({ target: fileInput });
        }
      } catch (error) {
        console.error('[PDF Import] PDF conversion error:', error);
        const errorList = document.getElementById('import-file-errors');
        if (errorList) {
          errorList.hidden = false;
          const item = document.createElement('li');
          item.textContent = 'Error converting PDF: ' + error.message;
          errorList.appendChild(item);
        }
      }
    }
  });

  // Handle upload button click
  uploadBtn.addEventListener('click', async function(event) {
    event.preventDefault();
    console.log('[PDF Import] Upload button clicked');
    
    const files = Array.from(fileInput.files);
    console.log('[PDF Import] Files from input:', files.length);
    
    if (files.length === 0) {
      console.log('[PDF Import] No files selected');
      return;
    }

    console.log('[PDF Import] Processing files:', files.map(f => f.name).join(', '));

    const csvFiles = files.filter(f => /\.csv$/i.test(f.name));
    const pdfFiles = files.filter(f => /\.pdf$/i.test(f.name));

    console.log('[PDF Import] CSV files:', csvFiles.length, 'PDF files:', pdfFiles.length);

    // If we have PDFs to convert, process them first
    if (pdfFiles.length > 0) {
      try {
        console.log('[PDF Import] Starting PDF conversion...');
        const convertedFiles = await convertPdfsToCSV(pdfFiles);
        console.log('[PDF Import] Successfully converted', convertedFiles.length, 'PDFs');
        
        // Combine converted PDFs with any CSV files
        const allFiles = [...convertedFiles, ...csvFiles];
        console.log('[PDF Import] Total files to process:', allFiles.length);
        
        // Create a new DataTransfer with all files
        const dataTransfer = new DataTransfer();
        allFiles.forEach(f => dataTransfer.items.add(f));
        fileInput.files = dataTransfer.files;
        console.log('[PDF Import] File input updated, now has:', fileInput.files.length, 'files');
      } catch (error) {
        console.error('[PDF Import] PDF conversion error:', error);
        // Let the user know there was an error
        const errorList = document.getElementById('import-file-errors');
        if (errorList) {
          errorList.hidden = false;
          const item = document.createElement('li');
          item.textContent = 'Error reading PDF: ' + error.message;
          errorList.appendChild(item);
          console.log('[PDF Import] Error message displayed to user');
        }
        return;
      }
    } else {
      console.log('[PDF Import] No PDFs to convert, only CSV files');
    }

    // Trigger the original file input change handler to show preview
    console.log('[PDF Import] Triggering import preview...');
    
    // Try to call the onchange handler directly if it exists
    if (typeof fileInput.onchange === 'function') {
      console.log('[PDF Import] Calling fileInput.onchange directly');
      fileInput.onchange();
    } else {
      console.log('[PDF Import] No onchange handler found on fileInput');
    }
    
    // Also dispatch the event for any addEventListener listeners
    console.log('[PDF Import] Dispatching change event');
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  });

  async function convertPdfsToCSV(pdfFiles) {
    const convertedFiles = [];

    for (const pdfFile of pdfFiles) {
      try {
        const pdf = await window.pdfjsLib.getDocument(await pdfFile.arrayBuffer()).promise;
        const csvData = await extractScheduleFromPdf(pdf);
        
        if (csvData) {
          // Create a new File object with CSV content
          const csvFile = new File(
            [csvData], 
            pdfFile.name.replace(/\.pdf$/i, '.csv'), 
            { type: 'text/csv', lastModified: Date.now() }
          );
          convertedFiles.push(csvFile);
        }
      } catch (error) {
        throw new Error(`${pdfFile.name}: ${error.message}`);
      }
    }

    return convertedFiles;
  }

  async function extractScheduleFromPdf(pdf) {
    let allText = '';
    
    // Extract all text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Build text from items, grouping by Y position for better line preservation
      const itemsByY = {};
      textContent.items.forEach(item => {
        const y = Math.round(item.y);
        if (!itemsByY[y]) itemsByY[y] = [];
        itemsByY[y].push(item.str);
      });
      
      // Sort by Y coordinate (descending, since PDF Y goes top to bottom)
      const sortedLines = Object.keys(itemsByY)
        .sort((a, b) => Number(b) - Number(a))
        .map(y => itemsByY[y].join(' '));
      
      allText += sortedLines.join('\n') + '\n';
    }

    // Parse the extracted text
    const games = parseScheduleText(allText);
    
    if (games.length === 0) {
      return null;
    }

    // Build CSV
    const header = 'date,start_time,home_away,opponent,location,sport,gender,level,status,notes';
    const csvRows = [header];
    
    games.forEach(game => {
      const row = [
        game.date || '',
        game.start_time || '',
        game.home_away || '',
        game.opponent || '',
        game.location || '',
        game.sport || '',
        game.gender || '',
        game.level || '',
        game.status || '',
        game.notes || ''
      ];
      csvRows.push(row.map(cell => escapeCsvCell(String(cell))).join(','));
    });

    return csvRows.join('\n');
  }

  function parseScheduleText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const games = [];
    let currentDate = null;
    let i = 0;

    // Pattern for day of week with date (e.g., "TUESDAY, DEC 08, 2026")
    const datePattern = /^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY),?\s+([A-Z]+)\s+(\d{1,2}),?\s+(\d{4})/i;
    
    // Pattern for time (e.g., "4:00pm", "5:30pm")
    const timePattern = /^\d{1,2}:\d{2}\s*(am|pm|a\.m\.|p\.m\.)?/i;

    while (i < lines.length) {
      const line = lines[i];
      
      // Check for date line
      const dateMatch = line.match(datePattern);
      if (dateMatch) {
        const monthStr = dateMatch[2];
        const day = dateMatch[3];
        const year = dateMatch[4];
        currentDate = parseMonthDayYear(monthStr, day, year);
        i++;
        continue;
      }

      // Check for time line
      if (currentDate && timePattern.test(line)) {
        const timeStr = formatTime(line);
        
        // Look ahead for the rest of the game info
        let homeAway = '';
        let opponent = '';
        let location = '';
        let status = '';
        let j = i + 1;

        // Next line should have home/away indicator (H or A)
        if (j < lines.length) {
          const nextLine = lines[j];
          if (nextLine === 'H' || nextLine.match(/^Home/i)) {
            homeAway = 'Home';
            j++;
          } else if (nextLine === 'A' || nextLine.match(/^Away/i) || nextLine === '@') {
            homeAway = 'Away';
            j++;
          }
        }

        // Look for opponent name and other details in next few lines
        while (j < lines.length && j < i + 10) {
          const nextLine = lines[j];
          
          // Stop if we hit another date
          if (nextLine.match(datePattern)) break;
          
          // Check if this line has opponent info
          const opMatch = nextLine.match(/(?:@\s+|vs\.?\s+|VS\s+)(.+?)(?:\s*\/|$)/i);
          if (opMatch) {
            opponent = opMatch[1].trim();
            // Remove extra info after the opponent name
            opponent = opponent.replace(/\s+or\s+.*/i, '').replace(/\s+\(.*\)/, '').trim();
          }
          
          // Check for game type (SCRIMMAGE, GAME, TOURNAMENT, Play Day)
          if (nextLine.match(/^(SCRIMMAGE|GAME|TOURNAMENT|Play Day)/i)) {
            status = 'Scheduled';
            j++;
            break;
          }
          
          // Check for facility/location - but skip if it's just a category label
          if (nextLine.match(/(?:Gym|Gymnasium|Field|School|Court|Arena|Main|North|South|East|West|Off Site)/i)
              && !nextLine.match(/^(Sport|Start Time|H\/A|Opponents|Type|Facility|Girls Varsity)$/i)) {
            if (!location) {
              location = nextLine;
            }
          }
          
          j++;
        }

        // Add the game if we have enough info
        if (currentDate && timeStr) {
          games.push({
            date: currentDate,
            start_time: timeStr,
            home_away: homeAway || 'Home',
            opponent: opponent.replace(/\s+\/.*$/, '').trim() || 'TBD',
            location: location.replace(/\s+-.*$/, '').trim() || 'TBD',
            sport: 'Basketball',
            gender: 'Girls',
            level: 'Varsity',
            status: status || 'Scheduled',
            notes: ''
          });
        }

        i = j;
        continue;
      }

      i++;
    }

    return games;
  }

  function parseMonthDayYear(monthStr, day, year) {
    const monthMap = {
      'JAN': '01', 'JANUARY': '01',
      'FEB': '02', 'FEBRUARY': '02',
      'MAR': '03', 'MARCH': '03',
      'APR': '04', 'APRIL': '04',
      'MAY': '05',
      'JUN': '06', 'JUNE': '06',
      'JUL': '07', 'JULY': '07',
      'AUG': '08', 'AUGUST': '08',
      'SEP': '09', 'SEPTEMBER': '09',
      'OCT': '10', 'OCTOBER': '10',
      'NOV': '11', 'NOVEMBER': '11',
      'DEC': '12', 'DECEMBER': '12'
    };

    const month = monthMap[monthStr.toUpperCase()];
    if (!month) return null;

    return `${year}-${month}-${String(day).padStart(2, '0')}`;
  }

  function formatTime(timeStr) {
    // Convert "4:00pm" to "16:00" format, keeping "TBD" as-is
    if (timeStr.toLowerCase() === 'tbd') return 'TBD';
    
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(am|pm|a\.m\.|p\.m\.)?/i);
    if (!match) return timeStr;

    let hour = Number(match[1]);
    const minute = match[2];
    const meridiem = match[3];

    if (meridiem) {
      if (hour === 12) {
        hour = meridiem.toLowerCase().startsWith('a') ? 0 : 12;
      } else if (meridiem.toLowerCase().startsWith('p')) {
        hour += 12;
      }
    }

    return `${String(hour).padStart(2, '0')}:${minute}`;
  }

  function escapeCsvCell(value) {
    if (!value) return '';
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }
})();
