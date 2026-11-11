-- El casino en 3D, bloque d (1.110.0, SPEC §110; encargo de Francisco del 10-11-2026, plan en docs/qa/casino-3d.md):
-- «Las tres chisteras», el tercer juego del casino. La aplica Francisco en el SQL Editor, después de
-- 20261201120000_casino_ruleta.sql. Sin ella, la mesa de las chisteras se ve pero no se juega.
--
-- - El conejo se mete bajo una de las tres chisteras y las chisteras se cambian de sitio; quien juega elige dónde está.
--   Una partida al día de tres rondas, cada una con más cambios (3, 5 y 7). Es de habilidad: el premio depende solo de
--   cuántas rondas se aciertan (0, 1, 2 o 3: 1, 3, 6 o 10 fichas), **dentro** del tope de 150 fichas a la semana
--   (piso_casino_semana las cuenta junto a las manos de «Las 21 páginas»). Nunca se pierde nada.
-- - **Baraja y comprueba el servidor**: cada vez que se mira una ronda (piso_casino_chisteras_ver) se sortean otra vez
--   dónde empieza el conejo y los cambios, así que volver a mirarla no da ventaja; la elección
--   (piso_casino_chisteras_elegir) se comprueba con lo último que se enseñó y solo vale una vez por ronda.
-- - Las partidas perfectas (tres de tres) se cuentan para los premios de la vitrina (bloque e). Sin tickets ni sobres.
-- ADITIVA y re-ejecutable: una tabla y siete funciones nuevas, y redefine piso_casino_semana (la de
-- 20261111120000_hotel_casino_arreglos.sql) para que sume también las fichas de las chisteras. No borra ni cambia datos.
-- Probada con PGlite (src/features/edificio/__tests__/casino-chisteras.rls.test.js).

-- ── La partida de cada día (solo se usa desde las funciones) ──
create table if not exists public.piso_casino_chisteras (
  user_id uuid not null references auth.users (id) on delete cascade,
  dia date not null,
  estado text not null default 'jugando' check (estado in ('jugando', 'hecha')),
  -- La ronda que toca (1 a 3) y lo que se enseñó la última vez que se miró: dónde empieza el conejo (0 izquierda, 1 medio,
  -- 2 derecha) y los cambios (0 = izquierda y medio, 1 = medio y derecha, 2 = izquierda y derecha). Sin mirar, null
  ronda smallint not null default 1 check (ronda between 1 and 3),
  inicio smallint check (inicio between 0 and 2),
  cambios smallint[],
  -- Cada ronda jugada: [{ elegida, conejo, acierto }]
  rondas jsonb not null default '[]'::jsonb,
  aciertos smallint not null default 0 check (aciertos between 0 and 3),
  fichas integer not null default 0 check (fichas >= 0),
  creado timestamptz not null default now(),
  primary key (user_id, dia)
);
alter table public.piso_casino_chisteras enable row level security;
revoke all on public.piso_casino_chisteras from anon, authenticated;

-- Las reglas en cifras (las mismas que CHISTERAS_JUEGO en src/features/edificio/hotel/chisteras.js; una prueba lo comprueba)
create or replace function public.piso_casino_chisteras_reglas()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('rondas', 3, 'cambios', jsonb_build_array(3, 5, 7), 'premios', jsonb_build_array(1, 3, 6, 10));
$$;

-- Dónde acaba el conejo si empieza bajo `inicio` y se hacen `cambios`
create or replace function public.piso_casino_chisteras_final(inicio integer, cambios smallint[])
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  pos integer := inicio;
  k smallint;
  a integer;
  b integer;
begin
  foreach k in array coalesce(cambios, '{}'::smallint[]) loop
    a := case k when 2 then 0 else k end;
    b := case k when 0 then 1 else 2 end;
    if pos = a then
      pos := b;
    elsif pos = b then
      pos := a;
    end if;
  end loop;
  return pos;
end;
$$;

-- Las fichas ganadas en la semana de `dia`: las manos de «Las 21 páginas» y, desde la 1.110, las partidas de las
-- chisteras (las dos van dentro del mismo tope de 150; la ruleta, fuera)
create or replace function public.piso_casino_semana(uid uuid, dia date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    coalesce((select sum(m.fichas) from public.piso_casino_manos m
      where m.user_id = uid and m.dia >= date_trunc('week', piso_casino_semana.dia)::date and m.dia < date_trunc('week', piso_casino_semana.dia)::date + 7), 0)
    + coalesce((select sum(c.fichas) from public.piso_casino_chisteras c
      where c.user_id = uid and c.dia >= date_trunc('week', piso_casino_semana.dia)::date and c.dia < date_trunc('week', piso_casino_semana.dia)::date + 7), 0)
  )::integer;
$$;
revoke all on function public.piso_casino_semana(uuid, date) from public, anon, authenticated;

-- La partida de `uid` el día `dia`, sin nada de lo que está por elegir: { dia, estado, ronda, rondas, aciertos, fichas,
-- perfectas, reglas, semana, tope, fichasCuenta }. `estado` es null si aún no ha empezado
create or replace function public.piso_casino_chisteras_vista(uid uuid, dia date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'dia', piso_casino_chisteras_vista.dia,
    'estado', p.estado,
    'ronda', coalesce(p.ronda, 1),
    'rondas', coalesce(p.rondas, '[]'::jsonb),
    'aciertos', coalesce(p.aciertos, 0),
    'fichas', coalesce(p.fichas, 0),
    'perfectas', (select count(*) from public.piso_casino_chisteras x where x.user_id = uid and x.estado = 'hecha' and x.aciertos = 3),
    'reglas', public.piso_casino_chisteras_reglas(),
    'semana', public.piso_casino_semana(uid, piso_casino_chisteras_vista.dia),
    'tope', (public.piso_casino_reglas() ->> 'tope')::integer,
    'fichasCuenta', coalesce((select c.fichas from public.piso_casino_cuentas c where c.user_id = uid), 0)
  )
  from (select 1) uno
  left join public.piso_casino_chisteras p on p.user_id = uid and p.dia = piso_casino_chisteras_vista.dia;
