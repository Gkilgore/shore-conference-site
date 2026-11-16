# NJSIAA Member Schools - Opponents Tab

## Overview

The Opponents tab in the Athletics Director (AD) staff view now displays a browsable directory of all 452 NJSIAA member schools. ADs can search and easily add schools to their opponent list.

## Features

### NJSIAA Member Schools Browser
- **Complete Directory**: All 452 NJSIAA member schools with addresses
- **Real-time Search**: Filter schools by:
  - School name (e.g., "Colts Neck", "Marlboro")
  - City/location (e.g., "Monmouth County", "Camden")
  - Phone number
- **School Details**: Each school displays:
  - Full school name
  - Complete address
  - Phone number
  - Athletic Director name and contact
- **One-Click Add**: "Add to opponent list" button integrates with the existing opponent management system

### How to Use

1. **Sign in** to the Staff Dashboard
2. **Select your school** from the School dropdown
3. **Click the Opponents tab**
4. **Search NJSIAA member schools**:
   - Type a school name, city, or phone number in the search box
   - Results filter in real-time
5. **Add a school**:
   - Click "Add to opponent list" on any school
   - The school name is populated in the form
   - Form submits automatically
6. **Manage your list**:
   - Added schools appear in "My opponent list" section below
   - Remove schools with the "Remove" button

## Data Source

Data is sourced directly from the official NJSIAA website:
- **Source URL**: https://www.njsiaa.org/schools/member-information
- **Last Updated**: November 2024
- **Total Schools**: 452 unique NJSIAA member schools
- **Data Included**: School name, address, phone, athletic director contact

## Files

### Data Files
- `data/njsiaa-schools.js` - JavaScript global variable containing all schools
- `data/njsiaa-schools.json` - JSON format for programmatic access

### Code Files
- `js/staff-opponents-njsiaa.js` - Browser module that handles display and search
- `css/staff.css` - Styling for the NJSIAA schools section

### HTML
- `admin.html` - Opponents panel updated with NJSIAA section

## Implementation Details

### Search Algorithm
The browser uses case-insensitive substring matching on:
1. School name
2. Full address
3. Phone number (if available)

Partial matches are supported (e.g., searching "Colts" finds "Colts Neck High School").

### Integration with Opponent List
When a school is selected from the NJSIAA directory:
1. The school name is populated in the manual opponent input field
2. The form is automatically submitted
3. The school is added to the opponent list via the existing `add_school_opponent` function
4. Full RLS (row-level security) rules apply

### Performance
- Initial page load: Schools loaded from pre-built JS file
- Search: Client-side filtering (452 schools)
- Responsive on mobile and desktop
- Maximum list height with scroll for better UX

## Customization

### Adding Schools to the Directory
If NJSIAA adds new member schools:

1. Re-scrape the NJSIAA member information page
2. Update `data/njsiaa-schools.json` and `data/njsiaa-schools.js`
3. Redeploy the files

### Modifying Search Behavior
Edit `js/staff-opponents-njsiaa.js` function `filterSchools()` to change search criteria.

### Styling
CSS classes available for customization:
- `.staff-njsiaa-search` - Search input container
- `.njsiaa-schools-list` - School list container
- `.njsiaa-school-item` - Individual school card
- `.njsiaa-school-name` - School name
- `.njsiaa-school-address` - School address
- `.njsiaa-school-details` - Phone and AD info
- `.njsiaa-add-button` - Add button

## Browser Compatibility

Supported on all modern browsers:
- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Troubleshooting

### Schools not appearing
1. Check browser console for errors
2. Verify `njsiaa-schools.js` file is loaded
3. Ensure JavaScript is enabled

### Search not working
1. Check if `staff-opponents-njsiaa.js` is loaded
2. Verify the search input field has focus
3. Clear browser cache and reload

### Add button not working
1. Ensure you're signed in as an AD
2. Verify you have selected a school
3. Check that the opponent form is visible
4. Look for error messages in the status area

## Future Enhancements

Potential improvements:
- Athletic director contact import integration
- School profile automatic matching based on NJSIAA data
- Batch import of all NJSIAA schools
- Filtering by NJSIAA section/division
- Automatic sync with NJSIAA roster changes
