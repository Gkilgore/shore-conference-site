// Starts sign-in and shows the workspace only after Supabase verifies an invitation.
const authStatus = document.getElementById('auth-status');
const signIn = document.getElementById('sign-in');
const signOut = document.getElementById('sign-out');
const workspace = document.getElementById('workspace');
const googleButton = document.getElementById('google-sign-in');
const emailForm = document.getElementById('email-sign-in');
const workspaceTitles = {
  ad: 'Athletic Director workspace',
  conference_office: 'Conference admin workspace',
  site_admin: 'Site admin workspace',
};

if (location.protocol === 'file:') {
  authStatus.textContent = 'Open this page through the local web server to sign in.';
} else if (!shoreSupabase.url || !shoreSupabase.publishableKey.startsWith('sb_publishable_')) {
  authStatus.textContent = 'Staff sign-in isn’t set up yet.';
} else if (!window.supabase) {
  authStatus.textContent = 'The sign-in service could not load. Refresh to try again.';
} else {
  startStaffSignIn();
}

function startStaffSignIn() {
  const client = window.supabase.createClient(shoreSupabase.url, shoreSupabase.publishableKey, {
    auth: { flowType: 'pkce' },
  });
  const redirectTo = new URL('admin.html', location.href).href;
  let latestCheck = 0;
  let stopSchedule;
  let workspaceUserId;
  let inviteKey;

  client.auth.onAuthStateChange((event, session) => {
    if (session?.user.id === workspaceUserId && stopSchedule &&
        (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')) {
      const check = ++latestCheck;
      setTimeout(() => {
        if (check === latestCheck && session.user.id === workspaceUserId) checkAccess(check);
      }, 0);
      return;
    }
    stopSchedule?.();
    stopSchedule = undefined;
    inviteKey = undefined;
    workspaceUserId = session?.user.id;
    const check = ++latestCheck;
    workspace.hidden = true;
    document.getElementById('staff-sign-in-title').hidden = Boolean(session);
    signIn.hidden = Boolean(session);
    signOut.hidden = !session;
    document.querySelector('a.staff-link').hidden = Boolean(session);
    document.querySelector('.staff-auth').classList.remove('has-problem');
    document.title = (session ? 'Staff Dashboard' : 'Staff Sign-in') + ' | The Shore Conference';
    authStatus.textContent = session ? 'Checking staff access…' : 'Use the email your invitation was sent to.';
    if (session) setTimeout(() => checkAccess(check), 0);
  });

  async function checkAccess(check) {
    const { data: invite, error } = await client.from('users')
      .select('name,email,role,school_id,schools(name)').maybeSingle();
    if (check !== latestCheck) return;
    if (error) {
      authStatus.textContent = 'Staff access could not be checked. Refresh to try again.';
      return;
    }
    if (!invite || !Object.hasOwn(workspaceTitles, invite.role)) {
      stopSchedule?.();
      stopSchedule = undefined;
      inviteKey = undefined;
      workspace.hidden = true;
      authStatus.textContent = 'This email hasn’t been invited. Sign out and use the email your invitation was sent to.';
      return;
    }
    const key = [invite.email,invite.name,invite.role,invite.school_id].join('|');
    if (key === inviteKey && stopSchedule) return;
    stopSchedule?.();
    inviteKey = key;
    document.getElementById('workspace-title').textContent = workspaceTitles[invite.role];
    document.getElementById('workspace-account').textContent =
      [invite.name, invite.email].filter(Boolean).join(' · ');
    authStatus.textContent = 'Signed in.';
    workspace.hidden = false;
    stopSchedule = startStaffSchedule(client, invite);
  }

  window.addEventListener('focus', () => {
    if (workspaceUserId) checkAccess(++latestCheck);
  });

  googleButton.addEventListener('click', async () => {
    googleButton.disabled = true;
    authStatus.textContent = 'Opening Google sign-in…';
    const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) {
      authStatus.textContent = 'Google sign-in could not start. Try again or use an email link.';
      googleButton.disabled = false;
    }
  });

  emailForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = emailForm.querySelector('button');
    button.disabled = true;
    const email = document.getElementById('staff-email').value.trim().toLowerCase();
    const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    authStatus.textContent = error
      ? 'The sign-in link could not be sent. Check that you used your invited email and try again.'
      : 'Check your inbox. Open the link in this same browser.';
    button.disabled = false;
  });

  signOut.addEventListener('click', async () => {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) {
      authStatus.textContent = 'Sign-out failed. Try again.';
      // The status line is hidden inside the dashboard, so bring it back for this.
      document.querySelector('.staff-auth').classList.add('has-problem');
    }
  });
}
