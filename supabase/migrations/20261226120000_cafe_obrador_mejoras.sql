-- 1.144 (§144) · El café-librería del bajo: el obrador, segunda tanda (bloque 2 de docs/qa/cafe-libreria.md §18.12; plan aprobado por
-- Francisco el 17-11-2026 con las cuatro recomendadas, y «Sigue con el bloque 2» el 19-11-2026).
-- Requiere las migraciones del café hasta 20261225120000_cafe_obrador.sql (todas ya aplicadas). Añade columnas y funciones y
-- redefine varias del bloque 1 (cada una dice qué cambia):
-- - Las mejoras (`cafe_obrador_mejorar`), como el cuaderno de Pilar: se pagan una vez con granos, tienen grados y nunca caducan.
--   El horno: 2 bandejas por 250 granos (nivel 4) y 3 por 600 (nivel 6). La vitrina: 20 piezas y 6 al día en el mostrador por 150
--   (nivel 4), 30 y 9 por 350 (nivel 5), 40 y 12 por 700 (nivel 7). Antes de cambiar la vitrina, se cobra lo que ya vendió Pilar.
-- - Las vitrinas de tartas (el mueble `cafe-vitrina` del nivel 2) que tengas colocadas en el plano suman 6 huecos cada una, hasta dos.
-- - La venta del mostrador (`cafe_mostrador`): por cada día entero que pasa, Pilar vende a la gente de la calle lo que haya en la
--   vitrina, como mucho su cupo diario, a precio base (+1 la especialidad), guardando como mucho 7 días, como la hucha. Las
--   jornadas de prueba (`cafe_probadores`) cuentan como un día más cada una.
-- - La especialidad del día (`cafe_obrador_especialidad`): una de tus recetas abiertas, elegida con la semilla del servidor. Paga
--   +1 grano por pieza, en la mesa y en el mostrador, y más clientes la piden (de quienes piden comida, dos de cada tres piden su
--   tipo, dulce o salado).
-- - La maestría, por receta, con las hornadas de 2 o 3 estrellas: ★ con 3 (+1 pieza por bandeja), ★★ con 10 (+1 grano por pieza
--   servida en la mesa) y ★★★ con 25 («Que lo hornee Pilar», `cafe_hornear_pilar`: la hornada sale como una de 3 estrellas).
-- La comida sigue dando solo granos: nunca reputación ni tickets. Las cifras, las mismas que en src/features/edificio/cafe/cafeObrador.js
-- (las pruebas lo comprueban). Todo por funciones `security definer`; las tablas, con RLS y sin permisos directos. Re-ejecutable.

-- ── Lo nuevo de cada obrador: el mostrador (desde cuándo cuenta y lo que ha dado) ──
-- Las cuentas que ya lo tenían abierto empiezan a contar desde que se aplica esta migración: nada atrasado.
alter table public.cafe_obrador add column if not exists mostrador_desde timestamptz not null default now();
alter table public.cafe_obrador add column if not exists mostrador_prueba date;
alter table public.cafe_obrador add column if not exists mostrador_piezas integer not null default 0;
alter table public.cafe_obrador add column if not exists mostrador_granos integer not null default 0;
alter table public.cafe_obrador drop constraint if exists cafe_obrador_mostrador_check;
alter table public.cafe_obrador add constraint cafe_obrador_mostrador_check
  check (mostrador_piezas between 0 and 1000000000 and mostrador_granos between 0 and 1000000000);

-- Cada hornada apunta su bandeja y si la horneó Pilar (para lo que te ha dado el horno y para la maestría)
alter table public.cafe_obrador_hornadas add column if not exists bandeja smallint not null default 1;
alter table public.cafe_obrador_hornadas add column if not exists pilar boolean not null default false;
alter table public.cafe_obrador_hornadas drop constraint if exists cafe_obrador_hornadas_bandeja_check;
alter table public.cafe_obrador_hornadas add constraint cafe_obrador_hornadas_bandeja_check check (bandeja between 1 and 3);
create index if not exists cafe_obrador_hornadas_receta on public.cafe_obrador_hornadas (user_id, receta);

