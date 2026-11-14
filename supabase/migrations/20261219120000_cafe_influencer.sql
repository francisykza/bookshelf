-- 1.132 (§132) · El café-librería del bajo: el influencer de cada nivel y fuera la pizarra (encargo de Francisco del
-- 14-11-2026, con las cuatro decisiones recomendadas, y «Sí, empieza» al bloque 1; plan en docs/qa/cafe-libreria.md §16).
-- Requiere las migraciones del café hasta 20261218120000_cafe_libreria.sql (todas ya aplicadas: esta no edita ninguna; añade
-- columnas, una tabla y funciones, y redefine siete).
-- - El influencer: al llenar la barra del nivel, el café está «a punto de subir» y llega el influencer de ese nivel (uno por
--   subida, del 2 al 8, cada uno con su receta fija). El nivel sube al despedirle, salga como salga. Mientras no se le
--   despide, la reputación de más no se pierde: espera aparte (`reputacion_espera`) y entra al despedirle.
-- - Las cuentas que ya habían pasado niveles reciben a los influencers de esos niveles igual, uno al día y del más antiguo al
--   más nuevo, sin frenar nada (si hay una subida pendiente, su influencer va primero).
-- - Como mucho un influencer al día. Paga como el excéntrico (`cafe_premio('excentrico', …)`).
-- - El reloj de arena: `cafe_influencer_empezar` apunta la hora cada vez que vas a la barra (empezar otra vez no castiga) y
--   `cafe_influencer_entregar` mira si llegó a tiempo: 150 segundos, con 10 de margen por la conexión.
-- - A tiempo y con 3 estrellas, «el vídeo se hace viral»: el siguiente día que abras el café llegan 3 clientes más (los
--   números 201 a 203, que pagan como un cliente) y su foto firmada se cuelga en la pared (`fotos` en `cafe_json`).
-- - La pizarra sale de la app: `cafe_dia_json` ya no la manda. Las reseñas siguen guardadas en `cafe_resenas`.
-- Las cifras, las mismas que en src/features/edificio/cafe/cafeInfluencers.js (las pruebas lo comprueban). Todo por funciones
-- `security definer`; tablas con RLS y sin permisos directos. Re-ejecutable.

-- ── Lo que se guarda de más ──
alter table public.cafe_locales add column if not exists reputacion_espera integer not null default 0;
alter table public.cafe_locales drop constraint if exists cafe_locales_espera_check;
alter table public.cafe_locales add constraint cafe_locales_espera_check check (reputacion_espera between 0 and 1000000);

alter table public.cafe_dias add column if not exists virales smallint not null default 0;
alter table public.cafe_dias drop constraint if exists cafe_dias_virales_check;
alter table public.cafe_dias add constraint cafe_dias_virales_check check (virales between 0 and 3);
alter table public.cafe_dias add column if not exists virales_de smallint;
alter table public.cafe_dias drop constraint if exists cafe_dias_virales_de_check;
alter table public.cafe_dias add constraint cafe_dias_virales_de_check check (virales_de is null or virales_de between 2 and 8);

-- Los virales (201 a 203) y el influencer (300 + el nivel al que sube) también se sirven
alter table public.cafe_servicios drop constraint if exists cafe_servicios_cliente_check;
alter table public.cafe_servicios add constraint cafe_servicios_cliente_check
  check (cliente between 1 and 10 or cliente between 101 and 102 or cliente between 201 and 203 or cliente between 302 and 308);

-- Cada influencer, una vez por cuenta: cuándo se fue a la barra por última vez, cuándo se le despidió y cómo salió
create table if not exists public.cafe_influencers (
  user_id   uuid not null references auth.users (id) on delete cascade,
  nivel     smallint not null check (nivel between 2 and 8),
  empezado  timestamptz,
  dia       date,
  despedido timestamptz,
  estrellas smallint check (estrellas is null or estrellas between 1 and 3),
  segundos  integer check (segundos is null or segundos >= 0),
  a_tiempo  boolean not null default false,
  viral     boolean not null default false,
  viral_dia date,
  creado    timestamptz not null default now(),
  primary key (user_id, nivel)
);
alter table public.cafe_influencers enable row level security;
revoke all on table public.cafe_influencers from anon, authenticated;

