
ALTER TABLE public.conversations
  DROP CONSTRAINT conversations_sorted_users;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_sorted_users
  CHECK (is_group OR user_one < user_two);

CREATE OR REPLACE FUNCTION private.is_group_member(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id = p_conversation_id
      AND cm.user_id = (SELECT auth.uid())
  );
$function$;

REVOKE ALL ON FUNCTION private.is_group_member(uuid) FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_group_member(uuid) TO authenticated;

DROP POLICY IF EXISTS conversation_members_select ON public.conversation_members;
CREATE POLICY conversation_members_select
ON public.conversation_members
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (SELECT private.is_group_owner(conversation_id))
  OR (SELECT private.is_group_member(conversation_id))
);

DROP POLICY IF EXISTS mersal_call_broadcast_read ON realtime.messages;
CREATE POLICY mersal_call_broadcast_read
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  extension = 'broadcast'
  AND EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id::text = split_part((SELECT realtime.topic()), ':', 2)
      AND (
        c.user_one = (SELECT auth.uid())
        OR c.user_two = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.conversation_members cm
          WHERE cm.conversation_id = c.id
            AND cm.user_id = (SELECT auth.uid())
        )
      )
  )
);

DROP POLICY IF EXISTS mersal_call_broadcast_send ON realtime.messages;
CREATE POLICY mersal_call_broadcast_send
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  extension = 'broadcast'
  AND EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id::text = split_part((SELECT realtime.topic()), ':', 2)
      AND (
        c.user_one = (SELECT auth.uid())
        OR c.user_two = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.conversation_members cm
          WHERE cm.conversation_id = c.id
            AND cm.user_id = (SELECT auth.uid())
        )
      )
  )
);
