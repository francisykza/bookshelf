-- 1.145 (§145) · El café-librería del bajo: el obrador, tercera tanda, «el recetario crece» (bloque 3 de
-- docs/qa/cafe-libreria.md §18.12; plan aprobado por Francisco el 17-11-2026 con las cuatro recomendadas, y «Sigue con el bloque
-- 3» el 19-11-2026).
-- Requiere las migraciones del café hasta 20261226120000_cafe_obrador_mejoras.sql (todas ya aplicadas). Añade una tabla, una
-- columna y funciones, y redefine varias de los bloques 1 y 2 (cada una dice qué cambia):
-- - Las cuatro recetas que faltaban: las galletas del puerto (nivel 5, dulces, 2 granos), el pan de la bodega (6, salado, 4), el
--   bizcocho del tostadero (7, dulce, 4) y la tortilla de patatas (8, salada, 5); 6, 7 u 8 piezas según las estrellas.
-- - El pan de la bodega se amasa un día (`cafe_masa_reposar`, con el mimo del amasado) y reposa la noche en la bodega fresca: desde
--   el día siguiente (Madrid) se greña y se hornea. Una masa cada vez, sin plazo: si no vuelves, sigue esperando. En las jornadas de
--   prueba (`cafe_probadores`), una jornada nueva cuenta como la noche.
-- - Los hitos del obrador, por piezas vendidas en total (en la mesa y en el mostrador): 25, 100, 250, 500 y 1.000. Cada uno deja su
--   adorno en el obrador y 20 granos, una vez.
-- - El excéntrico, la mitad de los días (con el obrador abierto), pide algo concreto de tu recetario con un acertijo, en lugar del
--   libro (máximo dos cosas por cliente), y paga el doble de la pieza. Solo vale esa receta.
-- - El favorito de cada habitual: los doce tienen su receta. Si le toca pedir comida (uno de cada tres, como todos) y su favorito
--   está en tu recetario, lo pide por su nombre y paga +2; otra pieza del mismo tipo también le vale, a su precio.
-- - Lo que ven las visitas (`cafe_visita`): el horno con su grado, la vitrina con lo que haya y los adornos de los hitos.
-- La comida sigue dando solo granos: nunca reputación ni tickets. Las cifras, las mismas que en src/features/edificio/cafe/cafeObrador.js
-- (las pruebas lo comprueban). Todo por funciones `security definer`; las tablas, con RLS y sin permisos directos. Re-ejecutable.

-- ── La masa del pan, reposando en la bodega (una por cuenta) ──
create table if not exists public.cafe_obrador_masa (
  user_id uuid primary key references auth.users (id) on delete cascade,
  amasado smallint not null check (amasado between 1 and 2),
  puesta  date not null,
  prueba  date,
  creado  timestamptz not null default now()
);
alter table public.cafe_obrador_masa enable row level security;
revoke all on table public.cafe_obrador_masa from anon, authenticated;

-- Los hitos ya dados (de 0 a 5). Las cuentas que ya tenían el obrador cuentan lo vendido hasta hoy
alter table public.cafe_obrador add column if not exists hitos smallint not null default 0;
alter table public.cafe_obrador drop constraint if exists cafe_obrador_hitos_check;
alter table public.cafe_obrador add constraint cafe_obrador_hitos_check check (hitos between 0 and 5);

