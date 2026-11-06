# School branding

ADs set their school's logo and two colors in the staff dashboard under **School settings**. The dashboard heading, tabs, buttons, and calendar then use those colors and that logo.

## Setup on the test project

1. Apply `supabase/migrations/20261106000100_school_branding.sql`. It adds a main color, an accent color, and a logo to each school, and it creates the public `school-logos` storage bucket.
2. Sign in as a test AD and open **School settings**. Upload a logo, choose colors, and save.
3. Sign in as a different school's AD. Check that they can't change the first school's branding. The save should fail with "This account may not manage this school."

## Who can change what

- An AD can change only their own school's colors and logo, and can upload only into that school's folder.
- Site admins can change any school.
- The conference office can't change branding.
- Nobody can rename a school or change its membership from the dashboard.

## Notes

- Logos must be PNG, JPEG, or WebP files up to 1 MB. SVG is blocked because it can carry scripts.
- The site picks black or white text for each color automatically. If the accent is too close to the main color, the dashboard warns the AD.
- Until the migration is applied, the dashboard falls back to the built-in sample colors and logos.
- The public school pages still use `data/sample-data.js` for colors. They switch to the saved branding when the public pages start reading from Supabase.
