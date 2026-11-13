// 1.120 · El café-librería del bajo en el Supabase simulado: las RPC de `20261210120000_cafe_local.sql` con las mismas
// reglas que el servidor (nombre de la lista, una sola inauguración, plano dentro de la cuadrícula y sin solapes, copias
// del café y de casa contando el piso). Se engancha después de `mock.attach` (la última ruta manda). Sin `cafe`, el
// servidor no tiene la migración (404 PGRST202), como antes de aplicarla.
import { CAFE_MUEBLES, CAFE_NOMBRES, PLANO_INICIAL, asientosDe, cabe, cuenta, deCasa, maxCosas, medidas } from '../src/features/edificio/cafe/cafeCatalogo';
import { TICKETS_NIVEL, cartaDe, granosHito, nivelDe, novedades, ticketsDelDia, umbralHito } from '../src/features/edificio/cafe/cafeNiveles';
import { SUPABASE } from './mockSupabase';
import {
  BIENVENIDA,
  CAJA_GENERO,
  CAJA_TITULO,
  EXTRA_LLEVADO,
  GENEROS,
  MAX_HABITUALES,
  PARTES,
  aciertosDe,
  bebidasDe,
  opcionesDe,
  clientesDelNivel,
  estrellasDe,
  huecosDelNivel,
  premio,
  recetaPide,
} from '../src/features/edificio/cafe/cafeClientes';

const json = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
const falla = (route, message) => json(route, { code: 'P0001', message }, 400);

/**
 * `estado`: { inaugurado, nombre, granos, plano, inventario } o null (sin migración). `piso()`: { copias, layout } de casa.
 * `clientes`: { hoy, semillas, quienes, frases } (el último cliente es el excéntrico: `quien` = semilla % 6) para simular también `20261211120000_cafe_clientes.sql` (1.121): el día solo
 * vale `hoy` o el anterior, los clientes los da el nivel, cada uno se atiende una vez y hay como mucho 2 habituales; sin él,
 * el servidor no tiene esa migración.
 * Libros en cajas (§121.3): `estado.libros` = { bienvenida, libros: [{ clave, titulo, genero, caja, balda }] }; el azar de
 * las cajas de género, aquí, en orden (para que las capturas sean siempre iguales).
 * Jornadas de prueba (1.126, `20261215120000_cafe_probador.sql`): con `clientes.jornada` (AAAA-MM-DD), la cuenta prueba y
 * juega ese día; `cafe_nueva_jornada` abre el siguiente si ya está todo el mundo atendido. `clientes.atendidosEn`: los días
 * (AAAA-MM-DD) que empiezan con todo el mundo ya atendido (2 estrellas, sin libro).
 */