-- ── Las cifras ──
-- Lo que pide cada influencer (el nivel al que sube): [bebida, grano, leche, toque], siempre con lo que ya está en la carta
-- con la barra del nivel anterior llena
create or replace function public.cafe_influencer_pide(nivel integer)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case nivel
           when 2 then array['cafe', 'suave', 'avena', 'canela']
           when 3 then array['te', 'intenso', 'sin', 'miel']
           when 4 then array['chocolate', 'intenso', 'entera', 'nata']
           when 5 then array['cafe', 'suave', 'entera', 'vainilla']
           when 6 then array['frio', 'intenso', 'avena', 'nada']
           when 7 then array['cafe', 'intenso', 'sin', 'nada']
           when 8 then array['frio', 'suave', 'entera', 'vainilla'] end;
$$;
revoke all on function public.cafe_influencer_pide(integer) from public, anon, authenticated;

-- El reloj de arena: 150 segundos, y 10 de margen por la conexión
create or replace function public.cafe_arena_segundos()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 150;
$$;
revoke all on function public.cafe_arena_segundos() from public, anon, authenticated;

create or replace function public.cafe_arena_margen()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 10;
$$;
revoke all on function public.cafe_arena_margen() from public, anon, authenticated;

-- ── La subida espera al influencer ──
-- Hasta dónde llega la reputación: lo que falta, menos uno, para el primer nivel por encima del tuyo cuyo influencer aún no
-- se ha despedido (null: nada lo frena)
create or replace function public.cafe_techo(uid uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  select l.nivel into n from public.cafe_locales l where l.user_id = uid;
  if n is null then
    return null;
  end if;
  for m in (n + 1) .. 8 loop
    if not exists (select 1 from public.cafe_influencers i where i.user_id = uid and i.nivel = m and i.despedido is not null) then
      return public.cafe_nivel_desde(m) - 1;
    end if;
  end loop;
  return null;
end;
$$;
revoke all on function public.cafe_techo(uuid) from public, anon, authenticated;

-- Lo que esperaba vuelve y lo que pase del techo se aparta otra vez (nunca se pierde nada)
create or replace function public.cafe_apartar(uid uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  t integer;
begin
  update public.cafe_locales l set reputacion = least(1000000, l.reputacion + l.reputacion_espera), reputacion_espera = 0
   where l.user_id = uid and l.reputacion_espera > 0;
  t := public.cafe_techo(uid);
  if t is null then
    return;
  end if;
  update public.cafe_locales l set reputacion_espera = least(1000000, l.reputacion_espera + (l.reputacion - t)), reputacion = t
   where l.user_id = uid and l.reputacion > t;
end;
$$;
revoke all on function public.cafe_apartar(uuid) from public, anon, authenticated;

-- El progreso (lo de antes, de 20261214120000_cafe_sotano.sql), primero con la reputación de más apartada: el nivel solo sube
-- hasta donde llega el techo
create or replace function public.cafe_progreso(uid uuid, dia date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  l public.cafe_locales;
  d public.cafe_dias;
  v_nuevo integer;
  v_niveles jsonb := '[]'::jsonb;
  v_hitos jsonb := '[]'::jsonb;
  v_tickets integer := 0;
  v_granos integer := 0;
  v_dia_tk integer := 0;
begin
  perform 1 from public.cafe_locales x where x.user_id = uid for update;
  perform public.cafe_apartar(uid);
  select * into l from public.cafe_locales x where x.user_id = uid;
  v_nuevo := public.cafe_nivel_de(l.reputacion);
  for n in 1 .. v_nuevo loop
    insert into public.cafe_niveles_cobrados (user_id, nivel, tickets) values (uid, n, public.cafe_tickets_nivel(n))
    on conflict on constraint cafe_niveles_cobrados_pkey do nothing;
    if found then
      v_tickets := v_tickets + public.cafe_tickets_nivel(n);
      v_niveles := v_niveles || jsonb_build_object('nivel', n, 'tickets', public.cafe_tickets_nivel(n));
    end if;
    for k in 1 .. 3 loop
      if l.reputacion >= public.cafe_hito_umbral(n, k) then
        insert into public.cafe_hitos (user_id, nivel, hito) values (uid, n, k)
        on conflict on constraint cafe_hitos_pkey do nothing;
        if found then
          v_hitos := v_hitos || jsonb_build_object('nivel', n, 'hito', k);
          if k = 3 then
            v_granos := v_granos + public.cafe_granos_hito(n);
          end if;
        end if;
      end if;
    end loop;
  end loop;
  -- Los tickets del día, con el primer servicio (con el nivel de después de subir)
  select * into d from public.cafe_dias x where x.user_id = uid and x.dia = cafe_progreso.dia for update;
  if d.tickets = 0 then
    v_dia_tk := public.cafe_tickets_dia(v_nuevo);
    update public.cafe_dias x set tickets = v_dia_tk where x.user_id = uid and x.dia = cafe_progreso.dia;
  end if;
  update public.cafe_locales x set nivel = greatest(x.nivel, v_nuevo), granos = least(100000, x.granos + v_granos), actualizado = now() where x.user_id = uid;
  if v_tickets + v_dia_tk > 0 then
    update public.piso_cuentas c set tickets = least(100000, c.tickets + v_tickets + v_dia_tk) where c.user_id = uid;
  end if;
  return jsonb_build_object('de', l.nivel, 'a', greatest(l.nivel, v_nuevo), 'niveles', v_niveles, 'hitos', v_hitos, 'granos', v_granos, 'tickets_dia', v_dia_tk,
    'tickets', v_tickets + v_dia_tk);
end;
$$;
revoke all on function public.cafe_progreso(uuid, date) from public, anon, authenticated;

-- ── El influencer del día ──
-- El que ya despediste ese día (servido); si no, el de la subida pendiente (la barra llena) y, si no, el más antiguo de los
-- niveles que ya tenías sin despedir (sin frenar nada). O null. Como mucho uno al día.
create or replace function public.cafe_influencer_de(uid uuid, dia date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l public.cafe_locales;
  i public.cafe_influencers;
  n integer;
begin
  select * into l from public.cafe_locales x where x.user_id = uid;
  if l.user_id is null or l.inaugurado is null then
    return null;
  end if;
  select * into i from public.cafe_influencers x where x.user_id = uid and x.dia = cafe_influencer_de.dia and x.despedido is not null order by x.despedido limit 1;
  if found then
    return jsonb_build_object('nivel', i.nivel, 'servido', true, 'sube', false, 'estrellas', i.estrellas, 'a_tiempo', i.a_tiempo, 'viral', i.viral);
  end if;
  if l.nivel < 8 and l.reputacion + l.reputacion_espera >= public.cafe_nivel_desde(l.nivel + 1)
     and not exists (select 1 from public.cafe_influencers x where x.user_id = uid and x.nivel = l.nivel + 1 and x.despedido is not null) then
    return jsonb_build_object('nivel', l.nivel + 1, 'servido', false, 'sube', true);
  end if;
  select min(k) into n
    from generate_series(2, l.nivel) k
   where not exists (select 1 from public.cafe_influencers x where x.user_id = uid and x.nivel = k and x.despedido is not null);
  if n is not null then
    return jsonb_build_object('nivel', n, 'servido', false, 'sube', false);
  end if;
  return null;
end;
$$;
revoke all on function public.cafe_influencer_de(uuid, date) from public, anon, authenticated;

-- Abrir el día (lo de antes, de 20261218120000_cafe_libreria.sql) y, si es nuevo, el reparto y los virales: si un influencer
-- se fue contento otro día anterior, hoy llegan 3 clientes más por su vídeo (una vez por influencer)
create or replace function public.cafe_abrir_dia(uid uuid, dia date)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  l public.cafe_locales;
  rep jsonb;
  nuevo boolean;
  v integer;
begin
  if not public.cafe_dia_valido(dia) then
    raise exception 'cafe:dia' using errcode = 'P0001';
  end if;
  select * into l from public.cafe_locales where user_id = uid;
  if l.user_id is null or l.inaugurado is null then
    raise exception 'cafe:cerrado' using errcode = 'P0001';
  end if;
  insert into public.cafe_dias (user_id, dia, clientes, carta)
  values (uid, dia, public.cafe_clientes_dia(l.nivel, public.cafe_asientos(l.plano)), public.cafe_carta(l.reputacion))
  on conflict on constraint cafe_dias_pkey do nothing;
  nuevo := found;
  if nuevo then
    rep := public.cafe_reparto(uid, dia);
    if rep is not null then
      update public.cafe_dias d set reparto = rep where d.user_id = uid and d.dia = cafe_abrir_dia.dia;
    end if;
    select x.nivel into v from public.cafe_influencers x
     where x.user_id = uid and x.viral and x.viral_dia is null and x.dia < cafe_abrir_dia.dia
     order by x.despedido limit 1;
    if v is not null then
      update public.cafe_influencers x set viral_dia = cafe_abrir_dia.dia where x.user_id = uid and x.nivel = v;
      update public.cafe_dias d set virales = 3, virales_de = v where d.user_id = uid and d.dia = cafe_abrir_dia.dia;
    end if;
  end if;
end;
$$;
revoke all on function public.cafe_abrir_dia(uuid, date) from public, anon, authenticated;

-- Lo que pide cada uno (lo de antes, de 20261212120000_cafe_niveles.sql): los habituales, «lo de siempre»; el influencer, lo
-- suyo; los clientes y los virales, con la carta de su día
create or replace function public.cafe_pide(uid uuid, dia date, cliente integer)
returns text[]
language sql
volatile
security definer
set search_path = ''
as $$
  select case when cliente between 101 and 199 then public.cafe_receta(public.cafe_quien(uid, dia, cliente - 100) * 29 + 7)
              when cliente between 301 and 399 then public.cafe_influencer_pide(cliente - 300)
              else public.cafe_receta_carta(public.cafe_semilla(uid, dia, 'c' || cliente) / 1000,
                     coalesce((select d.carta from public.cafe_dias d where d.user_id = uid and d.dia = cafe_pide.dia), '{}')) end;
$$;
revoke all on function public.cafe_pide(uuid, date, integer) from public, anon, authenticated;

-- El día (lo de antes, de 20261218120000_cafe_libreria.sql), sin la pizarra y con los virales y el influencer
create or replace function public.cafe_dia_json(uid uuid, dia date)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'dia', d.dia,
    'carta', to_jsonb(d.carta),
    'tickets', d.tickets,
    'reparto', d.reparto,
    'clientes', coalesce((
      select jsonb_agg(jsonb_build_object('n', n, 'semilla', public.cafe_semilla(uid, d.dia, 'c' || n), 'servido', s.cliente is not null,
               'encaja', s.encaja, 'estrellas', s.estrellas, 'excentrico', n = d.clientes,
               'quien', case when n = d.clientes then public.cafe_semilla(uid, d.dia, 'c' || n) % 6 end) order by n)
        from generate_series(1, d.clientes) n
        left join public.cafe_servicios s on s.user_id = uid and s.dia = d.dia and s.cliente = n), '[]'::jsonb),
    'habituales', coalesce((
      select jsonb_agg(jsonb_build_object('n', 100 + k, 'quien', public.cafe_quien(uid, d.dia, k), 'semilla', public.cafe_semilla(uid, d.dia, 'h' || k || 'p'),
               'servido', s.cliente is not null, 'encaja', s.encaja, 'estrellas', s.estrellas) order by k)
        from generate_series(1, d.habituales) k
        left join public.cafe_servicios s on s.user_id = uid and s.dia = d.dia and s.cliente = 100 + k), '[]'::jsonb),
    'virales', coalesce((
      select jsonb_agg(jsonb_build_object('n', 200 + k, 'semilla', public.cafe_semilla(uid, d.dia, 'c' || (200 + k)), 'servido', s.cliente is not null,
               'encaja', s.encaja, 'estrellas', s.estrellas) order by k)
        from generate_series(1, d.virales) k
        left join public.cafe_servicios s on s.user_id = uid and s.dia = d.dia and s.cliente = 200 + k), '[]'::jsonb),
    'virales_de', d.virales_de,
    'influencer', public.cafe_influencer_de(uid, d.dia))
  from public.cafe_dias d where d.user_id = uid and d.dia = cafe_dia_json.dia;
$$;
revoke all on function public.cafe_dia_json(uuid, date) from public, anon, authenticated;

-- Tu café (lo de antes, de 20261218120000_cafe_libreria.sql) con la reputación que espera a la subida y las fotos firmadas
-- de la pared (los niveles de los influencers que se hicieron virales)
create or replace function public.cafe_json(uid uuid)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'nombre', l.nombre, 'nivel', l.nivel, 'reputacion', l.reputacion, 'granos', l.granos, 'plano', l.plano,
    'inaugurado', l.inaugurado is not null, 'escaparate', l.escaparate,
    'tostadero', jsonb_build_object('tazas', l.tazas, 'saco_dia', l.saco_dia),
    'espera', l.reputacion_espera,
    'fotos', coalesce((select jsonb_agg(i.nivel order by i.nivel) from public.cafe_influencers i where i.user_id = uid and i.viral), '[]'::jsonb),
    'dominio', coalesce((
      select jsonb_object_agg(t.k, t.n)
        from (select v.k, count(*)::integer as n
                from public.cafe_servicios s
               cross join lateral (values (s.receta[1]),
                                          (case when s.receta[2] = 'casa' then 'grano:casa' end),
                                          (case when s.receta[4] in ('nata', 'vainilla', 'brulee') then 'toque:' || s.receta[4] end)) v(k)
               where s.user_id = uid and s.estrellas >= 2 and v.k is not null
               group by v.k) t), '{}'::jsonb),
    'inventario', coalesce((select jsonb_object_agg(v.mueble, v.copias) from public.cafe_inventario v where v.user_id = uid and v.copias > 0), '{}'::jsonb))
  from public.cafe_locales l where l.user_id = uid;
$$;
revoke all on function public.cafe_json(uuid) from public, anon, authenticated;

-- ── Servir (lo de antes, de 20261218120000_cafe_libreria.sql), también a los virales ──
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
  en_balda := libro is not null and exists (select 1 from public.cafe_libros b where b.user_id = me and b.clave = libro and b.balda > 0);
  if en_balda then
    ok := array[coalesce(libro_ok[1], false), coalesce(libro_ok[2], false), coalesce(libro_ok[3], false)];
    la := (case when ok[1] then 1 else 0 end) + (case when ok[2] then 1 else 0 end) + (case when ok[3] then 1 else 0 end);
    lleva := ok[1];
  end if;
  if lleva then
    extra := 4;
  end if;
  tueste := receta[2] = 'casa' and pide[2] = 'casa';
  if tueste then
    bono_g := 3;
    bono_r := 4;
  end if;
  estrellas := public.cafe_estrellas_total(aciertos + la);
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
      'dorada', dorada, 'tueste', tueste, 'bono_granos', bono_g, 'bono_reputacion', bono_r),
    'progreso', progreso);