$$;
revoke all on function public.piso_casino_chisteras_vista(uuid, date) from public, anon, authenticated;

-- La partida de hoy para quien juega (sin empezarla)
create or replace function public.piso_casino_chisteras(dia date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
begin
  return public.piso_casino_chisteras_vista(me, dia);
end;
$$;
revoke all on function public.piso_casino_chisteras(date) from public, anon;
grant execute on function public.piso_casino_chisteras(date) to authenticated;

-- Mirar la ronda que toca (`dia`: hoy, ayer o mañana, por las zonas horarias). Empieza la partida si hace falta y sortea
-- de nuevo dónde empieza el conejo y los cambios; devuelve la partida con { inicio, cambios } de esta ronda
create or replace function public.piso_casino_chisteras_ver(dia date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  p public.piso_casino_chisteras;
  n integer;
  ini smallint := floor(random() * 3)::smallint;
  cs smallint[];
begin
  if dia > current_date + 1 or dia < current_date - 1 then
    raise exception 'Ese día ya no se puede jugar.' using errcode = 'P0001';
  end if;
  perform public.piso_casino_llegar(me, dia);
  perform 1 from public.piso_casino_cuentas x where x.user_id = me for update;
  insert into public.piso_casino_chisteras (user_id, dia) values (me, dia) on conflict do nothing;
  select * into p from public.piso_casino_chisteras x where x.user_id = me and x.dia = piso_casino_chisteras_ver.dia;
  if p.estado = 'hecha' then
    raise exception 'Hoy ya has jugado a las chisteras: mañana, más.' using errcode = 'P0001';
  end if;
  n := (public.piso_casino_chisteras_reglas() -> 'cambios' ->> (p.ronda - 1))::integer;
  cs := array(select floor(random() * 3)::smallint from generate_series(1, n));
  update public.piso_casino_chisteras x set inicio = ini, cambios = cs
    where x.user_id = me and x.dia = piso_casino_chisteras_ver.dia;
  return public.piso_casino_chisteras_vista(me, dia) || jsonb_build_object('inicio', ini, 'cambios', to_jsonb(cs));
end;
$$;
revoke all on function public.piso_casino_chisteras_ver(date) from public, anon;
grant execute on function public.piso_casino_chisteras_ver(date) to authenticated;

-- Elegir una chistera (0 izquierda, 1 medio, 2 derecha) en la ronda que se acaba de mirar. Una sola vez por ronda; al
-- acabar la tercera, las fichas (sin pasar del tope de la semana). Devuelve la partida con { elegida, conejo, acierto }
create or replace function public.piso_casino_chisteras_elegir(dia date, chistera integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  p public.piso_casino_chisteras;
  reglas jsonb := public.piso_casino_chisteras_reglas();
  conejo integer;
  bien boolean;
  total integer;
  premio integer := 0;
begin
  if chistera is null or chistera not between 0 and 2 then
    raise exception 'Esa chistera no está en la mesa.' using errcode = 'P0001';
  end if;
  perform 1 from public.piso_casino_cuentas x where x.user_id = me for update;
  select * into p from public.piso_casino_chisteras x where x.user_id = me and x.dia = piso_casino_chisteras_elegir.dia;
  if p.user_id is null then
    raise exception 'Primero mira la ronda.' using errcode = 'P0001';
  end if;
  if p.estado = 'hecha' then
    raise exception 'Hoy ya has jugado a las chisteras: mañana, más.' using errcode = 'P0001';
  end if;
  if p.cambios is null then
    raise exception 'Primero mira la ronda.' using errcode = 'P0001';
  end if;
  conejo := public.piso_casino_chisteras_final(p.inicio, p.cambios);
  bien := conejo = chistera;
  total := p.aciertos + case when bien then 1 else 0 end;
  if p.ronda >= (reglas ->> 'rondas')::integer then
    premio := least((reglas -> 'premios' ->> total)::integer, greatest(0, (public.piso_casino_reglas() ->> 'tope')::integer - public.piso_casino_semana(me, dia)));
    update public.piso_casino_chisteras x
      set estado = 'hecha', inicio = null, cambios = null, aciertos = total, fichas = premio,
          rondas = x.rondas || jsonb_build_array(jsonb_build_object('elegida', chistera, 'conejo', conejo, 'acierto', bien))
      where x.user_id = me and x.dia = piso_casino_chisteras_elegir.dia;
    update public.piso_casino_cuentas c set fichas = c.fichas + premio where c.user_id = me;
  else
    update public.piso_casino_chisteras x
      set ronda = x.ronda + 1, inicio = null, cambios = null, aciertos = total,
          rondas = x.rondas || jsonb_build_array(jsonb_build_object('elegida', chistera, 'conejo', conejo, 'acierto', bien))
      where x.user_id = me and x.dia = piso_casino_chisteras_elegir.dia;
  end if;
  return public.piso_casino_chisteras_vista(me, dia) || jsonb_build_object('elegida', chistera, 'conejo', conejo, 'acierto', bien);
end;
$$;
revoke all on function public.piso_casino_chisteras_elegir(date, integer) from public, anon;
grant execute on function public.piso_casino_chisteras_elegir(date, integer) to authenticated;
