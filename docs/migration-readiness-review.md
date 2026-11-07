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
- `accept_friend_request(uuid)` / `decline_friend_request(uuid)`: recipient-only state changes; acceptance creates both friendship edges in the same transaction.
- `remove_friendship(uuid)`: removes both reciprocal friendship edges together.

Direct client INSERT/UPDATE/DELETE privileges and policies for friend-request creation/responses and one-sided friendship deletion are removed. Message visibility rows are restricted to messages in conversations where the caller is an active member. The message-insert trigger creates recipient receipts and updates conversation activity timestamps.

The private schema is not exposed through the Data API. The public wrappers call the private SECURITY DEFINER functions as invoker, and the private routines use an empty search path plus explicit schema qualification. Do not grant browser users direct write access to membership rows.

## Required implementation stages before cutover
1. Validate the SQL migration on an isolated staging database with a disposable Supabase project or local Supabase stack. Run it twice to verify idempotency.
2. Add negative RLS tests: anonymous access, non-member reads, non-member inserts, member tampering, receipt ownership, friend-request sender/recipient boundaries, and scheduled-message cancellation.
3. Implement a server-side Supabase JWT verifier. Verify signatures and issuer/audience using Supabase-supported verification (prefer `auth.getClaims()`/JWKS for asymmetric signing keys; use Auth server validation when the project uses symmetric signing). Never merely decode the JWT.
4. Introduce an authentication adapter without removing Firebase Admin yet. Keep separate identity namespaces; Firebase UIDs and Supabase UUIDs are not interchangeable.
5. Port profile, direct/group conversation, message, receipts, friend/block, notification, scheduled-message, report, and admin operations in dependency order. Preserve existing socket event payloads or update all clients in the same release.
6. Add a reversible deployment switch. Test Google sign-in, profile creation, two-user messaging, group messaging, receipts, blocking, account deletion, admin restrictions, and mobile VoiceOver flows.
7. Only after all tests pass: switch production traffic, observe logs, and later retire Firebase. Never delete Firebase credentials before this point.

## Current blockers / not yet complete
- The expanded SQL is a reviewed draft, not applied or proven against a PostgreSQL runtime.
- The private RPC functions are not yet wired to the Express/Socket.IO server.
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
- The server-side verifier module `supabase-auth-verifier.js` and Node test file `test/supabase-auth-verifier.test.js` are present. The verifier calls Supabase Auth `getUser(accessToken)`; it does not decode and trust JWT claims locally. It is still staged and not connected to `server.js`.
- The live Supabase security advisor returned no lints at the last read-only check. That result describes the current live prototype, not the un-applied migration draft.
- The branch comparison currently shows the migration branch ahead of `main` with no commits behind. Production `main` remains untouched.

## Additional release blockers
- The SQL has not been executed on a disposable PostgreSQL/Supabase staging database, and idempotency has not been verified by applying it twice.
- Automated Node tests have not yet been run in a project environment with dependencies installed.
- The repository has no committed `package-lock.json`; dependency resolution is therefore not reproducible yet. Add and verify a lockfile before release.
- Added `.github/workflows/migration-branch-tests.yml` and static regression checks in `test/migration-safety.test.js`. The initial CI run passed the verifier tests; the migration-safety tests were added immediately afterward and are being exercised by the next branch run.
- The login page, chat page, settings page, profile page, Socket.IO middleware, upload route, and the remaining Firestore-backed routes still use Firebase. The presence of Supabase OAuth settings and helper modules does not mean Google login has switched.
- The current server is a 2,478-line Firebase-dependent service with many socket events and admin workflows. It must be migrated in feature groups with compatibility tests; replacing only its token verifier would break those features.