-- ── Las cifras fijas (las mismas que en cafeObrador.js) ──
-- Cada receta: su tipo, el nivel en que se abre, las piezas con 1, 2 y 3 estrellas, su precio en granos y lo que tarda en el horno
-- (en segundos). De 20261225120000_cafe_obrador.sql, con las cuatro de esta tanda.
create or replace function public.cafe_obrador_receta(receta text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case receta
    when 'magdalenas' then '{"tipo": "dulce", "nivel": 4, "piezas": [4, 5, 6], "precio": 2, "segundos": 60}'::jsonb
    when 'empanada' then '{"tipo": "salado", "nivel": 4, "piezas": [4, 5, 6], "precio": 3, "segundos": 90}'::jsonb
    when 'galletas' then '{"tipo": "dulce", "nivel": 5, "piezas": [6, 7, 8], "precio": 2, "segundos": 60}'::jsonb
    when 'pan' then '{"tipo": "salado", "nivel": 6, "piezas": [6, 7, 8], "precio": 4, "segundos": 60}'::jsonb
    when 'bizcocho' then '{"tipo": "dulce", "nivel": 7, "piezas": [6, 7, 8], "precio": 4, "segundos": 90}'::jsonb
    when 'tortilla' then '{"tipo": "salado", "nivel": 8, "piezas": [6, 7, 8], "precio": 5, "segundos": 60}'::jsonb
  end;
$$;
revoke all on function public.cafe_obrador_receta(text) from public, anon, authenticated;

-- La receta favorita de cada habitual (por su número, de 0 a 11, el orden de HABITUALES en cafeClientes.js)
create or replace function public.cafe_obrador_favorito(quien integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array['magdalenas', 'galletas', 'pan', 'empanada', 'tortilla', 'bizcocho',
                'empanada', 'magdalenas', 'pan', 'bizcocho', 'tortilla', 'galletas'])[1 + ((coalesce(quien, 0) % 12) + 12) % 12];
$$;
revoke all on function public.cafe_obrador_favorito(integer) from public, anon, authenticated;

-- Los hitos: las piezas vendidas en total que hacen falta para cada uno, y lo que dan
create or replace function public.cafe_obrador_hitos_cifras()
returns integer[]
language sql
immutable
set search_path = ''
as $$
  select array[25, 100, 250, 500, 1000];
$$;
revoke all on function public.cafe_obrador_hitos_cifras() from public, anon, authenticated;

create or replace function public.cafe_obrador_hito_granos()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 20;
$$;
revoke all on function public.cafe_obrador_hito_granos() from public, anon, authenticated;

-- ── Lo de cada cuenta ──
-- Las recetas que se pueden hornear en tu nivel, en el orden del recetario
create or replace function public.cafe_obrador_abiertas(uid uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(t.r order by t.k), '{}')
    from unnest(public.cafe_obrador_recetario()) with ordinality t(r, k)
   where public.cafe_obrador_receta(t.r) is not null
     and (public.cafe_obrador_receta(t.r) ->> 'nivel')::integer <= coalesce((select l.nivel from public.cafe_locales l where l.user_id = uid), 0);
$$;
revoke all on function public.cafe_obrador_abiertas(uuid) from public, anon, authenticated;

-- Las piezas vendidas en total: las servidas en la mesa y las del mostrador
create or replace function public.cafe_obrador_vendidas(uid uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select count(*)::integer from public.cafe_obrador_ventas v where v.user_id = uid), 0)
       + coalesce((select o.mostrador_piezas from public.cafe_obrador o where o.user_id = uid), 0);
$$;
revoke all on function public.cafe_obrador_vendidas(uuid) from public, anon, authenticated;

-- Los hitos nuevos (tras vender): los apunta y paga sus granos. Devuelve los números de los nuevos ([] si ninguno)
create or replace function public.cafe_obrador_dar_hitos(uid uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  antes integer;
  ahora integer;
  total integer;
begin
  select o.hitos into antes from public.cafe_obrador o where o.user_id = uid for update;
  if antes is null then
    return '[]'::jsonb;
  end if;
  total := public.cafe_obrador_vendidas(uid);
  select count(*)::integer into ahora from unnest(public.cafe_obrador_hitos_cifras()) c where c <= total;
  if ahora <= antes then
    return '[]'::jsonb;
  end if;
  update public.cafe_obrador o set hitos = ahora where o.user_id = uid;
  update public.cafe_locales l set granos = least(100000, l.granos + public.cafe_obrador_hito_granos() * (ahora - antes)), actualizado = now()
   where l.user_id = uid;
  return (select jsonb_agg(k order by k) from generate_series(antes + 1, ahora) k);
end;
$$;
revoke all on function public.cafe_obrador_dar_hitos(uuid) from public, anon, authenticated;

-- ¿Está lista la masa del pan? (desde el día siguiente al amasarla o, en las jornadas de prueba, desde la jornada siguiente)
create or replace function public.cafe_masa_lista(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select m.puesta < public.cafe_hoy()
           or coalesce((select p.jornada > m.prueba from public.cafe_probadores p where p.user_id = uid and m.prueba is not null), false)
      from public.cafe_obrador_masa m where m.user_id = uid), false);
