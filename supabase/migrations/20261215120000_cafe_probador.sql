-- 1.126 · El café-librería del bajo: jornadas de prueba para la cuenta de Francisco.
-- Francisco, 13-11-2026: «Quiero que mi cuenta pueda jugar todo lo que quiera para probar yo todas las funciones del juego y
-- ver cosas cambiar o no».
--
-- Quien está en `cafe_probadores` (se añade a mano con `supabase/scripts/cafe_probador.sql`; nadie puede añadirse desde la
-- app) puede abrir una jornada nueva cuando ha atendido a todos: el café juega con un día propio de pruebas (desde el
-- 1-1-3000, uno más cada vez), con sus clientes, su excéntrico y sus habituales, como un día cualquiera. No se borra nada:
-- los días de verdad, la pizarra, los granos, la reputación y los niveles siguen como estaban, y el progreso de las jornadas
-- cuenta igual. Los tickets de cada jornada siguen sus reglas (los de nivel, una vez; los del día, por jornada, como mucho 5),
-- solo para esa cuenta. Para el resto de cuentas no cambia nada: `cafe_dia_valido` sigue aceptando solo hoy o ayer.

create table if not exists public.cafe_probadores (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  jornada  date not null default date '3000-01-01' check (jornada >= date '3000-01-01'),
  creado   timestamptz not null default now()
);
alter table public.cafe_probadores enable row level security;
revoke all on table public.cafe_probadores from anon, authenticated;

-- El día que manda la app vale si es hoy o ayer (Madrid) o, para quien prueba, su jornada de prueba actual
create or replace function public.cafe_dia_valido(dia date)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select dia is not null and (
    dia between public.cafe_hoy() - 1 and public.cafe_hoy()
    or exists (select 1 from public.cafe_probadores p where p.user_id = auth.uid() and p.jornada = dia)
  );
$$;
revoke all on function public.cafe_dia_valido(date) from public, anon, authenticated;

-- La jornada de prueba de quien llama (AAAA-MM-DD), o null si no prueba: la app juega ese día en vez del de hoy
create or replace function public.cafe_jornada()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select p.jornada from public.cafe_probadores p where p.user_id = auth.uid();
$$;
revoke all on function public.cafe_jornada() from public, anon;
grant execute on function public.cafe_jornada() to authenticated;

-- Otra jornada: solo para quien prueba y con todos los clientes de la actual atendidos (si aún no la ha abierto, vale)
create or replace function public.cafe_nueva_jornada()
returns date
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  p public.cafe_probadores;
  d public.cafe_dias;
  atendidos integer;
begin
  select * into p from public.cafe_probadores x where x.user_id = me for update;
  if not found then
    raise exception 'cafe:probador' using errcode = 'P0001';
  end if;
  select * into d from public.cafe_dias x where x.user_id = me and x.dia = p.jornada;
  if found then
    select count(*) into atendidos from public.cafe_servicios s where s.user_id = me and s.dia = p.jornada;
    if atendidos < d.clientes + d.habituales then
      raise exception 'cafe:pendientes' using errcode = 'P0001';
    end if;
  end if;
  update public.cafe_probadores x set jornada = x.jornada + 1 where x.user_id = me returning x.jornada into p.jornada;
  return p.jornada;
end;
$$;
revoke all on function public.cafe_nueva_jornada() from public, anon;
grant execute on function public.cafe_nueva_jornada() to authenticated;
