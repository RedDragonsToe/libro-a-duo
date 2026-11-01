-- =====================================================================
-- Libro a Dúo · esquema de Supabase
-- Pegalo completo en Supabase > SQL Editor > New query y tocá "Run".
-- Se puede correr más de una vez sin romper nada.
--
-- Cómo funciona la seguridad:
--  * Las tablas quedan cerradas (RLS activado y sin políticas). Nadie puede
--    leerlas ni escribirlas directo con la clave pública.
--  * La app solo usa las funciones lad_* de abajo. Cada una exige el
--    identificador de sala (p_room), que es un hash SHA-256 del código de sala.
--    Quien no conoce el código no puede calcularlo, así que no ve nada.
-- =====================================================================

create table if not exists public.lad_books (
  id          uuid primary key default gen_random_uuid(),
  room        text not null check (room ~ '^[0-9a-f]{64}$'),
  title       text not null check (char_length(title) between 1 and 160),
  chars       integer not null default 0,
  words       integer not null default 0,
  gz          boolean not null default false,
  n_chunks    integer not null default 0 check (n_chunks between 0 and 60),
  complete    boolean not null default false,
  by_member   text,
  by_name     text,
  created_at  timestamptz not null default now()
);
create index if not exists lad_books_room_idx on public.lad_books (room, created_at desc);

create table if not exists public.lad_chunks (
  book  uuid not null references public.lad_books(id) on delete cascade,
  idx   integer not null,
  data  text not null,
  primary key (book, idx)
);

create table if not exists public.lad_readers (
  book        uuid not null references public.lad_books(id) on delete cascade,
  member      text not null check (char_length(member) between 6 and 64),
  name        text not null default '',
  color       text not null default '',
  pos         integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (book, member)
);

create table if not exists public.lad_notes (
  id          uuid primary key default gen_random_uuid(),
  book        uuid not null references public.lad_books(id) on delete cascade,
  pos         integer not null default 0,
  quote       text not null default '',
  body        text not null default '' check (char_length(body) <= 1500),
  color       text not null default 'yellow',
  member      text not null,
  name        text not null default '',
  mcolor      text not null default '',
  aud_mime    text,
  aud_dur     integer,
  aud_b64     text,
  created_at  timestamptz not null default now()
);
create index if not exists lad_notes_book_idx on public.lad_notes (book, pos);

-- Tablas cerradas: sin políticas, nadie entra directo.
alter table public.lad_books   enable row level security;
alter table public.lad_chunks  enable row level security;
alter table public.lad_readers enable row level security;
alter table public.lad_notes   enable row level security;
revoke all on public.lad_books, public.lad_chunks, public.lad_readers, public.lad_notes from anon, authenticated;

