# Mersal migration readiness review

## Current boundary
All work in this branch is isolated from `main`. No production deployment or live schema migration has been performed. The live Supabase prototype still contains zero Auth users, profiles, conversations, and messages at the last read-only verification.

## Confirmed current architecture
- The browser login page still initializes Firebase Auth and Firestore.
- The server initializes Firebase Admin at process startup and verifies Firebase ID tokens in Socket.IO middleware.
- Server routes, account moderation, notifications, push subscriptions, account deletion, and public posts still use Firestore.
- Chat data is stored in Firestore conversations with nested messages; group membership is an array on the conversation document.
- Supabase currently backs the new authentication prototype and media storage only; it is not yet the source of truth for chat.
- The existing login page still exposes username/password registration and login in addition to Google. The Google button is still Firebase-based until the cutover is implemented.

## Supabase schema review findings
The live prototype has pair-only constraints on `conversations`: `ordered_participants`, `different_participants`, and `unique_direct_conversation`. These must be retired before allowing group rows with nullable legacy participant columns. The migration now drops these constraints and adds a partial unique index for canonical direct pairs.

The live RLS policy names were inspected. Existing policies are:
- conversations: `Participants can view conversations`, `Users can start direct conversations`
- messages: `Participants can view messages`, `Participants can send messages as themselves`, `Recipients can mark messages as read`
- profiles: `Authenticated users can discover profiles`, `Users can update their own profile`

The expanded migration removes the old pair-based policies and replaces them with active membership checks. It retains the profiles policies unchanged. It adds explicit authenticated table/column grants in addition to RLS.

## Transactional database APIs
The migration now keeps privileged implementations in the non-exposed `private` schema and exposes narrow, invoker-rights wrappers in `public`, with EXECUTE granted only to `authenticated`:
- `create_direct_conversation(uuid)`: canonical participant ordering, advisory transaction lock, duplicate prevention, block checks, and atomic membership insertion.
- `create_group_conversation(text, uuid[])`: bounded member count, deduplicated membership, user existence checks, block checks, and atomic creator/member insertion.
- `send_friend_request(uuid)`: rejects self-requests, unknown users, blocks, existing friendships, and pending requests in either direction; uses a pair lock and symmetric uniqueness.
- `cancel_friend_request(uuid)`: sender-only cancellation of a pending outgoing request.
- `accept_friend_request(uuid)` / `decline_friend_request(uuid)`: recipient-only state changes; acceptance creates both friendship edges in the same transaction.
- `remove_friendship(uuid)`: removes both reciprocal friendship edges together.
- `add_group_members(uuid, uuid[])`, `remove_group_member(uuid, uuid)`, and `leave_group(uuid)`: active-membership and role checks, group capacity enforcement, and transactional membership changes.
- `rename_group(uuid, text)`, `update_group_details(uuid, text, text)`, `update_group_permissions(uuid, text, text)`, `set_group_moderator(uuid, uuid, boolean)`, and `delete_group(uuid)`: group settings and moderator operations with creator/admin permission checks.

Direct client INSERT/UPDATE/DELETE privileges and policies for friend-request creation/responses and one-sided friendship deletion are removed. Message visibility rows are restricted to messages in conversations where the caller is an active member. The message-insert trigger creates recipient receipts and updates conversation activity timestamps.

The private schema is not exposed through the Data API. The public wrappers call the private SECURITY DEFINER functions as invoker, and the private routines use an empty search path plus explicit schema qualification. Do not grant browser users direct write access to membership rows.

