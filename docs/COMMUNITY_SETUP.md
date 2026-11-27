# CamWizards community features — setup

## Supabase setup order

Run each migration once in Supabase → SQL Editor, in this order:

1. \`supabase/migrations/20261126_community_admin_xp_moderation.sql\`
2. \`supabase/migrations/20261127_ban_interactions_guard.sql\`
3. \`supabase/migrations/20261127_private_chats.sql\`
4. \`supabase/migrations/20261127_profile_avatars_mixed_media.sql\`

In Vercel → Project → Settings → Environment Variables, keep these server-side values configured for Production (and Preview when used):

- \`SUPABASE_SERVICE_ROLE_KEY\` — never prefix with \`NEXT_PUBLIC_\`.
- \`GROQ_API_KEY\` — used for public Lounge moderation and text-only post-name review.
- \`OWNER_EMAIL\` — owner sign-in email used for owner permissions.

Never paste secret keys into GitHub, browser code, source files or chat. Rotate any secret that has been exposed.

## Features

- Roles: owner (matched by \`OWNER_EMAIL\`), admin, moderator and member. Only the owner can grant or remove staff roles.
- Admins can suspend members, grant XP, review reports and moderate posts/chat. Moderators can review content and reports but cannot grant roles, XP or suspend accounts.
- Admins and the owner can clear the public Lounge from the admin panel. This marks public messages removed and records the action; private rooms are unaffected.
- XP: +10 for an approved post and +1 for an approved Lounge message, capped at 10 Lounge XP per user per day. XP changes are recorded and cannot be edited through a normal profile update.
- Public Lounge messages continue to be checked by Groq before appearing. Ordinary profanity is allowed; high-confidence hate slurs, targeted harassment or credible threats can be removed and may trigger a 24-hour suspension.
- Uploads can contain up to 10 photos and one video in a single post. Each file goes to its matching Supabase Storage bucket. Upload is attempted in parallel; if any file fails, successful uploads are cleaned up and retried sequentially with photos first, then video.
- Video files in a mixed gallery expire after 10 days; photos in that same post remain available. Video-only posts retain the existing 10-day renewal behavior.
- Groq post review receives only the post title, camera name and lens name. It does not receive photos, videos, thumbnails, image URLs or file data. No visual scan, image hashing or price search is performed.
- Members can report public posts and profiles. Reports appear in the admin panel.
- Members can set a profile photo with an image URL or upload a JPG, PNG, WebP or AVIF image (up to 5 MB) from their device. Uploaded avatars are stored in the dedicated \`avatars\` bucket.

## Private rooms

- A signed-in member can create a room with a name and a required password (6–64 characters).
- The creator receives a room code. Sharing the room code and password allows another signed-in account to join; usernames and invitation lists are not required.
- Passwords are stored as salted scrypt hashes, never as readable text. Successful password verification creates a short-lived, HTTP-only, signed access cookie (6 hours).
- Every private-room request checks the signed-in account, room membership and (for locked rooms) the signed access cookie. Room tables have RLS enabled and no direct anon/authenticated table policies; API routes use the server-only service role after validation.
- Private-room messages are separate from the public Lounge. They are limited to 1,000 characters and 10 messages per minute per user per room.
- This is password-gated access, not end-to-end encryption. The server processes messages to store and deliver them.

## Important limitations

- AI moderation can make mistakes. The public Lounge keeps a manual review path; moderation decisions should not be treated as infallible.
- Groq post-name review can also be wrong or unavailable. When it cannot finish, the post stays in the moderation queue.
- Supabase \`photos\` and \`videos\` buckets remain public. A direct public storage URL can still be opened by anyone who has it, even when a post is not shown in CamWizards pages. A private-bucket/signed-URL migration is a separate security change.
- Profile avatars are public images. Do not upload private or sensitive images.
- IP addresses are not collected or stored by this feature. Suspensions are account-level.
