# CamWizards

A production-oriented Next.js + Supabase community photography archive.

## Run locally

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor. It is safe to re-run. It also creates the public `photos` (10 MB) and `videos` (50 MB) Storage buckets.
4. In Supabase Authentication:
   - Enable Email/Password.
   - Enable Google OAuth and set the Google provider credentials.
   - Add `http://localhost:3000/auth/callback` as an allowed redirect URL for local development.
   - For Vercel, add `https://YOUR-DOMAIN/auth/callback`.
5. Copy `.env.example` to `.env.local` and fill in the Supabase URL and anon key.
6. Run:

```bash
npm install
npm run dev
```

## Vercel

Import the repository into Vercel and add:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OWNER_EMAIL` (optional, shows the OWNER badge for that account)

The app uses only the public Supabase anon key in the browser. Database and Storage access is protected by Row Level Security. Never expose a Supabase service-role key in frontend code.

## Important production notes

- Video expiry is enforced by database visibility policies and application queries. A scheduled cleanup job can be added later if you want expired video files physically deleted from Storage.
- The current upload flow requires authentication. This is intentional: it avoids anonymous abuse and keeps Storage ownership straightforward.
- Google OAuth profile data is used as a default; users can later edit their profile implementation as desired.
- Search currently covers camera, lens, title and description plus category/type/condition filters. Price-range UI can be extended with `gte/lte` filters.
- For large-scale production, add moderation, upload-size limits, image transformations, rate limiting and virus/media validation at the edge/backend.
