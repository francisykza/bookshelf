-- Místicos, bloque 3 (docs/qa/misticos.md; cifras aprobadas por Francisco el 2-11-2026, «Sí, esas cifras»): salen en
-- los sobres.
--   · Solo en «Edición coleccionista»: cada mueble tiene un 1 % de ser un místico, y de esos, 1 de cada 4 es
--     legendario (0,25 % del total). Ese 1 % se resta de lo raro (del 15 % al 14 %): lo poco común, lo común y el pity
--     actual no cambian.
--   · Sin pity propio. Un místico cuenta como «algo raro» para el pity de siempre (es mejor que raro); el pity sigue
--     asegurando un raro, nunca un místico.
--   · Los demás sobres no los dan nunca.
-- Necesita las migraciones de la tienda (1.67), los muebles de la tanda 2 y los místicos (1.72). ADITIVA y
-- re-ejecutable: redefine piso_sobre y piso_abrir_sobre con lo mismo de antes más el sorteo del místico. No borra datos
-- ni cambia políticas. La aplica Francisco en el SQL Editor. Probada con PGlite
-- (src/features/edificio/__tests__/misticos.rls.test.js).

-- Los sobres de la temporada (los mismos que SOBRES en economy.js), con el místico en el de coleccionista
create or replace function public.piso_sobre(sobre text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case sobre
    when 'salon' then jsonb_build_object('coste1', 10, 'coste5', 45, 'raro', 0.06, 'poco', 0.24,
      'muebles', jsonb_build_array('sillon', 'sofa', 'silla', 'banco', 'mesa-baja', 'mesa', 'mesilla', 'estanteria', 'cama',
        'puf', 'mecedora', 'escritorio', 'comoda', 'baul'))
    when 'luces' then jsonb_build_object('coste1', 10, 'coste5', 45, 'raro', 0.06, 'poco', 0.24,
      'muebles', jsonb_build_array('lampara-pie', 'estufa', 'lampara-mesa', 'ventana', 'cuadro', 'reloj', 'guirnalda',
        'velas', 'farol', 'estante-pared', 'espejo', 'mapa'))
    when 'balcon' then jsonb_build_object('coste1', 10, 'coste5', 45, 'raro', 0.06, 'poco', 0.24,
      'muebles', jsonb_build_array('planta-grande', 'planta-pequena', 'libros', 'radio', 'tetera', 'gato', 'alfombra', 'alfombra-redonda',
        'cactus', 'monstera', 'pecera', 'globo', 'tocadiscos', 'taza', 'alfombra-rayas'))
    when 'coleccion' then jsonb_build_object('coste1', 25, 'coste5', 110, 'raro', 0.14, 'poco', 0.35, 'mistico', 0.01,
      'legendario', 0.25, 'muebles', null)
    else null
  end;
$$;

-- Abrir un sobre de la pared, de 1 o de 5 muebles. Devuelve { premios: [{ mueble, rareza, nuevo }], inventario }.
-- Igual que en la 1.67, con el místico: la tirada empieza por él (0 … 'mistico'), luego lo raro y lo poco común.
create or replace function public.piso_abrir_sobre(sobre text, cuantos integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.piso_yo();
  def jsonb := public.piso_sobre(sobre);
  coste integer;
  saldo integer;
  pity integer;
  premios jsonb := '[]'::jsonb;
  mejor_que_comun boolean := false;
  r text;
  tirada double precision;
  mist double precision;
  elegido text;
  tenia integer;
  i integer;
begin
  if def is null then
    raise exception 'Ese sobre no está a la venta.' using errcode = 'P0001';
  end if;
  coste := case cuantos when 1 then (def ->> 'coste1')::integer when 5 then (def ->> 'coste5')::integer else null end;
  if coste is null then
    raise exception 'Los sobres son de 1 o de 5.' using errcode = 'P0001';
  end if;
  mist := coalesce((def ->> 'mistico')::double precision, 0);
  select c.tickets, c.sin_raro into saldo, pity from public.piso_cuentas c where c.user_id = me for update;
  if saldo < coste then
    raise exception 'No tienes tickets suficientes.' using errcode = 'P0001';
  end if;
  for i in 1..cuantos loop
    tirada := random();
    r := case
      when tirada < mist then (case when random() < (def ->> 'legendario')::double precision then 'legendario' else 'mistico' end)
      when tirada < mist + (def ->> 'raro')::double precision then 'raro'
      when tirada < mist + (def ->> 'raro')::double precision + (def ->> 'poco')::double precision then 'poco-comun'
      else 'comun' end;
    -- Pity: el mueble 15 seguido sin nada raro (contado entre todos los sobres) es raro seguro
    if pity >= 14 and r not in ('raro', 'mistico', 'legendario') then
      r := 'raro';
    end if;
    -- En el de 5, el último asegura algo mejor que común si aún no ha salido
    if cuantos = 5 and i = 5 and not mejor_que_comun and r = 'comun' then
      r := 'poco-comun';
    end if;
    if r <> 'comun' then
      mejor_que_comun := true;
    end if;
    pity := case when r in ('raro', 'mistico', 'legendario') then 0 else pity + 1 end;
    elegido := public.piso_al_azar(r, case when r in ('mistico', 'legendario') then null else def -> 'muebles' end);
    select coalesce((select v.copias from public.piso_inventario v where v.user_id = me and v.mueble = elegido), 0) into tenia;
    perform public.piso_sumar(me, elegido, 1);
    premios := premios || jsonb_build_object('mueble', elegido, 'rareza', r, 'nuevo', tenia = 0);
  end loop;
  update public.piso_cuentas set tickets = tickets - coste, sin_raro = pity where user_id = me;
  return jsonb_build_object('premios', premios, 'inventario', public.piso_mi_inventario());
end;
$$;
revoke all on function public.piso_abrir_sobre(text, integer) from public, anon;
grant execute on function public.piso_abrir_sobre(text, integer) to authenticated;
