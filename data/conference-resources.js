// Facts copied by hand from theshoreconference.com: division lists, school athletics links and
// tournament sources. Greg updates this file through a pull request; docs/conference-resources.md says how.
// Every entry carries its official URL, a review status and the date it was last checked.
const shoreConferenceResources = (() => {
  const site = 'https://theshoreconference.com';
  const reviewed = '2026-11-10';
  // The official lists do not name a level. They are recorded, and shown, as varsity only.
  // year: the fall calendar year for Fall and Winter, the spring calendar year for Spring.
  // complete: every division listed here has its full member list. Divisions with no pilot school are left out.
  // Members are directory slugs. A name with no single matching school stays as the list prints it.
  const list = (sports, genders, season, year, title, path, complete, divisions) => ({
    sports, genders, level: 'Varsity', season, year, title, url: site + path, status: 'verified', reviewed, complete, divisions });

  const divisionLists = [
    list(['Soccer'], ['Boys'], 'Fall', 2026, '2026 Boys’ Soccer Divisions', '/sports/2026/6/24/MSOC_2026-divisions.aspx', true, {
      'A North': ['colts-neck', 'christian-brothers-academy', 'middletown-south', 'marlboro', 'manalapan', 'saint-john-vianney', 'freehold-township'],
      'A Central': ['holmdel', 'shore-regional', 'ocean-township', 'long-branch', 'manasquan', 'rumson-fair-haven-regional', 'ranney-school'],
    }),
    list(['Soccer'], ['Girls'], 'Fall', 2026, '2026 Girls’ Soccer Divisions', '/sports/2025/12/12/divs-26-girls-soccer.aspx', true, {
      'B North': ['colts-neck', 'holmdel', 'monmouth-regional', 'neptune', 'ocean-township', 'red-bank-regional', 'shore-regional'],
      'A Central': ['freehold-boro', 'freehold-township', 'manasquan', 'marlboro', 'middletown-north', 'raritan', 'wall-township'],
    }),
    list(['Field Hockey'], ['Girls'], 'Fall', 2026, '2026 Field Hockey Divisions', '/sports/2026/6/24/FH_2026_divisions.aspx', true, {
      'A North': ['freehold-township', 'manalapan', 'middletown-south', 'ocean-township', 'rumson-fair-haven-regional', 'shore-regional', 'trinity-hall'],
      'B North': ['colts-neck', 'holmdel', 'middletown-north', 'monmouth-regional', 'red-bank-catholic', 'red-bank-regional', 'saint-john-vianney'],
    }),
    list(['Tennis'], ['Girls'], 'Fall', 2026, '2026 Girls Tennis Divisions', '/sports/2026/6/24/WTEN_2026-divisions.aspx', true, {
      'A North': ['colts-neck', 'holmdel', 'manalapan', 'middletown-south', 'red-bank-catholic', 'red-bank-regional', 'rumson-fair-haven-regional'],
      'B North': ['freehold-township', 'marlboro', 'monmouth-regional', 'ocean-township', 'ranney-school', 'shore-regional', 'trinity-hall'],
    }),
    list(['Volleyball'], ['Girls'], 'Fall', 2026, '2026 Girls Volleyball Divisions', '/sports/2026/6/24/WVB_-2026-divisions.aspx', true, {
      'A North': ['holmdel', 'howell', 'marlboro', 'raritan', 'saint-john-vianney', 'trinity-hall'],
      'B North': ['colts-neck', 'middletown-north', 'middletown-south', 'rumson-fair-haven-regional', 'shore-regional', 'saint-rose'],
    }),
    list(['Cross Country'], ['Boys', 'Girls'], 'Fall', 2026, '2026 Boys and Girls’ Cross Country Divisions', '/sports/2026/6/24/xc-2026-divisions.aspx', true, {
      'A North': ['howell', 'freehold-township', 'christian-brothers-academy', 'marlboro', 'manalapan', 'colts-neck', 'red-bank-regional', 'long-branch'],
      'A Central': ['rumson-fair-haven-regional', 'monmouth-regional', 'raritan', 'wall-township', 'red-bank-catholic', 'trinity-hall', 'shore-regional', 'manasquan'],
    }),
    list(['Football'], ['Boys'], 'Fall', 2026, '2026 Football Divisions', '/documents/2026/6/22/sc_football_26.pdf', true, {
      'B North': ['freehold-township', 'manasquan', 'matawan-regional', 'middletown-north', 'middletown-south', 'shore-regional'],
      'C North': ['howell', 'marlboro', 'neptune', 'ocean-township', 'raritan', 'Red Bank'],
      'D North': ['asbury-park', 'barnegat', 'colts-neck', 'long-branch', 'manchester-township', 'monmouth-regional'],
    }),
    list(['Gymnastics'], ['Girls'], 'Fall', 2026, '2026 Gymnastics Divisions', '/documents/2026/9/2/Gymnastics_2026_Divisions.pdf', false, {
      'A North': ['marlboro', 'colts-neck'],
    }),

    list(['Basketball'], ['Boys'], 'Winter', 2026, '2026-27 Boys’ Basketball Divisions', '/documents/2026/6/25/sc_boys_basketball_27.pdf', true, {
      'A North': ['christian-brothers-academy', 'howell', 'manasquan', 'marlboro', 'red-bank-catholic', 'wall-township'],
      'A Central': ['colts-neck', 'henry-hudson-regional', 'middletown-south', 'monmouth-regional', 'shore-regional', 'saint-rose'],
    }),
    list(['Basketball'], ['Girls'], 'Winter', 2026, '2026-27 Girls’ Basketball Divisions', '/documents/2026/6/25/sc_girls_basketball_27.pdf', true, {
      'B North': ['colts-neck', 'middletown-south', 'neptune', 'red-bank-regional', 'shore-regional', 'saint-rose'],
      'A Central': ['freehold-boro', 'freehold-township', 'holmdel', 'keansburg', 'marlboro', 'middletown-north'],
    }),
    list(['Ice Hockey'], ['Boys', 'Coed'], 'Winter', 2026, '2026-27 Ice Hockey Divisions', '/sports/2026/6/25/MHOCKEY_27-divisions.aspx?path=mhockey', true, {
      'Shore North': ['Brick', 'christian-brothers-academy', 'freehold-township', 'howell', 'manalapan', 'manasquan', 'marlboro', 'middletown-north', 'red-bank-catholic', 'toms-river-east'],
    }),
    list(['Wrestling'], ['Boys'], 'Winter', 2026, '2026-27 Boys’ Wrestling Divisions', '/sports/2026/6/25/WREST_27-divisions.aspx', true, {
      Independence: ['colts-neck', 'manasquan', 'matawan-regional', 'raritan', 'saint-john-vianney'],
      Federal: ['central-regional', 'long-branch', 'marlboro', 'toms-river-north', 'toms-river-south'],
      Royal: ['barnegat', 'brick-township', 'manalapan', 'point-pleasant-beach', 'pinelands-regional', 'shore-regional'],
    }),
    list(['Wrestling'], ['Girls'], 'Winter', 2026, '2026-27 Girls’ Wrestling Divisions', '/sports/2026/6/25/WWREST_27-divisions.aspx', true, {
      'A North': ['freehold-boro', 'howell', 'manalapan', 'marlboro', 'Middletown', 'raritan'],
    }),
    list(['Swimming'], ['Boys', 'Girls'], 'Winter', 2026, '2026-27 Boys and Girls’ Swimming Divisions', '/documents/2026/6/25/2026_2027_Boys_and_Girls_Swimming.pdf', false, null),

    list(['Baseball'], ['Boys'], 'Spring', 2027, '2027 Baseball Divisions', '/documents/2026/6/22/SC_Baseball_Div_27.pdf', true, {
      American: ['red-bank-catholic', 'christian-brothers-academy', 'colts-neck', 'rumson-fair-haven-regional', 'howell', 'ranney-school'],
      Colonial: ['manalapan', 'freehold-township', 'raritan', 'saint-john-vianney', 'shore-regional', 'middletown-north', 'red-bank-regional'],
      Constitution: ['ocean-township', 'marlboro', 'holmdel', 'monmouth-regional', 'middletown-south', 'matawan-regional', 'freehold-boro'],
    }),
    list(['Softball'], ['Girls'], 'Spring', 2027, '2027 Softball Divisions', '/documents/2026/6/22/sc_softball_div_27.pdf', true, {
      American: ['saint-john-vianney', 'middletown-south', 'red-bank-catholic', 'marlboro', 'raritan', 'holmdel'],
      Colonial: ['colts-neck', 'shore-regional', 'middletown-north', 'howell', 'matawan-regional', 'manalapan'],
    }),
    list(['Golf'], ['Boys'], 'Spring', 2027, '2027 Boys’ Golf Divisions', '/documents/2026/6/22/sc_boys_golf_27.pdf', true, {
      Mickelson: ['freehold-township', 'monmouth-regional', 'colts-neck', 'middletown-north', 'manalapan', 'howell'],
      Hogan: ['ranney-school', 'saint-rose', 'rumson-fair-haven-regional', 'red-bank-catholic', 'red-bank-regional', 'marlboro'],
      Snead: ['ocean-township', 'shore-regional', 'freehold-boro', 'neptune', 'long-branch'],
    }),
    list(['Golf'], ['Girls'], 'Spring', 2027, '2027 Girls’ Golf Divisions', '/documents/2026/6/23/sc_girls_golf_27.pdf', true, {
      Sorrenstam: ['trinity-hall', 'holmdel', 'saint-john-vianney', 'colts-neck', 'rumson-fair-haven-regional', 'saint-rose'],
      Whitworth: ['middletown-south', 'middletown-north', 'marlboro', 'red-bank-catholic', 'freehold-boro', 'ranney-school', 'wall-township'],
    }),
    list(['Lacrosse'], ['Boys'], 'Spring', 2027, '2027 Boys’ Lacrosse Divisions', '/documents/2026/6/22/sc_boys_lax_27.pdf', true, {
      Colonial: ['wall-township', 'manalapan', 'shore-regional', 'red-bank-catholic', 'point-pleasant-borough', 'brick-memorial', 'ocean-township', 'howell'],
      Constitution: ['barnegat', 'lacey-township', 'middletown-north', 'jackson-township', 'toms-river-north', 'marlboro', 'saint-john-vianney', 'colts-neck'],
    }),
    list(['Lacrosse'], ['Girls'], 'Spring', 2027, '2027 Girls’ Lacrosse Divisions', '/documents/2026/6/22/sc_girls_lax_27.pdf', true, {
      American: ['trinity-hall', 'rumson-fair-haven-regional', 'southern-regional', 'red-bank-regional', 'middletown-south', 'barnegat', 'shore-regional'],
      Constitution: ['freehold-township', 'toms-river-south', 'howell', 'red-bank-catholic', 'wall-township', 'marlboro', 'toms-river-north', 'lacey-township'],
      Freedom: ['new-egypt', 'saint-john-vianney', 'colts-neck', 'ocean-township', 'donovan-catholic', 'brick-memorial', 'long-branch', 'jackson-township'],
    }),
    list(['Tennis'], ['Boys'], 'Spring', 2027, '2027 Boys’ Tennis Divisions', '/documents/2026/6/24/sc_boys_tennis_27.pdf', true, {
      American: ['christian-brothers-academy', 'marlboro', 'ocean-township', 'holmdel', 'ranney-school', 'wall-township', 'rumson-fair-haven-regional', 'colts-neck'],
      Constitution: ['raritan', 'howell', 'shore-regional', 'freehold-township', 'saint-john-vianney', 'monmouth-regional', 'keansburg', 'long-branch'],
    }),
    list(['Track', 'Spring Track'], ['Boys', 'Girls'], 'Spring', 2027, '2027 Boys and Girls’ Track Divisions', '/documents/2026/6/25/Track_2027.pdf', false, {
      'A North': ['marlboro', 'colts-neck'],
      'A Central': ['shore-regional'],
    }),
    list(['Volleyball'], ['Boys'], 'Spring', 2027, '2027 Boys’ Volleyball Divisions', '/documents/2026/6/24/sc_boys_volleyball_27.pdf', true, {
      American: ['saint-john-vianney', 'howell', 'holmdel', 'christian-brothers-academy', 'freehold-boro', 'marlboro', 'colts-neck'],
    }),
    list(['Flag Football'], ['Girls'], 'Spring', 2027, '2027 Flag Football Divisions', '/documents/2026/6/24/2027_flag_divisions.pdf', true, {
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
  const chart = site + '/documents/2026/9/24/Shore_Conference_Quick_Chart_2025_2028_Fall.pdf';
  const cutoff = { label: 'Qualification cutoff', date: '', confirmed: false,
    note: 'Regulations say Oct 10, 2026. Quick chart says Oct 11.' };
  const tournamentSources = [{
    sports: ['Soccer'], genders: ['Boys', 'Girls'], season: 'Fall', year: 2026, reviewed,
    rules_title: '2026 SCT Soccer Rules and Regulations',
    rules_url: site + '/documents/2026/9/24/2026_SCT_Soccer_Rules_and_Regulations.pdf',
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
