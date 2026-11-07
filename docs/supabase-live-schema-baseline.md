# Supabase Live Schema Baseline (Read-only inspection)

Inspected on 2026-11-07 for project `dzrtzctppgogvhoychrf`.

This is a read-only snapshot of the current public tables. No SQL DDL or data writes were performed.

## Current columns

### profiles
- `id uuid NOT NULL` (auth user identifier)
- `username text NULL`
- `display_name text NOT NULL DEFAULT ''`
- `avatar_url text NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

### conversations
- `id uuid NOT NULL DEFAULT gen_random_uuid()`
- `user_one uuid NOT NULL`
- `user_two uuid NOT NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`

### messages
- `id uuid NOT NULL DEFAULT gen_random_uuid()`
- `conversation_id uuid NOT NULL`
- `sender_id uuid NOT NULL`
- `body text NOT NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `read_at timestamptz NULL`

## Migration implications

The existing schema is a small direct-message prototype, not a complete replacement for the current application data model.

Before application code is switched over, the schema still needs to account for:
- group conversations and membership roles;
- group metadata, moderator permissions and membership lifecycle;
- message attachments and replies;
- delivery receipts and per-recipient read state;
- per-user message/conversation hiding and clearing;
- edits, deletion-for-everyone and deletion-for-self;
- scheduled messages;
- friends, requests, blocks and reports;
- notifications and push subscriptions;
- account moderation and administrator audit/configuration data.

The current `read_at` column on `messages` is insufficient for group conversations because read state is per recipient, not a single timestamp for the whole message.

## Verification

- Security advisor returned zero lint findings at inspection time.
- The previously inspected auth and application tables were empty; this baseline does not imply that future changes are safe without RLS and authorization tests.
- Do not apply this document as SQL. A reviewed migration must be prepared and tested separately.
