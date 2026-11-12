// 1.120 · El café-librería del bajo en el Supabase simulado: las RPC de `20261210120000_cafe_local.sql` con las mismas
// reglas que el servidor (nombre de la lista, una sola inauguración, plano dentro de la cuadrícula y sin solapes, copias
// del café y de casa contando el piso). Se engancha después de `mock.attach` (la última ruta manda). Sin `cafe`, el
// servidor no tiene la migración (404 PGRST202), como antes de aplicarla.
import { CAFE_MUEBLES, CAFE_NOMBRES, PLANO_INICIAL, cabe, cuenta, deCasa, medidas } from '../src/features/edificio/cafe/cafeCatalogo';
import { SUPABASE } from './mockSupabase';
import { MAX_HABITUALES, PARTES, aciertosDe, bebidasDelNivel, clientesDelNivel, estrellasDe, premio, recetaPide } from '../src/features/edificio/cafe/cafeClientes';

const json = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
const falla = (route, message) => json(route, { code: 'P0001', message }, 400);

/**
 * `estado`: { inaugurado, nombre, granos, plano, inventario } o null (sin migración). `piso()`: { copias, layout } de casa.
 * `clientes`: { hoy, semillas, quienes, frases } (el último cliente es el excéntrico: `quien` = semilla % 6) para simular también `20261211120000_cafe_clientes.sql` (1.121): el día solo
 * vale `hoy` o el anterior, los clientes los da el nivel, cada uno se atiende una vez y hay como mucho 2 habituales; sin él,
 * el servidor no tiene esa migración.
 */
export async function simularCafe(page, estado, { piso = () => ({ copias: {}, layout: { items: [] } }), clientes = null } = {}) {
  const c = estado ? { inaugurado: false, nombre: null, nivel: 1, reputacion: 0, granos: 0, plano: { v: 1, items: [] }, inventario: {}, llamadas: [], ...estado } : null;
  const vista = () => ({ nombre: c.nombre, nivel: c.nivel, reputacion: c.reputacion, granos: c.granos, plano: c.plano, inaugurado: c.inaugurado, inventario: c.inventario });
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
        const valido = medidas(it.id) && (CAFE_MUEBLES.some((m) => m.id === it.id) || deCasa(it.id)) && !uids.has(it.uid) && cabe(limpio, it);
        if (!valido) return falla(route, 'cafe:plano');
        uids.add(it.uid);
        limpio.items.push(it);
      }
      if (!Array.isArray(items) || items.length > 24) return falla(route, 'cafe:plano');
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
      if (!m) return falla(route, 'cafe:mueble');
      if (c.granos < m.precio) return falla(route, 'cafe:granos');
      c.granos -= m.precio;
      c.inventario[m.id] = (c.inventario[m.id] ?? 0) + 1;
      return json(route, vista());
    }
    if (clientes && ['cafe_dia', 'cafe_habitual', 'cafe_servir'].includes(rpc)) return diaDelCafe(route, rpc, body);
    return json(route, { code: 'PGRST202', message: 'no existe' }, 404);
  });
  // ── Los clientes del día (bloque 3) ──
  const dias = {};
  const pizarra = [];
  const ayer = clientes ? new Date(new Date(`${clientes.hoy}T12:00:00Z`).getTime() - 864e5).toISOString().slice(0, 10) : null;
  const semilla = (k) => clientes.semillas?.[k] ?? 1000 + k * 7919;
  const diaJson = (d) => ({
    dia: d.dia,
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
    if (body.dia !== clientes.hoy && body.dia !== ayer) return falla(route, 'cafe:dia');
    if (!c.inaugurado) return falla(route, 'cafe:cerrado');
    const d = (dias[body.dia] ??= { dia: body.dia, clientes: clientesDelNivel(c.nivel), habituales: 0, servidos: {} });
    let dado = null;
    if (rpc === 'cafe_habitual') d.habituales = Math.min(MAX_HABITUALES, d.habituales + 1);
    if (rpc === 'cafe_servir') {
      const n = body.cliente;
      if (!((n >= 1 && n <= d.clientes) || (n >= 101 && n <= 100 + d.habituales))) return falla(route, 'cafe:cliente');
      const r = body.receta;
      const valida = Array.isArray(r) && r.length === 4 && bebidasDelNivel(c.nivel).some((b) => b.id === r[0]) && PARTES.slice(1).every((parte, k) => parte.opciones.some((o) => o.id === r[k + 1]));
      if (!valida) return falla(route, 'cafe:receta');
      if (d.servidos[n]) return falla(route, 'cafe:servido');
      const habitual = n > 100;
      const excentrico = !habitual && n === d.clientes;
      const quien = habitual ? (clientes.quienes?.[n - 101] ?? (n - 101) * 5) : semilla(n - 1) % 6;
      const pide = recetaPide(habitual ? { n, quien } : { n, semilla: semilla(n - 1) });
      const aciertos = aciertosDe(r, pide);
      const estrellas = estrellasDe(aciertos, Boolean(body.encaja));
      const p = premio(habitual ? 'habitual' : excentrico ? 'excentrico' : 'cliente', estrellas);
      d.servidos[n] = { encaja: Boolean(body.encaja), receta: r, estrellas };
      c.granos = Math.min(100000, c.granos + p.granos);
      c.reputacion += p.reputacion;
      dado = { ...p, estrellas, aciertos, pide, frase: null, dorada: false };
      if (habitual) {
        dado.frase = clientes.frases?.[n - 101] ?? 2;
        pizarra.unshift({ dia: d.dia, quien, frase: dado.frase, dorada: false });
      } else if (excentrico && estrellas === 3) {
        Object.assign(dado, { frase: quien, dorada: true });
        pizarra.unshift({ dia: d.dia, quien, frase: quien, dorada: true });
      }
    }
    return json(route, { cafe: vista(), dia: diaJson(d), dado });
  }
  return c;
}
