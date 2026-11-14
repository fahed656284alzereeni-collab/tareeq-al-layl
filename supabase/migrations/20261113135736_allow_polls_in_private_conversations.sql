
create or replace function private.validate_group_poll()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  option_value jsonb;
  normalized_options text[] := array[]::text[];
  option_text text;
begin
  if new.created_by <> (select auth.uid()) then
    raise exception 'Poll creator must be the signed-in user';
  end if;

  if not exists (
    select 1
    from public.conversations c
    where c.id = new.conversation_id
      and (
        (
          c.is_group
          and (
            private.is_group_owner(c.id)
            or private.is_group_member(c.id)
          )
        )
        or (
          not c.is_group
          and (
            c.user_one = (select auth.uid())
            or c.user_two = (select auth.uid())
          )
        )
      )
  ) then
    raise exception 'Only conversation participants can create polls';
  end if;

  if char_length(btrim(new.question)) < 1 or char_length(new.question) > 240 then
    raise exception 'Poll question must be between 1 and 240 characters';
  end if;

  if jsonb_typeof(new.options) <> 'array'
     or jsonb_array_length(new.options) < 2
     or jsonb_array_length(new.options) > 10 then
    raise exception 'Polls must have between 2 and 10 options';
  end if;

  for option_value in select value from jsonb_array_elements(new.options)
  loop
    if jsonb_typeof(option_value) <> 'string' then
      raise exception 'Poll options must be text';
    end if;
    option_text := btrim(option_value #>> '{}');
    if char_length(option_text) < 1 or char_length(option_text) > 120 then
      raise exception 'Poll options must be between 1 and 120 characters';
    end if;
    if lower(option_text) = any(normalized_options) then
      raise exception 'Poll options must be unique';
    end if;
    normalized_options := array_append(normalized_options, lower(option_text));
  end loop;

  return new;
end;
$function$;
