-- 1.143 (§143) · El café-librería del bajo: el obrador, primera tanda (encargo de Francisco del 17-11-2026: vender comida, «algo
-- como starbucks pero super cozy»; de la cadena del ejemplo, solo el género. Plan en docs/qa/cafe-libreria.md §18, aprobado el
-- mismo día con las cuatro recomendadas; bloque 1 de §18.12).
-- Requiere las migraciones del café hasta 20261224120000_cafe_pilar.sql (todas ya aplicadas). Añade tablas y funciones nuevas y
-- redefine una de antes, `cafe_entregar` (al final): igual que en 20261222120000_cafe_catalogo.sql salvo para quien pide comida.
-- - Desde el nivel 4, tras la pared del ala lateral, el horno de la antigua tahona con su recetario (`cafe_obrador_abrir`, una
--   vez por cuenta): el horno de grado 1 (una bandeja), la vitrina de grado 1 (12 piezas) y la primera hornada de la casa, seis
--   magdalenas ya en la vitrina. Nada retroactivo.
-- - Hornear (`cafe_hornear`): una receta abierta en tu nivel y lo que dice la app de sus dos gestos (`mimo`: 2, bien; 1, se podía
--   mejorar). El servidor pone las estrellas (las del taller: 3 con los dos bien, 2 con uno, 1 si no) y las piezas (las de la
--   receta, una menos por estrella que falta). Hasta 30 hornadas al día y solo con una bandeja libre.
-- - Sacar la hornada (`cafe_sacar_hornada`): pasado su tiempo (con 5 s de margen), a la vitrina hasta llenarla; lo que no cabe
--   espera en la bandeja. Lo horneado nunca se estropea ni se quema.
-- - Máximo dos cosas por cliente (Francisco, 17-11-2026, tras ver la 1.143: «Dos máx., 1 de cada 3»): cada día, uno de cada tres
--   clientes (los de la carta, los habituales y los que vienen por un vídeo; ni el excéntrico ni el influencer) pide la bebida y
--   algo dulce o salado para acompañar, y ese no pide libro (`cafe_pide_comida`, con la semilla del servidor). Sus estrellas salen
--   solo de la bebida (`cafe_estrellas_bebida`: 4 aciertos, 3; 2 o 3, 2; si no, 1) y, si la app le diera un libro, no cuenta ni
--   se lo lleva. Servírselo (`cafe_servir_comida`) se puede una vez por cliente y día, tras servirle la bebida, con una pieza del
--   tipo que pidió y que quede en la vitrina: paga su precio en granos (2 la magdalena, 3 la empanada). La comida solo da granos:
--   nunca reputación, tickets ni estrellas. Los granos cuentan en «granos ganados en total» (el disparador de la 1.141).
-- Las cifras, las mismas que en src/features/edificio/cafe/cafeObrador.js (las pruebas lo comprueban). Todo por funciones
-- `security definer`; las tablas, con RLS y sin permisos directos. Re-ejecutable.

-- ── El obrador de cada cuenta: cuándo se abrió y el grado del horno y de la vitrina (las mejoras llegan en la 1.144) ──
create table if not exists public.cafe_obrador (
  user_id uuid primary key references auth.users (id) on delete cascade,
  abierto timestamptz not null default now(),
  horno   smallint not null default 1 check (horno between 1 and 3),
  vitrina smallint not null default 1 check (vitrina between 1 and 4)
);
alter table public.cafe_obrador enable row level security;
revoke all on table public.cafe_obrador from anon, authenticated;

-- Lo que hay en el horno: una fila por bandeja ocupada (las piezas que quedan, si al sacarla no cupieron todas)
create table if not exists public.cafe_obrador_horno (
  user_id   uuid not null references auth.users (id) on delete cascade,
  bandeja   smallint not null check (bandeja between 1 and 3),
  receta    text not null check (char_length(receta) between 1 and 20),
  piezas    smallint not null check (piezas between 1 and 20),
  estrellas smallint not null check (estrellas between 1 and 3),
  metida    timestamptz not null default now(),
  primary key (user_id, bandeja)
);
alter table public.cafe_obrador_horno enable row level security;
revoke all on table public.cafe_obrador_horno from anon, authenticated;

-- Lo que hay en la vitrina, por receta
create table if not exists public.cafe_obrador_vitrina (
  user_id uuid not null references auth.users (id) on delete cascade,
  receta  text not null check (char_length(receta) between 1 and 20),
  piezas  smallint not null check (piezas between 0 and 100),
  primary key (user_id, receta)
);
alter table public.cafe_obrador_vitrina enable row level security;
revoke all on table public.cafe_obrador_vitrina from anon, authenticated;

