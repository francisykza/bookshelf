-- 1.139 · El café-librería del bajo: de dónde salen los libros (Francisco, 16-11-2026: «lo que no me convence es el tema de
-- comprar libros y que dependan exclusivamente de tu biblioteca, porque la gente que lea poco no tendrá muchas opciones y si
-- no tienes dinero pierdes esa parte del juego»; cifras aprobadas el mismo día, «Sí, esas cifras»; docs/qa/cafe-libreria.md §17).
-- Requiere las migraciones del café hasta 20261220120000_cafe_taller.sql (todas ya aplicadas).
-- - El catálogo del café: 80 libros reales, 8 por género (`cafe_catalogo()`, los mismos que CATALOGO_LIBROS de la app).
-- - Tus leídos: la app los manda al entrar (`cafe_mis_titulos`, hasta 200) y quedan en `cafe_tuyos` para el reparto.
-- - El reparto de la mañana, gratis: 6 libros en los niveles 1 y 2, 8 del 3 al 5 y 10 del 6 en adelante, nunca más que los
--   huecos libres. Primero lo vendido desde el último reparto; después, del catálogo, procurando al menos 3 géneros en la
--   balda; si tienes leídos, uno de cada tres es tuyo. Ya no cobra los 2 granos por ejemplar.
-- - Las cajas con granos (de un género, 5 por 10; de un título, 3 por 9) y la de bienvenida: del catálogo y de tus leídos.
-- - El ejemplar que se lleva el cliente: +4 granos si es del catálogo, +6 si es uno de tus leídos.
-- Se redefinen `cafe_reparto`, `cafe_comprar_caja`, `cafe_bienvenida`, `cafe_entregar` y `cafe_influencer_entregar` (copiadas de sus migraciones, con
-- solo esos cambios). Nada se borra: lo que hay en la balda y en las cajas se queda.

