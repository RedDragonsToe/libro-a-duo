-- =====================================================================
-- Libro a Dúo · actualización 2
--  * Guarda el largo total de cada libro (para el porcentaje con dos decimales).
--  * Agrega la lista de lectura compartida (pendientes, leyendo, ya leídos).
-- Se puede correr más de una vez sin romper nada. Los libros y notas
-- que ya tenés no se tocan.
-- =====================================================================

alter table public.lad_books add column if not exists total integer;

-- Cambian los parámetros y lo que devuelven, así que hay que reemplazarlas.
drop function if exists public.lad_list_books(text);
drop function if exists public.lad_add_book(text,text,integer,integer,boolean,integer,text,text);
drop function if exists public.lad_add_book(text,text,integer,integer,integer,boolean,integer,text,text);

create function public.lad_list_books(p_room text)
returns table (id uuid, title text, chars integer, words integer, total integer, gz boolean, n_chunks integer,
               by_member text, by_name text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if p_room is null or p_room !~ '^[0-9a-f]{64}$' then
    raise exception 'sala invalida' using errcode = '22023';
  end if;
  return query
    select b.id, b.title, b.chars, b.words, b.total, b.gz, b.n_chunks, b.by_member, b.by_name, b.created_at
    from lad_books b where b.room = p_room and b.complete order by b.created_at desc;
end $$;

create function public.lad_add_book(p_room text, p_title text, p_chars integer, p_words integer, p_total integer,
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
  insert into lad_books (room, title, chars, words, total, gz, n_chunks, by_member, by_name)
  values (p_room, left(trim(p_title), 160), p_chars, p_words, p_total, p_gz, p_n_chunks, left(p_member, 64), left(coalesce(p_name, ''), 40))
  returning id into v;
  return v;
end $$;

-- ---------- lista de lectura ----------
create table if not exists public.lad_wishlist (
  id          uuid primary key default gen_random_uuid(),
  room        text not null check (room ~ '^[0-9a-f]{64}$'),
  title       text not null check (char_length(title) between 1 and 160),
  status      text not null default 'pending' check (status in ('pending', 'reading', 'done')),
  done_at     timestamptz,
  book        uuid references public.lad_books(id) on delete set null,
  by_member   text,
  by_name     text,
  created_at  timestamptz not null default now()
);
create index if not exists lad_wishlist_room_idx on public.lad_wishlist (room, created_at);
alter table public.lad_wishlist enable row level security;
revoke all on public.lad_wishlist from anon, authenticated;

create or replace function public.lad_wish_list(p_room text)
returns table (id uuid, title text, status text, done_at timestamptz, book uuid,
               by_member text, by_name text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if p_room is null or p_room !~ '^[0-9a-f]{64}$' then
    raise exception 'sala invalida' using errcode = '22023';
  end if;
  return query
    select w.id, w.title, w.status, w.done_at, w.book, w.by_member, w.by_name, w.created_at
    from lad_wishlist w where w.room = p_room order by w.created_at;
end $$;

create or replace function public.lad_wish_add(p_room text, p_title text, p_member text, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid; t text := left(trim(coalesce(p_title, '')), 160);
begin
  if p_room is null or p_room !~ '^[0-9a-f]{64}$' then
    raise exception 'sala invalida' using errcode = '22023';
  end if;
  if t = '' then
    raise exception 'Escribí el título del libro.' using errcode = '22023';
  end if;
  if (select count(*) from lad_wishlist where room = p_room) >= 200 then
    raise exception 'La lista ya tiene 200 libros.' using errcode = '54000';
  end if;
  insert into lad_wishlist (room, title, by_member, by_name)
  values (p_room, t, left(p_member, 64), left(coalesce(p_name, ''), 40))
  returning id into v;
  return v;
end $$;

create or replace function public.lad_wish_set_status(p_room text, p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_room is null or p_room !~ '^[0-9a-f]{64}$' then
    raise exception 'sala invalida' using errcode = '22023';
  end if;
  if p_status not in ('pending', 'reading', 'done') then
    raise exception 'estado invalido' using errcode = '22023';
  end if;
  update lad_wishlist
     set status = p_status,
         done_at = case when p_status = 'done' then coalesce(done_at, now()) else null end
   where id = p_id and room = p_room;
  if not found then raise exception 'libro de la lista no encontrado' using errcode = 'P0002'; end if;
end $$;

create or replace function public.lad_wish_delete(p_room text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_room is null or p_room !~ '^[0-9a-f]{64}$' then
    raise exception 'sala invalida' using errcode = '22023';
  end if;
  delete from lad_wishlist where id = p_id and room = p_room;
end $$;

-- Une un libro de la lista con el libro ya subido a la biblioteca.
create or replace function public.lad_wish_link(p_room text, p_id uuid, p_book uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform lad_check(p_room, p_book);
  update lad_wishlist set book = p_book where id = p_id and room = p_room;
  if not found then raise exception 'libro de la lista no encontrado' using errcode = 'P0002'; end if;
end $$;

-- ---------- permisos ----------
do $$
declare f text;
begin
  foreach f in array array[
    'lad_list_books(text)',
    'lad_add_book(text,text,integer,integer,integer,boolean,integer,text,text)',
    'lad_wish_list(text)',
    'lad_wish_add(text,text,text,text)',
    'lad_wish_set_status(text,uuid,text)',
    'lad_wish_delete(text,uuid)',
    'lad_wish_link(text,uuid,uuid)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

notify pgrst, 'reload schema';