-- Cada hornada (para el tope del día y, en la 1.144, la maestría de cada receta)
create table if not exists public.cafe_obrador_hornadas (
  id        bigint generated always as identity primary key,
  user_id   uuid not null references auth.users (id) on delete cascade,
  dia       date not null,
  receta    text not null check (char_length(receta) between 1 and 20),
  estrellas smallint not null check (estrellas between 1 and 3),
  piezas    smallint not null check (piezas between 1 and 20),
  creado    timestamptz not null default now()
);
create index if not exists cafe_obrador_hornadas_dia on public.cafe_obrador_hornadas (user_id, dia);
alter table public.cafe_obrador_hornadas enable row level security;
revoke all on table public.cafe_obrador_hornadas from anon, authenticated;

-- Lo que se ha servido para acompañar: una pieza por cliente y día
create table if not exists public.cafe_obrador_ventas (
  user_id uuid not null,
  dia     date not null,
  cliente smallint not null check (cliente between 1 and 13 or cliente between 101 and 102 or cliente between 201 and 203),
  receta  text not null check (char_length(receta) between 1 and 20),
  granos  smallint not null check (granos between 0 and 50),
  creado  timestamptz not null default now(),
  primary key (user_id, dia, cliente),
  foreign key (user_id, dia) references public.cafe_dias (user_id, dia) on delete cascade
);
alter table public.cafe_obrador_ventas enable row level security;
revoke all on table public.cafe_obrador_ventas from anon, authenticated;

-- ── Las cifras fijas (las mismas que en cafeObrador.js) ──
-- El nivel desde el que se abre el obrador (la Sala de lectura grande, con el ala lateral)
create or replace function public.cafe_obrador_nivel()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 4;
$$;
revoke all on function public.cafe_obrador_nivel() from public, anon, authenticated;