-- ── El catálogo ──
create or replace function public.cafe_catalogo()
returns table (clave text, titulo text, genero text)
language sql
immutable
set search_path = ''
as $$
  select v.clave, v.titulo, v.genero from (values
    ('cat:cien-anos-de-soledad', 'Cien años de soledad', 'novela'),
    ('cat:la-sombra-del-viento', 'La sombra del viento', 'novela'),
    ('cat:nada', 'Nada', 'novela'),
    ('cat:el-tunel', 'El túnel', 'novela'),
    ('cat:patria', 'Patria', 'novela'),
    ('cat:la-casa-de-los-espiritus', 'La casa de los espíritus', 'novela'),
    ('cat:cronica-de-una-muerte-anunciada', 'Crónica de una muerte anunciada', 'novela'),
    ('cat:los-santos-inocentes', 'Los santos inocentes', 'novela'),
    ('cat:el-hobbit', 'El hobbit', 'fantasia'),
    ('cat:el-nombre-del-viento', 'El nombre del viento', 'fantasia'),
    ('cat:la-historia-interminable', 'La historia interminable', 'fantasia'),
    ('cat:el-ultimo-deseo', 'El último deseo', 'fantasia'),
    ('cat:el-imperio-final', 'El imperio final', 'fantasia'),
    ('cat:un-mago-de-terramar', 'Un mago de Terramar', 'fantasia'),
    ('cat:coraline', 'Coraline', 'fantasia'),
    ('cat:juego-de-tronos', 'Juego de tronos', 'fantasia'),
    ('cat:asesinato-en-el-orient-express', 'Asesinato en el Orient Express', 'misterio'),
    ('cat:y-no-quedo-ninguno', 'Y no quedó ninguno', 'misterio'),
    ('cat:la-chica-del-tren', 'La chica del tren', 'misterio'),
    ('cat:el-codigo-da-vinci', 'El código Da Vinci', 'misterio'),
    ('cat:los-hombres-que-no-amaban-a-las-mujeres', 'Los hombres que no amaban a las mujeres', 'misterio'),
    ('cat:el-sabueso-de-los-baskerville', 'El sabueso de los Baskerville', 'misterio'),
    ('cat:la-verdad-sobre-el-caso-harry-quebert', 'La verdad sobre el caso Harry Quebert', 'misterio'),
    ('cat:el-nombre-de-la-rosa', 'El nombre de la rosa', 'misterio'),
    ('cat:orgullo-y-prejuicio', 'Orgullo y prejuicio', 'amor'),
    ('cat:bajo-la-misma-estrella', 'Bajo la misma estrella', 'amor'),
    ('cat:yo-antes-de-ti', 'Yo antes de ti', 'amor'),
    ('cat:el-amor-en-los-tiempos-del-colera', 'El amor en los tiempos del cólera', 'amor'),
    ('cat:gente-normal', 'Gente normal', 'amor'),
    ('cat:romeo-y-julieta', 'Romeo y Julieta', 'amor'),
    ('cat:los-puentes-de-madison', 'Los puentes de Madison', 'amor'),
    ('cat:cumbres-borrascosas', 'Cumbres borrascosas', 'amor'),
    ('cat:don-quijote-de-la-mancha', 'Don Quijote de la Mancha', 'clasico'),
    ('cat:madame-bovary', 'Madame Bovary', 'clasico'),
    ('cat:crimen-y-castigo', 'Crimen y castigo', 'clasico'),
    ('cat:el-gran-gatsby', 'El gran Gatsby', 'clasico'),
    ('cat:la-metamorfosis', 'La metamorfosis', 'clasico'),
    ('cat:frankenstein', 'Frankenstein', 'clasico'),
    ('cat:jane-eyre', 'Jane Eyre', 'clasico'),
    ('cat:el-extranjero', 'El extranjero', 'clasico'),
    ('cat:1984', '1984', 'ciencia-ficcion'),
    ('cat:un-mundo-feliz', 'Un mundo feliz', 'ciencia-ficcion'),
    ('cat:fahrenheit-451', 'Fahrenheit 451', 'ciencia-ficcion'),
    ('cat:dune', 'Dune', 'ciencia-ficcion'),
    ('cat:fundacion', 'Fundación', 'ciencia-ficcion'),
    ('cat:el-problema-de-los-tres-cuerpos', 'El problema de los tres cuerpos', 'ciencia-ficcion'),
    ('cat:cronicas-marcianas', 'Crónicas marcianas', 'ciencia-ficcion'),
    ('cat:la-mano-izquierda-de-la-oscuridad', 'La mano izquierda de la oscuridad', 'ciencia-ficcion'),
    ('cat:veinte-poemas-de-amor-y-una-cancion-desesperada', 'Veinte poemas de amor y una canción desesperada', 'poesia'),
    ('cat:romancero-gitano', 'Romancero gitano', 'poesia'),
    ('cat:rimas-y-leyendas', 'Rimas y leyendas', 'poesia'),
    ('cat:campos-de-castilla', 'Campos de Castilla', 'poesia'),
    ('cat:hojas-de-hierba', 'Hojas de hierba', 'poesia'),
    ('cat:canto-general', 'Canto general', 'poesia'),
    ('cat:la-divina-comedia', 'La divina comedia', 'poesia'),
    ('cat:el-profeta', 'El profeta', 'poesia'),
    ('cat:sapiens', 'Sapiens', 'historia'),
    ('cat:los-pilares-de-la-tierra', 'Los pilares de la Tierra', 'historia'),
    ('cat:el-infinito-en-un-junco', 'El infinito en un junco', 'historia'),
    ('cat:spqr', 'SPQR', 'historia'),
    ('cat:armas-germenes-y-acero', 'Armas, gérmenes y acero', 'historia'),
    ('cat:yo-claudio', 'Yo, Claudio', 'historia'),
    ('cat:el-capitan-alatriste', 'El capitán Alatriste', 'historia'),
    ('cat:el-nino-con-el-pijama-de-rayas', 'El niño con el pijama de rayas', 'historia'),
    ('cat:el-diario-de-ana-frank', 'El diario de Ana Frank', 'biografia'),
    ('cat:yo-soy-malala', 'Yo soy Malala', 'biografia'),
    ('cat:steve-jobs', 'Steve Jobs', 'biografia'),
    ('cat:vivir-para-contarla', 'Vivir para contarla', 'biografia'),
    ('cat:persepolis', 'Persépolis', 'biografia'),
    ('cat:mi-historia', 'Mi historia', 'biografia'),
    ('cat:una-educacion', 'Una educación', 'biografia'),
    ('cat:martes-con-mi-viejo-profesor', 'Martes con mi viejo profesor', 'biografia'),
    ('cat:harry-potter-y-la-piedra-filosofal', 'Harry Potter y la piedra filosofal', 'juvenil'),
    ('cat:los-juegos-del-hambre', 'Los juegos del hambre', 'juvenil'),
    ('cat:el-principito', 'El principito', 'juvenil'),
    ('cat:matilda', 'Matilda', 'juvenil'),
    ('cat:momo', 'Momo', 'juvenil'),
    ('cat:la-leccion-de-august', 'La lección de August', 'juvenil'),
    ('cat:percy-jackson-y-el-ladron-del-rayo', 'Percy Jackson y el ladrón del rayo', 'juvenil'),
    ('cat:charlie-y-la-fabrica-de-chocolate', 'Charlie y la fábrica de chocolate', 'juvenil')
  ) as v(clave, titulo, genero);
