-- BookShelf · esquema de la nube (SPEC §9ter, 1.16.0).
-- Pégalo una vez en Supabase → SQL Editor → New query → Run. Se puede volver a ejecutar sin romper nada.

-- Una fila por persona con todo su estado (libros, progreso, figuras, ajustes compartidos)
create table if not exists public.libraries (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb not null,
  version    integer not null default 5,
  updated_at timestamptz not null default now()
);

-- La hora de cada guardado la pone el servidor (la app la usa para detectar si otro dispositivo escribió)
create or replace function public.libraries_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists libraries_touch on public.libraries;
create trigger libraries_touch
  before insert or update on public.libraries
  for each row execute function public.libraries_touch();

-- Seguridad por filas: cada persona solo ve y cambia su propia fila
alter table public.libraries enable row level security;

drop policy if exists "leer mi biblioteca" on public.libraries;
create policy "leer mi biblioteca" on public.libraries
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "crear mi biblioteca" on public.libraries;
create policy "crear mi biblioteca" on public.libraries
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "guardar mi biblioteca" on public.libraries;
create policy "guardar mi biblioteca" on public.libraries
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "borrar mi biblioteca" on public.libraries;
create policy "borrar mi biblioteca" on public.libraries
  for delete to authenticated using ((select auth.uid()) = user_id);
