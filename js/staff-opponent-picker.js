// Provides the game editor's keyboard-accessible opponent search and add flow.
function startStaffOpponentPicker({ currentSchool, directory, saveSchool, onSelect }) {
  const input = document.getElementById('game-opponent-search');
  const list = document.getElementById('game-opponent-results');
  const inline = document.getElementById('game-opponent-add');
  const newName = document.getElementById('game-opponent-new-name');
  const newAddress = document.getElementById('game-opponent-new-address');
  const addButton = document.getElementById('game-opponent-add-save');
  const status = document.getElementById('game-opponent-status');
  let chosen = null, options = [], index = -1;

  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    index = -1;
  }

  function set(item) {
    chosen = item;
    input.value = item?.name ?? '';
    inline.hidden = true;
    status.textContent = '';
    close();
    onSelect(item);
  }

  function openAdd() {
    newName.value = input.value.trim();
    newAddress.value = '';
    inline.hidden = false;
    close();
    newName.focus();
  }

  function render() {
    const groups = searchStaffOpponents(directory(), input.value, currentSchool()?.slug);
    options = [];
    const nodes = [];
    for (const group of groups) {
      const heading = document.createElement('li');
      heading.className = 'opponent-result-heading';
      heading.textContent = group.title;
      heading.setAttribute('role', 'presentation');
      nodes.push(heading);
      for (const item of group.items) {
        const row = document.createElement('li');
        row.id = 'opponent-option-' + options.length;
        row.className = 'opponent-result';
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', 'false');
        const name = document.createElement('strong');
        name.textContent = item.name;
        row.append(name);
        if (item.address) {
          const address = document.createElement('small');
          address.textContent = opponentTown(item.address);
          row.append(address);
        }
        row.onmousedown = event => event.preventDefault();
        row.onclick = () => set(item);
        options.push({ node: row, act: () => set(item) });
        nodes.push(row);
      }
    }
    const add = document.createElement('li');
    add.id = 'opponent-option-' + options.length;
    add.className = 'opponent-result';
    add.setAttribute('role', 'option');
    add.setAttribute('aria-selected', 'false');
    add.textContent = input.value.trim()
      ? 'Add “' + input.value.trim() + '” as a new school' : 'Add a new school';
    add.onmousedown = event => event.preventDefault();
    add.onclick = openAdd;
    options.push({ node: add, act: openAdd });
    nodes.push(add);
    list.replaceChildren(...nodes);
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    index = -1;
  }

  function highlight(next) {
    if (!options.length) return;
    if (index >= 0) options[index].node.setAttribute('aria-selected', 'false');
    index = (next + options.length) % options.length;
    options[index].node.setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', options[index].node.id);
    options[index].node.scrollIntoView?.({ block: 'nearest' });
  }

  input.onfocus = render;
  input.oninput = () => {
    chosen = null;
    onSelect(null);
    render();
  };
  input.onkeydown = event => {
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (list.hidden) render();
      highlight(index + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Enter' && !list.hidden) {
      event.preventDefault();
      if (index < 0) highlight(0);
      options[index]?.act();
    }
  };
  input.onblur = () => setTimeout(() => {
    if (!inline.contains(document.activeElement)) close();
  }, 100);
  addButton.onclick = async () => {
    addButton.disabled = true;
    const saved = await saveSchool(newName.value, newAddress.value);
    addButton.disabled = false;
    if (saved) set(saved);
    else status.textContent = 'Check the school name and try again.';
  };
  document.getElementById('game-opponent-add-cancel').onclick = () => {
    inline.hidden = true;
    input.focus();
  };
  return { set, selected: () => chosen, refresh: () => { if (!list.hidden) render(); },
    reset: () => { chosen = null; input.value = ''; inline.hidden = true; close(); } };
}
