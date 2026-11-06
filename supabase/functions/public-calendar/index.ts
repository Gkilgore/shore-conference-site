// Serves published schedules and subscription feeds; privileged credentials stay in the server environment.
import { createHandler, databaseLoader } from './handler.mjs';

const base = Deno.env.get('SUPABASE_URL');
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!base || !key) throw new Error('Calendar server configuration is missing.');
Deno.serve(createHandler(databaseLoader(base, key)));
