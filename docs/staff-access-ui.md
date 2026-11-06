# Staff access controller

Load `js/staff-access.js` before the dashboard script. Create one controller per signed-in dashboard:

```js
const access = startStaffAccess(client, invite, () => schools);
```

Call `access.load()` when the Staff access tab opens, after the full public school list loads. Pass the actual signed-in invitation, never a role-preview value. Call `access.reset()` when leaving the tab and `access.stop()` before replacing the signed-in dashboard. The controller hides its panel until `list_staff_access()` verifies the current role; the invitation's role only gates the initial request. Errors and denied access clear account rows and drafts. Keep the status outside the panel so a denied or failed request remains readable.

Use these IDs (all are required). Existing shared staff styles supply the layout:

```html
<p id="staff-access-status" role="status" aria-live="polite"></p>
<section id="staff-access-panel" hidden>
  <h2>Staff access</h2>
  <p>Add invited access; the person signs in with the invited email. Several ADs may share a school.</p>
  <form id="staff-access-form">
    <div class="filters">
      <label>Invited email
        <input id="staff-access-email" type="email" maxlength="254" autocomplete="off" required>
      </label>
      <label>Name
        <input id="staff-access-name" maxlength="100" autocomplete="off" required>
      </label>
      <label>Access
        <select id="staff-access-role" required></select>
      </label>
      <label id="staff-access-school-field">School
        <select id="staff-access-school" required></select>
      </label>
    </div>
    <div class="staff-actions">
      <button id="staff-access-submit" class="button primary" type="submit">Review invited access</button>
      <button id="staff-access-cancel-edit" class="button secondary" type="button" hidden>Cancel edit</button>
    </div>
  </form>
  <h3>Current invited access</h3>
  <ul id="staff-access-list" class="game-list"></ul>
</section>
<dialog id="staff-access-review" class="game-details" aria-labelledby="staff-access-review-title">
  <h2 id="staff-access-review-title">Review invited access</h2>
  <p id="staff-access-review-summary"></p>
  <div class="staff-actions">
    <button id="staff-access-review-confirm" class="button primary" type="button">Add invited access</button>
    <button id="staff-access-review-cancel" class="button secondary" type="button">Cancel</button>
  </div>
</dialog>
```

`load()` returns whether the server verified permission and returned the list. The caller can use that result to update navigation. The controller handles adding, editing assignments and roles, and removing access; it does not send email, create login accounts, or use direct table writes. Creation sends a null revision; updates and removals send the selected record's revision. Every write requires a dialog review. Any result reloads the list; a stale rejection clears the old review and draft so a fresh selection and review are required.

Site admins can manage AD and conference-admin access. Conference admins can manage AD access. Site-admin records are displayed without edit/remove buttons; no form option grants site-admin access. The database repeats permission checks at save time. Name, email, and school text are inserted with `textContent`.

Automated controller checks: `node --test tests/staff-access.test.mjs`. No connected project or database changes are needed to run them.
