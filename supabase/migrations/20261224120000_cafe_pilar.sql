-- 1.142 (SPEC §142): el cuaderno de Pilar. Francisco, 16-11-2026: «añadirle tareas a pilar a cambio de monedas para que pueda
-- facilitar tareas o añadir funciones que recompensen al jugador a la larga». Decisión: «Mejoras para siempre» (se pagan una
-- vez con granos, tienen grados y nunca caducan). Tras verlo, «que los beneficios de los encargos sean mucho más atractivos»:
-- cifras «Generosos».
-- - Colocar la caja (nivel 1, 60 granos): cada mañana, al abrir el día y tras el reparto, Pilar sube lo que espera en las cajas a
--   la balda, hasta llenar los huecos (lo que no cabe se queda en la caja). 2.º grado, «Pilar pide a la distribuidora» (nivel 4,
--   300 granos): 3 libros más en cada reparto de la mañana (sin pasar de los huecos libres).
-- - La hucha de propinas (desde el nivel 2; 120 / 250 / 450 granos): 8 / 15 / 25 granos por cada día entero que pasa, guardando
--   como mucho 7 días; se recoge al entrar en el café. Al subir de grado, primero se cobra lo de antes.
-- - La pizarra de la acera (150 / 350 desde el nivel 3; 700 desde el nivel 5): 1 / 2 / 3 clientes más al día, desde el día
--   siguiente. La reputación del día no tiene otro tope que los clientes, así que sube en proporción.
-- Además se cuenta lo que ha dado cada tarea (granos de la hucha, libros colocados, clientes de la pizarra, libros pedidos).
-- Todo lo cuenta el servidor; nada toca los tickets. Se redefinen `cafe_abrir_dia` y `cafe_json` (de
-- 20261219120000_cafe_influencer.sql) y `cafe_reparto` (de 20261222120000_cafe_catalogo.sql), con solo esos cambios. Nada se borra.

-- ── Lo comprado y lo que ha dado ──
alter table public.cafe_locales add column if not exists pilar_caja smallint not null default 0;
alter table public.cafe_locales add column if not exists hucha smallint not null default 0;
alter table public.cafe_locales add column if not exists hucha_desde timestamptz;
alter table public.cafe_locales add column if not exists pizarra smallint not null default 0;
alter table public.cafe_locales add column if not exists hucha_total integer not null default 0;
alter table public.cafe_locales add column if not exists pilar_colocados integer not null default 0;
alter table public.cafe_locales add column if not exists pizarra_clientes integer not null default 0;
alter table public.cafe_locales add column if not exists pilar_pedidos integer not null default 0;
alter table public.cafe_locales drop constraint if exists cafe_locales_pilar_caja_check;
alter table public.cafe_locales add constraint cafe_locales_pilar_caja_check check (pilar_caja between 0 and 2);
alter table public.cafe_locales drop constraint if exists cafe_locales_hucha_check;
alter table public.cafe_locales add constraint cafe_locales_hucha_check check (hucha between 0 and 3);
alter table public.cafe_locales drop constraint if exists cafe_locales_pizarra_check;
alter table public.cafe_locales add constraint cafe_locales_pizarra_check check (pizarra between 0 and 3);

-- ── Con la pizarra, hasta 13 clientes al día ──
alter table public.cafe_dias drop constraint if exists cafe_dias_clientes_check;
alter table public.cafe_dias add constraint cafe_dias_clientes_check check (clientes between 0 and 13);
alter table public.cafe_servicios drop constraint if exists cafe_servicios_cliente_check;
alter table public.cafe_servicios add constraint cafe_servicios_cliente_check
  check (cliente between 1 and 13 or cliente between 101 and 102 or cliente between 201 and 203 or cliente between 302 and 308);