end;
$$;
revoke all on function public.cafe_entregar(date, integer, text[], text, boolean[]) from public, anon;
grant execute on function public.cafe_entregar(date, integer, text[], text, boolean[]) to authenticated;

-- ── Atender al influencer ──
-- Ir a la barra: se da la vuelta al reloj de arena (cada vez que se va; volver a empezar no castiga)
create or replace function public.cafe_influencer_empezar(dia date, nivel integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  hoy jsonb;
begin
  perform public.cafe_abrir_dia(me, dia);
  hoy := public.cafe_influencer_de(me, dia);
  if hoy is null or (hoy ->> 'servido')::boolean or (hoy ->> 'nivel')::integer is distinct from cafe_influencer_empezar.nivel then
    raise exception 'cafe:influencer' using errcode = 'P0001';
  end if;
  insert into public.cafe_influencers (user_id, nivel, empezado) values (me, cafe_influencer_empezar.nivel, now())
  on conflict on constraint cafe_influencers_pkey do update set empezado = now();
  return jsonb_build_object('nivel', cafe_influencer_empezar.nivel, 'segundos', public.cafe_arena_segundos());
end;
$$;
revoke all on function public.cafe_influencer_empezar(date, integer) from public, anon;
grant execute on function public.cafe_influencer_empezar(date, integer) to authenticated;

-- Llevarle lo preparado (como `cafe_entregar`, con su receta fija). A tiempo si no ha pasado el reloj de arena (con su
-- margen): paga como el excéntrico y, con 3 estrellas, viral; si no, paga como un cliente normal. Se le despide (y, si era el de la subida, el café sube)
create or replace function public.cafe_influencer_entregar(dia date, nivel integer, receta text[], libro text default null, libro_ok boolean[] default null)
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
  i public.cafe_influencers;
  hoy jsonb;
  pide text[];
  carta text[];
  aciertos integer := 0;
  en_balda boolean := false;
  ok boolean[] := array[false, false, false];
  la integer := 0;
  v_estrellas integer;
  premio integer[];
  lleva boolean := false;
  extra integer := 0;
  tueste boolean := false;
  bono_g integer := 0;
  bono_r integer := 0;
  v_segundos integer;
  v_a_tiempo boolean;
  v_viral boolean;
  progreso jsonb;
begin
  perform public.cafe_abrir_dia(me, dia);
  select * into l from public.cafe_locales x where x.user_id = me for update;
  select * into d from public.cafe_dias x where x.user_id = me and x.dia = cafe_influencer_entregar.dia for update;
  hoy := public.cafe_influencer_de(me, d.dia);
  if hoy is null or (hoy ->> 'servido')::boolean or (hoy ->> 'nivel')::integer is distinct from cafe_influencer_entregar.nivel then
    raise exception 'cafe:influencer' using errcode = 'P0001';
  end if;
  select * into i from public.cafe_influencers x where x.user_id = me and x.nivel = cafe_influencer_entregar.nivel for update;
  if i.user_id is null or i.empezado is null then
    raise exception 'cafe:influencer' using errcode = 'P0001';
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
  pide := public.cafe_influencer_pide(cafe_influencer_entregar.nivel);
  for k in 1..4 loop
    if receta[k] = pide[k] then
      aciertos := aciertos + 1;
    end if;
  end loop;
  en_balda := libro is not null and exists (select 1 from public.cafe_libros b where b.user_id = me and b.clave = libro and b.balda > 0);
  if en_balda then
    ok := array[coalesce(libro_ok[1], false), coalesce(libro_ok[2], false), coalesce(libro_ok[3], false)];
    la := (case when ok[1] then 1 else 0 end) + (case when ok[2] then 1 else 0 end) + (case when ok[3] then 1 else 0 end);
    lleva := ok[1];
  end if;
  if lleva then
    extra := 4;
  end if;
  tueste := receta[2] = 'casa' and pide[2] = 'casa';
  if tueste then
    bono_g := 3;
    bono_r := 4;
  end if;
  v_estrellas := public.cafe_estrellas_total(aciertos + la);
  v_segundos := greatest(0, floor(extract(epoch from (now() - i.empezado)))::integer);
  v_a_tiempo := v_segundos <= public.cafe_arena_segundos() + public.cafe_arena_margen();
  v_viral := v_a_tiempo and v_estrellas = 3;
  -- A tiempo, como el excéntrico; con la arena acabada, como un cliente normal (solo se pierde lo especial)
  premio := public.cafe_premio(case when v_a_tiempo then 'excentrico' else 'cliente' end, v_estrellas);
  insert into public.cafe_servicios (user_id, dia, cliente, receta, aciertos, encaja, estrellas, granos, reputacion, libro, libro_aciertos)
  values (me, d.dia, 300 + cafe_influencer_entregar.nivel, receta, aciertos, lleva, v_estrellas, premio[1] + extra + bono_g, premio[2] + bono_r,
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
  update public.cafe_influencers x
     set despedido = now(), dia = d.dia, estrellas = v_estrellas, segundos = v_segundos, a_tiempo = v_a_tiempo, viral = v_viral
   where x.user_id = me and x.nivel = cafe_influencer_entregar.nivel;
  progreso := public.cafe_progreso(me, d.dia);
  return jsonb_build_object('cafe', public.cafe_json(me), 'dia', public.cafe_dia_json(me, d.dia), 'libros', public.cafe_libros_json(me),
    'dado', jsonb_build_object('granos', premio[1] + extra + bono_g, 'reputacion', premio[2] + bono_r, 'llevado', lleva, 'extra', extra, 'estrellas', v_estrellas,
      'aciertos', aciertos, 'libro_aciertos', la, 'libro_ok', to_jsonb(ok), 'en_balda', en_balda, 'pide', to_jsonb(pide), 'frase', null,
      'dorada', false, 'tueste', tueste, 'bono_granos', bono_g, 'bono_reputacion', bono_r,
      'influencer', jsonb_build_object('nivel', cafe_influencer_entregar.nivel, 'a_tiempo', v_a_tiempo, 'viral', v_viral, 'segundos', v_segundos,
        'sube', coalesce((hoy ->> 'sube')::boolean, false))),
    'progreso', progreso);
end;
$$;
revoke all on function public.cafe_influencer_entregar(date, integer, text[], text, boolean[]) from public, anon;
grant execute on function public.cafe_influencer_entregar(date, integer, text[], text, boolean[]) to authenticated;

-- ── Jornadas de prueba (lo de antes, de 20261215120000_cafe_probador.sql): con todos atendidos, también los virales y el
-- influencer del día ──
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
  inf jsonb;
begin
  select * into p from public.cafe_probadores x where x.user_id = me for update;
  if not found then
    raise exception 'cafe:probador' using errcode = 'P0001';
  end if;
  select * into d from public.cafe_dias x where x.user_id = me and x.dia = p.jornada;
  if found then
    select count(*) into atendidos from public.cafe_servicios s where s.user_id = me and s.dia = p.jornada and s.cliente < 300;
    inf := public.cafe_influencer_de(me, p.jornada);
    if atendidos < d.clientes + d.habituales + d.virales or (inf is not null and not (inf ->> 'servido')::boolean) then
      raise exception 'cafe:pendientes' using errcode = 'P0001';
    end if;
  end if;
  update public.cafe_probadores x set jornada = x.jornada + 1 where x.user_id = me returning x.jornada into p.jornada;
  return p.jornada;
end;
$$;
revoke all on function public.cafe_nueva_jornada() from public, anon;
grant execute on function public.cafe_nueva_jornada() to authenticated;
