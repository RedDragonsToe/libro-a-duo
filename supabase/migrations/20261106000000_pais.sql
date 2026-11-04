-- ========== v6: país aproximado de cada persona (solo el código de 2 letras) ==========
alter table public.lad_members add column if not exists country text;
drop function if exists public.lad_room_touch(text, text, text, text);
create or replace function public.lad_room_touch(p_room text, p_member text, p_name text, p_color text, p_country text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform lad_gate(p_room);
  if p_room is null or p_room !~ '^[0-9a-f]{64}$' or p_member is null or length(p_member) < 6 then return; end if;
  insert into lad_members(room, member, name, color, country)
  values (p_room, p_member, left(p_name, 24), left(p_color, 16), case when p_country ~ '^[A-Z]{2}$' then p_country end)
  on conflict (room, member) do update set name = excluded.name, color = excluded.color, last_seen = now(),
    country = coalesce(excluded.country, lad_members.country);
end $$;
revoke all on function public.lad_room_touch(text,text,text,text,text) from public;
grant execute on function public.lad_room_touch(text,text,text,text,text) to anon, authenticated;
notify pgrst, 'reload schema';
