# Mersal Cloudflare + Supabase cutover plan

Date: 2026-11-07
Branch: `supabase-migration`
Status: architecture plan only; no production deployment or live setting changes.

## Executive decision

Do not try to deploy the existing `server.js` as-is to Cloudflare Pages or Workers.

The current server is a long-lived Node.js/Express + Socket.IO process with mandatory Firebase Admin initialization, Firestore persistence, in-memory connected-user maps, voice-call state, scheduled work, and administrative routes. Cloudflare Pages is a static frontend host, and Workers use a different request/WebSocket runtime. A direct lift-and-shift would break important behavior.

Target architecture:

- **Cloudflare Pages:** serve the existing static HTML, CSS, JavaScript, icons, manifest, and service worker from the GitHub repository.
- **Supabase Auth:** Google OAuth and session/JWT lifecycle.
- **Supabase Postgres + RLS + RPC:** durable profiles, conversations, memberships, messages, receipts, friends, blocks, reports, scheduling state, and notifications.
- **Supabase Realtime:** private conversation events, message notifications, delivery/read updates, online presence, and WebRTC signaling. Use Broadcast/Presence with authorization; do not expose private channel payloads.
- **Supabase Edge Functions:** only trusted server-side operations that genuinely need privileged logic, such as moderation/admin actions, push delivery, account lifecycle, and scheduled-message dispatch.
- **No always-on Node server in the first target.** Revisit Cloudflare Workers/Durable Objects only if a measured feature cannot be delivered safely with Supabase Realtime and Edge Functions.

This approach avoids a permanent Socket.IO process and avoids an immediate Durable Objects design. It is still a staged migration, not a one-click host change.

## Verified repository and live-project facts

- `server.js` is a 2,478-line Express/Socket.IO server.
- `package.json` depends on `express`, `firebase-admin`, `socket.io`, `@supabase/supabase-js`, and `web-push`; there is no committed `package-lock.json` at this audit.
- Firebase Admin credentials are mandatory at server startup. Socket.IO middleware verifies Firebase ID tokens and loads Firestore user records.
- Browser pages `login.html`, `chat.html`, `settings.html`, and `profile.html` still initialize Firebase Auth/Firestore.
- The opt-in Supabase chat API, Supabase profile API, Supabase auth preview, and Supabase chat preview are staged. Production browser pages do not yet use them.
- The existing Socket.IO implementation includes direct/group chat, receipts, friend workflows, blocks/reports, scheduled messages, presence, and voice-call signaling.
- Supabase live migration history was read on 2026-11-07 and includes:
  - `20261107100404 mersal_expand_messaging_schema`
  - `20261107100410 mersal_auth_profile_bootstrap`
  - `20261107100650 move_auth_helpers_private`
  - `20261107101147 add_fk_indexes_and_rls_cleanup`
- The SQL integration tests in CI are useful evidence, but do not prove Google OAuth, two-user browser chat, Realtime authorization, push, or VoiceOver end-to-end behavior.

## Important design constraints

### 1. Realtime is not just "subscribe to messages"

The current client depends on many Socket.IO request/response events and connection lifecycle semantics. The migration must explicitly define:
- Private channel topic naming and membership authorization.
- Presence state and multi-device sessions.
- Broadcast payload validation and rate limiting.
- Reconnection, missed-event recovery, and authoritative refetch from Postgres.
- WebRTC offer/answer/ICE signaling and call lifecycle.
- Delivery/read receipt persistence, not merely ephemeral broadcasts.

Persisted messages must be written to Postgres first. Realtime is a notification/synchronization path, not the source of truth. On reconnect, the client must reload durable state.

### 2. Realtime quotas must shape product behavior

The current Supabase Realtime quota documentation lists Free-plan limits including 200 concurrent connections, 100 Broadcast events/second, and 20 Presence events/second. Treat these as capacity constraints, not a promise of unlimited free scale. Avoid broadcasting every keystroke or every database row change. Batch presence updates, scope channels to conversations, and monitor usage.

### 3. Cloudflare Pages does not run this Node server

Pages can host the static frontend. Pages Functions/Workers are request-driven and are not a drop-in Node process for the existing Socket.IO server. Workers support WebSockets, but multi-connection coordination requires a deliberate design (typically Durable Objects). Do not port the whole server to Workers without a specific requirement and tests.

### 4. Secrets and redirects

- Only the Supabase publishable key may appear in browser code.
- Supabase secret/service-role keys and Firebase service-account credentials must never enter Git or frontend files.
- Do not change the live Supabase Site URL / redirect allow-list until the final Pages hostname is known and the preview OAuth flow has been tested.
- Keep Firebase credentials and the old login path available until rollback is no longer needed.

