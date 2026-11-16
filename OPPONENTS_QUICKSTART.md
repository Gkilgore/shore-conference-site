# Opponents Tab - Quick Start Guide

## 🎯 What's New

The Opponents tab now includes a **searchable NJSIAA member schools directory** with all 452 schools and their addresses. Athletics Directors can search and add schools in one click.

## 📂 Key Files

| File | Purpose | Size |
|------|---------|------|
| `data/njsiaa-schools.js` | School data (global variable) | 80 KB |
| `js/staff-opponents-njsiaa.js` | Search & UI functionality | 4 KB |
| `css/staff.css` | Added NJSIAA styling | +60 lines |
| `admin.html` | Added NJSIAA section | +2 script tags |

## ✨ Features

✓ Search 452 NJSIAA member schools  
✓ Filter by name, address, or phone  
✓ One-click add to opponent list  
✓ Mobile & desktop friendly  
✓ Real-time filtering  
✓ No configuration needed  

## 🔍 How It Works

1. **Data loads** from `njsiaa-schools.js` on page load
2. **User searches** in real-time
3. **Results filter** instantly (client-side)
4. **Click "Add"** to add school to opponent list
5. **Form submits** automatically with school name

## 📊 Data Included

Each school has:
- **Name** (required, e.g., "Colts Neck High School")
- **Address** (required, e.g., "One Warrior Way Colts Neck, NJ 07722")
- **Phone** (optional)
- **Athletic Director** (optional)

## 🧪 Testing

### Manual Testing Checklist
- [ ] Sign in as Athletics Director
- [ ] Go to Opponents tab
- [ ] Search "Colts" → find "Colts Neck High School"
- [ ] Search "Marlboro" → find schools
- [ ] Click "Add to opponent list"
- [ ] School appears in "My opponent list"
- [ ] Can remove added schools
- [ ] Works on mobile and desktop

### Browser Testing
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

## 🔧 Customization

### Change Search Placeholder
In `admin.html` line ~166:
```html
<input ... placeholder="Search schools...">
```

### Change Max List Height
In `css/staff.css`:
```css
.njsiaa-schools-list {
  max-height: 60vh;  /* Change this value */
}
```

### Add More Data
1. Update `data/njsiaa-schools.json`
2. Update `data/njsiaa-schools.js` with:
   ```javascript
   const njsiaaSchools = [...];
   ```
3. Data auto-loads on page refresh

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Schools not showing | Clear cache, check browser console for errors |
| Search not working | Ensure JavaScript is enabled, check Dev Tools |
| Add button not working | Verify form is visible, check network tab |
| Styling looks wrong | Clear browser cache, check CSS file loaded |

## 📋 Maintenance

### Monthly Checklist
- [ ] Check NJSIAA website for new schools
- [ ] Run scraper if needed: `python3 tools/scrape-njsiaa.py`
- [ ] Verify test schools still work
- [ ] Check for browser compatibility issues

### Quarterly Tasks
- [ ] Review search performance metrics
- [ ] Check for unused/closed schools
- [ ] Update documentation if needed
- [ ] Test with real user scenarios

## 📚 Documentation

- **Full Guide**: `docs/opponents-njsiaa.md`
- **Implementation Details**: `docs/OPPONENTS_IMPLEMENTATION.md`
- **Checklist**: `docs/OPPONENTS_CHECKLIST.md`

## 🚀 Deployment

1. Files are already in production
2. No build step required
3. No configuration needed
4. Live on next page load

## 💡 Tips

- **Faster search**: Use specific terms (e.g., "Colts Neck" vs just "High")
- **Phone search**: Try last 4 digits if full number doesn't work
- **City search**: Try just the city name (e.g., "Monmouth")
- **Multiple adds**: Search once, add multiple schools quickly

## ✅ Verification

Run this to verify everything is working:
```bash
node tools/verify-opponents.js
```

Expected output:
```
✅ All tests PASSED - Opponents tab is ready!
   📈 Data: 452 schools loaded
   📄 Files: 5 files present
   🎨 CSS: 6/6 classes styled
```

## 🤝 Getting Help

| Question | Answer |
|----------|--------|
| "How do I search?" | Type school name, city, or phone in search box |
| "How do I add a school?" | Click the "Add to opponent list" button |
| "Can I add non-NJSIAA schools?" | Yes, use the manual form below |
| "Where's the data from?" | Official NJSIAA member directory |
| "How often is it updated?" | On request (manual update process) |

---

**Status**: Ready for use  
**Last Updated**: November 2024  
**Support**: See `docs/opponents-njsiaa.md`