-- Cada receta de esta tanda: su tipo, el nivel en que se abre, las piezas con 1, 2 y 3 estrellas, su precio en granos y lo que
-- tarda en el horno (en segundos). Null si no es una receta (o aún no está: las otras cuatro llegan en la 1.145).
create or replace function public.cafe_obrador_receta(receta text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case receta
    when 'magdalenas' then '{"tipo": "dulce", "nivel": 4, "piezas": [4, 5, 6], "precio": 2, "segundos": 60}'::jsonb
    when 'empanada' then '{"tipo": "salado", "nivel": 4, "piezas": [4, 5, 6], "precio": 3, "segundos": 90}'::jsonb
  end;
$$;
revoke all on function public.cafe_obrador_receta(text) from public, anon, authenticated;

-- Bandejas del horno y piezas que caben en la vitrina, por grado (las mejoras, en la 1.144)
create or replace function public.cafe_obrador_bandejas(horno integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select greatest(1, least(3, coalesce(horno, 1)));
$$;
revoke all on function public.cafe_obrador_bandejas(integer) from public, anon, authenticated;

create or replace function public.cafe_obrador_cabe(vitrina integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case coalesce(vitrina, 1) when 4 then 40 when 3 then 30 when 2 then 20 else 12 end;
$$;
revoke all on function public.cafe_obrador_cabe(integer) from public, anon, authenticated;

-- Hornadas al día, como mucho
create or replace function public.cafe_obrador_tope()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 30;
$$;
revoke all on function public.cafe_obrador_tope() from public, anon, authenticated;

-- Las estrellas de quien pide comida (no pide libro): solo los 4 aciertos de la bebida. 3 con los 4; 2 con 2 o 3; si no, 1
create or replace function public.cafe_estrellas_bebida(aciertos integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when aciertos >= 4 then 3 when aciertos >= 2 then 2 else 1 end;
$$;
revoke all on function public.cafe_estrellas_bebida(integer) from public, anon, authenticated;

-- ── ¿Pide algo para acompañar este cliente este día? 'dulce', 'salado' o null ──
-- Con el obrador abierto, uno de cada tres: los de la carta (menos el excéntrico, el último del día), los habituales y los que
-- vienen por un vídeo. El influencer, nunca. Lo decide la semilla del servidor: la app no puede elegir quién pide. Quien pide
-- comida no pide libro (máximo dos cosas por cliente).
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
  return case when (s / 3) % 2 = 0 then 'dulce' else 'salado' end;
end;
$$;
revoke all on function public.cafe_pide_comida(uuid, date, integer) from public, anon, authenticated;

-- ── Lo que se ve del obrador de una cuenta (null si aún no se ha abierto) ──
-- `falta`: los segundos que le quedan a cada bandeja (la app no enseña números: solo lo usa para el horno y la campanilla).
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
    'cabe', public.cafe_obrador_cabe(o.vitrina),
    'horneando', coalesce((
      select jsonb_agg(jsonb_build_object('bandeja', h.bandeja, 'receta', h.receta, 'piezas', h.piezas, 'estrellas', h.estrellas,
               'falta', greatest(0, ceil(extract(epoch from (h.metida + make_interval(secs => coalesce((public.cafe_obrador_receta(h.receta) ->> 'segundos')::integer, 60)) - now()))))::integer)
               order by h.bandeja)
        from public.cafe_obrador_horno h where h.user_id = uid), '[]'::jsonb),
    'piezas', coalesce((select jsonb_object_agg(v.receta, v.piezas) from public.cafe_obrador_vitrina v where v.user_id = uid and v.piezas > 0), '{}'::jsonb),
    'hornadas_hoy', (select count(*)::integer from public.cafe_obrador_hornadas x where x.user_id = uid and x.dia = public.cafe_hoy()),
    'vendidas', (select count(*)::integer from public.cafe_obrador_ventas x where x.user_id = uid))
  from public.cafe_obrador o where o.user_id = uid;
$$;
revoke all on function public.cafe_obrador_json(uuid) from public, anon, authenticated;

-- ── Tu obrador y quién pide algo para acompañar ese día (abre el día como al cargar los clientes) ──
-- { obrador (null si aún no lo has abierto), piden: [{ n, tipo, servido, receta }] }. Por debajo del nivel 4, obrador null y nadie pide.
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
begin
  perform public.cafe_abrir_dia(me, dia);
  select * into d from public.cafe_dias x where x.user_id = me and x.dia = cafe_obrador.dia;
  return jsonb_build_object(
    'obrador', public.cafe_obrador_json(me),
    'piden', coalesce((
      select jsonb_agg(jsonb_build_object('n', c.n, 'tipo', t.tipo, 'servido', v.cliente is not null, 'receta', v.receta) order by c.n)
        from (select g.n from generate_series(1, d.clientes) g(n)
              union all select 100 + k from generate_series(1, d.habituales) k
              union all select 200 + k from generate_series(1, d.virales) k) c
       cross join lateral (select public.cafe_pide_comida(me, cafe_obrador.dia, c.n) as tipo) t
        left join public.cafe_obrador_ventas v on v.user_id = me and v.dia = cafe_obrador.dia and v.cliente = c.n
       where t.tipo is not null), '[]'::jsonb));
end;
$$;
revoke all on function public.cafe_obrador(date) from public, anon;
grant execute on function public.cafe_obrador(date) to authenticated;

-- ── Abrir el obrador (una vez por cuenta, desde el nivel 4): el horno, la vitrina y la primera hornada de la casa ──
create or replace function public.cafe_obrador_abrir()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  l public.cafe_locales;
  nuevo boolean;
begin
  select * into l from public.cafe_locales x where x.user_id = me for update;
  if l.user_id is null or l.inaugurado is null then
    raise exception 'cafe:cerrado' using errcode = 'P0001';
  end if;
  if l.nivel < public.cafe_obrador_nivel() then
    raise exception 'cafe:obrador' using errcode = 'P0001';
  end if;
  insert into public.cafe_obrador (user_id) values (me) on conflict (user_id) do nothing;
  nuevo := found;
  if nuevo then
    insert into public.cafe_obrador_vitrina (user_id, receta, piezas) values (me, 'magdalenas', 6)
    on conflict (user_id, receta) do nothing;
  end if;
  return jsonb_build_object('obrador', public.cafe_obrador_json(me), 'nuevo', nuevo);
end;
$$;
revoke all on function public.cafe_obrador_abrir() from public, anon;
grant execute on function public.cafe_obrador_abrir() to authenticated;

-- ── Hornear: la receta y cómo quedaron sus dos gestos (2, bien; 1, se podía mejorar) ──
create or replace function public.cafe_hornear(receta text, mimo smallint[])
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  o public.cafe_obrador;
  v_nivel integer;
  r jsonb;
  b integer;
  v_estrellas integer;
  v_piezas integer;
begin
  select * into o from public.cafe_obrador x where x.user_id = me for update;
  if o.user_id is null then
    raise exception 'cafe:obrador' using errcode = 'P0001';
  end if;
  select x.nivel into v_nivel from public.cafe_locales x where x.user_id = me;
  r := public.cafe_obrador_receta(cafe_hornear.receta);
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
  v_piezas := (r -> 'piezas' ->> (v_estrellas - 1))::integer;
  insert into public.cafe_obrador_horno (user_id, bandeja, receta, piezas, estrellas) values (me, b, cafe_hornear.receta, v_piezas, v_estrellas);
  insert into public.cafe_obrador_hornadas (user_id, dia, receta, estrellas, piezas) values (me, public.cafe_hoy(), cafe_hornear.receta, v_estrellas, v_piezas);
  return jsonb_build_object('obrador', public.cafe_obrador_json(me),
    'dado', jsonb_build_object('bandeja', b, 'estrellas', v_estrellas, 'piezas', v_piezas, 'mimo', to_jsonb(cafe_hornear.mimo)));
end;
$$;
revoke all on function public.cafe_hornear(text, smallint[]) from public, anon;
grant execute on function public.cafe_hornear(text, smallint[]) to authenticated;

-- ── Sacar una hornada: a la vitrina hasta llenarla; lo que no cabe espera en su bandeja ──
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
  hueco := public.cafe_obrador_cabe(o.vitrina) - hay;
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

-- ── Servir algo para acompañar: al cliente ya servido ese día que lo pidió, del tipo que pidió y que quede en la vitrina ──
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
  precio := (r ->> 'precio')::integer;
  insert into public.cafe_obrador_ventas (user_id, dia, cliente, receta, granos)
  values (me, cafe_servir_comida.dia, cafe_servir_comida.cliente, cafe_servir_comida.receta, precio)
  on conflict on constraint cafe_obrador_ventas_pkey do nothing;
  if not found then
    raise exception 'cafe:servido' using errcode = 'P0001';
  end if;
  update public.cafe_obrador_vitrina x set piezas = x.piezas - 1 where x.user_id = me and x.receta = cafe_servir_comida.receta;
  update public.cafe_locales x set granos = least(100000, x.granos + precio), actualizado = now() where x.user_id = me;
  return jsonb_build_object('cafe', public.cafe_json(me), 'obrador', public.cafe_obrador_json(me),
    'dado', jsonb_build_object('granos', precio, 'receta', cafe_servir_comida.receta));
end;
$$;
revoke all on function public.cafe_servir_comida(date, integer, text) from public, anon;
grant execute on function public.cafe_servir_comida(date, integer, text) to authenticated;

-- ── Servir la bebida (de 20261222120000_cafe_catalogo.sql), con lo de la comida: a quien pide comida, sus estrellas solo de la
-- bebida y sin libro (máximo dos cosas por cliente). Para los demás, igual que antes. ──
create or replace function public.cafe_entregar(dia date, cliente integer, receta text[], libro text default null, libro_ok boolean[] default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  l public.cafe_locales;
  d public.cafe_dias;
  pide text[];
  carta text[];
  habitual boolean := cliente between 101 and 102;
  excentrico boolean;
  aciertos integer := 0;
  en_balda boolean := false;
  ok boolean[] := array[false, false, false];
  la integer := 0;
  estrellas integer;
  premio integer[];
  frase integer := null;
  quien integer := null;
  dorada boolean := false;
  lleva boolean := false;
  extra integer := 0;
  tueste boolean := false;
  bono_g integer := 0;
  bono_r integer := 0;
  progreso jsonb;
  comida text;
begin
  perform public.cafe_abrir_dia(me, dia);
  select * into l from public.cafe_locales x where x.user_id = me for update;
  select * into d from public.cafe_dias x where x.user_id = me and x.dia = cafe_entregar.dia for update;
  if cliente is null or not ((cliente between 1 and d.clientes) or (cliente between 101 and 100 + d.habituales) or (cliente between 201 and 200 + d.virales)) then
    raise exception 'cafe:cliente' using errcode = 'P0001';
  end if;
  carta := public.cafe_carta(l.reputacion);
  if receta is null or cardinality(receta) <> 4
     or not (receta[1] = any (public.cafe_bebidas_carta(carta)))
     or not (receta[2] = any (public.cafe_granos_carta(carta)))
     or (receta[2] = 'casa' and not (receta[1] = any (array['cafe', 'frio'])))
     or not (receta[3] = any (array['sin', 'entera', 'avena']))
     or not (receta[4] = any (public.cafe_toques_carta(carta))) then
    raise exception 'cafe:receta' using errcode = 'P0001';
  end if;
  if libro is not null and (char_length(libro) not between 1 and 80 or libro_ok is null or cardinality(libro_ok) <> 3) then
    raise exception 'cafe:libro' using errcode = 'P0001';
  end if;
  if receta[2] = 'casa' and l.tazas < 1 then
    raise exception 'cafe:tueste' using errcode = 'P0001';
  end if;
  excentrico := not habitual and cliente = d.clientes;
  pide := public.cafe_pide(me, d.dia, cliente);
  for k in 1..4 loop
    if receta[k] = pide[k] then
      aciertos := aciertos + 1;
    end if;
  end loop;
  -- 1.143: quien pide comida no pide libro (máximo dos cosas): si llegara uno, ni cuenta ni se lo lleva
  comida := public.cafe_pide_comida(me, d.dia, cliente);
  en_balda := comida is null and libro is not null and exists (select 1 from public.cafe_libros b where b.user_id = me and b.clave = libro and b.balda > 0);
  if en_balda then
    ok := array[coalesce(libro_ok[1], false), coalesce(libro_ok[2], false), coalesce(libro_ok[3], false)];
    la := (case when ok[1] then 1 else 0 end) + (case when ok[2] then 1 else 0 end) + (case when ok[3] then 1 else 0 end);
    lleva := ok[1];
  end if;
  if lleva then
    -- 1.139: uno de tus leídos, «lo recomiendas tú», paga 6; uno del catálogo, 4
    extra := case when libro like 'cat:%' then 4 else 6 end;
  end if;
  tueste := receta[2] = 'casa' and pide[2] = 'casa';
  if tueste then
    bono_g := 3;
    bono_r := 4;
  end if;
  estrellas := case when comida is not null then public.cafe_estrellas_bebida(aciertos) else public.cafe_estrellas_total(aciertos + la) end;
  premio := public.cafe_premio(case when habitual then 'habitual' when excentrico then 'excentrico' else 'cliente' end, estrellas);
  insert into public.cafe_servicios (user_id, dia, cliente, receta, aciertos, encaja, estrellas, granos, reputacion, libro, libro_aciertos)
  values (me, d.dia, cliente, receta, aciertos, lleva, estrellas, premio[1] + extra + bono_g, premio[2] + bono_r,
          case when en_balda then libro end, la)
  on conflict on constraint cafe_servicios_pkey do nothing;
  if not found then
    raise exception 'cafe:servido' using errcode = 'P0001';
  end if;
  update public.cafe_locales x
     set granos = least(100000, x.granos + premio[1] + extra + bono_g), reputacion = least(1000000, x.reputacion + premio[2] + bono_r),
         tazas = x.tazas - case when receta[2] = 'casa' then 1 else 0 end, actualizado = now()
   where x.user_id = me;
  if lleva then
    update public.cafe_libros b set balda = b.balda - 1 where b.user_id = me and b.clave = libro and b.balda > 0;
  end if;
  -- Las reseñas se siguen guardando (la nota del habitual y la dorada se ven al despedirle; la pizarra ya no está en la app)
  if habitual then
    quien := public.cafe_quien(me, d.dia, cliente - 100);
    frase := public.cafe_semilla(me, d.dia, 'r' || (cliente - 100)) % 12;
    insert into public.cafe_resenas (user_id, dia, excentrico, quien, frase)
    values (me, d.dia, false, quien, frase)
    on conflict on constraint cafe_resenas_pkey do nothing;
  elsif excentrico and estrellas = 3 then
    quien := public.cafe_semilla(me, d.dia, 'c' || cliente) % 6;
    frase := quien;
    dorada := true;
    insert into public.cafe_resenas (user_id, dia, excentrico, quien, frase)
    values (me, d.dia, true, quien, frase)
    on conflict on constraint cafe_resenas_pkey do nothing;
  end if;
  progreso := public.cafe_progreso(me, d.dia);
  return jsonb_build_object('cafe', public.cafe_json(me), 'dia', public.cafe_dia_json(me, d.dia), 'libros', public.cafe_libros_json(me),
    'dado', jsonb_build_object('granos', premio[1] + extra + bono_g, 'reputacion', premio[2] + bono_r, 'llevado', lleva, 'extra', extra, 'estrellas', estrellas,
      'aciertos', aciertos, 'libro_aciertos', la, 'libro_ok', to_jsonb(ok), 'en_balda', en_balda, 'pide', to_jsonb(pide), 'frase', frase,
      'dorada', dorada, 'tueste', tueste, 'bono_granos', bono_g, 'bono_reputacion', bono_r, 'comida', comida),
    'progreso', progreso);
end;
$$;
revoke all on function public.cafe_entregar(date, integer, text[], text, boolean[]) from public, anon;
grant execute on function public.cafe_entregar(date, integer, text[], text, boolean[]) to authenticated;
