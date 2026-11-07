# Mersal migration plan: Firebase to Supabase

## Status
- Working branch: `supabase-migration` (created from `main`).
- Production branch `main` has not been changed.
- No application code has been switched yet.
- The owner confirmed the site currently has no users or messages, so there is no application data to migrate at this time.

## Repository audit
The current app is not a small direct-message prototype. The login page, chat page, settings page, and Express/Socket.IO server still depend on Firebase:
- `login.html`: Firebase Auth (Google popup and custom-token sign-in) plus Firestore user profiles.
- `chat.html`: Firebase Auth session; Socket.IO is used for messaging and real-time application actions.
- `settings.html`: Firebase Auth and Firestore for account/profile and settings workflows.
- `server.js`: Firebase Admin initializes at process startup, verifies Firebase ID tokens, reads/writes Firestore, and uses Firebase Auth administration.

The server currently implements or references more than direct messages, including group conversations and membership/permissions, friend requests, blocking, message scheduling, delivery/read state, voice-call signaling, user moderation, admin controls, notifications, and media storage. These features must be inventoried and migrated deliberately; replacing only the login button would break the rest of the app.

## Supabase project audit
Project: `dzrtzctppgogvhoychrf` (Mersal), healthy.

Existing public tables (all currently report zero rows and RLS enabled):
- `profiles`: user profile keyed to `auth.users(id)`; unique optional username.
- `conversations`: currently models a direct conversation with exactly two ordered participants.
- `messages`: text messages attached to a conversation, with sender and read timestamp.

Existing database security:
- Profiles can be discovered by authenticated users; owners can update their own profile.
- A new auth user is handled by the `on_auth_user_created` trigger and `handle_new_user()` function.
- Conversation participants can read their conversations and create a conversation only when they are one of its two participants.
- Only a participant can read messages; inserts require the authenticated sender to be the sender and a participant in the conversation.
- A recipient can mark messages as read.
- RLS is enabled on all three tables.
- Realtime publication currently includes `conversations` and `messages`.
- Security advisor returned no findings at audit time.

Important schema gap: current `conversations` is strictly two-person/direct-message shaped (two user columns and a uniqueness rule). It does not represent the existing application's group conversations and membership/roles/permissions. Other app features also have no confirmed matching Supabase tables yet.

## Migration approach
1. Preserve Firebase and production `main` while building on this branch.
2. Finish the feature inventory across all Firebase Auth, Firestore, Admin SDK, Socket.IO, scheduled jobs, and client pages.
3. Define the complete Supabase schema and RLS policies for direct chats, groups, memberships, messages, friendships/requests, blocks, scheduling, read/delivery state, moderation, and any other retained feature. Do not expose service-role/secret keys to browser code.
4. Move browser sign-in to Supabase Auth Google OAuth and ensure every client page restores and checks the Supabase session consistently.
5. Move server authentication to verified Supabase access tokens and use a server-only secret key only for trusted administrative tasks; use user-scoped clients/RLS for ordinary user actions where appropriate.
6. Replace Firestore operations and Socket.IO persistence paths in small, testable groups. Keep Socket.IO only where it adds value (e.g. signaling/presence), not as a second competing source of truth for persisted messages.
7. Test account creation, sign-in/out, profile creation, direct messages, groups, permissions, blocking, scheduled delivery, attachments, voice calls, admin flows, and unauthorized cross-user access.
8. Deploy a preview/staging version and verify it before merging to `main` or changing Render production environment variables.
9. Remove Firebase dependencies/secrets only after the full feature set passes verification.

## Safety constraints
- Never put Supabase service-role/secret keys in HTML or browser JavaScript.
- Do not weaken RLS to make the migration appear to work.
- Do not remove Firebase credentials or change production deployment settings before a tested replacement is available.
- No production merge or destructive database change is included in this audit commit.

## Current branch progress (2026-11-07)
- Expanded messaging migration remains a draft on supabase-migration; it has not been applied to the live Supabase database.
- Hardened SQL function quoting, made the conversation constraints re-runnable, enforced direct/group participant shape, and added authenticated Data API wrappers around private transactional routines.
- Direct and group conversation creation is now server-side transactional SQL; friend-request acceptance/decline is routed through atomic functions rather than allowing clients to edit request status directly.
- Message insert trigger now creates per-recipient receipt rows and updates conversation activity timestamps. Attachment-only messages are permitted subject to the existing 10,000-character cap.
- Added a server-side Supabase Auth verifier that calls Auth getUser(accessToken), plus unit tests. It is intentionally not connected to current Firebase-dependent routes.
- Added a Node test command: npm test.

## Remaining blockers before cutover
- The application still depends heavily on Firebase Auth and Firestore in login.html, chat.html, settings.html, and server.js. The new verifier alone must not be switched on.
- Complete migration of user profile operations, conversation/message persistence, group membership administration, friend/block workflows, scheduled messages, notifications, media storage, admin actions, account deletion, and Socket.IO identity checks.
- Add/verify storage bucket policies and attachment validation; define trusted admin authorization in app_metadata or a server-controlled role table.
- Test the migration SQL against a disposable Supabase staging project, including RLS negative tests and re-run/idempotency checks. The live project's advisor currently reports no security lints for its existing schema; this is not a validation of the unapplied draft.
- Run browser and Socket.IO end-to-end tests before any Render environment change or production deploy.

- Expanded the draft with transactional group operations: add/remove members, leave/delete group, rename, update details and permissions, and appoint/revoke moderators. The SQL enforces the current 50-member product limit and keeps membership changes out of direct client table writes.
- Added attachment-only message support and a database trigger that creates per-recipient receipt rows and updates conversation activity in the same transaction.
- Static review confirms balanced SQL dollar-quote delimiters and no remaining malformed bare delimiters. This is a text-level check only; the migration still needs execution against a disposable staging database before it can be considered validated.
- The current application applies name-moderation rules in its server code. The final server/RPC integration must preserve those checks for group names; do not rely on client-side validation alone.


## Server/client dependency inventory update (2026-11-07)
- Added `docs/firebase-server-feature-inventory.md` after scanning the current server and browser entry points. It maps the Socket.IO event families, HTTP route families, Firebase Auth/Firestore coupling, and safe cutover sequence.
- Confirmed that `login.html`, `chat.html`, `settings.html`, and `profile.html` still initialize Firebase directly. The staged Supabase browser client is not yet consumed by these pages.
- Confirmed that server startup still requires Firebase Admin credentials; Socket.IO middleware and persistence handlers still depend on Firebase Admin/Firestore semantics.
- Therefore the Supabase token verifier must remain staged and must not be enabled by itself. A real cutover requires a persistence adapter and feature-by-feature migration, not a token-only switch.
- Rechecked the live Supabase public schema: `profiles`, `conversations`, and `messages` remain empty and RLS-enabled; `conversations` remains a two-participant schema. Security advisor currently reports no lints for the live schema only.
- No live database DDL, production branch change, or Render deployment was performed in this work session.