## Migration workstreams

### Phase A — Static hosting preparation
1. Verify every browser asset is a static file and identify any URLs still hard-coded to the old host.
2. Add a Pages-compatible build/deploy configuration that publishes the repository root without altering app behavior.
3. Add CI checks for missing local assets, syntax, and required static entry files.
4. Connect Cloudflare Pages to the GitHub repository only after the Cloudflare account is authorized and the Pages project name is selected.
5. Use the generated `*.pages.dev` hostname for preview first; do not change OAuth redirects yet.

Acceptance: Pages preview loads the existing Firebase-based login and all static assets without 404s. This is hosting validation only, not the Supabase cutover.

### Phase B — Supabase auth preview
1. Test Google OAuth on a temporary/preview hostname with the existing `supabase-auth-preview.html`.
2. Verify session restore, refresh, sign-out, profile bootstrap, invalid/expired sessions, and safe redirect handling.
3. Add the final preview origin to Supabase Auth only when that exact hostname exists.
4. Keep `login.html` unchanged until preview tests pass.

Acceptance: real Google sign-in creates/loads the correct Supabase user and profile, and VoiceOver can complete the flow.

### Phase C — Data and chat API
1. Validate the already-applied schema and RLS against the actual live project using read-only checks and dedicated test accounts.
2. Run two-user tests for direct chats, group chats, membership changes, receipts, editing/deletion, per-user hiding, attachments, blocking, and search.
3. Add Realtime private-channel authorization and event contracts; verify one user cannot subscribe to another user's conversation.
4. Convert the isolated chat preview to Realtime-first synchronization: Postgres is authoritative; Realtime wakes clients; reconnect refetches state.
5. Keep the feature flags off in the production app until the full browser test matrix passes.

Acceptance: two independent Supabase accounts can use the chat preview with no Firebase dependency, and negative authorization tests pass.

### Phase D — Client cutover
1. Introduce one shared Supabase session module used by login, chat, settings, and profile.
2. Replace Firebase session access in a feature-by-feature sequence, not by editing all pages at once.
3. Preserve accessible focus order, clear labels, full-screen navigation behavior, and VoiceOver announcements.
4. Add a visible rollback switch that returns clients to the old Firebase path while Firebase remains available.
5. Run the mobile Safari/VoiceOver regression suite before enabling the new path for users.

Acceptance: the same app workflows work with Supabase Auth and database only.

### Phase E — Remaining server features
Migrate these separately to Edge Functions, SQL/RPC, or a supported provider:
- Scheduled-message dispatcher and retry/idempotency.
- Web Push subscription lifecycle and delivery.
- Moderation, admin roles, account suspension and deletion.
- Diagnostics and audit logs.
- Public posts, integrations, and monetization settings if still required.
- Media upload/download policies and signed URL lifecycle.

Admin authorization must come from a server-controlled role source (for example app metadata or a protected role table), never user-editable metadata. Edge Functions must enforce authorization independently of the browser.

### Phase F — Retire Firebase
Only after every acceptance test passes:
- Switch production login and clients.
- Observe errors, auth refresh, Realtime quotas, and storage behavior.
- Keep rollback available through a defined observation period.
- Then remove Firebase dependencies and credentials in a separate reviewed change.

## Required tests before production

- Google OAuth success, cancellation, refresh, sign-out, and invalid callback.
- Two-user direct chat and group chat.
- RLS denial for non-members and cross-user private data.
- Group owner/moderator permissions and member removal/leave.
- Message send/edit/delete/hide, attachment-only messages, receipts.
- Realtime private channel join denial, reconnect, missed-event recovery, multi-device presence.
- WebRTC call setup/accept/end and reconnect behavior.
- Scheduled message exactly-once behavior and retries.
- Push permission denied/granted and expired subscription.
- Admin self-escalation denial, suspension, and account deletion.
- Safari on iPhone with VoiceOver for all critical flows.
- Free-tier quota and request-volume monitoring.

## Explicit non-goals for this plan

- No Render deployment, plan renewal, or Render dependency.
- No production branch merge.
- No deletion of Firebase credentials or project.
- No live OAuth redirect changes before a Pages hostname exists.
- No new paid Supabase project/branch.
- No claim that Cloudflare or Supabase free plans guarantee unlimited capacity or permanent free hosting.

## Current next implementation task

Start with Phase A as an isolated static-hosting preview. Before adding any Cloudflare deployment workflow, inspect the complete tree for build-time assumptions, service-worker scope, hard-coded origin URLs, and Firebase redirect origins. Do not deploy or change live auth settings as part of this commit.
