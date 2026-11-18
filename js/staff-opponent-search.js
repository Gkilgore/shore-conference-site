// Finds opponent choices for the staff game editor and prepares saved game values.
function searchStaffOpponents(directory, query, schoolSlug) {
  const aliases = {
    'middletown high school north': 'middletown north',
    'middletown high school south': 'middletown south',
    'ocean academy charter school': 'ocean academy',
    'st. rose high school': 'saint rose',
    'toms river high school east': 'toms river east',
    'toms river high school north': 'toms river north',
    'toms river high school south': 'toms river south',
    'wall high school': 'wall township',
  };
  const typed = query.trim().toLocaleLowerCase();
  const normalized = aliases[typed] ?? typed.replace(/ high school$/, '');
  const words = normalized.split(/\s+/).filter(Boolean);
  const groups = [
    { source: 'conference', title: 'Shore Conference', items: [] },
    { source: 'custom', title: 'Your saved schools', items: [] },
    { source: 'njsiaa', title: 'NJSIAA schools', items: [] },
  ];
  for (const item of directory) {
    if (item.slug === schoolSlug || (item.source === 'custom' && item.added_by_school !== schoolSlug)) continue;
    const group = groups.find(group => group.source === item.source);
    if (group && words.every(word => item.name.toLocaleLowerCase().includes(word))) group.items.push(item);
  }
  for (const group of groups) {
    group.items.sort((a, b) => a.name.localeCompare(b.name));
    group.items.length = Math.min(group.items.length, 8);
  }
  return groups.filter(group => group.items.length);
}

function opponentSelection(item) {
  return {
    opponent_school_id: item?.source === 'conference' ? item.slug : null,
    opponent_directory_slug: item?.slug ?? null,
    opponent_name: item?.source === 'conference' ? null : item?.name ?? null,
  };
}

function opponentAwayVenue(homeAway, currentVenue, item) {
  if (homeAway !== 'Away' || currentVenue.trim() || !item?.address) return currentVenue;
  return item.name + ', ' + item.address;
}

function opponentTown(address) {
  const last = (address ?? '').split(',').at(-1).trim();
  return last.replace(/\s+NJ\s+\d{5}(?:-\d{4})?$/i, '').trim() || last;
}
