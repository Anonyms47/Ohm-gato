-- Suppression d'un compte : les traces d'action (journal, historiques) sont conservées,
-- seul le lien vers le compte disparaît.
do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname, a.attname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
      and c.connamespace = 'public'::regnamespace
      and c.confdeltype = 'a'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I foreign key (%I) references auth.users (id) on delete set null',
                   r.tbl, r.conname, r.attname);
  end loop;
end $$;
