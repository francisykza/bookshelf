// 1.120 · El café-librería del bajo en el Supabase simulado: las RPC de `20261210120000_cafe_local.sql` con las mismas
// reglas que el servidor (nombre de la lista, una sola inauguración, plano dentro de la cuadrícula y sin solapes, copias
// del café y de casa contando el piso). Se engancha después de `mock.attach` (la última ruta manda). Sin `cafe`, el
// servidor no tiene la migración (404 PGRST202), como antes de aplicarla.
import { TAREAS, gradoDe } from '../src/features/edificio/cafe/cafeCuaderno';
import { CAFE_MUEBLES, CAFE_NOMBRES, PLANO_INICIAL, asientosDe, cabe, cuenta, deCasa, maxCosas, medidas } from '../src/features/edificio/cafe/cafeCatalogo';
import { BONO_TUESTE, TAZAS_MAX, TAZAS_SACO, TICKETS_NIVEL, cartaDe, desdeNivel, granosHito, nivelDe, novedades, sacoListo, ticketsDelDia, tuesteAbierto, umbralHito } from '../src/features/edificio/cafe/cafeNiveles';
import { ARENA_MARGEN, ARENA_SEGUNDOS, INFLUENCERS, NIVELES_INFLUENCER, VIRALES } from '../src/features/edificio/cafe/cafeInfluencers';
import { SUPABASE } from './mockSupabase';
import {
  BIENVENIDA,
  CAJA_GENERO,
  CAJA_TITULO,
  EXTRA_LLEVADO,
  GENEROS,
  MAX_HABITUALES,
  aciertosDe,
  recetaValida,
  clientesDelNivel,
  estrellasDe,
  huecosDelNivel,
  premio,
  recetaPide,
} from '../src/features/edificio/cafe/cafeClientes';
import { estrellasTotal, extraLibro, repartoDelNivel, REPARTO_TUYOS_CADA } from '../src/features/edificio/cafe/cafeLibreria';
import { CATALOGO_LIBROS } from '../src/features/edificio/cafe/cafeCatalogoLibros';
import { PRIMER_ENCARGO, TALLER_NIVEL, estrellasTaller, premioTaller } from '../src/features/edificio/cafe/cafeTaller';

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
 * El tostadero (1.127, `20261216120000_cafe_tostadero.sql`): `estado.tazas` y `estado.sacoDia` (AAAA-MM-DD o null);
 * `cafe_recoger_saco` da 5 tazas una vez al día, y servir el tueste gasta una y, a quien lo pidió, paga el bono.
 * 1.130 (`20261218120000_cafe_libreria.sql`): `cafe_entregar` (el libro en tres partes, estrellas de siete, +4 si aciertas el
 * género), el reparto al abrir un día nuevo (lo vendido sin reponer, hasta 10, a 2 granos) y el dominio de Pilar en el café
 * (`estado.dominio`: lo que ya se trae servido, por ejemplo { cafe: 12 }); `clientes.vendidos`: lo vendido otro día, sin
 * reponer (las claves). Con `estado.sinEntregar`, el servidor aún no
 * tiene la migración (`cafe_entregar` da 404 y la app sirve con `cafe_servir`).
 * 1.132 (`20261219120000_cafe_influencer.sql`), solo con `clientes.influencer` ({ segundos }: los que dice el servidor que
 * pasaron desde la barra; sin ellos, los de verdad): con la barra llena, la reputación de más espera aparte (`estado.espera`) y
 * llega el influencer de la subida (300 + nivel); `cafe_influencer_empezar` da la vuelta al reloj y `cafe_influencer_entregar`
 * le sirve (a tiempo, como el excéntrico; viral con 3 estrellas) y sube el café. `estado.influencers`: { [nivel]: { despedido,
 * dia, estrellas, a_tiempo, viral, viral_dia } } de antes. El siguiente día nuevo, 3 virales (201 a 203). La pizarra ya no va.
 * 1.139 (`20261222120000_cafe_catalogo.sql`): el catálogo del café (CATALOGO_LIBROS) entra en las cajas y en la bienvenida,
 * `cafe_mis_titulos` guarda tus leídos, el reparto del día nuevo es gratis (6 / 8 / 10 según el nivel, nunca más que los huecos
 * libres: primero lo vendido, después uno de cada tres tuyo y el resto del catálogo, con al menos 3 géneros) y el ejemplar
 * tuyo que se lleva el cliente paga 6. Aquí sin azar: el catálogo, en orden. Solo con `clientes.reparto` el día nuevo
 * trae reparto (las pruebas de antes no lo esperan).
 */
