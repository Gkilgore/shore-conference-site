// Facts copied by hand from the conference's own lists: division lists, school athletics links and
// tournament sources. Greg updates this file through a pull request; docs/conference-resources.md says how.
// Every entry links to a copy saved on this site, with a review status and the date it was last checked.
// The old conference site will go away, so nothing here links to it.
// PDFs are saved in assets/documents/. Web pages are saved in data/archived-resources.js and shown by archive.html.
const savedCopy = path => {
  const name = path.split('?')[0].split('/').pop();
  return name.endsWith('.pdf') ? 'assets/documents/' + name : 'archive.html?page=' + encodeURIComponent(name.replace(/\.aspx$/, ''));
};

const shoreConferenceResources = (() => {
  const reviewed = '2026-11-10';
  // The official lists do not name a level. They are recorded, and shown, as varsity only.
  // year: the fall calendar year for Fall and Winter, the spring calendar year for Spring.
  // Every division on each saved list is copied with all its members, in the order the list prints them,
  // so complete and allDivisions are both true. The source transcription is
  // docs/source-archive/division-transcriptions.json; division-name-map.json turns its names into slugs.
  // Members are directory slugs. A combined team or a name with no single matching school stays as printed,
  // and notes say what a person should confirm.
  const listsReviewed = '2026-11-13';
  const list = (sports, genders, season, year, title, path, divisions, notes = []) => ({
    sports, genders, level: 'Varsity', season, year, title, url: savedCopy(path), status: 'verified',
    reviewed: listsReviewed, complete: true, allDivisions: true, divisions, notes });

  const divisionLists = [
    list(['Soccer'], ['Boys'], 'Fall', 2026, '2026 Boys’ Soccer Divisions', '/sports/2026/6/24/MSOC_2026-divisions.aspx', {
      'A North': ['colts-neck', 'christian-brothers-academy', 'middletown-south', 'marlboro', 'manalapan', 'saint-john-vianney', 'freehold-township'],
      'B North': ['wall-township', 'freehold-boro', 'red-bank-regional', 'asbury-park', 'howell', 'middletown-north', 'keyport'],
      'A Central': ['holmdel', 'shore-regional', 'ocean-township', 'long-branch', 'manasquan', 'rumson-fair-haven-regional', 'ranney-school'],
      'B Central': ['matawan-regional', 'raritan', 'neptune', 'monmouth-regional', 'red-bank-catholic', 'saint-rose', 'henry-hudson-regional'],
      'A South': ['toms-river-east', 'southern-regional', 'point-pleasant-borough', 'toms-river-south', 'brick-memorial', 'toms-river-north'],
      'B South': ['brick-township', 'lacey-township', 'point-pleasant-beach', 'central-regional', 'jackson-township', 'manchester-township'],
      'C South': ['barnegat', 'pinelands-regional', 'lakewood', 'donovan-catholic', 'new-egypt'],
    }),
    list(['Soccer'], ['Girls'], 'Fall', 2026, '2026 Girls’ Soccer Divisions', '/sports/2025/12/12/divs-26-girls-soccer.aspx', {
      'A North': ['howell', 'manalapan', 'middletown-south', 'red-bank-catholic', 'rumson-fair-haven-regional', 'saint-john-vianney', 'trinity-hall'],
      'B North': ['colts-neck', 'holmdel', 'monmouth-regional', 'neptune', 'ocean-township', 'red-bank-regional', 'shore-regional'],
      'A Central': ['freehold-boro', 'freehold-township', 'manasquan', 'marlboro', 'middletown-north', 'raritan', 'wall-township'],
      'B Central': ['asbury-park', 'keyport', 'long-branch', 'matawan-regional', 'ranney-school', 'saint-rose'],
      'A South': ['central-regional', 'jackson-township', 'point-pleasant-borough', 'southern-regional', 'toms-river-east', 'toms-river-south'],
      'B South': ['barnegat', 'brick-memorial', 'lacey-township', 'manchester-township', 'point-pleasant-beach', 'toms-river-north'],
      'C South': ['brick-township', 'donovan-catholic', 'lakewood', 'new-egypt', 'pinelands-regional'],
    }),
    list(['Field Hockey'], ['Girls'], 'Fall', 2026, '2026 Field Hockey Divisions', '/sports/2026/6/24/FH_2026_divisions.aspx', {
      'A North': ['freehold-township', 'manalapan', 'middletown-south', 'ocean-township', 'rumson-fair-haven-regional', 'shore-regional', 'trinity-hall'],
      'B North': ['colts-neck', 'holmdel', 'middletown-north', 'monmouth-regional', 'red-bank-catholic', 'red-bank-regional', 'saint-john-vianney'],
      'C North': ['freehold-boro', 'henry-hudson-regional', 'long-branch', 'matawan-regional', 'neptune', 'ranney-school', 'raritan'],
      'A South': ['howell', 'manasquan', 'point-pleasant-borough', 'southern-regional', 'saint-rose', 'toms-river-north', 'wall-township'],
      'B South': ['barnegat', 'central-regional', 'jackson-township', 'lacey-township', 'toms-river-east', 'toms-river-south'],
      'C South': ['brick-memorial', 'brick-township', 'donovan-catholic', 'lakewood', 'manchester-township', 'new-egypt', 'pinelands-regional'],
    }),
    list(['Tennis'], ['Girls'], 'Fall', 2026, '2026 Girls Tennis Divisions', '/sports/2026/6/24/WTEN_2026-divisions.aspx', {
      'A North': ['colts-neck', 'holmdel', 'manalapan', 'middletown-south', 'red-bank-catholic', 'red-bank-regional', 'rumson-fair-haven-regional'],
      'B North': ['freehold-township', 'marlboro', 'monmouth-regional', 'ocean-township', 'ranney-school', 'shore-regional', 'trinity-hall'],
      'C North': ['freehold-boro', 'henry-hudson-regional', 'keansburg', 'long-branch', 'matawan-regional', 'middletown-north', 'raritan', 'saint-john-vianney'],
      'A South': ['barnegat', 'central-regional', 'donovan-catholic', 'jackson-township', 'manasquan', 'southern-regional', 'toms-river-east'],
      'B South': ['howell', 'lacey-township', 'pinelands-regional', 'point-pleasant-borough', 'saint-rose', 'toms-river-north', 'wall-township'],
      'C South': ['brick-township', 'brick-memorial', 'lakewood', 'manchester-township', 'neptune', 'new-egypt', 'point-pleasant-beach', 'toms-river-south'],
    }),
    list(['Volleyball'], ['Girls'], 'Fall', 2026, '2026 Girls Volleyball Divisions', '/sports/2026/6/24/WVB_-2026-divisions.aspx', {
      'A North': ['holmdel', 'howell', 'marlboro', 'raritan', 'saint-john-vianney', 'trinity-hall'],
      'B North': ['colts-neck', 'middletown-north', 'middletown-south', 'rumson-fair-haven-regional', 'shore-regional', 'saint-rose'],
      'C North': ['asbury-park', 'freehold-boro', 'keyport', 'long-branch', 'red-bank-catholic', 'red-bank-regional'],
      'A South': ['donovan-catholic', 'jackson-township', 'pinelands-regional', 'southern-regional', 'toms-river-south'],
      'B South': ['barnegat', 'brick-memorial', 'brick-township', 'lacey-township', 'manasquan', 'toms-river-north'],
      'C South': ['central-regional', 'lakewood', 'manchester-township', 'point-pleasant-beach', 'toms-river-east', 'wall-township'],
    }, ['The list prints “TRINTIY HALL”. Read as Trinity Hall.']),
    list(['Cross Country'], ['Boys', 'Girls'], 'Fall', 2026, '2026 Boys and Girls’ Cross Country Divisions', '/sports/2026/6/24/xc-2026-divisions.aspx', {
      'A South': ['southern-regional', 'toms-river-north', 'toms-river-south', 'toms-river-east', 'brick-township', 'brick-memorial', 'central-regional', 'jackson-township'],
      'A Central': ['rumson-fair-haven-regional', 'monmouth-regional', 'raritan', 'wall-township', 'red-bank-catholic', 'trinity-hall', 'shore-regional', 'manasquan'],
      'A North': ['howell', 'freehold-township', 'christian-brothers-academy', 'marlboro', 'manalapan', 'colts-neck', 'red-bank-regional', 'long-branch'],
      'B South': ['pinelands-regional', 'manchester-township', 'lacey-township', 'barnegat', 'point-pleasant-borough', 'donovan-catholic', 'lakewood', '(Ocean Academy)'],
      'B Central': ['asbury-park', 'keansburg', 'point-pleasant-beach', 'saint-rose', 'ranney-school', 'Henry Hudson/Keyport', 'new-egypt'],
      'B North': ['neptune', 'matawan-regional', 'ocean-township', 'saint-john-vianney', 'holmdel', 'middletown-north', 'middletown-south', 'freehold-boro'],
    }, ['“(Ocean Academy)” is shown as printed. Printed in parentheses; its status in this list is not stated.', '“Henry Hudson/Keyport” is shown as printed. Combined team.']),
    list(['Football'], ['Boys'], 'Fall', 2026, '2026 Football Divisions', '/documents/2026/6/22/sc_football_26.pdf', {
      'A North': ['holmdel', 'manalapan', 'red-bank-catholic', 'rumson-fair-haven-regional', 'saint-john-vianney', 'wall-township'],
      'B North': ['freehold-township', 'manasquan', 'matawan-regional', 'middletown-north', 'middletown-south', 'shore-regional'],
      'C North': ['howell', 'marlboro', 'neptune', 'ocean-township', 'raritan', 'Red Bank'],
      'D North': ['asbury-park', 'barnegat', 'colts-neck', 'long-branch', 'manchester-township', 'monmouth-regional'],
      'A South': ['brick-memorial', 'donovan-catholic', 'jackson-township', 'point-pleasant-borough', 'southern-regional', 'toms-river-north'],
      'B South': ['brick-township', 'central-regional', 'lacey-township', 'pinelands-regional', 'toms-river-east', 'toms-river-south'],
      'C South': ['freehold-boro', 'keansburg', 'keyport', 'lakewood', 'new-egypt', 'point-pleasant-beach'],
    }, ['“Red Bank” is shown as printed. Could be Red Bank Regional or Red Bank Catholic.']),
    list(['Gymnastics'], ['Girls'], 'Fall', 2026, '2026 Gymnastics Divisions', '/documents/2026/9/2/Gymnastics_2026_Divisions.pdf', {
      'A North': ['middletown-south', 'saint-john-vianney', 'marlboro', 'howell', 'freehold-township', 'ocean-township', 'colts-neck'],
      'A South': ['Brick Mem./Brick Twp.', 'Manchester/Jackson', 'southern-regional', 'central-regional', 'manasquan', 'lacey-township'],
      'B North': ['trinity-hall', 'manalapan', 'holmdel', 'red-bank-catholic', 'RBR/RFH', 'freehold-boro', 'middletown-north'],
      'B South': ['toms-river-south', 'neptune', 'point-pleasant-borough', 'toms-river-east', 'wall-township', 'toms-river-north', 'donovan-catholic'],
    }, ['Filed as Fall 2026. The list says only “2026”; confirm the season.', '“Brick Mem./Brick Twp.” is shown as printed. Combined team.', '“Manchester/Jackson” is shown as printed. Combined team.', 'The list prints “Manlapan”. Read as Manalapan.', '“RBR/RFH” is shown as printed. Combined team.']),

    list(['Basketball'], ['Boys'], 'Winter', 2026, '2026-27 Boys’ Basketball Divisions', '/documents/2026/6/25/sc_boys_basketball_27.pdf', {
      'A North': ['christian-brothers-academy', 'howell', 'manasquan', 'marlboro', 'red-bank-catholic', 'wall-township'],
      'A South': ['brick-memorial', 'central-regional', 'jackson-township', 'point-pleasant-beach', 'point-pleasant-borough', 'southern-regional'],
      'B North': ['freehold-township', 'holmdel', 'ocean-township', 'ranney-school', 'red-bank-regional', 'rumson-fair-haven-regional'],
      'B South': ['barnegat', 'pinelands-regional', 'toms-river-east', 'toms-river-north', 'toms-river-south'],
      'A Central': ['colts-neck', 'henry-hudson-regional', 'middletown-south', 'monmouth-regional', 'shore-regional', 'saint-rose'],
      'C South': ['brick-township', 'donovan-catholic', 'lacey-township', 'lakewood', 'manchester-township', 'new-egypt'],
      'B Central': ['freehold-boro', 'manalapan', 'matawan-regional', 'middletown-north', 'saint-john-vianney'],
      'C North': ['asbury-park', 'keansburg', 'keyport', 'long-branch', 'neptune', 'raritan'],
    }),
    list(['Basketball'], ['Girls'], 'Winter', 2026, '2026-27 Girls’ Basketball Divisions', '/documents/2026/6/25/sc_girls_basketball_27.pdf', {
      'A North': ['howell', 'manasquan', 'red-bank-catholic', 'rumson-fair-haven-regional', 'saint-john-vianney', 'trinity-hall'],
      'A South': ['brick-township', 'jackson-township', 'point-pleasant-borough', 'southern-regional', 'toms-river-east', 'toms-river-south'],
      'B North': ['colts-neck', 'middletown-south', 'neptune', 'red-bank-regional', 'shore-regional', 'saint-rose'],
      'B South': ['barnegat', 'brick-memorial', 'central-regional', 'donovan-catholic', 'lacey-township', 'manchester-township'],
      'A Central': ['freehold-boro', 'freehold-township', 'holmdel', 'keansburg', 'marlboro', 'middletown-north'],
      'C South': ['lakewood', 'new-egypt', 'pinelands-regional', 'point-pleasant-beach', 'toms-river-north'],
      'B Central': ['manalapan', 'matawan-regional', 'ocean-township', 'ranney-school', 'wall-township'],
      'C North': ['asbury-park', 'henry-hudson-regional', 'keyport', 'long-branch', 'monmouth-regional', 'raritan'],
    }),
    list(['Ice Hockey'], ['Boys', 'Coed'], 'Winter', 2026, '2026-27 Ice Hockey Divisions', '/sports/2026/6/25/MHOCKEY_27-divisions.aspx?path=mhockey', {
      'Shore North': ['Brick', 'christian-brothers-academy', 'freehold-township', 'howell', 'manalapan', 'manasquan', 'marlboro', 'middletown-north', 'red-bank-catholic', 'toms-river-east'],
      'Shore South': ['central-regional', 'freehold-boro', 'lacey-township', 'middletown-south', 'ocean-township', 'red-bank-regional', 'Rumson', 'southern-regional', 'saint-john-vianney', 'wall-township'],
    }, ['“Brick” is shown as printed. Could be Brick Township or Brick Memorial.', '“Rumson” is shown as printed. Probably Rumson-Fair Haven Regional; not confirmed.']),
    list(['Wrestling'], ['Boys'], 'Winter', 2026, '2026-27 Boys’ Wrestling Divisions', '/sports/2026/6/25/WREST_27-divisions.aspx', {
      American: ['christian-brothers-academy', 'howell', 'red-bank-catholic', 'southern-regional', 'toms-river-east'],
      Constitution: ['holmdel', 'middletown-north', 'middletown-south', 'rumson-fair-haven-regional', 'wall-township'],
      Freedom: ['brick-memorial', 'jackson-township', 'lacey-township', 'ocean-township', 'point-pleasant-borough'],
      Independence: ['colts-neck', 'manasquan', 'matawan-regional', 'raritan', 'saint-john-vianney'],
      Federal: ['central-regional', 'long-branch', 'marlboro', 'toms-river-north', 'toms-river-south'],
      Royal: ['barnegat', 'brick-township', 'manalapan', 'point-pleasant-beach', 'pinelands-regional', 'shore-regional'],
      Centennial: ['asbury-park', 'freehold-boro', 'freehold-township', 'keansburg', 'monmouth-regional', 'red-bank-regional'],
      United: ['donovan-catholic', 'keyport', 'lakewood', 'manchester-township', 'neptune', 'new-egypt'],
    }),
    list(['Wrestling'], ['Girls'], 'Winter', 2026, '2026-27 Girls’ Wrestling Divisions', '/sports/2026/6/25/WWREST_27-divisions.aspx', {
      'A North': ['freehold-boro', 'howell', 'manalapan', 'marlboro', 'Middletown', 'raritan'],
      'A South': ['Brick', 'central-regional', 'jackson-township', 'lakewood', 'manchester-township', 'southern-regional', 'Toms River'],
    }, ['“Middletown” is shown as printed. Could be Middletown North or Middletown South.', '“Brick” is shown as printed. Could be Brick Township or Brick Memorial.', '“Toms River” is shown as printed. Could be Toms River East, North or South.']),
    list(['Swimming'], ['Boys'], 'Winter', 2026, '2026-27 Boys’ Swimming Divisions', '/documents/2026/6/25/2026_2027_Boys_and_Girls_Swimming.pdf', {
      'A North': ['christian-brothers-academy', 'holmdel', 'manasquan', 'middletown-south', 'red-bank-regional', 'rumson-fair-haven-regional'],
      'B North': ['freehold-township', 'marlboro', 'ocean-township', 'red-bank-catholic', 'saint-rose', 'wall-township'],
      'A Central': ['colts-neck', 'howell', 'manalapan', 'neptune', 'ranney-school', 'shore-regional'],
      'B Central': ['freehold-boro', 'long-branch', 'middletown-north', 'monmouth-regional', 'raritan', 'saint-john-vianney'],
      'A South': ['central-regional', 'jackson-township', 'lacey-township', 'southern-regional', 'toms-river-east', 'toms-river-south'],
      'B South': ['barnegat', 'brick-memorial', 'brick-township', 'donovan-catholic', 'manchester-township', 'point-pleasant-borough', 'toms-river-north'],
    }, ['Page 1 of the saved PDF.']),
    list(['Swimming'], ['Girls'], 'Winter', 2026, '2026-27 Girls’ Swimming Divisions', '/documents/2026/6/25/2026_2027_Boys_and_Girls_Swimming.pdf', {
      'A North': ['trinity-hall', 'holmdel', 'manasquan', 'middletown-south', 'red-bank-regional', 'rumson-fair-haven-regional'],
      'B North': ['freehold-township', 'marlboro', 'ocean-township', 'red-bank-catholic', 'saint-rose', 'wall-township'],
      'A Central': ['colts-neck', 'howell', 'manalapan', 'neptune', 'ranney-school', 'shore-regional'],
      'B Central': ['freehold-boro', 'long-branch', 'middletown-north', 'monmouth-regional', 'raritan', 'saint-john-vianney'],
      'A South': ['central-regional', 'jackson-township', 'lacey-township', 'southern-regional', 'toms-river-east', 'toms-river-south'],
      'B South': ['barnegat', 'brick-memorial', 'brick-township', 'donovan-catholic', 'manchester-township', 'point-pleasant-borough', 'toms-river-north'],
    }, ['Page 2 of the saved PDF.']),

    list(['Baseball'], ['Boys'], 'Spring', 2027, '2027 Baseball Divisions', '/documents/2026/6/22/SC_Baseball_Div_27.pdf', {
      American: ['red-bank-catholic', 'christian-brothers-academy', 'colts-neck', 'rumson-fair-haven-regional', 'howell', 'ranney-school'],
      Freedom: ['brick-memorial', 'toms-river-east', 'toms-river-south', 'wall-township', 'jackson-township', 'point-pleasant-beach'],
      Patriot: ['henry-hudson-regional', 'long-branch', 'keyport', 'keansburg', 'lakewood', 'asbury-park', 'neptune'],
      Colonial: ['manalapan', 'freehold-township', 'raritan', 'saint-john-vianney', 'shore-regional', 'middletown-north', 'red-bank-regional'],
      Independence: ['point-pleasant-borough', 'lacey-township', 'manasquan', 'central-regional', 'southern-regional', 'toms-river-north'],
      Constitution: ['ocean-township', 'marlboro', 'holmdel', 'monmouth-regional', 'middletown-south', 'matawan-regional', 'freehold-boro'],
      Liberty: ['saint-rose', 'barnegat', 'brick-township', 'donovan-catholic', 'manchester-township', 'pinelands-regional', 'new-egypt'],
    }),
    list(['Softball'], ['Girls'], 'Spring', 2027, '2027 Softball Divisions', '/documents/2026/6/22/sc_softball_div_27.pdf', {
      American: ['saint-john-vianney', 'middletown-south', 'red-bank-catholic', 'marlboro', 'raritan', 'holmdel'],
      Freedom: ['donovan-catholic', 'barnegat', 'southern-regional', 'central-regional', 'pinelands-regional', 'toms-river-east'],
      Patriot: ['keansburg', 'red-bank-regional', 'keyport', 'rumson-fair-haven-regional', 'neptune', 'lakewood', 'long-branch'],
      Colonial: ['colts-neck', 'shore-regional', 'middletown-north', 'howell', 'matawan-regional', 'manalapan'],
      Independence: ['jackson-township', 'new-egypt', 'toms-river-south', 'point-pleasant-borough', 'brick-memorial', 'toms-river-north'],
      Constitution: ['freehold-boro', 'freehold-township', 'ocean-township', 'saint-rose', 'wall-township', 'trinity-hall', 'manasquan'],
      Liberty: ['manchester-township', 'Brick', 'point-pleasant-beach', 'lacey-township', 'monmouth-regional', 'henry-hudson-regional'],
    }, ['“Brick” is shown as printed. Could be Brick Township or Brick Memorial.']),
    list(['Golf'], ['Boys'], 'Spring', 2027, '2027 Boys’ Golf Divisions', '/documents/2026/6/22/sc_boys_golf_27.pdf', {
      Nicklaus: ['christian-brothers-academy', 'saint-john-vianney', 'manasquan', 'holmdel', 'wall-township', 'middletown-south'],
      Woods: ['central-regional', 'point-pleasant-beach', 'donovan-catholic', 'lacey-township', 'toms-river-north'],
      Snead: ['ocean-township', 'shore-regional', 'freehold-boro', 'neptune', 'long-branch'],
      Palmer: ['point-pleasant-borough', 'southern-regional', 'toms-river-east', 'toms-river-south', 'barnegat'],
      Mickelson: ['freehold-township', 'monmouth-regional', 'colts-neck', 'middletown-north', 'manalapan', 'howell'],
      Hogan: ['ranney-school', 'saint-rose', 'rumson-fair-haven-regional', 'red-bank-catholic', 'red-bank-regional', 'marlboro'],
      Nelson: ['brick-memorial', 'jackson-township', 'brick-township', 'manchester-township', 'pinelands-regional'],
    }),
    list(['Golf'], ['Girls'], 'Spring', 2027, '2027 Girls’ Golf Divisions', '/documents/2026/6/23/sc_girls_golf_27.pdf', {
      Sorrenstam: ['trinity-hall', 'holmdel', 'saint-john-vianney', 'colts-neck', 'rumson-fair-haven-regional', 'saint-rose'],
      Wright: ['pinelands-regional', 'southern-regional', 'central-regional', 'barnegat', 'jackson-township'],
      Whitworth: ['middletown-south', 'middletown-north', 'marlboro', 'red-bank-catholic', 'freehold-boro', 'ranney-school', 'wall-township'],
      Lopez: ['toms-river-north', 'toms-river-east', 'toms-river-south', 'manchester-township', 'donovan-catholic', 'lacey-township'],
    }),
    list(['Lacrosse'], ['Boys'], 'Spring', 2027, '2027 Boys’ Lacrosse Divisions', '/documents/2026/6/22/sc_boys_lax_27.pdf', {
      American: ['rumson-fair-haven-regional', 'christian-brothers-academy', 'southern-regional', 'manasquan', 'holmdel', 'middletown-south', 'red-bank-regional', 'toms-river-east'],
      Constitution: ['barnegat', 'lacey-township', 'middletown-north', 'jackson-township', 'toms-river-north', 'marlboro', 'saint-john-vianney', 'colts-neck'],
      Colonial: ['wall-township', 'manalapan', 'shore-regional', 'red-bank-catholic', 'point-pleasant-borough', 'brick-memorial', 'ocean-township', 'howell'],
      Freedom: ['freehold-township', 'toms-river-south', 'new-egypt', 'donovan-catholic', 'brick-township', 'central-regional', 'neptune', 'long-branch', 'saint-rose'],
    }),
    list(['Lacrosse'], ['Girls'], 'Spring', 2027, '2027 Girls’ Lacrosse Divisions', '/documents/2026/6/22/sc_girls_lax_27.pdf', {
      American: ['trinity-hall', 'rumson-fair-haven-regional', 'southern-regional', 'red-bank-regional', 'middletown-south', 'barnegat', 'shore-regional'],
      Constitution: ['freehold-township', 'toms-river-south', 'howell', 'red-bank-catholic', 'wall-township', 'marlboro', 'toms-river-north', 'lacey-township'],
      Independence: ['middletown-north', 'point-pleasant-beach', 'saint-rose', 'ranney-school', 'neptune', 'monmouth-regional', 'pinelands-regional', 'manchester-township'],
      Colonial: ['manasquan', 'point-pleasant-borough', 'central-regional', 'holmdel', 'manalapan', 'toms-river-east', 'brick-township'],
      Freedom: ['new-egypt', 'saint-john-vianney', 'colts-neck', 'ocean-township', 'donovan-catholic', 'brick-memorial', 'long-branch', 'jackson-township'],
    }),
    list(['Tennis'], ['Boys'], 'Spring', 2027, '2027 Boys’ Tennis Divisions', '/documents/2026/6/24/sc_boys_tennis_27.pdf', {
      American: ['christian-brothers-academy', 'marlboro', 'ocean-township', 'holmdel', 'ranney-school', 'wall-township', 'rumson-fair-haven-regional', 'colts-neck'],
      Freedom: ['southern-regional', 'point-pleasant-borough', 'pinelands-regional', 'point-pleasant-beach', 'brick-township', 'lacey-township', 'toms-river-east', 'central-regional'],
      Colonial: ['manasquan', 'manalapan', 'middletown-south', 'red-bank-regional', 'neptune', 'matawan-regional', 'henry-hudson-regional', 'freehold-boro'],
      Independence: ['barnegat', 'jackson-township', 'brick-memorial', 'donovan-catholic', 'lakewood', 'toms-river-south', 'toms-river-north', 'manchester-township'],
      Constitution: ['raritan', 'howell', 'shore-regional', 'freehold-township', 'saint-john-vianney', 'monmouth-regional', 'keansburg', 'long-branch'],
    }),
    list(['Track', 'Spring Track'], ['Boys', 'Girls'], 'Spring', 2027, '2027 Boys and Girls’ Track Divisions', '/documents/2026/6/25/Track_2027.pdf', {
      'A North': ['marlboro', 'freehold-township', 'colts-neck', 'manalapan', 'howell', 'christian-brothers-academy', 'long-branch', 'red-bank-regional'],
      'A South': ['toms-river-north', 'toms-river-south', 'toms-river-east', 'southern-regional', 'brick-memorial', 'brick-township', 'jackson-township', 'central-regional'],
      'A Central': ['rumson-fair-haven-regional', 'monmouth-regional', 'raritan', 'wall-township', 'manasquan', 'red-bank-catholic', 'shore-regional', 'trinity-hall'],
      'B North': ['middletown-south', 'middletown-north', 'freehold-boro', 'neptune', 'matawan-regional', 'ocean-township', 'holmdel', 'saint-john-vianney'],
      'B South': ['lacey-township', 'point-pleasant-borough', 'pinelands-regional', 'manchester-township', 'barnegat', 'donovan-catholic', 'lakewood'],
      'B Central': ['saint-rose', 'ranney-school', 'keyport', 'point-pleasant-beach', 'asbury-park', 'henry-hudson-regional', 'new-egypt'],
    }),
    list(['Volleyball'], ['Boys'], 'Spring', 2027, '2027 Boys’ Volleyball Divisions', '/documents/2026/6/24/sc_boys_volleyball_27.pdf', {
      American: ['saint-john-vianney', 'howell', 'holmdel', 'christian-brothers-academy', 'freehold-boro', 'marlboro', 'colts-neck'],
      Constitution: ['wall-township', 'middletown-south', 'long-branch', 'asbury-park', 'middletown-north', 'red-bank-catholic'],
      Colonial: ['southern-regional', 'barnegat', 'pinelands-regional', 'jackson-township', 'lacey-township'],
      Freedom: ['central-regional', 'manchester-township', 'toms-river-south', 'toms-river-north', 'toms-river-east', 'lakewood'],
    }),
    list(['Flag Football'], ['Girls'], 'Spring', 2027, '2027 Flag Football Divisions', '/documents/2026/6/24/2027_flag_divisions.pdf', {
      American: ['keansburg', 'raritan', 'matawan-regional', 'middletown-north', 'saint-john-vianney', 'holmdel', 'rumson-fair-haven-regional', 'middletown-south', 'red-bank-catholic'],
      Constitution: ['neptune', 'howell', 'manasquan', 'brick-memorial', 'brick-township', 'central-regional', 'barnegat', 'pinelands-regional'],
      Colonial: ['marlboro', 'ranney-school', 'trinity-hall', 'shore-regional', 'long-branch', 'manalapan', 'colts-neck', 'freehold-boro', 'freehold-township'],
    }),
  ];

  // Athletics links from the member list on the conference home page. "verified" means the link was
  // listed there and loaded a page naming the school or its athletics on the review date.
  // Only verified links are shown. A note says what to settle for the rest.
  const ok = url => ({ url, status: 'verified', reviewed });
  const check = (url, note) => ({ url, status: 'needs-review', reviewed, note });
  const schoolSites = {
    'asbury-park': ok('https://aphs.asburypark.k12.nj.us/students'),
    barnegat: check('https://www.barnegatschools.com/departments-programs/athletics/welcome', 'Listed link returns Page Not Found.'),
    'brick-memorial': ok('https://www.brickschools.org/bmhs/athletics/'),
    'brick-township': ok('https://www.brickschools.org/bths/home-default/athletics/'),
    'central-regional': ok('https://www.wearecrsd.com/o/crhs/page/athletics-hs'),
    'christian-brothers-academy': ok('https://www.letsgocolts.com/'),
    'colts-neck': ok('https://sites.google.com/frhsd.com/cnhsseca/home'),
    'donovan-catholic': check('https://www.donovancatholic.org/student-life/athletics', 'Listed link returns 404.'),
    'freehold-boro': ok('https://sites.google.com/frhsd.com/fhsseca/home'),
    'freehold-township': ok('https://sites.google.com/frhsd.com/fthsseca/home'),
    'henry-hudson-regional': ok('https://hhrs.tridistrict.org/apps/pages/index.jsp?uREC_ID=3760859&type=d&pREC_ID=2440079'),
    holmdel: check('https://holmdelhs-ar.rschooltoday.com/', 'Listed link redirects to a vendor sales page.'),
    howell: ok('https://sites.google.com/frhsd.com/hhsseca/home'),
    'jackson-township': check('https://www.jacksonsd.org/Page/7348', 'The conference menu still lists Jackson Liberty and Jackson Memorial, and both links fail. Its Jackson Township record points here, which opens the district home page. Confirm the current athletics page.'),
    keansburg: check('https://www.keansburg.k12.nj.us/domain/137', 'Listed link returns Page Not Found.'),
    keyport: check('https://www.kpsdschools.org/o/central/page/kcs-athletics', 'Loads, but the page is titled for Keyport Central School. Confirm it is the high school page.'),
    'lacey-township': check('https://www.laceyschools.org/domain/74', 'Listed link returns Page Not Found.'),
    lakewood: check('https://www.lakewoodpiners.org/', 'Loads the district home page, not an athletics page.'),
    'long-branch': ok('https://sites.google.com/longbranch.k12.nj.us/long-branch-athletic-depart/athletic-schedules'),
    manalapan: ok('https://sites.google.com/frhsd.com/mnhsseca/home'),
    manasquan: check('https://www.manasquanschools.org/domain/76', 'Listed link returns Page Not Found.'),
    'manchester-township': ok('https://www.manchestertwp.org/o/mths/page/athletics'),
    marlboro: ok('https://sites.google.com/frhsd.com/mrhsseca/home'),
    'matawan-regional': check('https://sites.google.com/marsd.org/mrhs-athletics', 'Listed link asks for a Google sign-in.'),
    'middletown-north': ok('https://www.northlionssports.com/'),
    'middletown-south': ok('https://www.southeaglessports.com/'),
    'monmouth-regional': ok('https://monmouthregionalathletics.com/'),
    neptune: ok('https://hs.neptuneschools.org/apps/cross.jsp?wREC_ID=4781&crossPath=/apps/pages/index.jsp%3FuREC_ID%3D358473%26type%3Dd'),
    'new-egypt': ok('https://sites.google.com/newegypt.us/newegyptwarriorathletics/homegame-schedules'),
    // Ocean Academy is not in the conference's member list, so it has no entry.
    'ocean-township': check('https://www.oceanschools.org/athletics_activities', 'Listed link returns Page Not Found.'),
    'pinelands-regional': ok('https://www.pinelandsregional.org/page/athletics-overview'),
    'point-pleasant-beach': ok('https://www.ptbeach.com/o/ppbhs/page/athletics'),
    'point-pleasant-borough': ok('https://pointpleasant.k12.nj.us/apps/pages/index.jsp?uREC_ID=425847&type=d'),
    'ranney-school': ok('https://www.ranneyschool.org/athletics'),
    raritan: ok('https://raritansports.com/'),
    'red-bank-catholic': ok('https://www.redbankcatholiccaseys.com/'),
    'red-bank-regional': ok('https://www.rbrhs.org/athletics'),
    'rumson-fair-haven-regional': check('https://www.rumsonfairhaven.org/domain/47', 'Listed link returns Page Not Found.'),
    'saint-john-vianney': ok('https://www.sjvhs.com/athletics'),
    'saint-rose': check('https://www.srhsnj.com/athleticshome', 'Returned Forbidden to an automated check. Open it in a browser to confirm.'),
    'shore-regional': ok('https://www.shoreregional.org/apps/pages/index.jsp?uREC_ID=543574&type=d'),
    'southern-regional': ok('https://athletics.srsd.net/'),
    'toms-river-east': ok('https://trhseraiders.org/'),
    'toms-river-north': ok('https://tomsriverhighschoolnorth.bigteams.com/'),
    'toms-river-south': ok('https://tomsriverhighschoolsouth.bigteams.com/'),
    'trinity-hall': ok('https://www.trinityhallnj.org/apps/pages/index.jsp?uREC_ID=1189094&type=d&pREC_ID=1432562'),
    'wall-township': check('https://www.wallpublicschools.org/Page/2463', 'Listed link returns Page Not Found.'),
  };

  // What the conference has posted for a tournament. A conference admin can copy this into a
  // tournament's "Rules and dates" section. Dates the sources disagree on stay unconfirmed.
  const chart = savedCopy('/documents/2026/9/24/Shore_Conference_Quick_Chart_2025_2028_Fall.pdf');
  const cutoff = { label: 'Qualification cutoff', date: '', confirmed: false,
    note: 'Regulations say Oct 10, 2026. Quick chart says Oct 11.' };
  const tournamentSources = [{
    sports: ['Soccer'], genders: ['Boys', 'Girls'], season: 'Fall', year: 2026, reviewed,
    rules_title: '2026 SCT Soccer Rules and Regulations',
    rules_url: savedCopy('/documents/2026/9/24/2026_SCT_Soccer_Rules_and_Regulations.pdf'),
    chart_url: chart,
    // Named in the 2026 regulations. The conference's director list is still the 2025-26 one.
    director: 'Josh Mehl and Ted Gillen',
    dates: {
      Boys: [cutoff,
        { label: 'Round 1', date: '2026-10-14', confirmed: true, note: '' },
        { label: 'Round 2', date: '2026-10-16', confirmed: true, note: '' },
        { label: 'Quarterfinals', date: '', confirmed: false, note: 'Regulations say Oct 20. Their Changes section and the quick chart say Oct 19.' },
        { label: 'Semifinals', date: '', confirmed: false, note: 'Regulations say Oct 22. Their Changes section and the quick chart say Oct 21.' },
        { label: 'Finals', date: '2026-10-24', confirmed: true, note: '' }],
      Girls: [cutoff,
        { label: 'Round 1', date: '2026-10-13', confirmed: true, note: '' },
        { label: 'Round 2', date: '2026-10-15', confirmed: true, note: '' },
        { label: 'Quarterfinals', date: '', confirmed: false, note: 'Regulations say Oct 19, their Changes section says Oct 17, and the quick chart says Oct 20.' },
        { label: 'Semifinals', date: '', confirmed: false, note: 'Regulations say Oct 21, their Changes section says Oct 20, and the quick chart says Oct 22.' },
        { label: 'Finals', date: '2026-10-24', confirmed: true, note: '' }],
    },
  }];

  return { divisionLists, schoolSites, tournamentSources };
})();

