-- ========== v7: llevar la sesión a otro dispositivo (enlace de un solo uso) ==========
create table if not exists public.lad_transfers (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{22,64}$'),
  blob text not null check (length(blob) <= 8000),
  expires_at timestamptz not null
);
alter table public.lad_transfers enable row level security;
revoke all on public.lad_transfers from anon, authenticated;

create or replace function public.lad_xfer_put(p_id text, p_blob text) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from lad_transfers where expires_at < now();
  if (select count(*) from lad_transfers) >= 500 then raise exception 'demasiados pendientes' using errcode = '53400'; end if;
  insert into lad_transfers(id, blob, expires_at) values (p_id, p_blob, now() + interval '10 minutes');
end $$;

create or replace function public.lad_xfer_take(p_id text) returns text
language plpgsql security definer set search_path = public as $$
declare v text;
begin
  delete from lad_transfers where expires_at < now();
  delete from lad_transfers where id = p_id returning blob into v;
  return v;
end $$;
revoke all on function public.lad_xfer_put(text,text), public.lad_xfer_take(text) from public;
grant execute on function public.lad_xfer_put(text,text), public.lad_xfer_take(text) to anon, authenticated;
notify pgrst, 'reload schema';
