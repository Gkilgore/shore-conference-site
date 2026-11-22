-- Allow multiple transportation contacts per school.
-- Migrate existing data to new structure.
BEGIN;

-- Create new table with id primary key
CREATE TABLE public.school_transportation_contacts_new (
  id uuid primary key default gen_random_uuid(),
  school_id text not null references public.schools(slug),
  email text not null check (char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  created_at timestamp with time zone default now(),
  unique(school_id, email)
);

-- Enable RLS
ALTER TABLE public.school_transportation_contacts_new ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.school_transportation_contacts_new FROM public, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_transportation_contacts_new TO authenticated;

-- Create policy
CREATE POLICY own_school_transportation_contact ON public.school_transportation_contacts_new
  FOR ALL TO authenticated
  USING (shore_private.can_manage_schedule(school_id))
  WITH CHECK (shore_private.can_manage_schedule(school_id));

-- Migrate existing data
INSERT INTO public.school_transportation_contacts_new (school_id, email)
SELECT school_id, email FROM public.school_transportation_contacts;

-- Drop old table
DROP TABLE public.school_transportation_contacts;

-- Rename new table
ALTER TABLE public.school_transportation_contacts_new RENAME TO school_transportation_contacts;

COMMIT;