## Required implementation stages before cutover
1. **Completed in CI:** apply the SQL migration twice to a disposable PostgreSQL 16 database based on the live schema, then verify RPC behavior, legacy membership backfill, message receipts, profile updates, and selected negative RLS cases. A true Supabase staging project is still required before live application.
2. Add negative RLS tests: anonymous access, non-member reads, non-member inserts, member tampering, receipt ownership, friend-request sender/recipient boundaries, and scheduled-message cancellation.
3. Implement a server-side Supabase JWT verifier. Verify signatures and issuer/audience using Supabase-supported verification (prefer `auth.getClaims()`/JWKS for asymmetric signing keys; use Auth server validation when the project uses symmetric signing). Never merely decode the JWT.
4. Introduce an authentication adapter without removing Firebase Admin yet. Keep separate identity namespaces; Firebase UIDs and Supabase UUIDs are not interchangeable.
5. Port profile, direct/group conversation, message, receipts, friend/block, notification, scheduled-message, report, and admin operations in dependency order. Preserve existing socket event payloads or update all clients in the same release.
6. Add a reversible deployment switch. Test Google sign-in, profile creation, two-user messaging, group messaging, receipts, blocking, account deletion, admin restrictions, and mobile VoiceOver flows.
7. Only after all tests pass: switch production traffic, observe logs, and later retire Firebase. Never delete Firebase credentials before this point.

## Current blockers / not yet complete
- The expanded SQL and RPC suite has passed multiple disposable PostgreSQL 16 CI runs, including two consecutive applications. The latest fully completed run 62 passed both Node tests and PostgreSQL integration. Later commits are being re-tested; this does not replace a separate Supabase staging project. The migration remains unapplied to the live project.
- An opt-in Express HTTP adapter now exposes the core Supabase conversation, message, friend-request, and block operations behind `SUPABASE_CHAT_API_ENABLED=true`. It uses verified Supabase access tokens and request-scoped clients so RLS remains active. It is an additional HTTP API only; existing Socket.IO event handlers and browser screens still use Firebase.
- `login.html`, `chat.html`, `settings.html`, `profile.html`, and the Firebase-dependent routes have not yet been cut over.
- Supabase Storage upload still has an existing Firebase conversation membership check in the server route.
- Render production environment variables and health checks have not been changed.
- No production data has been copied; the user confirmed the Supabase prototype is empty, but this does not prove all legacy Firebase collections are empty.

## Safety decision
Do not merge this branch, apply the migration to the live database, deploy to Render, or remove Firebase credentials until the staging migration and end-to-end tests pass.


## Security review update — 7 November 2026
- Fixed malformed dollar-quote delimiters in the SQL draft; a static check now finds no remaining single-dollar function/DO delimiters and an even count of paired `$$` delimiters. This is a textual check, not a PostgreSQL execution test.
- Added atomic friend-request creation and reciprocal friendship removal RPCs. Direct table writes that could leave friend requests accepted without reciprocal friendship rows, or delete only one friendship edge, are no longer granted.
- Tightened per-user message visibility to require active membership in the message's conversation.
- The server-side verifier module `supabase-auth-verifier.js` calls Supabase Auth `getUser(accessToken)` and is used by the opt-in profile and chat HTTP APIs. Socket.IO and existing Firebase endpoints still use Firebase tokens.
- `supabase-clients.js` creates a request-scoped user client carrying the caller's bearer token (so RLS applies) and a separate server-only admin client. The user client is used by the opt-in profile API; the admin client is not yet used.
- The live Supabase security advisor returned no lints at the last read-only check. That result describes the current live prototype, not the un-applied migration draft.
- The branch comparison currently shows the migration branch ahead of `main` with no commits behind. Production `main` remains untouched.