export async function simularCafe(page, estado, { piso = () => ({ copias: {}, layout: { items: [] } }), clientes = null, taller = null, social = null, pilar = null } = {}) {
  const c = estado ? { inaugurado: false, nombre: null, nivel: 1, reputacion: 0, granos: 0, plano: { v: 1, items: [] }, inventario: {}, escaparate: [], tazas: 0, sacoDia: null, llamadas: [], espera: 0, influencers: {}, ...estado } : null;
  if (c) c.influencers = structuredClone(c.influencers);
  const conInf = Boolean(clientes?.influencer);
  // 1.142: el cuaderno de Pilar (`pilar`: { caja, hucha, pizarra, guardado }); sin `pilar`, sin la migración
  const pil = pilar ? { caja: 0, hucha: 0, pizarra: 0, guardado: 0, dado: { hucha: 0, colocados: 0, clientes: 0, pedidos: 0 }, ...pilar } : null;
  if (c && pil) c.pilar = pil;
  const HUCHA_DIA = [0, 8, 15, 25];
  const vista = () => ({
    nombre: c.nombre,
    nivel: c.nivel,
    reputacion: c.reputacion,
    granos: c.granos,
    plano: c.plano,
    inaugurado: c.inaugurado,
    inventario: c.inventario,
    escaparate: c.escaparate,
    tostadero: { tazas: c.tazas, saco_dia: c.sacoDia },
    dominio: dominio(),
    ...(conInf ? { espera: c.espera, fotos: NIVELES_INFLUENCER.filter((n) => c.influencers[n]?.viral) } : {}),
    ...(pil ? { pilar: { caja: pil.caja, hucha: pil.hucha, pizarra: pil.pizarra, hucha_dia: HUCHA_DIA[pil.hucha], hucha_lista: pil.guardado, dado: pil.dado } } : {}),
  });
  // 1.130: las servidas de 2 estrellas o más por bebida (y lo de la carta con gesto), sobre lo que ya se traía
  const dominio = () => {
    const out = { ...(c.dominio ?? {}) };
    for (const d of Object.values(dias))
      for (const sv of Object.values(d.servidos))
        if (sv.receta && sv.estrellas >= 2)
          for (const k of [sv.receta[0], sv.receta[1] === 'casa' ? 'grano:casa' : null, ['nata', 'vainilla', 'brulee'].includes(sv.receta[3]) ? `toque:${sv.receta[3]}` : null]) if (k) out[k] = (out[k] ?? 0) + 1;
    return out;
  };
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
  // 1.139: tus leídos (los guarda cafe_mis_titulos) y los títulos de una compra: los tuyos que manda la app y el catálogo
  let tuyos = [];
  const conCatalogo = (ts) => [...ts.filter((x) => !String(x.clave).startsWith('cat:')), ...CATALOGO_LIBROS.map(({ clave, titulo, genero }) => ({ clave, titulo, genero }))];
  const titulosValidos = (ts) => Array.isArray(ts) && ts.length <= 200 && ts.every((x) => x?.clave && x.titulo && GENEROS.some((g) => g.id === x.genero));
  const aLaCaja = (x, n) => {
    const b = (lib.libros[x.clave] ??= { clave: x.clave, titulo: x.titulo, genero: x.genero, caja: 0, balda: 0 });
    b.caja += n;
  };
  let giro = 0;
  /** 1.142: Pilar sube lo que espera en las cajas a la balda, por título, hasta llenar los huecos. */
  function colocaPilar() {
    if (!(pil?.caja >= 1)) return;
    let libres = huecosDelNivel(c.nivel) - Object.values(lib.libros).reduce((n, b) => n + b.balda, 0);
    for (const b of Object.values(lib.libros).sort((x, y) => x.titulo.localeCompare(y.titulo) || x.clave.localeCompare(y.clave))) {
      if (libres <= 0) break;
      const n = Math.min(b.caja, libres);
      Object.assign(b, { caja: b.caja - n, balda: b.balda + n });
      pil.dado.colocados += n;
      libres -= n;
    }
  }
  function libros(route, rpc, body) {
    if (!c.inaugurado) return falla(route, 'cafe:cerrado');
    const caja = [];
    if (rpc === 'cafe_bienvenida') {
      if (lib.bienvenida) return falla(route, 'cafe:bienvenida');
      if (!titulosValidos(body.titulos)) return falla(route, 'cafe:titulos');
      // Repartidos por género: uno de cada género por vuelta (los tuyos, primero en su género)
      const todos = conCatalogo(body.titulos);
      const porGenero = {};
      for (const x of todos) (porGenero[x.genero] ??= []).push(x);
      const filas = [];
      for (let k = 0; filas.length < todos.length; k += 1) for (const g of Object.values(porGenero)) if (g[k]) filas.push(g[k]);
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
        const x = conCatalogo(body.titulos).find((y) => y.clave === body.clave);
        if (!x) return falla(route, 'cafe:titulo');
        if (c.granos < CAJA_TITULO.precio) return falla(route, 'cafe:granos');
        aLaCaja(x, CAJA_TITULO.ejemplares);
        caja.push(...Array(CAJA_TITULO.ejemplares).fill(x.clave));
        c.granos -= CAJA_TITULO.precio;
      } else {
        const del = conCatalogo(body.titulos).filter((y) => y.genero === body.genero);
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
    // 1.141: los cafés de los demás (`social`: { ranking: { edificio, seguidos }, visitas: { [user_id]: café } }); sin `social`, sin la migración
    if (rpc === 'cafe_ranking' || rpc === 'cafe_visita') {
      if (!social) return json(route, { code: 'PGRST202', message: 'Could not find the function' }, 404);
      if (rpc === 'cafe_ranking') return json(route, social.ranking?.[body.ambito] ?? []);
      return json(route, social.visitas?.[body.lector] ?? null);
    }
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
      const atendidos = d ? Object.keys(d.servidos).filter((n) => Number(n) < 300).length : 0;
      const inf = d && conInf ? influencerDe(d.dia) : null;
      if (d && (atendidos < d.clientes + d.habituales + (d.virales ?? 0) || (inf && !inf.servido))) return falla(route, 'cafe:pendientes');
      const sig = new Date(`${jornada}T12:00:00Z`);
      sig.setUTCDate(sig.getUTCDate() + 1);
      jornada = sig.toISOString().slice(0, 10);
      c.llamadas.push({ rpc, jornada });
      return json(route, jornada);
    }
    if (clientes && rpc === 'cafe_recoger_saco') {
      if (body.dia !== clientes.hoy && body.dia !== ayer && body.dia !== jornada) return falla(route, 'cafe:dia');
      if (!c.inaugurado) return falla(route, 'cafe:cerrado');
      if (!tuesteAbierto(c.reputacion)) return falla(route, 'cafe:tueste');
      if (!sacoListo(c.reputacion, c.sacoDia, body.dia)) return falla(route, 'cafe:saco');
      if (c.tazas + TAZAS_SACO > TAZAS_MAX) return falla(route, 'cafe:tazas');
      c.tazas += TAZAS_SACO;
      c.sacoDia = body.dia;
      return json(route, { cafe: vista(), tazas: TAZAS_SACO });
    }
    if (clientes && rpc === 'cafe_mis_titulos') {
      if (!titulosValidos(body.titulos)) return falla(route, 'cafe:titulos');
      tuyos = body.titulos.filter((x) => !String(x.clave).startsWith('cat:')).map(({ clave, titulo, genero }) => ({ clave, titulo, genero }));
      return json(route, tuyos.length);
    }
    if (clientes && rpc === 'cafe_entregar' && c.sinEntregar) return json(route, { code: 'PGRST202', message: 'no existe' }, 404);
    if (rpc === 'cafe_pilar_mejorar' || rpc === 'cafe_hucha') {
      if (!pil) return json(route, { code: 'PGRST202', message: 'Could not find the function' }, 404);
      if (!c.inaugurado) return falla(route, 'cafe:cerrado');
      if (rpc === 'cafe_hucha') {
        const n = pil.guardado;
        c.granos = Math.min(100000, c.granos + n);
        pil.dado.hucha += n;
        pil.guardado = 0;
        return json(route, { recogido: n, cafe: vista() });
      }
      const t = TAREAS.find((x) => x.id === body.mejora);
      const g = t ? gradoDe(pil, t.id) : 0;
      const sig = t?.grados[g];
      if (!sig) return falla(route, 'cafe:cuaderno');
      if (c.nivel < sig.nivel) return falla(route, 'cafe:cuaderno_nivel');
      if (c.granos < sig.precio) return falla(route, 'cafe:granos');
      c.granos -= sig.precio;
      pil[t.id] = g + 1;
      if (t.id === 'caja') colocaPilar();
      return json(route, { cafe: vista(), libros: librosJson(), caja: [] });
    }
    if (clientes && ['cafe_dia', 'cafe_habitual', 'cafe_servir', 'cafe_entregar'].includes(rpc)) return diaDelCafe(route, rpc, body);
    if (conInf && ['cafe_influencer_empezar', 'cafe_influencer_entregar'].includes(rpc)) return diaDelCafe(route, rpc, body);
    if (clientes && ['cafe_bienvenida', 'cafe_comprar_caja', 'cafe_colocar'].includes(rpc)) return libros(route, rpc, body);
    if (clientes && taller && ['cafe_taller', 'cafe_restaurar'].includes(rpc)) return tallerDelCafe(route, rpc, body);
    return json(route, { code: 'PGRST202', message: 'no existe' }, 404);
  });
  // ── 1.133: el taller de la trastienda (`20261220120000_cafe_taller.sql`): un encargo al día como mucho, que no caduca ──
  const tal = taller ? { encargos: structuredClone(taller.encargos ?? []), siguientes: structuredClone(taller.siguientes ?? []) } : null;
  if (c && tal) c.taller = tal;
  const tallerDe = (dia) => {
    let e = tal.encargos.find((x) => !x.hecho);
    if (!e && !tal.encargos.some((x) => x.llega === dia || x.dia_hecho === dia)) {
      const n = tal.encargos.length + 1;
      const sig = n === 1 ? PRIMER_ENCARGO : (tal.siguientes.shift() ?? { libro: 9, quien: 3, danos: ['manchas', 'lomo'] });
      e = { n, llega: dia, libro: sig.libro, quien: sig.quien, danos: [...sig.danos], hecho: false };
      tal.encargos.push(e);
    }
    const h = [...tal.encargos].reverse().find((x) => x.dia_hecho === dia);
    return {
      encargo: e ? { n: e.n, libro: e.libro, quien: e.quien, danos: e.danos, llega: e.llega } : null,
      hechos: tal.encargos.filter((x) => x.hecho).length,
      hoy: h ? { n: h.n, libro: h.libro, quien: h.quien, estrellas: h.estrellas, granos: h.granos, reputacion: h.reputacion } : null,
    };
  };
  function tallerDelCafe(route, rpc, body) {
    if (body.dia !== clientes.hoy && body.dia !== ayer && body.dia !== jornada) return falla(route, 'cafe:dia');
    if (!c.inaugurado) return falla(route, 'cafe:cerrado');
    if (c.nivel < TALLER_NIVEL) return falla(route, 'cafe:taller');
    c.llamadas.push({ rpc, ...body });
    if (rpc === 'cafe_taller') return json(route, tallerDe(body.dia));
    const e = tal.encargos.find((x) => x.n === body.n);
    if (!e || e.hecho) return falla(route, 'cafe:encargo');
    if (!Array.isArray(body.mimo) || body.mimo.length !== e.danos.length || body.mimo.some((m) => m !== 1 && m !== 2)) return falla(route, 'cafe:mimo');
    const estrellas = estrellasTaller(body.mimo);
    const p = premioTaller(estrellas);
    Object.assign(e, { hecho: true, dia_hecho: body.dia, estrellas, mimo: body.mimo, ...p });
    const d = (dias[body.dia] ??= { dia: body.dia, clientes: clientesDelNivel(c.nivel, asientosDe(c.plano)), habituales: 0, servidos: {}, carta: cartaDe(c.reputacion), tickets: 0 });
    c.granos = Math.min(100000, c.granos + p.granos);
    const antes = c.reputacion;
    c.reputacion += p.reputacion;
    if (conInf) apartar();
    const nov = novedades(antes, c.reputacion);
    const de = c.nivel;
    c.nivel = Math.max(c.nivel, nivelDe(c.reputacion));
    const granosDeHitos = nov.hitos.filter((h) => h.hito === 3).reduce((s, h) => s + granosHito(h.nivel), 0);
    c.granos = Math.min(100000, c.granos + granosDeHitos);
    const progreso = { de, a: c.nivel, niveles: nov.niveles, hitos: nov.hitos.map(({ nivel, hito }) => ({ nivel, hito })), granos: granosDeHitos, tickets_dia: 0, tickets: nov.niveles.reduce((s, x) => s + x.tickets, 0) };
    return json(route, { cafe: vista(), dia: diaJson(d), libros: librosJson(), taller: tallerDe(body.dia), dado: { ...p, estrellas, mimo: body.mimo }, progreso });
  }
  // ── Los clientes del día (bloque 3) ──
  const dias = {};
  if (c) c.dias = dias;
  // 1.130: lo que se vendió otro día y aún no se ha repuesto (las claves de los ejemplares): el reparto lo trae al abrir el día
  if (clientes?.vendidos?.length) {
    const servidos = Object.fromEntries(clientes.vendidos.map((libro, i) => [i + 1, { encaja: true, receta: null, estrellas: 3, libro, repuesto: false, orden: i + 1 }]));
    dias['2000-01-01'] = { dia: '2000-01-01', clientes: clientes.vendidos.length, habituales: 0, servidos, carta: [], tickets: 0 };
    c.orden = clientes.vendidos.length;
  }
  let jornada = clientes?.jornada ?? null;
  const ayer = clientes ? new Date(new Date(`${clientes.hoy}T12:00:00Z`).getTime() - 864e5).toISOString().slice(0, 10) : null;
  const semilla = (k) => clientes.semillas?.[k] ?? 1000 + k * 7919;
  // Los virales (201 a 203) tienen su propia semilla, aparte de la de los clientes del día
  const semillaDe = (n) => (n >= 201 && n <= 203 ? semilla(30 + n - 201) : semilla(n - 1));
  // ── 1.132: el influencer de cada subida (cafe_techo, cafe_apartar y cafe_influencer_de de la migración) ──
  const despedido = (n) => Boolean(c.influencers[n]?.despedido);
  // Hasta dónde llega la reputación: lo que falta, menos uno, para el primer nivel cuyo influencer no se ha despedido
  const techo = () => {
    for (let m = c.nivel + 1; m <= 8; m += 1) if (!despedido(m)) return desdeNivel(m) - 1;
    return null;
  };
  // Lo que esperaba vuelve y lo que pase del techo se aparta otra vez (nunca se pierde nada)
  const apartar = () => {
    c.reputacion += c.espera;
    c.espera = 0;
    const t = techo();
    if (t !== null && c.reputacion > t) {
      c.espera = c.reputacion - t;
      c.reputacion = t;
    }
  };
  // El que ya despediste ese día; si no, el de la subida (la barra llena); si no, el más antiguo de los niveles que ya tenías
  function influencerDe(dia) {
    const hoy = Object.entries(c.influencers)
      .filter(([, i]) => i.despedido && i.dia === dia)
      .sort((a, b) => (a[1].orden ?? 0) - (b[1].orden ?? 0))[0];
    if (hoy) return { nivel: Number(hoy[0]), servido: true, sube: false, estrellas: hoy[1].estrellas ?? null, a_tiempo: Boolean(hoy[1].a_tiempo), viral: Boolean(hoy[1].viral) };
    if (c.nivel < 8 && c.reputacion + c.espera >= desdeNivel(c.nivel + 1) && !despedido(c.nivel + 1)) return { nivel: c.nivel + 1, servido: false, sube: true };
    for (let k = 2; k <= c.nivel; k += 1) if (!despedido(k)) return { nivel: k, servido: false, sube: false };
    return null;
  }
  const diaJson = (d) => ({
    dia: d.dia,
    carta: d.carta,
    tickets: d.tickets,
    reparto: d.reparto ?? null,
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
    ...(conInf
      ? {
          virales: Array.from({ length: d.virales ?? 0 }, (_, i) => ({
            n: 201 + i,
            semilla: semillaDe(201 + i),
            servido: Boolean(d.servidos[201 + i]),
            encaja: d.servidos[201 + i]?.encaja ?? null,
            estrellas: d.servidos[201 + i]?.estrellas ?? null,
          })),
          virales_de: d.virales_de ?? null,
          influencer: influencerDe(d.dia),
        }
      : {}),
  });
  function diaDelCafe(route, rpc, body) {
    if (body.dia !== clientes.hoy && body.dia !== ayer && body.dia !== jornada) return falla(route, 'cafe:dia');
    if (!c.inaugurado) return falla(route, 'cafe:cerrado');
    const nuevo = !dias[body.dia];
    const d = (dias[body.dia] ??= { dia: body.dia, clientes: Math.min(13, clientesDelNivel(c.nivel, asientosDe(c.plano)) + (pil?.pizarra ?? 0)), habituales: 0, servidos: {}, carta: cartaDe(c.reputacion), tickets: 0 });
    // 1.130: el día nuevo trae el reparto de lo vendido (de los otros días, del más antiguo al más nuevo)
    if (nuevo) {
      const vendidos = Object.values(dias)
        .filter((x) => x !== d)
        .flatMap((x) => Object.values(x.servidos))
        .filter((sv) => sv.encaja && sv.libro && !sv.repuesto)
        .sort((a, b) => a.orden - b.orden);
      // 1.139: gratis, con cupo del nivel y sin pasar de los huecos libres
      const ocupados = Object.values(lib.libros).reduce((s, b) => s + b.balda + b.caja, 0);
      if (pil) pil.dado.clientes += d.clientes - clientesDelNivel(c.nivel, asientosDe(c.plano));
      // 1.142: con el 2.º grado de «Colocar la caja», Pilar pide 3 más
      const base = repartoDelNivel(c.nivel);
      const cupo = !clientes.reparto ? 0 : Math.max(0, Math.min(base + (pil?.caja >= 2 ? 3 : 0), huecosDelNivel(c.nivel) - ocupados));
      const claves = [];
      let repuestos = 0;
      for (const sv of vendidos) {
        if (claves.length < cupo && lib.libros[sv.libro]) {
          lib.libros[sv.libro].caja += 1;
          claves.push(sv.libro);
          repuestos += 1;
        }
        sv.repuesto = true;
      }
      let k = 0;
      let kt = 0;
      while (claves.length < cupo) {
        let x;
        if (tuyos.length && claves.length % REPARTO_TUYOS_CADA === 0) x = tuyos[kt++ % tuyos.length];
        else {
          const presentes = new Set(Object.values(lib.libros).filter((b) => b.balda + b.caja > 0).map((b) => b.genero));
          const vale = (y) => presentes.size >= 3 || !presentes.has(y.genero);
          const lista = CATALOGO_LIBROS.filter(vale);
          x = lista[k++ % lista.length];
        }
        aLaCaja(x, 1);
        claves.push(x.clave);
      }
      const pedidos = Math.max(0, claves.length - base);
      if (pil) pil.dado.pedidos += pedidos;
      d.reparto = claves.length ? { claves, granos: 0, gratis: true, repuestos, faltan: 0, pilar: pedidos } : null;
      colocaPilar();
      // 1.132: si un influencer se fue contento otro día anterior, hoy llegan 3 más por su vídeo (una vez por influencer)
      if (conInf) {
        const v = Object.entries(c.influencers)
          .filter(([, i]) => i.viral && !i.viral_dia && i.dia && i.dia < d.dia)
          .sort((a, b) => (a[1].orden ?? 0) - (b[1].orden ?? 0))[0];
        if (v) {
          v[1].viral_dia = d.dia;
          Object.assign(d, { virales: VIRALES, virales_de: Number(v[0]) });
        }
      }
    }
    if (clientes.atendidosEn?.includes(d.dia) && !d.preparado) {
      d.preparado = true;
      for (let k = 1; k <= d.clientes; k += 1) d.servidos[k] = { encaja: false, receta: null, estrellas: 2, libro: null };
    }
    let dado = null;
    let progreso = null;
    if (rpc === 'cafe_habitual') d.habituales = Math.min(MAX_HABITUALES, d.habituales + 1);
    // 1.132: ir a la barra con el influencer da la vuelta al reloj de arena (cada vez; volver a empezar no castiga)
    const hoyInf = conInf && rpc.startsWith('cafe_influencer_') ? influencerDe(d.dia) : null;
    if (conInf && rpc.startsWith('cafe_influencer_') && (!hoyInf || hoyInf.servido || hoyInf.nivel !== body.nivel)) return falla(route, 'cafe:influencer');
    if (rpc === 'cafe_influencer_empezar') {
      (c.influencers[body.nivel] ??= {}).empezado = Date.now();
      return json(route, { nivel: body.nivel, segundos: ARENA_SEGUNDOS });
    }
    if (rpc === 'cafe_servir' || rpc === 'cafe_entregar' || rpc === 'cafe_influencer_entregar') {
      const inf = rpc === 'cafe_influencer_entregar' ? c.influencers[body.nivel] : null;
      if (rpc === 'cafe_influencer_entregar' && !inf?.empezado) return falla(route, 'cafe:influencer');
      const entrega = rpc !== 'cafe_servir';
      const n = inf ? 300 + body.nivel : body.cliente;
      if (!inf && !((n >= 1 && n <= d.clientes) || (n >= 101 && n <= 100 + d.habituales) || (conInf && n >= 201 && n <= 200 + (d.virales ?? 0)))) return falla(route, 'cafe:cliente');
      const r = body.receta;
      const carta = cartaDe(c.reputacion);
      if (!recetaValida(r, carta)) return falla(route, 'cafe:receta');
      // El tueste de la casa sale del saco: sin tazas, no hay
      if (r[1] === 'casa' && c.tazas < 1) return falla(route, 'cafe:tueste');
      if (d.servidos[n]) return falla(route, 'cafe:servido');
      const habitual = n >= 101 && n <= 199;
      const excentrico = !habitual && n === d.clientes;
      const quien = habitual ? (clientes.quienes?.[n - 101] ?? (n - 101) * 5) : semillaDe(n) % 6;
      const pide = inf ? [...INFLUENCERS[body.nivel].pide] : recetaPide(habitual ? { n, quien } : { n, semilla: semillaDe(n) }, d.carta);
      const aciertos = aciertosDe(r, pide);
      // El libro solo cuenta si está en la balda; si encaja (con `cafe_entregar`, si el género es), se lo lleva y paga más
      const enLaBalda = Boolean(body.libro) && lib.libros[body.libro]?.balda > 0;
      if (entrega && body.libro && (!Array.isArray(body.libro_ok) || body.libro_ok.length !== 3)) return falla(route, 'cafe:libro');
      const ok = entrega && enLaBalda ? body.libro_ok.map(Boolean) : [false, false, false];
      const la = ok.filter(Boolean).length;
      const lleva = entrega ? ok[0] : Boolean(body.encaja) && enLaBalda;
      const extra = lleva ? (entrega ? extraLibro(body.libro) : EXTRA_LLEVADO) : 0;
      if (lleva) lib.libros[body.libro].balda -= 1;
      const estrellas = entrega ? estrellasTotal(aciertos, la) : estrellasDe(aciertos, lleva);
      // El influencer: a tiempo (con el margen del servidor), como el excéntrico y, con 3 estrellas, viral; si no, como un cliente
      const segundos = inf ? (clientes.influencer.segundos ?? Math.max(0, Math.floor((Date.now() - inf.empezado) / 1000))) : null;
      const aTiempo = inf ? segundos <= ARENA_SEGUNDOS + ARENA_MARGEN : false;
      const viral = aTiempo && estrellas === 3;
      const base = premio(inf ? (aTiempo ? 'excentrico' : 'cliente') : habitual ? 'habitual' : excentrico ? 'excentrico' : 'cliente', estrellas);
      // Bloque 6b: servir el tueste gasta una taza; a quien lo pidió, +3 granos y +4 de reputación
      const tueste = r[1] === 'casa' && pide[1] === 'casa';
      const bono = tueste ? BONO_TUESTE : { granos: 0, reputacion: 0 };
      const p = { granos: base.granos + bono.granos, reputacion: base.reputacion + bono.reputacion };
      if (r[1] === 'casa') c.tazas -= 1;
      d.servidos[n] = { encaja: lleva, receta: r, estrellas, libro: enLaBalda ? body.libro : null, repuesto: false, orden: (c.orden = (c.orden ?? 0) + 1) };
      c.granos = Math.min(100000, c.granos + p.granos + extra);
      const antes = c.reputacion;
      c.reputacion += p.reputacion;
      // 1.132: despedirle quita el techo de su nivel; lo que esperaba entra y lo que pase del siguiente techo se aparta
      if (inf) Object.assign(inf, { despedido: true, dia: d.dia, estrellas, segundos, a_tiempo: aTiempo, viral, orden: c.orden });
      if (conInf) apartar();
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
      dado = { ...p, granos: p.granos + extra, llevado: lleva, extra, estrellas, aciertos, pide, frase: null, dorada: false, tueste, bono_granos: bono.granos, bono_reputacion: bono.reputacion };
      if (entrega) Object.assign(dado, { libro_aciertos: la, libro_ok: ok, en_balda: enLaBalda });
      if (inf) dado.influencer = { nivel: body.nivel, a_tiempo: aTiempo, viral, segundos, sube: Boolean(hoyInf.sube) };
      // La nota del habitual y la reseña dorada se ven en su bocadillo (la pizarra ya no está, 1.132)
      if (habitual) dado.frase = clientes.frases?.[n - 101] ?? 2;
      else if (excentrico && estrellas === 3) Object.assign(dado, { frase: quien, dorada: true });
    }
    return json(route, { cafe: vista(), dia: diaJson(d), libros: librosJson(), dado, progreso });
  }
  return c;
}