-- ── Las cifras fijas (las mismas que en cafeObrador.js) ──
-- Lo que cuesta cada grado de una mejora del obrador (null: no existe o es el de serie)
create or replace function public.cafe_obrador_precio(mejora text, grado integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case mejora
           when 'horno' then case grado when 2 then 250 when 3 then 600 end
           when 'vitrina' then case grado when 2 then 150 when 3 then 350 when 4 then 700 end
         end;
$$;
revoke all on function public.cafe_obrador_precio(text, integer) from public, anon, authenticated;

-- Desde qué nivel del café se puede comprar cada grado
create or replace function public.cafe_obrador_mejora_nivel(mejora text, grado integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case mejora
           when 'horno' then case when grado >= 3 then 6 else 4 end
           when 'vitrina' then case when grado >= 4 then 7 when grado = 3 then 5 else 4 end
         end;
$$;
revoke all on function public.cafe_obrador_mejora_nivel(text, integer) from public, anon, authenticated;

-- Las piezas que vende Pilar en el mostrador por cada día entero, según el grado de la vitrina
create or replace function public.cafe_obrador_cupo(vitrina integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case coalesce(vitrina, 1) when 4 then 12 when 3 then 9 when 2 then 6 else 4 end;
$$;
revoke all on function public.cafe_obrador_cupo(integer) from public, anon, authenticated;

-- Las vitrinas de tartas colocadas en el plano que cuentan (hasta dos), y los huecos que suma cada una
create or replace function public.cafe_obrador_tartas(plano jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select least(2, count(*))::integer
    from jsonb_array_elements(case when jsonb_typeof(plano -> 'items') = 'array' then plano -> 'items' else '[]'::jsonb end) e
   where e ->> 'id' = 'cafe-vitrina';
$$;
revoke all on function public.cafe_obrador_tartas(jsonb) from public, anon, authenticated;

create or replace function public.cafe_obrador_tarta_huecos()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 6;
$$;
revoke all on function public.cafe_obrador_tarta_huecos() from public, anon, authenticated;

-- La maestría de una receta (0 a 3) según sus hornadas de 2 o 3 estrellas: ★ con 3, ★★ con 10 y ★★★ con 25
create or replace function public.cafe_obrador_maestria(buenas integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when coalesce(buenas, 0) >= 25 then 3 when buenas >= 10 then 2 when buenas >= 3 then 1 else 0 end;
$$;
revoke all on function public.cafe_obrador_maestria(integer) from public, anon, authenticated;

-- Todas las recetas del recetario, en su orden (las que aún no tienen cifras en `cafe_obrador_receta` no cuentan)
create or replace function public.cafe_obrador_recetario()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['magdalenas', 'empanada', 'galletas', 'pan', 'bizcocho', 'tortilla'];
$$;
revoke all on function public.cafe_obrador_recetario() from public, anon, authenticated;

-- ── Lo de cada cuenta ──
-- Las hornadas buenas (2 o 3 estrellas) de una receta
create or replace function public.cafe_obrador_buenas(uid uuid, receta text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.cafe_obrador_hornadas h where h.user_id = uid and h.receta = cafe_obrador_buenas.receta and h.estrellas >= 2;
$$;
revoke all on function public.cafe_obrador_buenas(uuid, text) from public, anon, authenticated;

-- Las piezas que caben en la vitrina: las de su grado y 6 por vitrina de tartas colocada (hasta dos)
create or replace function public.cafe_obrador_capacidad(uid uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select public.cafe_obrador_cabe(o.vitrina) + public.cafe_obrador_tarta_huecos() * public.cafe_obrador_tartas(l.plano)
    from public.cafe_obrador o join public.cafe_locales l on l.user_id = o.user_id
   where o.user_id = uid;
$$;
revoke all on function public.cafe_obrador_capacidad(uuid) from public, anon, authenticated;

-- La especialidad de un día: una de las recetas que se pueden hornear en tu nivel, con la semilla del servidor (null sin ninguna)
create or replace function public.cafe_obrador_especialidad(uid uuid, dia date)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_nivel integer;
  abiertas text[];
begin
  select l.nivel into v_nivel from public.cafe_locales l where l.user_id = uid;
  select coalesce(array_agg(t.r order by t.k), '{}') into abiertas
    from unnest(public.cafe_obrador_recetario()) with ordinality t(r, k)
   where public.cafe_obrador_receta(t.r) is not null and (public.cafe_obrador_receta(t.r) ->> 'nivel')::integer <= coalesce(v_nivel, 0);
  if dia is null or cardinality(abiertas) = 0 then
    return null;
  end if;
  return abiertas[1 + public.cafe_semilla(uid, dia, 'especialidad') % cardinality(abiertas)];
end;
$$;
revoke all on function public.cafe_obrador_especialidad(uuid, date) from public, anon, authenticated;

-- Los días del mostrador que hay ahora mismo (como mucho 7): los enteros desde la última vez y, en las jornadas de prueba, uno por
-- cada jornada nueva
create or replace function public.cafe_mostrador_dias(uid uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select least(7, greatest(0, floor(extract(epoch from (now() - o.mostrador_desde)) / 86400)::integer)
                  + coalesce((select greatest(0, p.jornada - coalesce(o.mostrador_prueba, p.jornada)) from public.cafe_probadores p where p.user_id = uid), 0))
      from public.cafe_obrador o where o.user_id = uid), 0);
$$;
revoke all on function public.cafe_mostrador_dias(uuid) from public, anon, authenticated;

-- ── ¿Pide algo para acompañar este cliente este día? (de 20261225120000_cafe_obrador.sql) ──
-- Quién pide sigue igual (uno de cada tres, con la misma semilla). Lo que cambia es qué pide: con una especialidad, dos de cada tres
-- de quienes piden comida quieren su tipo. Sin especialidad, como antes (la mitad dulce y la mitad salado).
create or replace function public.cafe_pide_comida(uid uuid, dia date, cliente integer)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n integer;
  s integer;
  k integer;
  t_esp text;
begin
  if not exists (select 1 from public.cafe_obrador o where o.user_id = uid) then
    return null;
  end if;
  select d.clientes into n from public.cafe_dias d where d.user_id = uid and d.dia = cafe_pide_comida.dia;
  if n is null then
    return null;
  end if;
  if not (cliente between 1 and n - 1 or cliente between 101 and 102 or cliente between 201 and 203) then
    return null;
  end if;
  s := public.cafe_semilla(uid, cafe_pide_comida.dia, 'f' || cliente);
  if s % 3 <> 0 then
    return null;
  end if;
  k := (s / 3) % 6;
  t_esp := public.cafe_obrador_receta(public.cafe_obrador_especialidad(uid, cafe_pide_comida.dia)) ->> 'tipo';
  if t_esp is null then
    return case when k % 2 = 0 then 'dulce' else 'salado' end;
  end if;
  return case when k < 4 then t_esp when t_esp = 'dulce' then 'salado' else 'dulce' end;
end;
$$;
revoke all on function public.cafe_pide_comida(uuid, date, integer) from public, anon, authenticated;

-- ── Lo que se ve del obrador de una cuenta (de 20261225120000_cafe_obrador.sql), con lo de la 1.144 ──
-- `cabe`, ya con las vitrinas de tartas; `tartas`, las que cuentan; `cupo`, lo que vende Pilar al día; `mostrador`, los días que
-- esperan y lo que ha dado; `recetas`, por receta, sus hornadas buenas y su maestría; `dado`, lo que te ha dado cada mejora.
create or replace function public.cafe_obrador_json(uid uuid)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'horno', o.horno,
    'vitrina', o.vitrina,
    'bandejas', public.cafe_obrador_bandejas(o.horno),
    'cabe', public.cafe_obrador_capacidad(uid),
    'tartas', public.cafe_obrador_tartas(l.plano),
    'cupo', public.cafe_obrador_cupo(o.vitrina),
    'horneando', coalesce((
      select jsonb_agg(jsonb_build_object('bandeja', h.bandeja, 'receta', h.receta, 'piezas', h.piezas, 'estrellas', h.estrellas,
               'falta', greatest(0, ceil(extract(epoch from (h.metida + make_interval(secs => coalesce((public.cafe_obrador_receta(h.receta) ->> 'segundos')::integer, 60)) - now()))))::integer)
               order by h.bandeja)
        from public.cafe_obrador_horno h where h.user_id = uid), '[]'::jsonb),
    'piezas', coalesce((select jsonb_object_agg(v.receta, v.piezas) from public.cafe_obrador_vitrina v where v.user_id = uid and v.piezas > 0), '{}'::jsonb),
    'hornadas_hoy', (select count(*)::integer from public.cafe_obrador_hornadas x where x.user_id = uid and x.dia = public.cafe_hoy()),
    'vendidas', (select count(*)::integer from public.cafe_obrador_ventas x where x.user_id = uid),
    'mostrador', jsonb_build_object('dias', public.cafe_mostrador_dias(uid), 'piezas', o.mostrador_piezas, 'granos', o.mostrador_granos),
    'recetas', coalesce((
      select jsonb_object_agg(t.r, jsonb_build_object('buenas', b.n, 'maestria', public.cafe_obrador_maestria(b.n)))
        from unnest(public.cafe_obrador_recetario()) t(r)
       cross join lateral (select public.cafe_obrador_buenas(uid, t.r) as n) b
       where public.cafe_obrador_receta(t.r) is not null), '{}'::jsonb),
    'dado', jsonb_build_object(
      'horno', (select count(*)::integer from public.cafe_obrador_hornadas x where x.user_id = uid and x.bandeja > 1),
      'pilar', (select count(*)::integer from public.cafe_obrador_hornadas x where x.user_id = uid and x.pilar)))
  from public.cafe_obrador o join public.cafe_locales l on l.user_id = o.user_id
  where o.user_id = uid;
$$;
revoke all on function public.cafe_obrador_json(uuid) from public, anon, authenticated;

-- ── Tu obrador y quién pide algo para acompañar ese día (de 20261225120000_cafe_obrador.sql), con la especialidad del día ──
-- { obrador, piden, especialidad } (sin el obrador abierto, la especialidad no va).
create or replace function public.cafe_obrador(dia date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  d public.cafe_dias;
  o jsonb;
begin
  perform public.cafe_abrir_dia(me, dia);
  select * into d from public.cafe_dias x where x.user_id = me and x.dia = cafe_obrador.dia;
  -- Quien juega jornadas de prueba: el mostrador cuenta desde la jornada en que se ve por primera vez
  update public.cafe_obrador x set mostrador_prueba = p.jornada
    from public.cafe_probadores p
   where x.user_id = me and p.user_id = me and x.mostrador_prueba is null;
  o := public.cafe_obrador_json(me);
  return jsonb_build_object(
    'obrador', o,
    'piden', coalesce((
      select jsonb_agg(jsonb_build_object('n', c.n, 'tipo', t.tipo, 'servido', v.cliente is not null, 'receta', v.receta) order by c.n)
        from (select g.n from generate_series(1, d.clientes) g(n)
              union all select 100 + k from generate_series(1, d.habituales) k
              union all select 200 + k from generate_series(1, d.virales) k) c
       cross join lateral (select public.cafe_pide_comida(me, cafe_obrador.dia, c.n) as tipo) t
        left join public.cafe_obrador_ventas v on v.user_id = me and v.dia = cafe_obrador.dia and v.cliente = c.n
       where t.tipo is not null), '[]'::jsonb))
    || case when o is null then '{}'::jsonb else jsonb_build_object('especialidad', public.cafe_obrador_especialidad(me, cafe_obrador.dia)) end;
end;
$$;
revoke all on function public.cafe_obrador(date) from public, anon;
grant execute on function public.cafe_obrador(date) to authenticated;

-- ── Hornear (lo de `cafe_hornear` de 20261225120000_cafe_obrador.sql, para la app y para Pilar) ──
-- Con la maestría ★, una pieza más por bandeja. Apunta la bandeja y si la horneó Pilar.
create or replace function public.cafe_hornear_de(me uuid, receta text, mimo smallint[], pilar boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o public.cafe_obrador;
  v_nivel integer;
  r jsonb;
  b integer;
  v_estrellas integer;
  v_piezas integer;
  v_mas integer;
begin
  select * into o from public.cafe_obrador x where x.user_id = me for update;
  if o.user_id is null then
    raise exception 'cafe:obrador' using errcode = 'P0001';
  end if;
  select x.nivel into v_nivel from public.cafe_locales x where x.user_id = me;
  r := public.cafe_obrador_receta(cafe_hornear_de.receta);
  if r is null or (r ->> 'nivel')::integer > coalesce(v_nivel, 0) then
    raise exception 'cafe:receta' using errcode = 'P0001';
  end if;
  if mimo is null or cardinality(mimo) <> 2 or exists (select 1 from unnest(mimo) m where m is null or m not between 1 and 2) then
    raise exception 'cafe:mimo' using errcode = 'P0001';
  end if;
  if (select count(*) from public.cafe_obrador_hornadas x where x.user_id = me and x.dia = public.cafe_hoy()) >= public.cafe_obrador_tope() then
    raise exception 'cafe:hornadas' using errcode = 'P0001';
  end if;
  select min(k) into b from generate_series(1, public.cafe_obrador_bandejas(o.horno)) k
   where not exists (select 1 from public.cafe_obrador_horno h where h.user_id = me and h.bandeja = k);
  if b is null then
    raise exception 'cafe:horno' using errcode = 'P0001';
  end if;
  v_estrellas := public.cafe_estrellas_taller(mimo);
  v_mas := case when public.cafe_obrador_maestria(public.cafe_obrador_buenas(me, cafe_hornear_de.receta)) >= 1 then 1 else 0 end;
  v_piezas := (r -> 'piezas' ->> (v_estrellas - 1))::integer + v_mas;
  insert into public.cafe_obrador_horno (user_id, bandeja, receta, piezas, estrellas) values (me, b, cafe_hornear_de.receta, v_piezas, v_estrellas);
  insert into public.cafe_obrador_hornadas (user_id, dia, receta, estrellas, piezas, bandeja, pilar)
  values (me, public.cafe_hoy(), cafe_hornear_de.receta, v_estrellas, v_piezas, b, coalesce(cafe_hornear_de.pilar, false));
  return jsonb_build_object('obrador', public.cafe_obrador_json(me),
    'dado', jsonb_build_object('bandeja', b, 'estrellas', v_estrellas, 'piezas', v_piezas, 'mimo', to_jsonb(cafe_hornear_de.mimo), 'maestria', v_mas, 'pilar', coalesce(cafe_hornear_de.pilar, false)));
end;
$$;
revoke all on function public.cafe_hornear_de(uuid, text, smallint[], boolean) from public, anon, authenticated;

-- Hornear a mano: la receta y cómo quedaron sus dos gestos (2, bien; 1, se podía mejorar)
create or replace function public.cafe_hornear(receta text, mimo smallint[])
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return public.cafe_hornear_de(public.piso_yo(), receta, mimo, false);
end;
$$;
revoke all on function public.cafe_hornear(text, smallint[]) from public, anon;
grant execute on function public.cafe_hornear(text, smallint[]) to authenticated;

-- «Que lo hornee Pilar»: solo con la receta dominada (★★★, 25 hornadas buenas). Sale como una hornada de 3 estrellas.
create or replace function public.cafe_hornear_pilar(receta text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
begin
  if public.cafe_obrador_maestria(public.cafe_obrador_buenas(me, receta)) < 3 then
    raise exception 'cafe:maestria' using errcode = 'P0001';
  end if;
  return public.cafe_hornear_de(me, receta, array[2, 2]::smallint[], true);
end;
$$;
revoke all on function public.cafe_hornear_pilar(text) from public, anon;
grant execute on function public.cafe_hornear_pilar(text) to authenticated;

-- ── Sacar una hornada (de 20261225120000_cafe_obrador.sql): lo mismo, con la vitrina ya contando las vitrinas de tartas ──
create or replace function public.cafe_sacar_hornada(bandeja integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  o public.cafe_obrador;
  h public.cafe_obrador_horno;
  hay integer;
  hueco integer;
  mete integer;
begin
  select * into o from public.cafe_obrador x where x.user_id = me for update;
  if o.user_id is null then
    raise exception 'cafe:obrador' using errcode = 'P0001';
  end if;
  select * into h from public.cafe_obrador_horno x where x.user_id = me and x.bandeja = cafe_sacar_hornada.bandeja for update;
  if h.user_id is null then
    raise exception 'cafe:bandeja' using errcode = 'P0001';
  end if;
  if now() < h.metida + make_interval(secs => greatest(0, coalesce((public.cafe_obrador_receta(h.receta) ->> 'segundos')::integer, 60) - 5)) then
    raise exception 'cafe:pronto' using errcode = 'P0001';
  end if;
  hay := coalesce((select sum(v.piezas)::integer from public.cafe_obrador_vitrina v where v.user_id = me), 0);
  hueco := public.cafe_obrador_capacidad(me) - hay;
  if hueco <= 0 then
    raise exception 'cafe:vitrina' using errcode = 'P0001';
  end if;
  mete := least(hueco, h.piezas);
  insert into public.cafe_obrador_vitrina (user_id, receta, piezas) values (me, h.receta, mete)
  on conflict (user_id, receta) do update set piezas = least(100, public.cafe_obrador_vitrina.piezas + excluded.piezas);
  if mete >= h.piezas then
    delete from public.cafe_obrador_horno x where x.user_id = me and x.bandeja = h.bandeja;
  else
    update public.cafe_obrador_horno x set piezas = h.piezas - mete where x.user_id = me and x.bandeja = h.bandeja;
  end if;
  return jsonb_build_object('obrador', public.cafe_obrador_json(me),
    'dado', jsonb_build_object('receta', h.receta, 'sacadas', mete, 'quedan', h.piezas - mete, 'estrellas', h.estrellas));
end;
$$;
revoke all on function public.cafe_sacar_hornada(integer) from public, anon;
grant execute on function public.cafe_sacar_hornada(integer) to authenticated;

-- ── Servir algo para acompañar (de 20261225120000_cafe_obrador.sql): lo mismo, y paga +1 si es la especialidad del día y +1 con
-- la maestría ★★ de la receta ──
create or replace function public.cafe_servir_comida(dia date, cliente integer, receta text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  t text;
  r jsonb;
  v public.cafe_obrador_vitrina;
  precio integer;
  esp boolean;
  maestra boolean;
begin
  if not public.cafe_dia_valido(cafe_servir_comida.dia) then
    raise exception 'cafe:dia' using errcode = 'P0001';
  end if;
  perform 1 from public.cafe_obrador x where x.user_id = me for update;
  if not found then
    raise exception 'cafe:obrador' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.cafe_servicios s where s.user_id = me and s.dia = cafe_servir_comida.dia and s.cliente = cafe_servir_comida.cliente) then
    raise exception 'cafe:cliente' using errcode = 'P0001';
  end if;
  t := public.cafe_pide_comida(me, cafe_servir_comida.dia, cafe_servir_comida.cliente);
  r := public.cafe_obrador_receta(cafe_servir_comida.receta);
  if t is null or r is null or r ->> 'tipo' <> t then
    raise exception 'cafe:comida' using errcode = 'P0001';
  end if;
  select * into v from public.cafe_obrador_vitrina x where x.user_id = me and x.receta = cafe_servir_comida.receta for update;
  if v.user_id is null or v.piezas < 1 then
    raise exception 'cafe:agotado' using errcode = 'P0001';
  end if;
  esp := public.cafe_obrador_especialidad(me, cafe_servir_comida.dia) = cafe_servir_comida.receta;
  maestra := public.cafe_obrador_maestria(public.cafe_obrador_buenas(me, cafe_servir_comida.receta)) >= 2;
  precio := (r ->> 'precio')::integer + case when esp then 1 else 0 end + case when maestra then 1 else 0 end;
  insert into public.cafe_obrador_ventas (user_id, dia, cliente, receta, granos)
  values (me, cafe_servir_comida.dia, cafe_servir_comida.cliente, cafe_servir_comida.receta, precio)
  on conflict on constraint cafe_obrador_ventas_pkey do nothing;
  if not found then
    raise exception 'cafe:servido' using errcode = 'P0001';
  end if;
  update public.cafe_obrador_vitrina x set piezas = x.piezas - 1 where x.user_id = me and x.receta = cafe_servir_comida.receta;
  update public.cafe_locales x set granos = least(100000, x.granos + precio), actualizado = now() where x.user_id = me;
  return jsonb_build_object('cafe', public.cafe_json(me), 'obrador', public.cafe_obrador_json(me),
    'dado', jsonb_build_object('granos', precio, 'receta', cafe_servir_comida.receta, 'especialidad', esp, 'maestria', maestra));
end;
$$;
revoke all on function public.cafe_servir_comida(date, integer, text) from public, anon;
grant execute on function public.cafe_servir_comida(date, integer, text) to authenticated;

-- ── El mostrador: lo que vendió Pilar mientras no estabas ──
-- Por cada día que espera (como mucho 7), hasta el cupo de la vitrina, primero la especialidad y después lo que más haya. A precio
-- base, +1 la especialidad de `dia`. Los días se gastan aunque la vitrina esté vacía (nadie pudo comprar). Devuelve
-- { dias, piezas, granos, vendidas: { receta: n } }.
create or replace function public.cafe_mostrador_cobrar(uid uuid, dia date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o public.cafe_obrador;
  dias integer;
  reales integer;
  jornada date;
  quedan integer;
  esp text;
  r record;
  n integer;
  p integer;
  v_piezas integer := 0;
  v_granos integer := 0;
  v_vendidas jsonb := '{}'::jsonb;
begin
  select * into o from public.cafe_obrador x where x.user_id = uid for update;
  if o.user_id is null then
    return jsonb_build_object('dias', 0, 'piezas', 0, 'granos', 0, 'vendidas', '{}'::jsonb);
  end if;
  select p2.jornada into jornada from public.cafe_probadores p2 where p2.user_id = uid;
  dias := public.cafe_mostrador_dias(uid);
  if dias <= 0 then
    if jornada is not null and o.mostrador_prueba is null then
      update public.cafe_obrador x set mostrador_prueba = jornada where x.user_id = uid;
    end if;
    return jsonb_build_object('dias', 0, 'piezas', 0, 'granos', 0, 'vendidas', '{}'::jsonb);
  end if;
  reales := least(7, greatest(0, floor(extract(epoch from (now() - o.mostrador_desde)) / 86400)::integer));
  quedan := dias * public.cafe_obrador_cupo(o.vitrina);
  esp := public.cafe_obrador_especialidad(uid, dia);
  for r in
    select v.receta, v.piezas from public.cafe_obrador_vitrina v
     where v.user_id = uid and v.piezas > 0 and public.cafe_obrador_receta(v.receta) is not null
     order by (v.receta = esp) desc, v.piezas desc, v.receta
  loop
    exit when quedan <= 0;
    n := least(quedan, r.piezas);
    p := (public.cafe_obrador_receta(r.receta) ->> 'precio')::integer + case when r.receta = esp then 1 else 0 end;
    update public.cafe_obrador_vitrina x set piezas = x.piezas - n where x.user_id = uid and x.receta = r.receta;
    v_vendidas := v_vendidas || jsonb_build_object(r.receta, n);
    v_piezas := v_piezas + n;
    v_granos := v_granos + n * p;
    quedan := quedan - n;
  end loop;
  -- Lo que pasa de 7 días no se guarda: vuelve a empezar desde ahora; si no, se queda con las horas del día a medias
  update public.cafe_obrador x
     set mostrador_desde = case when reales >= 7 then now() else x.mostrador_desde + make_interval(days => reales) end,
         mostrador_prueba = coalesce(jornada, x.mostrador_prueba),
         mostrador_piezas = least(1000000000, x.mostrador_piezas + v_piezas),
         mostrador_granos = least(1000000000, x.mostrador_granos + v_granos)
   where x.user_id = uid;
  if v_granos > 0 then
    update public.cafe_locales x set granos = least(100000, x.granos + v_granos), actualizado = now() where x.user_id = uid;
  end if;
  return jsonb_build_object('dias', dias, 'piezas', v_piezas, 'granos', v_granos, 'vendidas', v_vendidas);
end;
$$;
revoke all on function public.cafe_mostrador_cobrar(uuid, date) from public, anon, authenticated;

-- Al entrar en el café (tirando del cajón de la caja de latón): lo que vendió Pilar. Devuelve { cobrado, cafe, obrador }
create or replace function public.cafe_mostrador(dia date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  c jsonb;
begin
  if not public.cafe_dia_valido(dia) then
    raise exception 'cafe:dia' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.cafe_obrador x where x.user_id = me) then
    raise exception 'cafe:obrador' using errcode = 'P0001';
  end if;
  c := public.cafe_mostrador_cobrar(me, dia);
  return jsonb_build_object('cobrado', c, 'cafe', public.cafe_json(me), 'obrador', public.cafe_obrador_json(me));
end;
$$;
revoke all on function public.cafe_mostrador(date) from public, anon;
grant execute on function public.cafe_mostrador(date) to authenticated;

-- ── Mejorar el horno o la vitrina: el grado siguiente, con su precio y su nivel ──
-- Antes de cambiar la vitrina, se cobra lo que ya había vendido Pilar (a su cupo de antes). Devuelve { cafe, obrador, cobrado }
create or replace function public.cafe_obrador_mejorar(mejora text, dia date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  l public.cafe_locales;
  o public.cafe_obrador;
  grado integer;
  precio integer;
  c jsonb := null;
begin
  if not public.cafe_dia_valido(dia) then
    raise exception 'cafe:dia' using errcode = 'P0001';
  end if;
  select * into l from public.cafe_locales x where x.user_id = me for update;
  if l.user_id is null or l.inaugurado is null then
    raise exception 'cafe:cerrado' using errcode = 'P0001';
  end if;
  select * into o from public.cafe_obrador x where x.user_id = me for update;
  if o.user_id is null then
    raise exception 'cafe:obrador' using errcode = 'P0001';
  end if;
  grado := case mejora when 'horno' then o.horno + 1 when 'vitrina' then o.vitrina + 1 end;
  precio := public.cafe_obrador_precio(mejora, grado);
  if precio is null then
    raise exception 'cafe:obrador_mejora' using errcode = 'P0001';
  end if;
  if l.nivel < public.cafe_obrador_mejora_nivel(mejora, grado) then
    raise exception 'cafe:obrador_nivel' using errcode = 'P0001';
  end if;
  if mejora = 'vitrina' then
    c := public.cafe_mostrador_cobrar(me, dia);
  end if;
  select * into l from public.cafe_locales x where x.user_id = me;
  if l.granos < precio then
    raise exception 'cafe:granos' using errcode = 'P0001';
  end if;
  update public.cafe_locales x set granos = x.granos - precio, actualizado = now() where x.user_id = me;
  if mejora = 'horno' then
    update public.cafe_obrador x set horno = grado where x.user_id = me;
  else
    update public.cafe_obrador x set vitrina = grado where x.user_id = me;
  end if;
  return jsonb_build_object('cafe', public.cafe_json(me), 'obrador', public.cafe_obrador_json(me), 'cobrado', c);
end;
$$;
revoke all on function public.cafe_obrador_mejorar(text, date) from public, anon;
grant execute on function public.cafe_obrador_mejorar(text, date) to authenticated;