$$;
revoke all on function public.cafe_masa_lista(uuid) from public, anon, authenticated;

-- ── ¿Quiere algo concreto este cliente? La receta (o null): el acertijo del excéntrico o el favorito de un habitual ──
-- El excéntrico (el último cliente del día), la mitad de los días, una de tus recetas abiertas. Un habitual, si le toca pedir
-- comida (la misma semilla que `cafe_pide_comida`: uno de cada tres) y su favorito está abierto.
create or replace function public.cafe_quiere_comida(uid uuid, dia date, cliente integer)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n integer;
  ab text[];
  fav text;
begin
  if not exists (select 1 from public.cafe_obrador o where o.user_id = uid) then
    return null;
  end if;
  select d.clientes into n from public.cafe_dias d where d.user_id = uid and d.dia = cafe_quiere_comida.dia;
  if n is null then
    return null;
  end if;
  ab := public.cafe_obrador_abiertas(uid);
  if cardinality(ab) = 0 then
    return null;
  end if;
  if cliente = n then
    if public.cafe_semilla(uid, cafe_quiere_comida.dia, 'fx') % 2 <> 0 then
      return null;
    end if;
    return ab[1 + public.cafe_semilla(uid, cafe_quiere_comida.dia, 'fr') % cardinality(ab)];
  end if;
  if cliente between 101 and 102 then
    if public.cafe_semilla(uid, cafe_quiere_comida.dia, 'f' || cliente) % 3 <> 0 then
      return null;
    end if;
    fav := public.cafe_obrador_favorito(public.cafe_quien(uid, cafe_quiere_comida.dia, cliente - 100));
    if fav = any (ab) then
      return fav;
    end if;
  end if;
  return null;
end;
$$;
revoke all on function public.cafe_quiere_comida(uuid, date, integer) from public, anon, authenticated;

-- ── ¿Pide algo para acompañar? (de 20261226120000_cafe_obrador_mejoras.sql) ──
-- Lo mismo, y además: el excéntrico, los días que pide algo concreto, y el habitual con su favorito piden el tipo de esa receta.
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
  q text;
  t_esp text;
begin
  if not exists (select 1 from public.cafe_obrador o where o.user_id = uid) then
    return null;
  end if;
  select d.clientes into n from public.cafe_dias d where d.user_id = uid and d.dia = cafe_pide_comida.dia;
  if n is null then
    return null;
  end if;
  if not (cliente between 1 and n or cliente between 101 and 102 or cliente between 201 and 203) then
    return null;
  end if;
  q := public.cafe_quiere_comida(uid, cafe_pide_comida.dia, cliente);
  if q is not null then
    return public.cafe_obrador_receta(q) ->> 'tipo';
  end if;
  if cliente = n then
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

-- ── Lo que se ve del obrador de una cuenta (de 20261226120000_cafe_obrador_mejoras.sql), con la masa y los hitos ──
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
    'vendidas_total', public.cafe_obrador_vendidas(uid),
    'hitos', o.hitos,
    'masa', (select jsonb_build_object('lista', public.cafe_masa_lista(uid), 'puesta', m.puesta) from public.cafe_obrador_masa m where m.user_id = uid),
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

