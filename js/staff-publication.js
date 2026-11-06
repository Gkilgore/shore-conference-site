// Lets an AD publish or unpublish only their school's saved schedule using existing ownership rules.
function startStaffPublication(client, currentSchool) {
  const form = document.getElementById('publication-form');
  const checkbox = form.elements.published;
  const submit = form.querySelector('button');
  const status = document.getElementById('publication-status');
  const publicLink = document.getElementById('publication-link');
  let requestNumber = 0;
  let active = true;

  async function load() {
    const request = ++requestNumber;
    const school = currentSchool();
    checkbox.checked = false;
    checkbox.disabled = submit.disabled = true;
    publicLink.href = 'school.html?school=' + encodeURIComponent(school.slug);
    status.textContent = 'Loading publication settings…';
    const { data, error } = await client.from('schools').select('schedule_published').eq('slug', school.slug).single();
    if (!active || request !== requestNumber) return;
    if (error) { status.textContent = 'Publication settings could not load. Reopen School settings to retry.'; return; }
    checkbox.checked = data.schedule_published;
    checkbox.disabled = submit.disabled = false;
    status.textContent = data.schedule_published ? 'Published. Saved changes appear publicly and in subscriptions.' : 'Private. Families cannot see or subscribe to this schedule yet.';
  }

  form.onsubmit = async event => {
    event.preventDefault();
    const request = ++requestNumber;
    const school = currentSchool();
    const published = checkbox.checked;
    checkbox.disabled = submit.disabled = true;
    status.textContent = 'Saving publication settings…';
    const { data, error } = await client.from('schools').update({ schedule_published: published }).eq('slug', school.slug).select('slug');
    if (!active || request !== requestNumber) return;
    checkbox.disabled = submit.disabled = false;
    status.textContent = error || !data?.length ? 'Publication settings could not be saved. Try again.'
      : published ? 'Schedule published. Families can subscribe for updates.' : 'Schedule unpublished. Subscriptions will clear when their apps refresh.';
  };

  return { load, reset() { requestNumber++; }, stop() { active = false; requestNumber++; form.onsubmit = null; } };
}
