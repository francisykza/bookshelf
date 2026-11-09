-- BookShelf · Lo que cada persona tiene a la vista en su estantería, para quien visita su piso. Aditiva y re-ejecutable.
--  · Copia aparte con lo justo para enseñar un libro (título, autoría y portada pública): nunca da acceso a la biblioteca privada.
--  · Solo se lee con las mismas reglas que la visita: comunidad activa, sin bloqueo y en tu edificio o a quien sigues.

create table if not exists public.piso_expuestos (
  user_id uuid primary key references auth.users (id) on delete cascade,
  libros jsonb not null default '[]'::jsonb check (jsonb_typeof(libros) = 'array' and jsonb_array_length(libros) <= 60),
  updated_at timestamptz not null default now()
);
alter table public.piso_expuestos enable row level security;
revoke all on public.piso_expuestos from public, anon, authenticated;

create or replace function public.piso_publicar_expuestos(lista jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  limpia jsonb;
begin
  if me is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '42501';
  end if;
  if jsonb_typeof(lista) <> 'array' then
    raise exception 'Lista no válida.' using errcode = 'P0001';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', left(s.e ->> 'id', 120),
    'title', left(btrim(s.e ->> 'title'), 300),
    'author', left(coalesce(s.e ->> 'author', ''), 300),
    'cover', case when char_length(s.e ->> 'cover') <= 600 and s.e ->> 'cover' ~ '^https://' then s.e ->> 'cover' else '' end
  ) order by s.n), '[]'::jsonb) into limpia
  from (select x.e, x.n from jsonb_array_elements(lista) with ordinality as x(e, n) order by x.n limit 60) s
  where jsonb_typeof(s.e) = 'object' and char_length(btrim(coalesce(s.e ->> 'title', ''))) > 0 and s.e ->> 'id' is not null;
  insert into public.piso_expuestos (user_id, libros, updated_at) values (me, limpia, now())
    on conflict (user_id) do update set libros = excluded.libros, updated_at = excluded.updated_at;
end;
$$;
revoke all on function public.piso_publicar_expuestos(jsonb) from public, anon;
grant execute on function public.piso_publicar_expuestos(jsonb) to authenticated;

create or replace function public.piso_expuestos_de(lector uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.tablon_puede_ver(lector)
    then coalesce((select e.libros from public.piso_expuestos e where e.user_id = lector), '[]'::jsonb)
    else '[]'::jsonb end;
$$;
revoke all on function public.piso_expuestos_de(uuid) from public, anon;
grant execute on function public.piso_expuestos_de(uuid) to authenticated;
