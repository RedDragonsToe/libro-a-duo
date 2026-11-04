-- ========== v3: administrador de sala, contraseña opcional y expulsar ==========
create table if not exists public.lad_rooms (
  room text primary key check (room ~ '^[0-9a-f]{64}$'),
  owner_hash text not null,
  pass_hash text,
  created_at timestamptz not null default now()
);
create table if not exists public.lad_banned (
  room text not null, member text not null, at timestamptz not null default now(),
  primary key (room, member)
);
create table if not exists public.lad_members (
  room text not null, member text not null, name text, color text,
  last_seen timestamptz not null default now(),
  primary key (room, member)
);
alter table public.lad_rooms enable row level security;
alter table public.lad_banned enable row level security;
alter table public.lad_members enable row level security;
revoke all on public.lad_rooms, public.lad_banned, public.lad_members from anon, authenticated;

create or replace function public.lad_hdr(k text) returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json ->> k
$$;

-- Portero: una sala reclamada exige el id de miembro y, si tiene contraseña, el token.
create or replace function public.lad_gate(p_room text) returns void
language plpgsql security definer set search_path = public as $$
declare r lad_rooms; m text; t text;
begin
  select * into r from lad_rooms where room = p_room;
  if not found then return; end if;
  m := lad_hdr('x-lad-member'); t := lad_hdr('x-lad-token');
  if m is null or m = '' then raise exception 'actualizar' using errcode = 'LAD03'; end if;
  if exists (select 1 from lad_banned where room = p_room and member = m) then
    raise exception 'expulsado' using errcode = 'LAD01';
  end if;
  if r.pass_hash is not null and (t is null or encode(sha256(convert_to(t, 'UTF8')), 'hex') <> r.pass_hash) then
    raise exception 'contrasena' using errcode = 'LAD02';
  end if;
end $$;

create or replace function public.lad_room_info(p_room text) returns json
language plpgsql security definer set search_path = public as $$
declare r lad_rooms;
begin
  if p_room is null or p_room !~ '^[0-9a-f]{64}$' then raise exception 'sala invalida' using errcode = '22023'; end if;
  select * into r from lad_rooms where room = p_room;
  return json_build_object('claimed', found, 'protected', found and r.pass_hash is not null);
end $$;

create or replace function public.lad_room_claim(p_room text, p_owner text, p_token text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_room is null or p_room !~ '^[0-9a-f]{64}$' then raise exception 'sala invalida' using errcode = '22023'; end if;
  if p_owner is null or length(p_owner) < 20 then raise exception 'clave invalida' using errcode = '22023'; end if;
  if exists (select 1 from lad_rooms where room = p_room) then raise exception 'sala ya reclamada' using errcode = 'LAD04'; end if;
  insert into lad_rooms(room, owner_hash, pass_hash)
  values (p_room, encode(sha256(convert_to(p_owner, 'UTF8')), 'hex'),
          case when p_token is null or p_token = '' then null else encode(sha256(convert_to(p_token, 'UTF8')), 'hex') end);
end $$;

create or replace function public.lad_room_owner(p_room text, p_owner text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from lad_rooms where room = p_room and owner_hash = encode(sha256(convert_to(coalesce(p_owner,''), 'UTF8')), 'hex')) then
    raise exception 'no sos el administrador' using errcode = 'LAD05';
  end if;
end $$;

create or replace function public.lad_room_set_pass(p_room text, p_owner text, p_token text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform lad_room_owner(p_room, p_owner);
  update lad_rooms set pass_hash = case when p_token is null or p_token = '' then null else encode(sha256(convert_to(p_token, 'UTF8')), 'hex') end
  where room = p_room;
end $$;

create or replace function public.lad_room_touch(p_room text, p_member text, p_name text, p_color text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform lad_gate(p_room);
  if p_room is null or p_room !~ '^[0-9a-f]{64}$' or p_member is null or length(p_member) < 6 then return; end if;
  insert into lad_members(room, member, name, color) values (p_room, p_member, left(p_name, 24), left(p_color, 16))
  on conflict (room, member) do update set name = excluded.name, color = excluded.color, last_seen = now();
end $$;

create or replace function public.lad_room_members(p_room text, p_owner text)
returns table (member text, name text, color text, last_seen timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  perform lad_room_owner(p_room, p_owner);
  return query select m.member, m.name, m.color, m.last_seen from lad_members m
    where m.room = p_room and not exists (select 1 from lad_banned b where b.room = p_room and b.member = m.member)
    order by m.last_seen desc;
end $$;

create or replace function public.lad_room_kick(p_room text, p_owner text, p_member text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform lad_room_owner(p_room, p_owner);
  insert into lad_banned(room, member) values (p_room, p_member) on conflict do nothing;
  delete from lad_members where room = p_room and member = p_member;
  delete from lad_readers where member = p_member and book in (select id from lad_books where room = p_room);
end $$;

revoke all on function public.lad_gate(text), public.lad_room_owner(text,text), public.lad_hdr(text) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'lad_room_info(text)','lad_room_claim(text,text,text)','lad_room_set_pass(text,text,text)',
    'lad_room_touch(text,text,text,text)','lad_room_members(text,text)','lad_room_kick(text,text,text)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

-- Pone el portero al principio de cada función de datos que recibe p_room (idempotente).
do $$
declare r record; def text;
begin
  for r in
    select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'lad\_%' and p.prokind = 'f'
      and pg_get_function_arguments(p.oid) like 'p_room text%'
      and p.proname not in ('lad_gate','lad_check','lad_room_info','lad_room_claim','lad_room_owner','lad_room_set_pass','lad_room_touch','lad_room_members','lad_room_kick')
  loop
    def := pg_get_functiondef(r.oid);
    if position('lad_gate' in def) = 0 then
      execute regexp_replace(def, '\mbegin\M', 'begin perform public.lad_gate(p_room);', 'i');
    end if;
  end loop;
end $$;
notify pgrst, 'reload schema';
