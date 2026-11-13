// Requires a signed-in school AD and sends through the configured email provider.
import { createHandler } from './handler.mjs';

Deno.serve(createHandler({
  supabaseUrl: Deno.env.get('SUPABASE_URL'),
  publishableKey: Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY'),
  resendApiKey: Deno.env.get('RESEND_API_KEY'),
  fromAddress: Deno.env.get('TRANSPORTATION_EMAIL_FROM'),
}));
