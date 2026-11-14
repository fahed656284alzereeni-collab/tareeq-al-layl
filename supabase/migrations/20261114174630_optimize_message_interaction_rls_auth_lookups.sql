do $$
declare
  policy_row record;
  statement text;
begin
  for policy_row in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename in ('message_reactions', 'starred_messages', 'message_pins')
      and (
        coalesce(qual, '') like '%auth.uid()%'
        or coalesce(with_check, '') like '%auth.uid()%'
      )
  loop
    statement := format('alter policy %I on %I.%I',
      policy_row.policyname, policy_row.schemaname, policy_row.tablename);
    if policy_row.qual is not null then
      statement := statement || format(' using (%s)',
        replace(policy_row.qual, 'auth.uid()', '(select auth.uid())'));
    end if;
    if policy_row.with_check is not null then
      statement := statement || format(' with check (%s)',
        replace(policy_row.with_check, 'auth.uid()', '(select auth.uid())'));
    end if;
    execute statement;
  end loop;
end
$$;
