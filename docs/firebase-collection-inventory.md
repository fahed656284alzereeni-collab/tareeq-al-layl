# Firebase collection inventory for the Supabase migration

This inventory was extracted from the current `server.js` on the `supabase-migration` branch. It is a migration checklist, not proof that every collection is actively used in production. Each collection's read/write call sites must be reviewed before implementing its replacement.

## Firestore collections found in server.js

| Firestore collection | Initial Supabase target | Notes / migration concerns |
|---|---|---|
| `users` | `auth.users` + `public.profiles` + private account metadata | Separate public profile fields from private moderation/security fields. Never expose private fields through profile discovery. |
| `conversations` | `public.conversations` + `public.conversation_members` | Existing Supabase conversations table only supports two ordered participants. Current app supports groups and member roles; schema must be extended or normalized before cutover. |
| `messages` | `public.messages` | Existing table supports text body and read timestamp only. App also supports edits/deletes, attachments, delivery state, and scheduled delivery; inspect exact event payloads before schema finalization. |
| `friends` | `public.friendships` | Must preserve symmetric relationship semantics and uniqueness. |
| `friendRequests` | `public.friend_requests` | Need sender/recipient state machine, duplicate prevention, and authorization policies. |
| `blockedUsers` | `public.user_blocks` | A user may manage only their own block list; enforce this with RLS. |
| `scheduledMessages` | `public.scheduled_messages` | Requires reliable server-side worker/cron, atomic claim-and-send, timezone-safe timestamps, and cancellation semantics. |
| `notifications` | `public.notifications` | Separate persisted in-app notifications from best-effort push delivery. |
| `pushSubscriptions` | `public.push_subscriptions` | Treat subscription endpoints and encryption keys as sensitive; never expose other users' subscription records. |
| `hiddenConversations` | `public.user_conversation_preferences` | Per-user state; likely a hidden flag rather than deleting a conversation. |
| `hiddenConversationContent` | `public.user_conversation_preferences` or a separate per-user cursor/state table | Determine whether this means clearing history locally or hiding content from a timestamp. Do not conflate with deletion for all participants. |
| `appSettings` | `public.app_settings` | Administrative settings need strict server-side authorization. |
| `siteSettings` | `public.site_settings` | Identify which settings are public and which must remain admin-only. |
| `systemControl` | `public.system_controls` | Maintenance/feature flags must not be writable by ordinary users. |
| `nameModeration` | `public.moderation_terms` | Read-only for users; edits restricted to trusted admins. |
| `usernameIndex` | unique constraint/index on `public.profiles.username` | Prefer a database unique index and normalized username rather than a separately maintained index document. |
| `userReports` | `public.user_reports` | Reporter may create/read their own reports; admin review data must be protected. |
| `adminActions` | `public.admin_actions` | Audit log should be append-only and server-written. |
| `adminControlLogs` | `public.admin_control_logs` | Append-only audit trail; redact secrets and sensitive personal content. |
| `developerDiagnostics` | restricted diagnostics table or external logs | Do not make diagnostics publicly queryable; scrub tokens, emails, and personal data. |
| `loginCredentials` | Supabase Auth; do not reproduce password storage | Never migrate plaintext credentials or build a parallel password store. |
| `monetization` | feature-specific monetization tables (only if still used) | Inspect current reads/writes and confirm whether this feature is retained before designing tables. |
| `publicPosts` | `public.posts` (only if still part of product scope) | The current stated product focus is private messaging; confirm whether public posts remain a supported feature. |

## Non-Firestore server responsibilities that also need migration decisions

- Firebase Admin ID-token verification in Socket.IO middleware.
- Firebase Auth user enable/disable and account suspension.
- Firebase Admin timestamps, transactions, batched writes, array union/removal, and document deletion semantics.
- Socket.IO real-time delivery, presence, and WebRTC voice-call signaling.
- Background workers for scheduled messages and expired suspensions.
- Admin and developer identity checks.

## Existing Supabase foundation (verified in project)

- `profiles`, `conversations`, and `messages` tables exist and were empty at audit time.
- Profiles are linked to `auth.users` and a trigger creates a profile after a new auth user.
- Direct conversation rows use `user_one` and `user_two`, with a unique ordered pair and a check that the two participants differ.
- Message rows use `conversation_id`, `sender_id`, `body`, `created_at`, and `read_at`.
- RLS is enabled. Existing policies allow authenticated profile discovery, owner profile updates, participant conversation/message reads, participant message inserts, and recipient read updates.
- Realtime publication contains `conversations` and `messages`.

## Required implementation order

1. Confirm product scope: direct and group chats, friendships, posts, calls, scheduling, moderation, push notifications, and admin console.
2. Finalize normalized schema and RLS policies, including group membership and server-only admin operations.
3. Add database migration files to this branch and validate them against a disposable/test Supabase project before applying to the live project.
4. Implement a Supabase Auth session/token adapter in the login page and all authenticated client pages.
5. Implement server-side Supabase JWT verification and profile loading.
6. Replace Firestore persistence feature by feature, keeping Socket.IO event names/contracts stable initially to reduce client rewrites.
7. Add integration tests for authorization boundaries and all retained features.
8. Deploy and test a preview before production cutover.

## Important safety rule

Do not remove Firebase initialization, Firebase environment variables, or Firebase project settings until every retained feature has a tested Supabase implementation. Do not place a Supabase service-role/secret key in browser code. The live Supabase project must not receive an unreviewed schema migration.
