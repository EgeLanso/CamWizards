# CamWizards community features — setup

## Deploy order

1. Merge PR #3 (the visual redesign) first.
2. In Supabase SQL Editor, run the complete file:
   `supabase/migrations/20261126_community_admin_xp_moderation.sql`
3. Then run the incremental suspension-guard migration:
   `supabase/migrations/20261127_ban_interactions_guard.sql`
4. Run the private-chat migration:
   `supabase/migrations/20261127_private_chats.sql`
5. In Vercel → Project → Settings → Environment Variables, add these as **Secret** values for Production (and Preview if you use it):
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase project service-role key. Server only; never prefix with `NEXT_PUBLIC_`.
   - `GROQ_API_KEY` — API key from GroqCloud. Server only.
6. Keep the existing `OWNER_EMAIL` environment variable set to the owner's sign-in email.
7. Merge this feature PR and redeploy.

Do not paste either secret into GitHub, source files, browser code, or chat. If a secret has ever been exposed publicly, rotate it.

## Features

- Roles: owner (matched by `OWNER_EMAIL`), admin, moderator, member.
- Only the owner can grant/remove admin and moderator roles.
- Admins can suspend members, grant XP and manage moderation. Moderators can review posts, reports and chat but cannot grant roles, XP or suspend accounts.
- Account suspensions can be temporary or permanent. The owner can lift them from the admin panel.
- XP: +10 for an approved photo post, +1 for an approved lounge message, capped at 10 chat XP per day. XP changes are recorded and cannot be edited through a normal profile update.
- Lounge: messages are checked before appearing. Ordinary profanity is allowed. High-confidence hate slurs, targeted harassment or credible threats are removed and can trigger a 24-hour automatic suspension.
- Posts: new uploads start as pending. Photos with up to three images are checked by Groq Vision. Videos and galleries with more than three images go to manual review.
- Exact SHA-256 file matches are flagged for moderator review. This detects byte-identical re-uploads, not edited copies and not copyright ownership.
- If a price is supplied, a short Groq browser-search check is stored for moderators. It is only a hint, not a definitive valuation.
- Members can report public posts; reports appear in the admin panel.

## Important limitations

- AI moderation can make mistakes. The admin panel keeps a manual review queue; do not treat automated decisions as infallible.
- Visual analysis cannot prove that a photograph came from the claimed camera. EXIF can also be missing or altered. The originality indicator is only a signal.
- The current public Supabase Storage buckets remain public. Pending posts are hidden from CamWizards pages by database policy, but anyone who obtains a direct public storage URL may still access that object. A full private-bucket/signed-URL migration is a separate security change.
- IP addresses are not collected or stored by this feature. It uses account-level bans. Network-level blocks should be handled separately through the hosting provider's security controls, with privacy and false-positive considerations.
- If Groq is unavailable or its free quota is exhausted, content stays pending for human review. Free quotas can change; check the Groq Console for your account's current limits.
- The gear price check uses Groq's browser-search tool only when a price is supplied. It is intentionally short and may return "unable to verify" if sources are weak.


## Private chats

- Members can create private rooms and invite 1–20 registered users by exact username. The creator is added automatically.
- A room password is optional. Passwords are stored as salted scrypt hashes; a successful unlock creates a short-lived, HTTP-only, signed cookie (6 hours).
- Every private-room API request checks both account membership and the signed unlock ticket. The room tables have RLS enabled and no direct anon/authenticated table policies; access is mediated by server-side routes.
- Private rooms use separate tables and do not appear in the public Lounge. Messages are limited to 1,000 characters and 10 per minute per user per room.
- Admins can clear the public Lounge from the admin panel. This hides public messages by marking them removed and records the action; private rooms are not affected.
- Run `supabase/migrations/20261127_private_chats.sql` once in Supabase SQL Editor before using private rooms.
