# Transportation email rollout

The dashboard stores each school's coordinator contact and previews an email from saved game details. Sending is disabled until the delivery service is configured.

1. Verify a sender domain in Resend and pick a From address. Add the sending key and From address as Supabase Edge Function secrets.
2. Add a Supabase Edge Function that requires a signed-in AD and accepts only a game ID. Read the game, bus details, and coordinator contact using that user's database permissions. Use the verified AD email for the copy. Never accept email recipients supplied by the browser.
3. Add a send confirmation showing the recipients. Use the game revision to avoid duplicate sends on retries and record whether Resend accepted the request. Show the AD the result and allow a failed request to be retried.
4. Test delivery with approved test inboxes, then test that an AD cannot send another school's game and that a double click sends one message. Enable the send button only after those checks.

A Confirmed bus checkbox and email updates for reschedules or cancellations are open decisions.