-- Verifica que el libro pertenezca a la sala indicada.
create or replace function public.lad_check(p_room text, p_book uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_room is null or p_room !~ '^[0-9a-f]{64}$' then
    raise exception 'sala invalida' using errcode = '22023';
  end if;
  if not exists (select 1 from lad_books where id = p_book and room = p_room) then
    raise exception 'libro no encontrado' using errcode = 'P0002';
  end if;
end $$;

-- ---------- libros ----------
create or replace function public.lad_list_books(p_room text)
returns table (id uuid, title text, chars integer, words integer, gz boolean, n_chunks integer,
               by_member text, by_name text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if p_room is null or p_room !~ '^[0-9a-f]{64}$' then
    raise exception 'sala invalida' using errcode = '22023';
  end if;
  return query
    select b.id, b.title, b.chars, b.words, b.gz, b.n_chunks, b.by_member, b.by_name, b.created_at
    from lad_books b where b.room = p_room and b.complete order by b.created_at desc;
end $$;

create or replace function public.lad_add_book(p_room text, p_title text, p_chars integer, p_words integer,
                                              p_gz boolean, p_n_chunks integer, p_member text, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if p_room is null or p_room !~ '^[0-9a-f]{64}$' then
    raise exception 'sala invalida' using errcode = '22023';
  end if;
  if (select count(*) from lad_books where room = p_room) >= 30 then
    raise exception 'La sala ya tiene 30 libros. Quitá alguno antes de subir otro.' using errcode = '54000';
  end if;
  insert into lad_books (room, title, chars, words, gz, n_chunks, by_member, by_name)
  values (p_room, left(trim(p_title), 160), p_chars, p_words, p_gz, p_n_chunks, left(p_member, 64), left(coalesce(p_name, ''), 40))
  returning id into v;
  return v;
end $$;

create or replace function public.lad_add_chunk(p_room text, p_book uuid, p_idx integer, p_data text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform lad_check(p_room, p_book);
  if exists (select 1 from lad_books where id = p_book and complete) then
    raise exception 'el libro ya esta completo' using errcode = '55000';
  end if;
  insert into lad_chunks (book, idx, data) values (p_book, p_idx, p_data)
  on conflict (book, idx) do update set data = excluded.data;
end $$;

create or replace function public.lad_finish_book(p_room text, p_book uuid)
returns void language plpgsql security definer set search_path = public as $$
declare n integer; need integer;
begin
  perform lad_check(p_room, p_book);
  select n_chunks into need from lad_books where id = p_book;
  select count(*) into n from lad_chunks where book = p_book;
  if n <> need then
    raise exception 'faltan partes del libro (% de %)', n, need using errcode = '55000';
  end if;
  update lad_books set complete = true where id = p_book;
end $$;

create or replace function public.lad_get_chunks(p_room text, p_book uuid)
returns table (idx integer, data text)
language plpgsql security definer set search_path = public as $$
begin
  perform lad_check(p_room, p_book);
  return query select c.idx, c.data from lad_chunks c where c.book = p_book order by c.idx;
end $$;

create or replace function public.lad_delete_book(p_room text, p_book uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform lad_check(p_room, p_book);
  delete from lad_books where id = p_book;
end $$;

-- ---------- progreso de lectura ----------
create or replace function public.lad_set_progress(p_room text, p_book uuid, p_member text, p_name text, p_color text, p_pos integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform lad_check(p_room, p_book);
  insert into lad_readers (book, member, name, color, pos, updated_at)
  values (p_book, left(p_member, 64), left(coalesce(p_name, ''), 40), left(coalesce(p_color, ''), 20), greatest(p_pos, 0), now())
  on conflict (book, member) do update
    set name = excluded.name, color = excluded.color, pos = excluded.pos, updated_at = now();
end $$;

create or replace function public.lad_list_readers(p_room text)
returns table (book uuid, member text, name text, color text, pos integer, updated_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if p_room is null or p_room !~ '^[0-9a-f]{64}$' then
    raise exception 'sala invalida' using errcode = '22023';
  end if;
  return query
    select r.book, r.member, r.name, r.color, r.pos, r.updated_at
    from lad_readers r join lad_books b on b.id = r.book where b.room = p_room;
end $$;

-- ---------- notas ----------
create or replace function public.lad_list_notes(p_room text, p_book uuid)
returns table (id uuid, pos integer, quote text, body text, color text, member text, name text, mcolor text,
               aud_mime text, aud_dur integer, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  perform lad_check(p_room, p_book);
  return query
    select n.id, n.pos, n.quote, n.body, n.color, n.member, n.name, n.mcolor, n.aud_mime, n.aud_dur, n.created_at
    from lad_notes n where n.book = p_book order by n.pos, n.created_at;
end $$;

create or replace function public.lad_add_note(p_room text, p_book uuid, p_pos integer, p_quote text, p_body text,
                                              p_color text, p_member text, p_name text, p_mcolor text,
                                              p_aud_b64 text, p_aud_mime text, p_aud_dur integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  perform lad_check(p_room, p_book);
  if p_aud_b64 is not null and char_length(p_aud_b64) > 6000000 then
    raise exception 'el audio es demasiado pesado' using errcode = '54000';
  end if;
  if (select count(*) from lad_notes where book = p_book) >= 800 then
    raise exception 'El libro ya tiene 800 notas.' using errcode = '54000';
  end if;
  insert into lad_notes (book, pos, quote, body, color, member, name, mcolor, aud_mime, aud_dur, aud_b64)
  values (p_book, greatest(p_pos, 0), left(coalesce(p_quote, ''), 200), left(coalesce(p_body, ''), 1500),
          coalesce(nullif(p_color, ''), 'yellow'), left(p_member, 64), left(coalesce(p_name, ''), 40),
          left(coalesce(p_mcolor, ''), 20), p_aud_mime, p_aud_dur, p_aud_b64)
  returning id into v;
  return v;
end $$;

create or replace function public.lad_get_audio(p_room text, p_note uuid)
returns table (mime text, b64 text)
language plpgsql security definer set search_path = public as $$
begin
  if p_room is null or p_room !~ '^[0-9a-f]{64}$' then
    raise exception 'sala invalida' using errcode = '22023';
  end if;
  return query
    select n.aud_mime, n.aud_b64 from lad_notes n join lad_books b on b.id = n.book
    where n.id = p_note and b.room = p_room and n.aud_b64 is not null;
end $$;

-- Solo quien escribió la nota puede borrarla.
create or replace function public.lad_delete_note(p_room text, p_note uuid, p_member text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_room is null or p_room !~ '^[0-9a-f]{64}$' then
    raise exception 'sala invalida' using errcode = '22023';
  end if;
  delete from lad_notes n using lad_books b
  where n.id = p_note and b.id = n.book and b.room = p_room and n.member = p_member;
end $$;

-- ---------- permisos: la app solo puede llamar estas funciones ----------
revoke all on function public.lad_check(text, uuid) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'lad_list_books(text)',
    'lad_add_book(text,text,integer,integer,boolean,integer,text,text)',
    'lad_add_chunk(text,uuid,integer,text)',
    'lad_finish_book(text,uuid)',
    'lad_get_chunks(text,uuid)',
    'lad_delete_book(text,uuid)',
    'lad_set_progress(text,uuid,text,text,text,integer)',
    'lad_list_readers(text)',
    'lad_list_notes(text,uuid)',
    'lad_add_note(text,uuid,integer,text,text,text,text,text,text,text,text,integer)',
    'lad_get_audio(text,uuid)',
    'lad_delete_note(text,uuid,text)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

notify pgrst, 'reload schema';
