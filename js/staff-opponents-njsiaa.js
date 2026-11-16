// NJSIAA member schools browser for the Opponents tab
function startNjsiaaSchoolsBrowser() {
  const searchInput = document.getElementById('njsiaa-search');
  const schoolsList = document.getElementById('njsiaa-schools-list');
  const noResults = document.getElementById('njsiaa-no-results');
  
  let schools = [];
  let filteredSchools = [];

  // Load schools from the global njsiaaSchools variable
  function loadSchools() {
    if (typeof njsiaaSchools !== 'undefined' && Array.isArray(njsiaaSchools)) {
      schools = njsiaaSchools;
      displaySchools(schools);
    }
  }

  function displaySchools(schoolsToShow) {
    filteredSchools = schoolsToShow;
    schoolsList.replaceChildren();

    if (schoolsToShow.length === 0) {
      noResults.hidden = false;
      return;
    }

    noResults.hidden = true;
    
    schoolsToShow.forEach(school => {
      const item = document.createElement('li');
      item.className = 'njsiaa-school-item';
      
      const name = document.createElement('div');
      name.className = 'njsiaa-school-name';
      name.textContent = school.name;
      
      const address = document.createElement('div');
      address.className = 'njsiaa-school-address';
      address.textContent = school.address;
      
      const details = document.createElement('div');
      details.className = 'njsiaa-school-details';
      
      if (school.phone) {
        const phone = document.createElement('span');
        phone.className = 'njsiaa-school-phone';
        phone.textContent = `Phone: ${school.phone}`;
        details.appendChild(phone);
      }
      
      if (school.athletic_director) {
        const ad = document.createElement('span');
        ad.className = 'njsiaa-school-ad';
        ad.textContent = `AD: ${school.athletic_director}`;
        details.appendChild(ad);
      }
      
      const addButton = document.createElement('button');
      addButton.className = 'button secondary njsiaa-add-button';
      addButton.type = 'button';
      addButton.textContent = 'Add to opponent list';
      addButton.setAttribute('aria-label', `Add ${school.name} to your opponent list`);
      addButton.onclick = () => addToOpponentList(school);
      
      item.append(name, address, details, addButton);
      schoolsList.appendChild(item);
    });
  }

  function filterSchools(query) {
    if (!query.trim()) {
      displaySchools(schools);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = schools.filter(school =>
      school.name.toLowerCase().includes(lowerQuery) ||
      school.address.toLowerCase().includes(lowerQuery) ||
      (school.phone && school.phone.toLowerCase().includes(lowerQuery))
    );

    displaySchools(filtered);
  }

  function addToOpponentList(school) {
    // Populate the manual opponent form with the school name and trigger add
    const nameInput = document.getElementById('opponent-name');
    const form = document.getElementById('opponent-add-form');
    
    if (nameInput && form) {
      nameInput.value = school.name;
      form.requestSubmit(); // Programmatically submit the form
    }
  }

  // Event listeners
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      filterSchools(e.target.value);
    });
  }

  // Load schools on initialization
  loadSchools();

  return {
    loadSchools,
    filterSchools,
    getSchools: () => schools,
    getFiltered: () => filteredSchools,
  };
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startNjsiaaSchoolsBrowser);
} else {
  startNjsiaaSchoolsBrowser();
}
