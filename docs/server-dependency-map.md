# Supabase Migration: Server Dependency Map

Branch: `supabase-migration`

This document records the server-side Firebase dependencies found during the second-pass review of `server.js` (2,478 lines). It is a planning artifact only: it does not change the live Supabase schema, Render deployment, or the production branch.

## Critical architectural finding

The application is not currently a Supabase-authenticated application. The browser login, profile, settings, and chat pages still initialize Firebase Auth/Firestore. The Node server verifies Firebase ID tokens with Firebase Admin and uses Firestore as the primary data store. Supabase is currently initialized only for media storage, and the newly added browser client is not yet imported by any page.

A safe migration therefore has to replace three connected layers, not just the Google button:

1. Identity: Firebase Auth ID tokens and custom-token username login -> Supabase Auth sessions/JWTs.
2. Data: Firestore documents, subcollections, transactions, queries, and timestamps -> relational Postgres tables, constraints, RPC/transactions, and RLS.
3. Realtime/server: Socket.IO authentication and event handlers -> either authenticated Socket.IO using Supabase JWT verification, or Supabase Realtime with carefully scoped channel authorization. The choice must preserve current events and presence behavior.

## Server feature map

| Area | Existing behavior observed | Main Firebase dependencies | Migration target |
|---|---|---|---|
| Authentication | Google sign-in, username/password registration and login, custom tokens, account lookup | Firebase Auth, `loginCredentials`, `usernameIndex`, `users` | Supabase Auth; decide whether username/password is retained via a safe Auth-compatible flow |
| User profiles | display/player name, bio, email, last seen, account status | `users` | `profiles` plus private account-state fields |
| Direct and group conversations | creation, membership, group title/details, permissions, moderators, member removal/leave/delete | `conversations` | `conversations` + `conversation_members`; direct/group constraints |
| Messages | send, reply, attachments, edit, delivery/read status, per-user hide/delete, delete-for-everyone | conversation `messages` subcollections | `messages` with explicit reply, attachment, edit, delivery/read and visibility fields/tables |
| Scheduled messages | worker scans due messages, transactional send and cleanup | `scheduledMessages`, conversations/messages, hidden subcollections | `scheduled_messages` + server worker/cron and transactional RPC |
| Friends and requests | send/cancel/respond/remove; mutual relationship records | user subcollections `friends`, `friendRequests` | `friendships` and `friend_requests` |
| Blocking and reporting | block/unblock users; report a conversation user | `blockedUsers`, `userReports` | `user_blocks`, `user_reports` |
| Notifications and push | create/list/delete notifications; manage web-push subscriptions | `notifications`, `pushSubscriptions` | `notifications`, `push_subscriptions` |
| Per-user conversation state | hide conversation, clear content, hide individual messages | `hiddenConversations`, `hiddenConversationContent`, message `hiddenFor` | membership state and per-user message visibility tables |
| Moderation and administration | maintenance, registration toggle, feature flags, account warnings/suspension, group suspension, name filters, diagnostics, audit logs | `appSettings`, `adminActions`, `adminControlLogs`, `developerDiagnostics`, user/group fields | admin-only tables and server-verified role/claims; never trust browser metadata |
| Public content/integrations | public posts, monetization settings, public integrations/ads | `publicPosts`, `siteSettings` | separate tables only if these features remain in scope |
| Account deletion | deletes user and associated nested records, relationships and username mappings | Firebase Auth + many Firestore collections/subcollections | explicit Postgres cascade/cleanup workflow plus Supabase Auth user deletion |

## Important data-model mismatches

- Current Firestore conversations store a `members` array and support both direct and group chats. The existing Supabase `conversations` table uses `user_one` and `user_two`, so it cannot represent the full current group-chat behavior.
- Membership is used for authorization throughout the server. A normalized `conversation_members` table is required before moving conversation/message access to RLS.
- Messages carry more than text: attachments, replies, delivery receipts, edit metadata, hidden-for-user state, and scheduled delivery all appear in the server logic. A simple `body` column would silently remove functionality.
- Several Firestore operations rely on transactions and batched writes. Related Postgres changes must be atomic (transactional RPC or trusted server transaction), especially sending messages, membership changes, account deletion, and scheduled delivery.
- Admin and moderation behavior must not be represented by user-editable profile metadata. Administrative authorization must be server-verified and protected from self-escalation.

## Recommended relational target (design only)

- `profiles`: public profile fields keyed to `auth.users.id`.
- `user_private_settings`: private account status and per-user preferences.
- `conversations`: conversation identity, type, title/details, group settings, timestamps and latest-message summary.
- `conversation_members`: one row per user per conversation, role/moderator flags, join/leave state, per-user hidden/cleared state.
- `messages`: conversation, sender, body, attachment metadata, reply reference, timestamps, edit/deletion state.
- `message_receipts`: message/user delivery and read timestamps.
- `message_user_visibility`: per-user hide state where a message is hidden only for one participant.
- `friendships`, `friend_requests`, `user_blocks`, `user_reports`.
- `scheduled_messages`, `notifications`, `push_subscriptions`.
- `admin_actions`, `admin_control_logs`, `developer_diagnostics`, `app_settings`, `name_moderation_terms`.
- Optional feature tables for public posts, monetization, and public integrations only after confirming their product scope.

This is a target inventory, not executable SQL. Constraints, indexes, RLS policies, triggers, grants, and realtime publication must be designed and tested together before applying a migration.

## Recommended migration sequence

1. Finalize schema and RLS for identity/profile, conversation membership, messages and receipts. Keep the current production app untouched.
2. Implement and test server-side Supabase JWT verification. Do not accept a UID supplied by the browser as identity.
3. Implement profile and direct/group conversation repository functions against Postgres.
4. Port message send/read/edit/delete and receipts, preserving transaction boundaries and per-user visibility.
5. Port friends, blocks, notifications, scheduled delivery and push subscriptions.
6. Port admin/moderation features with a server-only authorization source.
7. Update browser pages and Socket.IO authentication only after matching server APIs are ready.
8. Run automated tests, RLS negative tests (user A cannot read user B's private data), accessibility checks with VoiceOver, and staging smoke tests.
9. Deploy only after explicit approval; keep a rollback path and retain Firebase credentials until the migration is proven.

## Safety boundaries

- No live schema changes were made while preparing this map.
- No production branch changes or Render deployments were made.
- Never place a Supabase secret/service-role key in browser JavaScript.
- Do not delete Firebase configuration until all active clients and server endpoints have been migrated and verified.
