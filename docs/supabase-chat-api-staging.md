# Supabase chat API staging notes

## Current state

The opt-in Express API is mounted behind `SUPABASE_CHAT_API_ENABLED=true`. It uses a verified Supabase access token via `auth.getUser(token)` and a request-scoped Supabase client carrying the same bearer token, so database RLS remains active. It does not use the service-role key for user requests.

The default remains unchanged: the existing Firebase Socket.IO application is still the active production path. Do not set this flag on the live Render service yet.

## Implemented endpoints

All endpoints are under `/api/supabase/chat` and require `Authorization: Bearer <Supabase access token>`.

- `GET /conversations`
- `GET /conversations/:conversationId`
- `GET /conversations/:conversationId/messages?limit=100&before=<timestamp>`
- `POST /conversations/direct` with `{ "otherUserId": "..." }`
- `POST /conversations/group` with `{ "title": "...", "memberIds": ["..."] }`
- `POST /messages` with `{ "conversationId": "...", "body": "...", "attachment": null, "replyTo": null }`
- `POST /messages/:messageId/read`
- `POST /messages/:messageId/delivered`
- `POST /messages/:messageId/edit` with `{ "body": "..." }`
- `POST /messages/:messageId/delete-for-everyone`
- `POST /conversations/:conversationId/hide`
- `POST /conversations/:conversationId/clear-for-me`
- `POST /conversations/:conversationId/clear-for-everyone`
- `DELETE /conversations/:conversationId` (direct conversations only)
- `POST /friend-requests` with `{ "otherUserId": "..." }`
- `POST /friend-requests/:requestId/accept`
- `POST /friend-requests/:requestId/decline`
- `POST /blocks` with `{ "otherUserId": "..." }`
- `DELETE /blocks/:userId`
- `GET /friends`
- `GET /users/search?q=...`
- `POST /reports`
- `GET /scheduled-messages`
- `POST /scheduled-messages`
- `DELETE /scheduled-messages/:scheduledId`
- `POST /conversations/:conversationId/members`
- `DELETE /conversations/:conversationId/members/:userId`
- `POST /conversations/:conversationId/leave`
- `PATCH /conversations/:conversationId` (rename group)
- `PATCH /conversations/:conversationId/details`
- `PATCH /conversations/:conversationId/permissions`
- `PATCH /conversations/:conversationId/members/:userId/moderator`
- `DELETE /groups/:conversationId`
- `POST /messages/:messageId/delete-for-me`
- `PATCH /messages/:messageId/video-duration`
- `POST /friend-requests/:requestId/cancel`
- `DELETE /friends/:userId` (remove friendship)

## Before enabling in a staging deployment

1. Configure `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in the staging server.
2. Apply the migration only to a separate Supabase staging project after checking its schema, grants, policies, Auth settings, and Storage bucket.
3. Set `SUPABASE_CHAT_API_ENABLED=true` only in that staging deployment.
4. Test Google OAuth, user provisioning, profile completion, direct and group chats, attachments, replies, receipts, friend requests, blocks, scheduled messages, account deletion, and all admin/abuse controls.
5. Keep the existing Firebase path available for rollback until every screen and socket event has a tested replacement.
6. Do not enable the feature flag on production Render until the front-end is migrated and a full end-to-end acceptance run passes.

## Known gaps

- The current front-end still uses Firebase Auth and Firebase Socket.IO; these HTTP endpoints are not yet called by the shipped pages.
- Live typing/presence, voice calls, push notification fan-out, media upload signing, group-member event fan-out, scheduled-message worker, moderation, account suspension, and admin workflows are not yet cut over.
- A staging Supabase project and end-to-end browser/screen-reader tests are still required.
