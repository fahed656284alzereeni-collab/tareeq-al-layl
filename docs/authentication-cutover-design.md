# Authentication Cutover Design

Status: design only, branch `supabase-migration`. No production login page, server route, or Render environment variable has been changed.

## Current login paths

The current application has two distinct identity flows:

1. Google login is performed in the browser with Firebase Auth `signInWithPopup`.
2. Username/password registration and login are handled by Node routes `/api/auth/register` and `/api/auth/login`. The server stores a derived password hash and salt in Firestore `loginCredentials`, creates a Firebase Auth user, then returns a Firebase custom token for the browser to exchange.

The server and Socket.IO subsequently trust Firebase ID tokens verified by Firebase Admin. Upload, profile, admin, delete-account and welcome-email routes also verify Firebase ID tokens.

## Supabase target

- Google OAuth: browser uses Supabase Auth Google provider and receives a Supabase session/JWT.
- Server HTTP routes: verify Supabase access tokens using the Supabase Auth server-side verification path (or a verified JWT library with the project's JWKS). Never trust a UID sent in request JSON or socket handshake without validating the bearer token.
- Socket.IO: authenticate the Supabase bearer token during connection and attach the verified subject (`sub`) to socket state. Re-check authorization against Postgres membership for every conversation action.
- Profile: create/update the matching `profiles` row from the verified Supabase user identity. Keep private account flags out of public profile fields.
- Browser session: use the existing Supabase browser client module, but only after the server and page contracts are ready.

## Username/password decision

The existing username/password flow is custom: it uses Firestore username mapping plus a server-derived password hash and Firebase custom tokens. Those hashes are not automatically Supabase Auth password hashes, and the current server code does not expose a standard password-reset/recovery path in the inspected route set.

The Supabase Auth migration should not copy the existing hash into an assumed-compatible field. Since the project owner has stated that the app currently has no users or messages, the cleanest initial cutover is to start new accounts through Supabase Auth (Google first, with email/password only if the product owner wants it). Username display/lookup can remain a profile feature with a unique normalized username field and server-controlled reservation.

Do not remove the legacy endpoints or Firestore credentials until the Supabase login, refresh, logout, socket reconnect, account deletion, and protected HTTP routes all pass staging tests.

## Required implementation order

1. Add a single server auth adapter that validates Supabase JWTs and returns a normalized actor object.
2. Add tests for missing, malformed, expired, wrong-project, and valid tokens.
3. Convert Socket.IO handshake authentication to the adapter; test reconnect and multi-device sessions.
4. Convert protected HTTP routes in groups: profile/media, user-facing actions, notifications, then admin.
5. Wire `login.html` to Supabase Google OAuth and restore session handling.
6. Replace Firebase profile reads/writes in `chat.html`, `settings.html`, and profile pages with the new API/repository.
7. Test OAuth redirect back to `/chat.html`, session persistence on iPhone Safari/Chrome, and VoiceOver announcements.
8. Remove Firebase Auth/Firestore dependencies only after every route/page has been migrated and a rollback window has passed.

## Compatibility hazards

- Existing Firebase UIDs and Supabase Auth UUIDs are different identity namespaces. Never assume they match.
- The current direct-conversation Firestore ID is a sorted concatenation of two Firebase UIDs. The new Postgres conversation ID is a UUID; browser and Socket.IO code must treat it as an opaque string and must not reconstruct it from participant IDs.
- Google OAuth configured in the Supabase dashboard does not switch the website by itself. The page must call Supabase Auth and the server must accept Supabase JWTs.
- A browser publishable key is safe to expose only with correct RLS. Supabase secret/service-role keys must remain server-only.
- No existing user records were found in Supabase Auth or the prototype public tables at the time of inspection. This supports a clean start, but is not a reason to delete Firebase settings before cutover tests.