-- ── Las cifras ──
-- Lo que cuesta cada grado (null: no existe)
create or replace function public.cafe_pilar_precio(mejora text, grado integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case mejora
           when 'caja' then case grado when 1 then 60 when 2 then 300 end
           when 'hucha' then case grado when 1 then 120 when 2 then 250 when 3 then 450 end
           when 'pizarra' then case grado when 1 then 150 when 2 then 350 when 3 then 700 end
         end;
$$;
revoke all on function public.cafe_pilar_precio(text, integer) from public, anon, authenticated;

-- Desde qué nivel del café se puede encargar cada grado
create or replace function public.cafe_pilar_nivel(mejora text, grado integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case mejora
           when 'caja' then case when grado >= 2 then 4 else 1 end
           when 'hucha' then 2
           when 'pizarra' then case when grado >= 3 then 5 else 3 end
         end;
$$;
revoke all on function public.cafe_pilar_nivel(text, integer) from public, anon, authenticated;

-- Granos de la hucha por día entero, según su grado
create or replace function public.cafe_hucha_dia(grado integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case grado when 1 then 8 when 2 then 15 when 3 then 25 else 0 end;
$$;
revoke all on function public.cafe_hucha_dia(integer) from public, anon, authenticated;

-- Los días enteros que guarda la hucha ahora mismo (como mucho 7)
create or replace function public.cafe_hucha_dias(uid uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select least(7, greatest(0, floor(extract(epoch from (now() - l.hucha_desde)) / 86400)::integer))
                     from public.cafe_locales l where l.user_id = uid and l.hucha > 0 and l.hucha_desde is not null), 0);
$$;
revoke all on function public.cafe_hucha_dias(uuid) from public, anon, authenticated;

-- Lo de Pilar, para la app: los grados, la hucha y lo que te ha dado cada tarea
create or replace function public.cafe_pilar_json(uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'caja', l.pilar_caja, 'hucha', l.hucha, 'pizarra', l.pizarra,
    'hucha_dia', public.cafe_hucha_dia(l.hucha),
    'hucha_lista', public.cafe_hucha_dia(l.hucha) * public.cafe_hucha_dias(uid),
    'dado', jsonb_build_object('hucha', l.hucha_total, 'colocados', l.pilar_colocados, 'clientes', l.pizarra_clientes, 'pedidos', l.pilar_pedidos))
  from public.cafe_locales l where l.user_id = uid;
$$;
revoke all on function public.cafe_pilar_json(uuid) from public, anon, authenticated;

-- ── Pilar coloca la caja: lo que espera, a la balda, hasta llenar los huecos (por título; nada se pierde) ──
create or replace function public.cafe_pilar_coloca(uid uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  l public.cafe_locales;
  libres integer;
  puestos integer := 0;
  r record;
  n integer;
begin
  select * into l from public.cafe_locales x where x.user_id = uid;
  if l.user_id is null or l.inaugurado is null or l.pilar_caja < 1 then
    return 0;
  end if;
  select public.cafe_huecos(l.nivel) - coalesce(sum(b.balda), 0) into libres from public.cafe_libros b where b.user_id = uid;
  for r in select b.clave, b.caja from public.cafe_libros b where b.user_id = uid and b.caja > 0 order by b.titulo, b.clave loop
    exit when libres <= 0;
    n := least(r.caja, libres);
    update public.cafe_libros b set balda = b.balda + n, caja = b.caja - n where b.user_id = uid and b.clave = r.clave;
    libres := libres - n;
    puestos := puestos + n;
  end loop;
  if puestos > 0 then
    update public.cafe_locales x set pilar_colocados = least(1000000000, x.pilar_colocados + puestos) where x.user_id = uid;
  end if;
  return puestos;
end;
$$;
revoke all on function public.cafe_pilar_coloca(uuid) from public, anon, authenticated;

-- ── La hucha: lo guardado, a los granos ──
create or replace function public.cafe_hucha_cobrar(uid uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  dias integer;
  n integer;
begin
  perform 1 from public.cafe_locales x where x.user_id = uid for update;
  dias := public.cafe_hucha_dias(uid);
  if dias <= 0 then
    return 0;
  end if;
  select public.cafe_hucha_dia(x.hucha) * dias into n from public.cafe_locales x where x.user_id = uid;
  -- Lo que pasa de 7 días no se guarda: la hucha vuelve a empezar desde ahora; si no, se queda con las horas del día a medias
  update public.cafe_locales x
     set granos = least(100000, x.granos + n),
         hucha_total = least(1000000000, x.hucha_total + n),
         hucha_desde = case when dias >= 7 then now() else x.hucha_desde + make_interval(days => dias) end,
         actualizado = now()
   where x.user_id = uid;
  return n;
end;
$$;
revoke all on function public.cafe_hucha_cobrar(uuid) from public, anon, authenticated;

-- Al entrar en el café: recoger la hucha. Devuelve lo recogido y tu café
create or replace function public.cafe_hucha()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  l public.cafe_locales;
  n integer;
begin
  select * into l from public.cafe_locales x where x.user_id = me for update;
  if l.user_id is null or l.inaugurado is null then
    raise exception 'cafe:cerrado' using errcode = 'P0001';
  end if;
  n := public.cafe_hucha_cobrar(me);
  return jsonb_build_object('recogido', n, 'cafe', public.cafe_json(me));
end;
$$;
revoke all on function public.cafe_hucha() from public, anon;
grant execute on function public.cafe_hucha() to authenticated;

-- ── Comprar el grado siguiente de una tarea del cuaderno ──
create or replace function public.cafe_pilar_mejorar(mejora text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  l public.cafe_locales;
  grado integer;
  precio integer;
begin
  select * into l from public.cafe_locales x where x.user_id = me for update;
  if l.user_id is null or l.inaugurado is null then
    raise exception 'cafe:cerrado' using errcode = 'P0001';
  end if;
  grado := case mejora when 'caja' then l.pilar_caja + 1 when 'hucha' then l.hucha + 1 when 'pizarra' then l.pizarra + 1 end;
  precio := public.cafe_pilar_precio(mejora, grado);
  if precio is null then
    raise exception 'cafe:cuaderno' using errcode = 'P0001';
  end if;
  if l.nivel < public.cafe_pilar_nivel(mejora, grado) then
    raise exception 'cafe:cuaderno_nivel' using errcode = 'P0001';
  end if;
  if l.granos < precio then
    raise exception 'cafe:granos' using errcode = 'P0001';
  end if;
  if mejora = 'hucha' then
    -- Lo que ya guardaba, a su precio de antes; desde ahora, al nuevo
    perform public.cafe_hucha_cobrar(me);
    update public.cafe_locales x set granos = x.granos - precio, hucha = grado, hucha_desde = coalesce(case when grado > 1 then x.hucha_desde end, now()), actualizado = now()
     where x.user_id = me;
  elsif mejora = 'pizarra' then
    update public.cafe_locales x set granos = x.granos - precio, pizarra = grado, actualizado = now() where x.user_id = me;
  else
    update public.cafe_locales x set granos = x.granos - precio, pilar_caja = grado, actualizado = now() where x.user_id = me;
    perform public.cafe_pilar_coloca(me);
  end if;
  return jsonb_build_object('cafe', public.cafe_json(me), 'libros', public.cafe_libros_json(me));
end;
$$;
revoke all on function public.cafe_pilar_mejorar(text) from public, anon;
grant execute on function public.cafe_pilar_mejorar(text) to authenticated;

-- ── El reparto de la mañana (lo de antes, de 20261222120000_cafe_catalogo.sql) con lo que pide Pilar: 3 más con el 2.º grado de
-- la caja (sin pasar de los huecos libres). `pilar`, cuántos son de su pedido ──
create or replace function public.cafe_reparto(uid uuid, dia date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  l public.cafe_locales;
  cupo integer;
  base integer;
  claves text[] := '{}';
  repuestos integer := 0;
  r record;
  presentes text[];
  g text;
  tuyos integer;
  pedidos integer := 0;
begin
  select * into l from public.cafe_locales x where x.user_id = uid;
  base := public.cafe_reparto_cupo(l.nivel);
  select greatest(0, least(base + case when l.pilar_caja >= 2 then 3 else 0 end, public.cafe_huecos(l.nivel) - coalesce(sum(b.balda + b.caja), 0)))
    into cupo from public.cafe_libros b where b.user_id = uid;
  select count(*) into tuyos from public.cafe_tuyos t where t.user_id = uid;
  -- 1. Lo vendido desde el último reparto, el mismo título (todo queda repuesto, quepa o no)
  for r in
    select s.dia as d, s.cliente as c, s.libro as clave
      from public.cafe_servicios s
     where s.user_id = uid and s.encaja and s.libro is not null and not s.repuesto and s.dia <> cafe_reparto.dia
     order by s.creado, s.dia, s.cliente
  loop
    if cardinality(claves) < cupo and exists (select 1 from public.cafe_libros b where b.user_id = uid and b.clave = r.clave) then
      update public.cafe_libros b set caja = least(999, b.caja + 1) where b.user_id = uid and b.clave = r.clave;
      claves := claves || r.clave;
      repuestos := repuestos + 1;
    end if;
    update public.cafe_servicios s set repuesto = true where s.user_id = uid and s.dia = r.d and s.cliente = r.c;
  end loop;
  -- 2. El resto: uno de cada tres, de tus leídos (si tienes); los demás, del catálogo, con al menos 3 géneros en la balda
  while cardinality(claves) < cupo loop
    if tuyos > 0 and cardinality(claves) % 3 = 0 then
      select t.clave, t.titulo, t.genero into r from public.cafe_tuyos t where t.user_id = uid order by random() limit 1;
    else
      select coalesce(array_agg(distinct b.genero), '{}') into presentes from public.cafe_libros b where b.user_id = uid and b.balda + b.caja > 0;
      select c.genero into g from public.cafe_catalogo() c
       where cardinality(presentes) >= 3 or not (c.genero = any (presentes))
       order by random() limit 1;
      select c.clave, c.titulo, c.genero into r from public.cafe_catalogo() c where c.genero = g order by random() limit 1;
    end if;
    perform public.cafe_a_la_caja(uid, r.clave, r.titulo, r.genero, 1);
    claves := claves || r.clave;
  end loop;
  if cardinality(claves) = 0 then
    return null;
  end if;
  -- Lo que pasa del cupo de siempre es lo que pidió Pilar
  pedidos := greatest(0, cardinality(claves) - base);
  if pedidos > 0 then
    update public.cafe_locales x set pilar_pedidos = least(1000000000, x.pilar_pedidos + pedidos) where x.user_id = uid;
  end if;
  return jsonb_build_object('claves', to_jsonb(claves), 'granos', 0, 'gratis', true, 'repuestos', repuestos, 'faltan', 0, 'pilar', pedidos);
end;
$$;
revoke all on function public.cafe_reparto(uuid, date) from public, anon, authenticated;

-- ── Abrir el día (lo de antes, de 20261219120000_cafe_influencer.sql), con los clientes de la pizarra y, tras el reparto, Pilar
-- colocando la caja ──
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
  base integer;
  n integer;
begin
  if not public.cafe_dia_valido(dia) then
    raise exception 'cafe:dia' using errcode = 'P0001';
  end if;
  select * into l from public.cafe_locales where user_id = uid;
  if l.user_id is null or l.inaugurado is null then
    raise exception 'cafe:cerrado' using errcode = 'P0001';
  end if;
  base := public.cafe_clientes_dia(l.nivel, public.cafe_asientos(l.plano));
  n := least(13, base + l.pizarra);
  insert into public.cafe_dias (user_id, dia, clientes, carta)
  values (uid, dia, n, public.cafe_carta(l.reputacion))
  on conflict on constraint cafe_dias_pkey do nothing;
  nuevo := found;
  if nuevo then
    if n > base then
      update public.cafe_locales x set pizarra_clientes = least(1000000000, x.pizarra_clientes + (n - base)) where x.user_id = uid;
    end if;
    rep := public.cafe_reparto(uid, dia);
    if rep is not null then
      update public.cafe_dias d set reparto = rep where d.user_id = uid and d.dia = cafe_abrir_dia.dia;
    end if;
    perform public.cafe_pilar_coloca(uid);
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

-- ── Tu café (lo de antes, de 20261219120000_cafe_influencer.sql), con lo de Pilar ──
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
    'inventario', coalesce((select jsonb_object_agg(v.mueble, v.copias) from public.cafe_inventario v where v.user_id = uid and v.copias > 0), '{}'::jsonb),
    'pilar', public.cafe_pilar_json(uid))
  from public.cafe_locales l where l.user_id = uid;
$$;
revoke all on function public.cafe_json(uuid) from public, anon, authenticated;
