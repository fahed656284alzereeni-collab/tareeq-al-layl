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
The migration now defines trusted functions in a non-exposed `private` schema:
- `create_direct_conversation(uuid)`: canonical participant ordering, advisory transaction lock, duplicate prevention, block checks, and membership insertion.
- `create_group_conversation(text, uuid[])`: bounded member count, deduplicated membership, user existence checks, block checks, and atomic creator/member insertion.
- `accept_friend_request(uuid)`: recipient-only acceptance and reciprocal friendship edges in one transaction.

These functions are intentionally not exposed as public Data API RPC endpoints. The server integration must call them through a trusted database connection or an explicitly designed private-schema server path. Do not expose the private schema merely to make browser RPC work.

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