$$;
revoke all on function public.cafe_catalogo() from public, anon, authenticated;

-- ── Tus leídos, para el reparto (la app los manda; el servidor no tiene tu biblioteca) ──
create table if not exists public.cafe_tuyos (
  user_id uuid not null references auth.users (id) on delete cascade,
  clave   text not null check (char_length(clave) between 1 and 80 and clave not like 'cat:%'),
  titulo  text not null check (char_length(titulo) between 1 and 200),
  genero  text not null,
  primary key (user_id, clave)
);
alter table public.cafe_tuyos enable row level security;
revoke all on table public.cafe_tuyos from anon, authenticated;

create or replace function public.cafe_mis_titulos(titulos jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  n integer;
begin
  if me is null then
    raise exception 'cafe:sesion' using errcode = 'P0001';
  end if;
  delete from public.cafe_tuyos t where t.user_id = me;
  insert into public.cafe_tuyos (user_id, clave, titulo, genero)
  select me, t.clave, t.titulo, t.genero from public.cafe_titulos(titulos) t where t.clave not like 'cat:%';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.cafe_mis_titulos(jsonb) from public, anon;
grant execute on function public.cafe_mis_titulos(jsonb) to authenticated;

-- Los títulos de una compra: los tuyos que manda la app (nunca con clave del catálogo) y el catálogo entero
create or replace function public.cafe_titulos_y_catalogo(titulos jsonb)
returns table (clave text, titulo text, genero text)
language sql
immutable
set search_path = ''
as $$
  select t.clave, t.titulo, t.genero from public.cafe_titulos(titulos) t where t.clave not like 'cat:%'
  union all
  select c.clave, c.titulo, c.genero from public.cafe_catalogo() c;
$$;
revoke all on function public.cafe_titulos_y_catalogo(jsonb) from public, anon, authenticated;

-- Cuántos libros trae el reparto de cada nivel
create or replace function public.cafe_reparto_cupo(nivel integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when nivel >= 6 then 10 when nivel >= 3 then 8 else 6 end;
$$;
revoke all on function public.cafe_reparto_cupo(integer) from public, anon, authenticated;

-- ── El reparto de la mañana, gratis (se llama al abrir un día nuevo, desde cafe_abrir_dia) ──
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
  claves text[] := '{}';
  repuestos integer := 0;
  r record;
  presentes text[];
  g text;
  tuyos integer;
begin
  select * into l from public.cafe_locales x where x.user_id = uid;
  select greatest(0, least(public.cafe_reparto_cupo(l.nivel), public.cafe_huecos(l.nivel) - coalesce(sum(b.balda + b.caja), 0)))
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
  return jsonb_build_object('claves', to_jsonb(claves), 'granos', 0, 'gratis', true, 'repuestos', repuestos, 'faltan', 0);
end;
$$;
revoke all on function public.cafe_reparto(uuid, date) from public, anon, authenticated;

-- ── Comprar una caja y la de bienvenida (de 20261211120000_cafe_clientes.sql): ahora del catálogo y de tus leídos ──
create or replace function public.cafe_comprar_caja(genero text, clave text, titulos jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  l public.cafe_locales;
  precio integer;
  recibidos text[] := array[]::text[];
  r record;
  k integer := 0;
begin
  select * into l from public.cafe_locales x where x.user_id = me for update;
  if l.user_id is null or l.inaugurado is null then
    raise exception 'cafe:cerrado' using errcode = 'P0001';
  end if;
  if cafe_comprar_caja.clave is not null then
    precio := 9;
    select t.* into r from public.cafe_titulos_y_catalogo(titulos) t where t.clave = cafe_comprar_caja.clave;
    if r.clave is null then
      raise exception 'cafe:titulo' using errcode = 'P0001';
    end if;
    if l.granos < precio then
      raise exception 'cafe:granos' using errcode = 'P0001';
    end if;
    perform public.cafe_a_la_caja(me, r.clave, r.titulo, r.genero, 3);
    recibidos := array[r.clave, r.clave, r.clave];
  else
    precio := 10;
    if cafe_comprar_caja.genero is null or not (cafe_comprar_caja.genero = any (public.cafe_generos()))
       or not exists (select 1 from public.cafe_titulos_y_catalogo(titulos) t where t.genero = cafe_comprar_caja.genero) then
      raise exception 'cafe:genero' using errcode = 'P0001';
    end if;
    if l.granos < precio then
      raise exception 'cafe:granos' using errcode = 'P0001';
    end if;
    -- Cinco ejemplares: los títulos de ese género en un orden al azar, dando la vuelta si hay menos de cinco
    while k < 5 loop
      for r in select t.* from public.cafe_titulos_y_catalogo(titulos) t where t.genero = cafe_comprar_caja.genero order by random() loop
        exit when k >= 5;
        perform public.cafe_a_la_caja(me, r.clave, r.titulo, r.genero, 1);
        recibidos := recibidos || r.clave;
        k := k + 1;
      end loop;
    end loop;
  end if;
  update public.cafe_locales x set granos = x.granos - precio, actualizado = now() where x.user_id = me;
  return jsonb_build_object('cafe', public.cafe_json(me), 'libros', public.cafe_libros_json(me), 'caja', to_jsonb(recibidos));
end;
$$;
revoke all on function public.cafe_comprar_caja(text, text, jsonb) from public, anon;
grant execute on function public.cafe_comprar_caja(text, text, jsonb) to authenticated;

-- La caja de bienvenida: 8 ejemplares gratis, una sola vez, repartidos entre géneros para que haya variedad
create or replace function public.cafe_bienvenida(titulos jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  l public.cafe_locales;
  recibidos text[] := array[]::text[];
  r record;
  k integer := 0;
begin
  select * into l from public.cafe_locales x where x.user_id = me for update;
  if l.user_id is null or l.inaugurado is null then
    raise exception 'cafe:cerrado' using errcode = 'P0001';
  end if;
  if l.libros_bienvenida then
    raise exception 'cafe:bienvenida' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.cafe_titulos_y_catalogo(titulos)) then
    while k < 8 loop
      for r in select t.*, row_number() over (partition by t.genero order by random()) as fila from public.cafe_titulos_y_catalogo(titulos) t order by fila, random() loop
        exit when k >= 8;
        perform public.cafe_a_la_caja(me, r.clave, r.titulo, r.genero, 1);
        recibidos := recibidos || r.clave;
        k := k + 1;
      end loop;
    end loop;
  end if;
  update public.cafe_locales x set libros_bienvenida = true, actualizado = now() where x.user_id = me;
  return jsonb_build_object('cafe', public.cafe_json(me), 'libros', public.cafe_libros_json(me), 'caja', to_jsonb(recibidos));
end;
$$;
revoke all on function public.cafe_bienvenida(jsonb) from public, anon;
grant execute on function public.cafe_bienvenida(jsonb) to authenticated;

-- ── Servir (de 20261219120000_cafe_influencer.sql): el ejemplar de uno de tus leídos paga 6 ──
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
    -- 1.139: uno de tus leídos, «lo recomiendas tú», paga 6; uno del catálogo, 4
    extra := case when libro like 'cat:%' then 4 else 6 end;
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

-- ── Servir al influencer (de 20261219120000_cafe_influencer.sql): igual, el ejemplar tuyo paga 6 ──
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
    -- 1.139: uno de tus leídos, «lo recomiendas tú», paga 6; uno del catálogo, 4
    extra := case when libro like 'cat:%' then 4 else 6 end;
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