-- ── Tu obrador y quién pide algo ese día (de 20261226120000_cafe_obrador_mejoras.sql), con lo que quiere cada uno ──
-- Cada uno de `piden`, además: `quiere`, la receta concreta (el acertijo del excéntrico o el favorito de un habitual) o null.
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
  update public.cafe_obrador x set mostrador_prueba = p.jornada
    from public.cafe_probadores p
   where x.user_id = me and p.user_id = me and x.mostrador_prueba is null;
  o := public.cafe_obrador_json(me);
  return jsonb_build_object(
    'obrador', o,
    'piden', coalesce((
      select jsonb_agg(jsonb_build_object('n', c.n, 'tipo', t.tipo, 'quiere', public.cafe_quiere_comida(me, cafe_obrador.dia, c.n),
                                          'servido', v.cliente is not null, 'receta', v.receta) order by c.n)
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

-- ── Amasar el pan y dejarlo reposar en la bodega (desde el nivel 6; una masa cada vez) ──
-- `amasado`: cómo quedó el amasado (2, bien; 1, se podía mejorar). Devuelve { obrador }
create or replace function public.cafe_masa_reposar(amasado smallint)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  v_nivel integer;
  jornada date;
begin
  perform 1 from public.cafe_obrador x where x.user_id = me for update;
  if not found then
    raise exception 'cafe:obrador' using errcode = 'P0001';
  end if;
  select x.nivel into v_nivel from public.cafe_locales x where x.user_id = me;
  if coalesce(v_nivel, 0) < (public.cafe_obrador_receta('pan') ->> 'nivel')::integer then
    raise exception 'cafe:receta' using errcode = 'P0001';
  end if;
  if amasado is null or amasado not between 1 and 2 then
    raise exception 'cafe:mimo' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.cafe_obrador_masa m where m.user_id = me) then
    raise exception 'cafe:masa' using errcode = 'P0001';
  end if;
  select p.jornada into jornada from public.cafe_probadores p where p.user_id = me;
  insert into public.cafe_obrador_masa (user_id, amasado, puesta, prueba) values (me, cafe_masa_reposar.amasado, public.cafe_hoy(), jornada);
  return jsonb_build_object('obrador', public.cafe_obrador_json(me));
end;
$$;
revoke all on function public.cafe_masa_reposar(smallint) from public, anon;
grant execute on function public.cafe_masa_reposar(smallint) to authenticated;

-- ── Hornear (de 20261226120000_cafe_obrador_mejoras.sql): lo mismo, y el pan solo con su masa ya reposada ──
-- Del pan, el primer gesto es el amasado de ayer (el que se guardó con la masa) y el segundo, el greñado de hoy; si lo hornea
-- Pilar, sale como uno de 3 estrellas. La masa se gasta al hornearla.
create or replace function public.cafe_hornear_de(me uuid, receta text, mimo smallint[], pilar boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o public.cafe_obrador;
  m public.cafe_obrador_masa;
  v_nivel integer;
  r jsonb;
  b integer;
  v_mimo smallint[] := mimo;
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
  if v_mimo is null or cardinality(v_mimo) <> 2 or exists (select 1 from unnest(v_mimo) x where x is null or x not between 1 and 2) then
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
  if cafe_hornear_de.receta = 'pan' then
    select * into m from public.cafe_obrador_masa x where x.user_id = me for update;
    if m.user_id is null or not public.cafe_masa_lista(me) then
      raise exception 'cafe:masa' using errcode = 'P0001';
    end if;
    if not coalesce(cafe_hornear_de.pilar, false) then
      v_mimo := array[m.amasado, v_mimo[2]]::smallint[];
    end if;
    delete from public.cafe_obrador_masa x where x.user_id = me;
  end if;
  v_estrellas := public.cafe_estrellas_taller(v_mimo);
  v_mas := case when public.cafe_obrador_maestria(public.cafe_obrador_buenas(me, cafe_hornear_de.receta)) >= 1 then 1 else 0 end;
  v_piezas := (r -> 'piezas' ->> (v_estrellas - 1))::integer + v_mas;
  insert into public.cafe_obrador_horno (user_id, bandeja, receta, piezas, estrellas) values (me, b, cafe_hornear_de.receta, v_piezas, v_estrellas);
  insert into public.cafe_obrador_hornadas (user_id, dia, receta, estrellas, piezas, bandeja, pilar)
  values (me, public.cafe_hoy(), cafe_hornear_de.receta, v_estrellas, v_piezas, b, coalesce(cafe_hornear_de.pilar, false));
  return jsonb_build_object('obrador', public.cafe_obrador_json(me),
    'dado', jsonb_build_object('bandeja', b, 'estrellas', v_estrellas, 'piezas', v_piezas, 'mimo', to_jsonb(v_mimo), 'maestria', v_mas, 'pilar', coalesce(cafe_hornear_de.pilar, false)));
end;
$$;
revoke all on function public.cafe_hornear_de(uuid, text, smallint[], boolean) from public, anon, authenticated;

-- ── Servir algo para acompañar (de 20261226120000_cafe_obrador_mejoras.sql) ──
-- Lo mismo, y: al excéntrico, solo la receta de su acertijo, al doble de la pieza; a un habitual, su favorito paga +2 (otra del mismo
-- tipo, a su precio). Tras vender, los hitos. Devuelve también `excentrico`, `favorito` y `hitos` (los nuevos).
create or replace function public.cafe_servir_comida(dia date, cliente integer, receta text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  n integer;
  t text;
  q text;
  r jsonb;
  v public.cafe_obrador_vitrina;
  precio integer;
  esp boolean;
  maestra boolean;
  exc boolean;
  fav boolean;
  h jsonb;
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
  select d.clientes into n from public.cafe_dias d where d.user_id = me and d.dia = cafe_servir_comida.dia;
  t := public.cafe_pide_comida(me, cafe_servir_comida.dia, cafe_servir_comida.cliente);
  q := public.cafe_quiere_comida(me, cafe_servir_comida.dia, cafe_servir_comida.cliente);
  r := public.cafe_obrador_receta(cafe_servir_comida.receta);
  exc := cafe_servir_comida.cliente = n;
  if t is null or r is null or r ->> 'tipo' <> t or (exc and cafe_servir_comida.receta is distinct from q)
     or not (cafe_servir_comida.receta = any (public.cafe_obrador_abiertas(me))) then
    raise exception 'cafe:comida' using errcode = 'P0001';
  end if;
  fav := not exc and q is not null and cafe_servir_comida.receta = q;
  select * into v from public.cafe_obrador_vitrina x where x.user_id = me and x.receta = cafe_servir_comida.receta for update;
  if v.user_id is null or v.piezas < 1 then
    raise exception 'cafe:agotado' using errcode = 'P0001';
  end if;
  esp := public.cafe_obrador_especialidad(me, cafe_servir_comida.dia) = cafe_servir_comida.receta;
  maestra := public.cafe_obrador_maestria(public.cafe_obrador_buenas(me, cafe_servir_comida.receta)) >= 2;
  precio := (r ->> 'precio')::integer * case when exc then 2 else 1 end
            + case when esp then 1 else 0 end + case when maestra then 1 else 0 end + case when fav then 2 else 0 end;
  insert into public.cafe_obrador_ventas (user_id, dia, cliente, receta, granos)
  values (me, cafe_servir_comida.dia, cafe_servir_comida.cliente, cafe_servir_comida.receta, precio)
  on conflict on constraint cafe_obrador_ventas_pkey do nothing;
  if not found then
    raise exception 'cafe:servido' using errcode = 'P0001';
  end if;
  update public.cafe_obrador_vitrina x set piezas = x.piezas - 1 where x.user_id = me and x.receta = cafe_servir_comida.receta;
  update public.cafe_locales x set granos = least(100000, x.granos + precio), actualizado = now() where x.user_id = me;
  h := public.cafe_obrador_dar_hitos(me);
  return jsonb_build_object('cafe', public.cafe_json(me), 'obrador', public.cafe_obrador_json(me),
    'dado', jsonb_build_object('granos', precio, 'receta', cafe_servir_comida.receta, 'especialidad', esp, 'maestria', maestra,
      'excentrico', exc, 'favorito', fav, 'hitos', h));
end;
$$;
revoke all on function public.cafe_servir_comida(date, integer, text) from public, anon;
grant execute on function public.cafe_servir_comida(date, integer, text) to authenticated;

-- ── El mostrador (de 20261226120000_cafe_obrador_mejoras.sql): lo mismo y, si vendió algo, los hitos ──
-- Devuelve { dias, piezas, granos, vendidas: { receta: n }, hitos: [los nuevos] }.
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
  h jsonb := '[]'::jsonb;
begin
  select * into o from public.cafe_obrador x where x.user_id = uid for update;
  if o.user_id is null then
    return jsonb_build_object('dias', 0, 'piezas', 0, 'granos', 0, 'vendidas', '{}'::jsonb, 'hitos', '[]'::jsonb);
  end if;
  select p2.jornada into jornada from public.cafe_probadores p2 where p2.user_id = uid;
  dias := public.cafe_mostrador_dias(uid);
  if dias <= 0 then
    if jornada is not null and o.mostrador_prueba is null then
      update public.cafe_obrador x set mostrador_prueba = jornada where x.user_id = uid;
    end if;
    return jsonb_build_object('dias', 0, 'piezas', 0, 'granos', 0, 'vendidas', '{}'::jsonb, 'hitos', '[]'::jsonb);
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
  update public.cafe_obrador x
     set mostrador_desde = case when reales >= 7 then now() else x.mostrador_desde + make_interval(days => reales) end,
         mostrador_prueba = coalesce(jornada, x.mostrador_prueba),
         mostrador_piezas = least(1000000000, x.mostrador_piezas + v_piezas),
         mostrador_granos = least(1000000000, x.mostrador_granos + v_granos)
   where x.user_id = uid;
  if v_granos > 0 then
    update public.cafe_locales x set granos = least(100000, x.granos + v_granos), actualizado = now() where x.user_id = uid;
  end if;
  if v_piezas > 0 then
    h := public.cafe_obrador_dar_hitos(uid);
  end if;
  return jsonb_build_object('dias', dias, 'piezas', v_piezas, 'granos', v_granos, 'vendidas', v_vendidas, 'hitos', h);
end;
$$;
revoke all on function public.cafe_mostrador_cobrar(uuid, date) from public, anon, authenticated;

-- ── La visita (de 20261223120000_cafe_social.sql): lo mismo y, desde el nivel 4 y con el obrador abierto, lo que se ve de él ──
-- `obrador`: el grado del horno y de la vitrina, lo que hay en la vitrina y los hitos (sus adornos). Nada del horno por dentro.
create or replace function public.cafe_visita(lector uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  salida jsonb;
begin
  if not public.cafe_puedo_ver(lector) then
    return null;
  end if;
  select jsonb_build_object(
           'user_id', l.user_id, 'alias', p.alias, 'avatar_id', p.avatar_id, 'nombre', l.nombre, 'nivel', l.nivel,
           'reputacion', l.reputacion, 'plano', l.plano,
           'escaparate', case when l.nivel >= 5 then l.escaparate else '[]'::jsonb end,
           'fotos', coalesce((select jsonb_agg(i.nivel order by i.nivel) from public.cafe_influencers i where i.user_id = l.user_id and i.viral), '[]'::jsonb),
           'libros', coalesce((
             select jsonb_agg(
                      case when b.clave like 'cat:%'
                           then jsonb_build_object('clave', b.clave, 'titulo', b.titulo, 'genero', b.genero, 'balda', b.balda)
                           else jsonb_build_object('genero', b.genero, 'balda', b.balda) end
                      order by b.genero, b.clave)
               from public.cafe_libros b where b.user_id = l.user_id and b.balda > 0), '[]'::jsonb),
           'obrador', case when l.nivel >= public.cafe_obrador_nivel() then (
             select jsonb_build_object('horno', o.horno, 'vitrina', o.vitrina, 'hitos', o.hitos,
                      'piezas', coalesce((select jsonb_object_agg(v.receta, v.piezas) from public.cafe_obrador_vitrina v where v.user_id = o.user_id and v.piezas > 0), '{}'::jsonb))
               from public.cafe_obrador o where o.user_id = l.user_id) end)
    into salida
    from public.cafe_locales l
    join public.profiles p on p.user_id = l.user_id
   where l.user_id = lector and l.inaugurado is not null;
  return salida;
end;
$$;
revoke all on function public.cafe_visita(uuid) from public, anon;
grant execute on function public.cafe_visita(uuid) to authenticated;
