# Test staff sign-in

This setup is for the new rebuild test project. Keep the earlier Schedule Hub project separate.

1. In the new Supabase project, apply the migration in `supabase/migrations/`. It creates the three test schools and an empty staff invitation list. In **Authentication → Hooks**, enable **Before User Created** and select `public.hook_require_staff_invitation` before exposing sign-in. Keep email confirmation enabled.
2. In **Authentication → URL Configuration**, set the test site URL and add the exact redirect `http://localhost:8000/admin.html`. Add the GitHub Pages URL when it is available. Use the same local address throughout the sign-in flow.
3. In Google Auth Platform, create a **Web application** OAuth client. Add `http://localhost:8000` as an origin and the callback URL shown by the Supabase Google provider as an authorized redirect. If the Google app is in testing, add the invited Google accounts as test users. Put the client ID and secret directly into the Supabase Google provider settings.
4. In the Supabase Table Editor, add each approved email to the `users` table in lowercase with a name and role. Use `site_admin` for site admins or `conference_office` for conference office staff, with no school. Use `ad` with one of the school slugs for a test AD. Removing the row removes workspace access on the next check.
5. Set the project URL and publishable key in `js/supabase-config.js` once the hook is enabled. These are the public browser settings.
6. Run `python -m http.server 8000 --bind 127.0.0.1` from the project folder and open `http://localhost:8000/admin.html`. Check an invited admin, an invited AD, and an address without an invitation. The invited AD should see only their assigned school. Check that signing out hides the workspace.

The email-link option opens in the same browser that requested it. Supabase's built-in mail service only sends to project team addresses, so configure the planned Resend SMTP before using the email fallback with other test addresses. Staff sign-in gives access to a role-labeled landing page. Game editing is a later step.

[Supabase Google setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google) · [Signup hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook) · [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
