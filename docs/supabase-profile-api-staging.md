# Supabase profile API staging

## Added endpoints
The server now contains an isolated Supabase profile API:
- `GET /api/supabase/profile/me`
- `POST /api/supabase/profile/me`

These routes are registered only when the server environment contains:
`SUPABASE_PROFILE_API_ENABLED=true`

The flag is deliberately absent from production configuration and is not enabled by this code change. Existing Firebase-backed `/api/profile/me` routes remain unchanged and continue to be the active routes by default.

## Request security
- The request bearer token is verified through Supabase Auth `getUser(token)`.
- The route creates a request-scoped Supabase client using the publishable/anon key and that user's bearer token.
- Profile reads and updates are restricted by the existing `profiles` RLS policies; the elevated service-role client is not used.
- The route takes the profile ID only from the verified Supabase identity, never from request input.
- Display names pass the existing server-side name-moderation check before update.
- The response is marked no-store.

## Live schema checks performed (read-only)
- `profiles` has RLS enabled.
- The live policies allow profile discovery and allow a user to update only the row whose ID equals `auth.uid()`.
- The live auth user creation trigger `on_auth_user_created` calls `public.handle_new_user()`, which inserts the matching profile row using the new auth user ID.
- The profile update trigger maintains `updated_at`.
- No production DDL or data writes were made.

## Tests
Unit tests cover bearer verification, scoped-client creation, profile read/update, name moderation ordering, validation failures, and rejection of invalid tokens. The GitHub Actions workflow runs these tests and a disposable PostgreSQL migration integration test.

## Not a production cutover
The current login/chat/settings/profile browser pages still use Firebase. Socket.IO still verifies Firebase tokens and persists chat data in Firestore. Do not set the feature flag on Render or switch browser pages until a full Supabase sign-in flow, Socket.IO identity path, feature parity, and rollback plan are validated.
