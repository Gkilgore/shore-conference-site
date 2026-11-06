// Verified Shore member directory; unverified school branding uses conference colors and logo.
// NJSIAA league/conference list, updated July 23, 2026, page 5:
// https://www.njsiaa.org/sites/default/files/documents/2025-10/lc-schools-list-for-web.pdf
const shoreSchools = Object.fromEntries([
  ['asbury-park', 'Asbury Park'],
  ['barnegat', 'Barnegat'],
  ['brick-memorial', 'Brick Memorial'],
  ['brick-township', 'Brick Township'],
  ['central-regional', 'Central Regional'],
  ['christian-brothers-academy', 'Christian Brothers Academy'],
  ['colts-neck', 'Colts Neck'],
  ['donovan-catholic', 'Donovan Catholic'],
  ['freehold-boro', 'Freehold Boro'],
  ['freehold-township', 'Freehold Township'],
  ['henry-hudson-regional', 'Henry Hudson Regional'],
  ['holmdel', 'Holmdel'],
  ['howell', 'Howell'],
  ['jackson-township', 'Jackson Township'],
  ['keansburg', 'Keansburg'],
  ['keyport', 'Keyport'],
  ['lacey-township', 'Lacey Township'],
  ['lakewood', 'Lakewood'],
  ['long-branch', 'Long Branch'],
  ['manalapan', 'Manalapan'],
  ['manasquan', 'Manasquan'],
  ['manchester-township', 'Manchester Township'],
  ['marlboro', 'Marlboro'],
  ['matawan-regional', 'Matawan Regional'],
  ['middletown-north', 'Middletown North'],
  ['middletown-south', 'Middletown South'],
  ['monmouth-regional', 'Monmouth Regional'],
  ['neptune', 'Neptune'],
  ['new-egypt', 'New Egypt'],
  ['ocean-academy', 'Ocean Academy'],
  ['ocean-township', 'Ocean Township'],
  ['pinelands-regional', 'Pinelands Regional'],
  ['point-pleasant-beach', 'Point Pleasant Beach'],
  ['point-pleasant-borough', 'Point Pleasant Borough'],
  ['ranney-school', 'Ranney School'],
  ['raritan', 'Raritan'],
  ['red-bank-catholic', 'Red Bank Catholic'],
  ['red-bank-regional', 'Red Bank Regional'],
  ['rumson-fair-haven-regional', 'Rumson-Fair Haven Regional'],
  ['saint-john-vianney', 'Saint John Vianney'],
  ['saint-rose', 'Saint Rose'],
  ['shore-regional', 'Shore Regional'],
  ['southern-regional', 'Southern Regional'],
  ['toms-river-east', 'Toms River East'],
  ['toms-river-north', 'Toms River North'],
  ['toms-river-south', 'Toms River South'],
  ['trinity-hall', 'Trinity Hall'],
  ['wall-township', 'Wall Township'],
].map(([slug, name]) => [slug, {
  name, color: '#002857', accent: '#f3efe6', logo: 'assets/logos/shore-conference.svg',
}]));

Object.assign(shoreSchools['colts-neck'], {
  color: '#2f4a29', accent: '#dad8d9', logo: 'assets/logos/colts-neck.png',
});
Object.assign(shoreSchools.marlboro, {
  color: '#183366', accent: '#ffcc00', logo: 'assets/logos/marlboro.png',
});
Object.assign(shoreSchools['shore-regional'], {
  color: '#004990', accent: '#d4e0ec', logo: 'assets/logos/shore-regional.png',
});