// Public resource index: saved copies only. Source labels do not assert that a document is current.
const shorePublicResources = {
  "documents": [
    {
      "title": "History of the Shore Conference",
      "url": "assets/documents/HISTORY_OF_THE_SHORE_CONFERENCE.pdf",
      "description": "The conference history, from its founding in 1936 through later membership and organizational changes.",
      "category": "History",
      "version": "Official history; posted 2022",
      "format": "PDF",
      "reviewed": "2026-11-12"
    },
    {
      "title": "Shore Conference Constitution",
      "url": "assets/documents/SC_Constitution_2024_.pdf",
      "description": "The adopted conference constitution. Consult the original for the full governing text.",
      "category": "Governance",
      "version": "Revised June 2024",
      "format": "PDF",
      "reviewed": "2026-11-12",
      "note": "This is the linked edition; confirm any later amendments with the conference office."
    },
    {
      "title": "Executive Committee",
      "url": "assets/documents/SC_Exec_Comm_26.pdf",
      "description": "The published executive committee roster for 2025-26.",
      "category": "Leadership",
      "version": "2025-26",
      "format": "PDF",
      "reviewed": "2026-11-12",
      "note": "Past-season roster. Current appointments have not been confirmed."
    },
    {
      "title": "Tournament Directors",
      "url": "archive.html?page=GEN_sct-directors-26",
      "description": "Sport-by-sport tournament director information for 2025-26.",
      "category": "Leadership",
      "version": "2025-26",
      "format": "Web page",
      "reviewed": "2026-11-12",
      "note": "Past-season list. Check the current competition regulations before contacting a director."
    },
    {
      "title": "Professional Service and Lifetime Award Forms",
      "url": "assets/documents/PROFESSIONAL_SERVICE_and_LIFETIME_AWARD.pdf",
      "description": "Award criteria and blank nomination forms. Completed nominations go to the conference, not this public page.",
      "category": "Forms",
      "version": "Posted November 2022",
      "format": "PDF",
      "reviewed": "2026-11-12",
      "note": "Confirm the deadline and recipient with the conference office before submitting."
    }
  ],
  "tournaments": [
    {
      "title": "2026 Field Hockey SCT Bracket",
      "url": "assets/documents/FH_SCT_2026_SCT_2026.pdf",
      "description": "Official tournament bracket file for the field hockey SCT.",
      "category": "Bracket",
      "version": "2026",
      "format": "PDF",
      "reviewed": "2026-11-12",
      "sport": "Field Hockey",
      "competition": "SCT",
      "year": 2026
    },
    {
      "title": "2026 Field Hockey Coaches Cup Bracket",
      "url": "assets/documents/FH_Coaches_Cup_2026_Coaches_Cup_2026.pdf",
      "description": "Separate field hockey competition, with its own seeded bracket.",
      "category": "Bracket",
      "version": "2026",
      "format": "PDF",
      "reviewed": "2026-11-12",
      "sport": "Field Hockey",
      "competition": "Coaches Cup",
      "year": 2026,
      "note": "The source includes a spreadsheet error. Confirm unclear bracket details with the conference office."
    },
    {
      "title": "2026 Field Hockey Tournament Regulations",
      "url": "assets/documents/Shore_Conference_Field_Hockey_Tournament_Regulations.pdf",
      "description": "Official entry and competition regulations for the field hockey tournament.",
      "category": "Regulations",
      "version": "2026",
      "format": "PDF",
      "reviewed": "2026-11-12",
      "sport": "Field Hockey",
      "competition": "SCT",
      "year": 2026
    },
    {
      "title": "2026 Soccer Rules and Entry Information",
      "url": "assets/documents/2026_SCT_Soccer_Rules_and_Regulations.pdf",
      "description": "Boys' and girls' SCT regulations and entry information.",
      "category": "Regulations",
      "version": "2026",
      "format": "PDF",
      "reviewed": "2026-11-12",
      "sport": "Soccer",
      "competition": "SCT",
      "year": 2026,
      "note": "Some dates disagree with the quick chart. Confirm dates with the conference office; this page does not resolve the discrepancy."
    },
    {
      "title": "2026 Girls Volleyball SCT Bracket",
      "url": "assets/documents/2026_SCT_GVB_Bracket.pdf",
      "description": "The official girls' volleyball SCT bracket.",
      "category": "Bracket",
      "version": "2026",
      "format": "PDF",
      "reviewed": "2026-11-12",
      "sport": "Volleyball",
      "competition": "SCT",
      "year": 2026
    },
    {
      "title": "2026 Girls Volleyball Kim Cole Cup Bracket",
      "url": "assets/documents/2026_Girls_Volleyball_Kim_Cole_Cup_Bracket.pdf",
      "description": "The Kim Cole Cup is listed separately from the girls' volleyball SCT.",
      "category": "Bracket",
      "version": "2026",
      "format": "PDF",
      "reviewed": "2026-11-12",
      "sport": "Volleyball",
      "competition": "Kim Cole Cup",
      "year": 2026
    }
  ]
};