## Additional release blockers
- The SQL passed on disposable PostgreSQL 16 and was applied twice successfully. It has not yet been applied to a separate Supabase staging project, where Supabase Auth roles, Data API exposure, realtime publication, and Storage policies must also be verified.
- GitHub Actions run 89 passed Node tests and the disposable PostgreSQL 16 migration/RPC/RLS integration job. The suite applies the migration twice, verifies Realtime publication membership, tests authenticated and anonymous access, and covers attachment path rejection, block checks, receipts, message lifecycle, scheduling, and denial of forged timestamps/direct writes.
- The repository has no committed `package-lock.json`; dependency resolution is therefore not reproducible yet. Add and verify a lockfile before release.
- Added `.github/workflows/migration-branch-tests.yml`, static SQL safety checks, PostgreSQL fixtures/integration assertions, request-scoped client tests, and profile repository/handler tests.
- `login.html`, `chat.html`, `settings.html`, and `profile.html` still use Firebase. The new `/api/supabase/profile/me` routes are gated behind `SUPABASE_PROFILE_API_ENABLED=true` and are not enabled by default. Socket.IO, uploads, messaging, friends, notifications, and admin workflows still use Firebase/Firestore.
- An opt-in Supabase chat HTTP API has been mounted behind `SUPABASE_CHAT_API_ENABLED=true`, with request-verified Supabase tokens, user-scoped database clients, and handlers for core conversation/message/friend/block operations. The flag is off by default and the existing Firebase Socket.IO path remains active.
- The chat HTTP handler module and browser API adapter have automated tests for token verification, request-scoped identity, request authorization headers, direct-conversation creation, message sending, authentication failures, and invalid input. Group, scheduling, social, reporting, moderation, and notification endpoint handlers are mounted behind the same opt-in flag.
- Added an isolated accessible `supabase-auth-preview.html` Google OAuth smoke test. It checks Supabase session creation and profile bootstrap without changing the production login page or opening the legacy Firebase chat.
- Added authenticated Supabase media upload behind the chat API flag. It verifies active conversation membership and direct-message block state before using the server-only Storage credential; signed-URL failures clean up orphaned objects. Browser upload headers are allowed by the shared CORS middleware. The API is not yet used by `chat.html`; do not enable its flag in production until frontend compatibility and end-to-end tests are complete.
- GitHub Actions run 57 passed the expanded Node tests and the PostgreSQL 16 integration suite. The suite applies the migration twice and exercises attachment metadata rejection, block checks, receipts, message lifecycle, and RLS.
- The current server is a 2,478-line Firebase-dependent service with many socket events and admin workflows. It must be migrated in feature groups with compatibility tests; replacing only its token verifier would break those features.


## Authentication bootstrap finding — 7 November 2026
- A read-only inspection of the live Supabase project found no trigger on `auth.users` to create `public.profiles` after a first Google OAuth signup. The live prototype has zero Auth users and zero profile rows, so no existing user data is affected.
- Added `202611070002_auth_profile_bootstrap.sql` on the isolated migration branch. It creates a hardened trigger function in the non-exposed `private` schema, validates/bounds the display name, maps Google `full_name`/`name` and `avatar_url`/`picture` metadata, and inserts a profile without overwriting an existing one.
- Added a PostgreSQL integration assertion that creates a disposable Auth user and verifies the corresponding profile is created. CI now applies both migration files twice to test repeatability.
- This fix is branch-only and has not been applied to the live Supabase project. Google OAuth cutover and browser integration remain incomplete; Firebase login and chat continue to be the production path.


## Isolated Google OAuth preview — 7 November 2026
- Added `supabase-auth-preview.html`, a standalone, screen-reader-friendly OAuth test page on the migration branch. It uses the existing public Supabase browser client and PKCE flow, returns to itself after Google consent, checks the current Supabase session, reads only the signed-in user's profile through the RLS-protected Data API, and supports signing out.
- The page deliberately does not redirect into `chat.html`, does not import Firebase, and does not change `login.html`. A successful OAuth callback alone is not treated as a completed migration.
- Added automated checks for the isolated redirect, absence of Firebase references, profile verification, missing-profile messaging, and sign-out.
- GitHub Actions run 91 completed its Node test/syntax job and PostgreSQL 16 migration/RPC/RLS integration job successfully. This validates repository code and the disposable PostgreSQL fixture only; it does not execute a real Google consent flow or validate Supabase Auth against a separate hosted staging project.
- The preview file is committed only to `supabase-migration` and is not available on the production Render deployment. The configured Supabase redirect allow-list covers the Render origin, but no deploy or live redirect test has been performed.
- Remaining prerequisites: a hosted staging environment for real Google OAuth and two-user end-to-end chat tests, plus a reproducible dependency lockfile. Do not merge or deploy the branch as part of this preview work.
