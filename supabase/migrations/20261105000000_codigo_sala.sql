-- ========== v5: guardar el código de la sala (lo ve solo el dueño del proyecto) ==========
create table if not exists public.lad_room_codes (
  room text primary key check (room ~ '^[0-9a-f]{64}$'),
  code text not null,
  seen_at timestamptz not null default now()
);
alter table public.lad_room_codes enable row level security;
revoke all on public.lad_room_codes from anon, authenticated;

create or replace function public.lad_room_note_code(p_room text, p_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform lad_gate(p_room);
  if p_room is null or p_code is null or length(p_code) < 6 or length(p_code) > 200 then return; end if;
  if encode(sha256(convert_to('libro-a-duo:v1:' || p_code, 'UTF8')), 'hex') <> p_room then return; end if;
  insert into lad_room_codes(room, code) values (p_room, p_code)
  on conflict (room) do update set code = excluded.code, seen_at = now();
end $$;
revoke all on function public.lad_room_note_code(text,text) from public;
grant execute on function public.lad_room_note_code(text,text) to anon, authenticated;
notify pgrst, 'reload schema';
