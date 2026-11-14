-- 1.130 (§130) · El café-librería del bajo: «Pilar prepara lo que ya dominas» y «los libros, igual de importantes que el
-- café» (aprobado por Francisco el 14-11-2026; plan en docs/qa/cafe-libreria.md §15). Requiere las migraciones del café hasta
-- 20261217120000_cafe_catas.sql (todas ya aplicadas: esta no edita ninguna; añade columnas y funciones y redefine tres).
-- - Servir con el libro en tres partes (`cafe_entregar`): hasta 4 aciertos de la bebida y 3 del libro (el género, la
--   extensión y cómo se lo lleva); 3 estrellas con los 7, 2 con 4 a 6, 1 con menos (nunca 0). Si aciertas el género, el
--   ejemplar se va con el cliente y paga 4 granos más (antes, 2); si no, se queda en su sección. Los premios por estrellas no
--   cambian. `cafe_servir` se queda como estaba, para las apps que aún no se hayan actualizado.
-- - El reparto: al abrir un día nuevo llega solo una caja con lo vendido desde el último reparto (los mismos títulos, hasta
--   10 ejemplares, a 2 granos el ejemplar; solo lo que se pueda pagar, nunca a deber). Lo que no llega se apunta en `faltan`.
--   Lo vendido antes de esta migración no guardaba el título: no se repone.
-- - El dominio de Pilar: cuántas servidas de 2 estrellas o más llevas de cada bebida (y del tueste de la casa, la nata, la
--   vainilla y el brûlée), en `cafe_json`. Pilar no cambia nada de lo que se paga.
-- Las cifras, las mismas que en src/features/edificio/cafe/cafeLibreria.js (las pruebas lo comprueban). Todo por funciones
-- `security definer`; tablas con RLS y sin permisos directos. Re-ejecutable.

-- ── Lo que se guarda de más ──
alter table public.cafe_servicios add column if not exists libro text check (libro is null or char_length(libro) between 1 and 80);
alter table public.cafe_servicios add column if not exists libro_aciertos smallint not null default 0 check (libro_aciertos between 0 and 3);
alter table public.cafe_servicios add column if not exists repuesto boolean not null default false;
alter table public.cafe_dias add column if not exists reparto jsonb;

-- ── Las estrellas de siete ──
create or replace function public.cafe_estrellas_total(puntos integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when puntos >= 7 then 3 when puntos >= 4 then 2 else 1 end;
$$;
revoke all on function public.cafe_estrellas_total(integer) from public, anon, authenticated;

-- ── El reparto de la mañana ──
-- Lo vendido sin reponer (de cualquier día que no sea el que se abre), del más antiguo al más nuevo: hasta 10, a 2 granos,
-- mientras lleguen los granos. Todo lo mirado queda apuntado como repuesto (lo que no llega no se acumula para otro día).
create or replace function public.cafe_reparto(uid uuid, dia date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  quedan integer;
  r record;
  claves text[] := '{}';
  faltan integer := 0;
begin
  select l.granos into quedan from public.cafe_locales l where l.user_id = uid for update;
  for r in
    select s.dia as d, s.cliente as c, s.libro as clave
      from public.cafe_servicios s
     where s.user_id = uid and s.encaja and s.libro is not null and not s.repuesto and s.dia <> cafe_reparto.dia
     order by s.creado, s.dia, s.cliente
  loop
    if cardinality(claves) < 10 and quedan >= 2
       and exists (select 1 from public.cafe_libros b where b.user_id = uid and b.clave = r.clave) then
      claves := claves || r.clave;
      quedan := quedan - 2;
    else
      faltan := faltan + 1;
    end if;
    update public.cafe_servicios s set repuesto = true where s.user_id = uid and s.dia = r.d and s.cliente = r.c;
  end loop;
  if cardinality(claves) = 0 and faltan = 0 then
    return null;
  end if;
  update public.cafe_libros b set caja = least(999, b.caja + n.k)
    from (select x as clave, count(*)::integer as k from unnest(claves) as x group by x) n
   where b.user_id = uid and b.clave = n.clave;
  update public.cafe_locales l set granos = l.granos - 2 * cardinality(claves), actualizado = now() where l.user_id = uid;
  return jsonb_build_object('claves', to_jsonb(claves), 'granos', 2 * cardinality(claves), 'faltan', faltan);
end;
$$;
revoke all on function public.cafe_reparto(uuid, date) from public, anon, authenticated;

-- Abrir el día (lo de antes, de 20261213120000_cafe_ampliacion.sql) y, si es nuevo, el reparto
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
  if found then
    rep := public.cafe_reparto(uid, dia);
    if rep is not null then
      update public.cafe_dias d set reparto = rep where d.user_id = uid and d.dia = cafe_abrir_dia.dia;
    end if;
  end if;
end;
$$;
revoke all on function public.cafe_abrir_dia(uuid, date) from public, anon, authenticated;

-- El día (lo de antes, de 20261212120000_cafe_niveles.sql) con su reparto
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
    'pizarra', coalesce((
      select jsonb_agg(jsonb_build_object('dia', r.dia, 'quien', r.quien, 'frase', r.frase, 'dorada', r.excentrico) order by r.creado desc)
        from (select * from public.cafe_resenas x where x.user_id = uid order by x.creado desc limit 6) r), '[]'::jsonb))
  from public.cafe_dias d where d.user_id = uid and d.dia = cafe_dia_json.dia;
$$;
revoke all on function public.cafe_dia_json(uuid, date) from public, anon, authenticated;

-- ── El dominio de Pilar ──
-- Tu café (lo de antes, de 20261216120000_cafe_tostadero.sql) con lo que dominas: servidas de 2 estrellas o más de cada
-- bebida y de lo de la carta que tiene su gesto (`grano:casa`, `toque:nata`, `toque:vainilla`, `toque:brulee`)
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

-- ── Servir con el libro en tres partes ──
-- `libro`: la clave del ejemplar elegido (null, solo el café); `libro_ok`: [género, extensión, forma] acertados (la app lo
-- sabe: tu biblioteca no está en el servidor). Un libro que ya no está en la balda cuenta como solo el café.
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
  if cliente is null or not ((cliente between 1 and d.clientes) or (cliente between 101 and 100 + d.habituales)) then
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
  -- El tueste de la casa sale del saco: sin tazas, no hay
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
  -- El libro solo cuenta si es uno de tu balda; se lo lleva si el género es el que pidió
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
