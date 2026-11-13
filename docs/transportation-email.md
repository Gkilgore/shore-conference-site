# Transportation email

When an AD saves or imports a **Scheduled** game with a bus departure time, the dashboard sends the saved details to that school's transportation contact and copies the AD's verified sign-in email. No bus confirmation is requested or used to determine the game's status. Saving the same bus details again is safe to retry; the email provider's idempotency key prevents duplicate delivery.

The `transportation-email` Edge Function accepts only a saved game ID. It checks the signed-in staff invitation and uses the caller's database permissions to read the game and school contact. Email addresses are read from the database, never accepted from the browser. The service-role key is not used by this function.

Before delivery can work:

1. Verify a sender domain in Resend.
2. Set `RESEND_API_KEY` and `TRANSPORTATION_EMAIL_FROM` as Supabase Edge Function secrets. The Supabase function environment supplies its URL and publishable/anon key.
3. Deploy `supabase/functions/transportation-email`.
4. In the AD dashboard, save the school's transportation contact email under **Transportation**.
5. Test with an approved test inbox. Confirm a scheduled bus generates one email, a repeated save does not duplicate it, and an AD cannot send another school's game.

If delivery is not configured, the game still saves, and the dashboard tells the AD the email was not sent. Correct the contact or email setup and save the game again to retry.

Transportation emails do not yet update for later reschedules or cancellations. Coach emails are a separate feature and remain off; see `docs/coach-emails.md`.
