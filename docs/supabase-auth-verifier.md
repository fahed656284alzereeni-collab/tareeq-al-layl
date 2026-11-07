# Supabase Auth verifier (staged)

The new supabase-auth-verifier.js module adds a server-side identity verifier for the migration branch.

- Extracts Bearer tokens from HTTP requests.
- Validates the token with supabase.auth.getUser(accessToken) against Supabase Auth.
- Does not decode JWTs and trust their claims locally.
- Returns the Supabase UUID, normalized email, and email-confirmation state.
- Uses only the publishable key (or legacy anon key) for the Auth lookup; never uses a service-role/secret key for identity verification.
- Includes Node's built-in test coverage for missing, valid, and invalid tokens.

**Not active:** current server.js, Socket.IO middleware, browser pages, admin checks, account deletion, and most feature routes still depend on Firebase Auth and Firestore. This helper is deliberately not connected to those routes yet. Switching only the token verifier would break profile lookups, Firebase custom-token login, admin authorization, and every Firestore-backed feature.

Before enabling the cutover, migrate profile and feature data access, define the admin role in trusted app_metadata or a server-controlled table (never user-editable metadata), migrate Socket.IO verification, and run end-to-end/RLS negative tests. Keep Firebase operational until those checks pass.
