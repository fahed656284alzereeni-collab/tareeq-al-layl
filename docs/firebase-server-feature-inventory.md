# Firebase server and client cutover inventory

## Scope and method
Audited `server.js` on `supabase-migration` (2,478-line Express/Socket.IO server) and the current browser entry points `login.html`, `chat.html`, `settings.html`, and `profile.html`. This is a source inventory, not a claim that any feature has been migrated or tested.

## Current client authentication dependencies
- `login.html`: Firebase Auth popup/custom-token flows, persistent browser auth state, and Firestore user profile reads/writes. The Google button still calls Firebase `signInWithPopup`; the username/password flow calls the existing server endpoints and consumes Firebase custom tokens.
- `chat.html`: Firebase Auth session is the source of the current UID and ID token used to establish the Socket.IO session. The page contains voice-call WebRTC signaling and the complete chat event client.
- `settings.html`: Firebase Auth and Firestore profile/settings operations; Socket.IO supplies friend-request workflows.
- `profile.html`: Firebase Auth and Firestore profile/user lookup.
- `supabase-client.js` is currently a staged browser client, not a replacement used by these pages.

## Server identity and persistence coupling
- Startup initializes Firebase Admin and exits if Firebase credentials are unavailable.
- Socket.IO middleware verifies Firebase ID tokens, loads Firestore `users/{uid}`, applies suspension and maintenance checks, and derives the display name.
- Socket handlers use Firestore directly for persistence and authorization. Merely accepting a Supabase token in the handshake would not be sufficient: the handlers still assume Firestore document paths, snapshots, transactions, timestamp sentinels, and Firebase Auth administration.
- HTTP routes independently verify Firebase ID tokens and use Firestore/Firebase Auth for profile, admin, diagnostics, public posts, push subscriptions, notifications, account deletion, and welcome-email workflows.
- Supabase is currently used by the server for media Storage only; this does not constitute a database/auth cutover.

## Socket.IO feature inventory
| Area | Existing event names / behavior | Firebase coupling to replace |
|---|---|---|
| Voice calling | `voiceCall:resume/start/offer/accept/signal/end` | Conversation membership lookup and account/feature authorization |
| Groups | `startGroupConversation`, `addGroupMembers`, `renameGroup`, `updateGroupDetails`, `updateGroupPermissions`, `setGroupModerator`, `removeGroupMember`, `leaveGroup`, `deleteGroup` | Firestore conversation documents, membership arrays, transactions, timestamps |
| Discovery and conversations | `findUserByName`, `getConversationDetails`, `startDirectConversation`, `searchUsers`, `listConversations` | User/profile lookup, blocks, membership and conversation documents |
| Messaging | `markMessageDelivered`, `getConversationMessages`, `editDirectMessage`, `clearDirectConversationForMe`, `hideDirectConversationForMe`, `clearDirectConversation`, `deleteDirectConversation`, `deleteDirectMessageForMe`, `deleteDirectMessageForEveryone`, `sendDirectMessage` | Firestore subcollections, batch writes, message visibility, receipts and timestamps |
| Scheduling | `getScheduledMessages`, `cancelScheduledMessage`, `scheduleDirectMessage` plus background worker | Firestore scheduled-message collection and atomic message creation |
| Friends and identity | `sendFriendRequest`, `cancelFriendRequest`, `updatePlayerName`, `getFriendData`, `respondFriendRequest`, `removeFriend` | Firestore requests/friends/profile data and transactions |
| Presence | `onlinePlayers`, disconnect/last-seen updates | Current in-memory sockets plus Firestore last-seen persistence |
| Group moderation | `blockConversationUser`, `unblockConversationUser`, `reportConversationUser` | Firestore blocks and reports |

## HTTP route inventory
- Authentication: `POST /api/auth/register`, `POST /api/auth/login`, plus Firebase-token protected identity/session endpoints.
- Media: `POST /api/upload-media` (Firebase token and Firestore conversation-membership check; media object storage uses Supabase).
- Profile: `GET/POST /api/profile/me`.
- Diagnostics/admin: `/api/diagnostics/collect`, `/api/admin/diagnostics`, `/api/admin/dashboard`, `/api/admin/reports`, `/api/admin/warn`, `/api/admin/audit-log`.
- System controls: public/admin system settings, control-center status/logs/commands, name moderation terms and name-check.
- Group/account administration: admin group list/control, accounts list, account-name, account-control, account-action.
- Public content/monetization: public posts, public integrations, public ads.
- Push and notifications: push public key, subscribe/unsubscribe/test; notification list/read/delete operations.
- Account lifecycle: account deletion and welcome-email endpoints.
- Health/static serving: `/health` and page routes.

## Supabase schema facts verified against the live project
At audit time, public schema exposes `profiles`, `conversations`, and `messages`; all three have RLS enabled and zero rows. The live `conversations` table is a two-user direct-chat model (`user_one`, `user_two`), while the existing app has group conversations and a broad feature set. The expanded migration is still a draft and has not been applied. Security advisor currently returns no findings for the live schema only.

## Safe implementation sequence
1. Keep Firebase as the active provider until every dependent path is migrated. Keep the production branch and Render deployment untouched.
2. Validate the expanded schema on a disposable Supabase project, including RLS negative tests, policy/grant review, function execution privileges, repeatability, and concurrency.
3. Establish a canonical profile/account model and server-only Supabase administrative client. Keep the publishable key in browser code; never expose a secret/service-role key.
4. Add a selectable, opt-in Supabase authentication path to HTTP and Socket.IO, but do not enable it until the corresponding persistence adapter and profile lookup are available.
5. Migrate and test feature families in dependency order: profile/identity; direct conversations/messages/receipts; groups; friends/blocks/reports; scheduling; media; notifications/push; moderation/admin/account lifecycle.
6. Update all four client pages to use one shared Supabase session lifecycle, including refresh, sign-out, redirect handling, and Socket.IO token refresh.
7. Run unit, integration, browser, and Socket.IO tests, including unauthorized cross-user access and suspended-account cases.
8. Only after preview validation, seek explicit approval for production environment changes and cutover. Remove Firebase only after rollback is no longer needed.

## Explicit blockers
- Current Firebase Admin initialization is mandatory at process startup.
- The Socket.IO middleware and many handlers still depend on Firestore document semantics; switching only the token verifier would authenticate a user but leave persistence and authorization on the old provider.
- Admin actions currently use Firebase Auth account disable/revoke/delete operations; Supabase Auth admin equivalents and role authorization need a separate audited implementation.
- Existing client pages do not yet restore or use the staged Supabase browser session.
- The SQL draft has not been executed against a staging database. Static text inspection is not a substitute for PostgreSQL execution.