export async function simularCafe(page, estado, { piso = () => ({ copias: {}, layout: { items: [] } }), clientes = null } = {}) {
  const c = estado ? { inaugurado: false, nombre: null, nivel: 1, reputacion: 0, granos: 0, plano: { v: 1, items: [] }, inventario: {}, escaparate: [], llamadas: [], ...estado } : null;
  const vista = () => ({ nombre: c.nombre, nivel: c.nivel, reputacion: c.reputacion, granos: c.granos, plano: c.plano, inaugurado: c.inaugurado, inventario: c.inventario, escaparate: c.escaparate });
  // ── Libros en cajas ──
  const lib = { bienvenida: Boolean(estado?.libros?.bienvenida), libros: Object.fromEntries((estado?.libros?.libros ?? []).map((b) => [b.clave, { ...b }])) };
  if (c) c.lib = lib;
  const librosJson = () => ({
    huecos: huecosDelNivel(c.nivel),
    bienvenida: lib.bienvenida,
    libros: Object.values(lib.libros)
      .filter((b) => b.caja > 0 || b.balda > 0)
      .sort((a, b) => a.titulo.localeCompare(b.titulo) || a.clave.localeCompare(b.clave)),
  });
  const titulosValidos = (ts) => Array.isArray(ts) && ts.length <= 200 && ts.every((x) => x?.clave && x.titulo && GENEROS.some((g) => g.id === x.genero));
  const aLaCaja = (x, n) => {
    const b = (lib.libros[x.clave] ??= { clave: x.clave, titulo: x.titulo, genero: x.genero, caja: 0, balda: 0 });
    b.caja += n;
  };
  let giro = 0;
  function libros(route, rpc, body) {
    if (!c.inaugurado) return falla(route, 'cafe:cerrado');
    const caja = [];
    if (rpc === 'cafe_bienvenida') {
      if (lib.bienvenida) return falla(route, 'cafe:bienvenida');
      if (!titulosValidos(body.titulos)) return falla(route, 'cafe:titulos');
      // Repartidos por género: uno de cada género por vuelta
      const porGenero = {};
      for (const x of body.titulos) (porGenero[x.genero] ??= []).push(x);
      const filas = [];
      for (let k = 0; filas.length < body.titulos.length; k += 1) for (const g of Object.values(porGenero)) if (g[k]) filas.push(g[k]);
      for (let k = 0; filas.length && caja.length < BIENVENIDA; k += 1) {
        const x = filas[k % filas.length];
        aLaCaja(x, 1);
        caja.push(x.clave);
      }
      lib.bienvenida = true;
    }
    if (rpc === 'cafe_comprar_caja') {
      if (!titulosValidos(body.titulos)) return falla(route, 'cafe:titulos');
      if (body.clave) {
        const x = body.titulos.find((y) => y.clave === body.clave);
        if (!x) return falla(route, 'cafe:titulo');
        if (c.granos < CAJA_TITULO.precio) return falla(route, 'cafe:granos');
        aLaCaja(x, CAJA_TITULO.ejemplares);
        caja.push(...Array(CAJA_TITULO.ejemplares).fill(x.clave));
        c.granos -= CAJA_TITULO.precio;
      } else {
        const del = body.titulos.filter((y) => y.genero === body.genero);
        if (!del.length) return falla(route, 'cafe:genero');
        if (c.granos < CAJA_GENERO.precio) return falla(route, 'cafe:granos');
        for (let k = 0; k < CAJA_GENERO.ejemplares; k += 1) {
          const x = del[(giro + k) % del.length];
          aLaCaja(x, 1);
          caja.push(x.clave);
        }
        giro += 1;
        c.granos -= CAJA_GENERO.precio;
      }
    }
    if (rpc === 'cafe_colocar') {
      if ((body.poner?.length ?? 0) > 50 || (body.quitar?.length ?? 0) > 50) return falla(route, 'cafe:colocar');
      for (const k of body.quitar ?? []) {
        const b = lib.libros[k];
        if (b?.balda > 0) Object.assign(b, { balda: b.balda - 1, caja: b.caja + 1 });
      }
      for (const k of body.poner ?? []) {
        const puestos = Object.values(lib.libros).reduce((s, b) => s + b.balda, 0);
        if (puestos >= huecosDelNivel(c.nivel)) break;
        const b = lib.libros[k];
        if (b?.caja > 0) Object.assign(b, { caja: b.caja - 1, balda: b.balda + 1 });
      }
    }
    return json(route, { cafe: vista(), libros: librosJson(), caja });
  }
  await page.route(`${SUPABASE}/rest/v1/rpc/cafe_*`, async (route) => {
    const rpc = new URL(route.request().url()).pathname.split('/').pop();
    if (!c) return json(route, { code: 'PGRST202', message: 'Could not find the function' }, 404);
    const body = route.request().postDataJSON() ?? {};
    c.llamadas.push({ rpc, body });
    if (rpc === 'cafe_mio') return json(route, vista());
    if (rpc === 'cafe_inaugurar') {
      if (!CAFE_NOMBRES.includes(body.nombre)) return falla(route, 'cafe:nombre');
      if (c.inaugurado) return falla(route, 'cafe:ya');
      Object.assign(c, { inaugurado: true, nombre: body.nombre, plano: structuredClone(PLANO_INICIAL), inventario: cuenta(PLANO_INICIAL) });
      return json(route, vista());
    }
    if (rpc === 'cafe_guardar') {
      if (!c.inaugurado) return falla(route, 'cafe:cerrado');
      const items = body.plano?.items;
      const limpio = { v: 1, items: [] };
      const uids = new Set();
      for (const it of Array.isArray(items) ? items : []) {
        const valido = medidas(it.id) && (CAFE_MUEBLES.some((m) => m.id === it.id) || deCasa(it.id)) && !uids.has(it.uid) && cabe(limpio, it, it.uid, c.nivel);
        if (!valido) return falla(route, 'cafe:plano');
        uids.add(it.uid);
        limpio.items.push(it);
      }
      if (!Array.isArray(items) || items.length > maxCosas(c.nivel)) return falla(route, 'cafe:plano');
      const n = cuenta(limpio);
      const casa = piso();
      const enPiso = cuenta(casa.layout);
      for (const [id, k] of Object.entries(n)) {
        const delCafe = CAFE_MUEBLES.some((m) => m.id === id);
        if (delCafe ? k > (c.inventario[id] ?? 0) : k + (enPiso[id] ?? 0) > (casa.copias[id] ?? 0)) return falla(route, `cafe:copias:${id}`);
      }
      c.plano = limpio;
      return json(route, vista());
    }
    if (rpc === 'cafe_comprar') {
      const m = CAFE_MUEBLES.find((x) => x.id === body.mueble);
      if (!m || m.nivel > c.nivel || (m.hito && c.reputacion < umbralHito(m.nivel, m.hito))) return falla(route, 'cafe:mueble');
      if (c.granos < m.precio) return falla(route, 'cafe:granos');
      c.granos -= m.precio;
      c.inventario[m.id] = (c.inventario[m.id] ?? 0) + 1;
      return json(route, vista());
    }
    // Bloque 4b (1.123): el escaparate (nivel 5, hasta tres títulos) y lo que se ve desde la calle
    if (rpc === 'cafe_poner_escaparate') {
      if (!c.inaugurado) return falla(route, 'cafe:cerrado');
      if (c.nivel < 5) return falla(route, 'cafe:nivel');
      if (!Array.isArray(body.titulos) || body.titulos.length > 3 || !titulosValidos(body.titulos)) return falla(route, 'cafe:titulos');
      c.escaparate = body.titulos.map(({ clave, titulo, genero }) => ({ clave, titulo, genero }));
      return json(route, vista());
    }
    if (rpc === 'cafe_fachada') return json(route, { inaugurado: c.inaugurado, nombre: c.nombre, nivel: c.nivel, escaparate: c.nivel >= 5 ? c.escaparate : [] });
    if (clientes?.jornada && rpc === 'cafe_jornada') return json(route, jornada);
    if (clientes?.jornada && rpc === 'cafe_nueva_jornada') {
      const d = dias[jornada];
      if (d && Object.keys(d.servidos).length < d.clientes + d.habituales) return falla(route, 'cafe:pendientes');
      const sig = new Date(`${jornada}T12:00:00Z`);
      sig.setUTCDate(sig.getUTCDate() + 1);
      jornada = sig.toISOString().slice(0, 10);
      c.llamadas.push({ rpc, jornada });
      return json(route, jornada);
    }
    if (clientes && ['cafe_dia', 'cafe_habitual', 'cafe_servir'].includes(rpc)) return diaDelCafe(route, rpc, body);
    if (clientes && ['cafe_bienvenida', 'cafe_comprar_caja', 'cafe_colocar'].includes(rpc)) return libros(route, rpc, body);
    return json(route, { code: 'PGRST202', message: 'no existe' }, 404);
  });
  // ── Los clientes del día (bloque 3) ──
  const dias = {};
  let jornada = clientes?.jornada ?? null;
  const pizarra = [];
  const ayer = clientes ? new Date(new Date(`${clientes.hoy}T12:00:00Z`).getTime() - 864e5).toISOString().slice(0, 10) : null;
  const semilla = (k) => clientes.semillas?.[k] ?? 1000 + k * 7919;
  const diaJson = (d) => ({
    dia: d.dia,
    carta: d.carta,
    tickets: d.tickets,
    clientes: Array.from({ length: d.clientes }, (_, i) => ({
      n: i + 1,
      semilla: semilla(i),
      servido: Boolean(d.servidos[i + 1]),
      encaja: d.servidos[i + 1]?.encaja ?? null,
      estrellas: d.servidos[i + 1]?.estrellas ?? null,
      excentrico: i + 1 === d.clientes,
      quien: i + 1 === d.clientes ? semilla(i) % 6 : null,
    })),
    habituales: Array.from({ length: d.habituales }, (_, i) => ({
      n: 101 + i,
      quien: clientes.quienes?.[i] ?? i * 5,
      semilla: semilla(10 + i),
      servido: Boolean(d.servidos[101 + i]),
      encaja: d.servidos[101 + i]?.encaja ?? null,
      estrellas: d.servidos[101 + i]?.estrellas ?? null,
    })),
    pizarra: pizarra.slice(0, 6),
  });
  function diaDelCafe(route, rpc, body) {
    if (body.dia !== clientes.hoy && body.dia !== ayer && body.dia !== jornada) return falla(route, 'cafe:dia');
    if (!c.inaugurado) return falla(route, 'cafe:cerrado');
    const d = (dias[body.dia] ??= { dia: body.dia, clientes: clientesDelNivel(c.nivel, asientosDe(c.plano)), habituales: 0, servidos: {}, carta: cartaDe(c.reputacion), tickets: 0 });
    if (clientes.atendidosEn?.includes(d.dia) && !d.preparado) {
      d.preparado = true;
      for (let k = 1; k <= d.clientes; k += 1) d.servidos[k] = { encaja: false, receta: null, estrellas: 2, libro: null };
    }
    let dado = null;
    let progreso = null;
    if (rpc === 'cafe_habitual') d.habituales = Math.min(MAX_HABITUALES, d.habituales + 1);
    if (rpc === 'cafe_servir') {
      const n = body.cliente;
      if (!((n >= 1 && n <= d.clientes) || (n >= 101 && n <= 100 + d.habituales))) return falla(route, 'cafe:cliente');
      const r = body.receta;
      const carta = cartaDe(c.reputacion);
      const valida =
        Array.isArray(r) && r.length === 4 && bebidasDe(carta).some((b) => b.id === r[0]) && PARTES.slice(1).every((parte, k) => opcionesDe(parte.id, carta).some((o) => o.id === r[k + 1]));
      if (!valida) return falla(route, 'cafe:receta');
      if (d.servidos[n]) return falla(route, 'cafe:servido');
      const habitual = n > 100;
      const excentrico = !habitual && n === d.clientes;
      const quien = habitual ? (clientes.quienes?.[n - 101] ?? (n - 101) * 5) : semilla(n - 1) % 6;
      const pide = recetaPide(habitual ? { n, quien } : { n, semilla: semilla(n - 1) }, d.carta);
      const aciertos = aciertosDe(r, pide);
      // El libro solo cuenta si está en la balda; si encaja, se lo lleva y paga 2 granos más
      const lleva = Boolean(body.encaja) && Boolean(body.libro) && lib.libros[body.libro]?.balda > 0;
      const extra = lleva ? EXTRA_LLEVADO : 0;
      if (lleva) lib.libros[body.libro].balda -= 1;
      const estrellas = estrellasDe(aciertos, lleva);
      const p = premio(habitual ? 'habitual' : excentrico ? 'excentrico' : 'cliente', estrellas);
      d.servidos[n] = { encaja: lleva, receta: r, estrellas, libro: body.libro ?? null };
      c.granos = Math.min(100000, c.granos + p.granos + extra);
      const antes = c.reputacion;
      c.reputacion += p.reputacion;
      // El progreso (bloque 4a): niveles con sus tickets (el 1, con el primer servicio), hitos (el 3.º, 15 granos) y los del día
      const nov = novedades(antes, c.reputacion);
      const niveles = [...(c.cobrados?.includes(1) ? [] : [{ nivel: 1, tickets: TICKETS_NIVEL[1] }]), ...nov.niveles];
      c.cobrados = [...new Set([...(c.cobrados ?? []), ...niveles.map((x) => x.nivel)])];
      const granosDeHitos = nov.hitos.filter((h) => h.hito === 3).reduce((s, h) => s + granosHito(h.nivel), 0);
      const de = c.nivel;
      c.nivel = Math.max(c.nivel, nivelDe(c.reputacion));
      const ticketsDia = d.tickets ? 0 : ticketsDelDia(c.nivel);
      d.tickets ||= ticketsDia;
      c.granos = Math.min(100000, c.granos + granosDeHitos);
      const tk = niveles.reduce((s, x) => s + x.tickets, 0) + ticketsDia;
      c.tickets = (c.tickets ?? 0) + tk;
      progreso = { de, a: c.nivel, niveles, hitos: nov.hitos.map(({ nivel, hito }) => ({ nivel, hito })), granos: granosDeHitos, tickets_dia: ticketsDia, tickets: tk };
      dado = { ...p, granos: p.granos + extra, llevado: lleva, extra, estrellas, aciertos, pide, frase: null, dorada: false };
      if (habitual) {
        dado.frase = clientes.frases?.[n - 101] ?? 2;
        pizarra.unshift({ dia: d.dia, quien, frase: dado.frase, dorada: false });
      } else if (excentrico && estrellas === 3) {
        Object.assign(dado, { frase: quien, dorada: true });
        pizarra.unshift({ dia: d.dia, quien, frase: quien, dorada: true });
      }
    }
    return json(route, { cafe: vista(), dia: diaJson(d), libros: librosJson(), dado, progreso });
  }
  return c;
}
