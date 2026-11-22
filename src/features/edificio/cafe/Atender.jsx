// El café-librería del bajo, bloque 3 (1.121), revisado el 12-11-2026 (Francisco: «el café pesa más, el libro es un extra»)
// y rehecho el mismo día para que preparar sea divertido y cada paso se sienta único («quiero que el proceso de hacer el cafe
// sea divertido y adictivo, y que cada paso se sienta unico, tanto por los movimientos que haga el usuario como por los
// objetos que tenga que ver»): atender a un cliente, en el cuadro de diálogo de abajo y en la escena.
// 1. Te pide la bebida en una comanda (clara; la del excéntrico, en acertijos), que se queda a la vista arriba.
// 2. «A la barra»: cinco etapas, cada una con su objeto y su gesto (`cafeGestos.js`): la bebida (tocar la cafetera o la
//    tetera), el grano (el tarro y la manivela del molinillo) o la hoja (el tarro y la cuchara), la extracción (apisonar y la
//    palanca) o la infusión (la tetera y el colador), la leche (la jarrita bajo el vapor y servirla con pulso) y el toque
//    (agitar la canela o dibujar un hilo de miel). La cámara se acerca a cada objeto. Nada falla ni corre prisa; lo hecho no
//    se pierde al soltar; con movimiento reducido o con el teclado, cada gesto es un toque.
// 3. «Llevársela»: la taza en la mano y vas andando hasta su mesa.
// 4. El libro (1.130, tan importante como el café; Libreria.jsx): pide un género, corto o largo, y cómo se lo lleva; lo buscas
//    en su sección de la estantería, lo sacas, lo miras en la tabla y lo envuelves, lo abres con su marcapáginas o lo metes en
//    su bolsa, y el sello del café. O «Solo el café». Sin ejemplares en la balda, solo el café.
// 5. Estrellas (de 1 a 3: 4 aciertos de la bebida y 3 del libro; las pone el servidor con `cafe_entregar`) y el repaso de qué
//    acertaste. Los gestos no cambian las estrellas: solo cuenta lo elegido.
// Pilar (1.130, §15.1): lo que ya dominas (12 servidas de 2 estrellas o más) te lo prepara ella si quieres: tú eliges cada
// parte de la receta y los gestos los hace ella en la barra, con sus sonidos (con movimiento reducido, directos). Al
// excéntrico y lo recién abierto de la carta, siempre a mano. Lo elegido se recuerda en el dispositivo, por bebida.
// El influencer (1.132, §16.2): su comanda es clara y en directo («REC»); al ir a la barra se da la vuelta al reloj de arena
// (`onEmpezar`, el servidor apunta la hora) y la arena cae hasta que le sirves. Siempre a mano. Al despedirle, lo que publica
// y, si fue viral, lo que trae. Los que vienen por su vídeo saludan diciendo de quién era.
// La comida (1.143; Francisco, 17-11-2026: «Dos máx., 1 de cada 3»): máximo dos cosas por cliente. Con el obrador abierto, uno
// de cada tres pide la bebida y algo dulce o salado, sin libro (`pedido.id === 'comida'`, lo dice el servidor). Con la taza lista,
// a la vitrina (Vitrina.jsx: las pinzas, de la vitrina al plato) y, con la taza y el plato en la bandeja, a su mesa. Sus estrellas,
// solo de la bebida; la pieza paga su precio en granos aparte. Sin pieza de lo que pide, solo el café.
import { useEffect, useMemo, useRef, useState } from 'react';
import { PARTES, RESENAS, comandaAcertijo, comandaClara, nombreGenero, nombreOpcion, opcionesDe } from './cafeClientes';
import { AYUDA_NIVELES, AYUDA_PARADO_MS, ELIGE, ladoNota, ETAPAS, GESTOS, crearGesto, gestosDe, nombreEtapa, verAyuda, vistaTaza } from './cafeGestos';
import { crearSfxBarra } from './cafeSfx';
import { PILAR, retratoDe } from './cafeIconos';
import { errorCafe } from './cafeService';
import { DOMINIO, comandaLibro, comandaLibroAcertijo, extensionDe, formaPorId, frasePedido, haciaDominio, pilarHaceEtapa, pilarPuede, preparaRecordado, recordarPrepara } from './cafeLibreria';
import { BUCLE_PILAR, PILAR_MIRA_MS, duracionPilar, poseAuto, respiroPilar, sonidosEntre, tiempoPilar } from './cafePilar';
import { despedidaInfluencer, saludoViral } from './cafeInfluencers';
import { GRACIAS_COMIDA, comandaComida, fraseComida, laPieza, recetaObrador, sinPieza } from './cafeObrador';
import { useLibreria } from './Libreria';
import { useVitrina } from './Vitrina';
import { Pista } from './Pista';
import { PixelArt } from './PixelArt';
import { RelojArena } from './RelojArena';

export { Pista };

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** La hora para los gestos que se mantienen (fuera del componente: solo se llama en los toques y en cada cuadro). */
const reloj = () => performance.now();
const rgb = (c) => `rgb(${c[0]} ${c[1]} ${c[2]})`;
const VACIA = { bebida: null, grano: null, leche: null, toque: null };
/** Cuánto se queda el objeto en su postura final antes de pasar al siguiente (un respiro; directo con movimiento reducido). */
const RESPIRO_MS = 420;
/** Lo que se pregunta al elegir cada parte. */
const PREGUNTA = {
  bebida: (r, carta = []) =>
    carta.includes('chai')
      ? '¿Café, té, chocolate, café con hielo o chai? Toca la cafetera, la tetera, el cazo, la cubitera o el mortero.'
      : carta.includes('hielo')
      ? '¿Café, té, chocolate o café con hielo? Toca la cafetera, la tetera, el cazo o la cubitera.'
      : carta.includes('chocolate')
        ? '¿Café, té o chocolate? Toca la cafetera, la tetera o el cazo.'
        : '¿Café o té? Toca la cafetera o la tetera.',
  grano: (r) =>
    r.bebida === 'chai'
      ? '¿Qué té para el chai? Toca un tarro: la hoja verde, suave; la negra, intensa.'
      : r.bebida === 'te'
      ? '¿Qué hoja? Toca un tarro: la verde es suave; la negra, intensa.'
      : r.bebida === 'chocolate'
        ? '¿Qué cacao? Toca un tarro: el claro, con leche; el oscuro, negro.'
        : r.casa
          ? '¿Qué grano? Toca un tarro o el saco: el claro es suave; el tostado, intenso; el saco, tu tueste de la casa.'
          : '¿Qué grano? Toca un tarro: el claro es suave; el tostado, intenso.',
  leche: () => '¿Leche? Toca una jarrita, o «Sin leche».',
  toque: (r, carta = []) =>
    carta.includes('brulee')
      ? '¿Un toque final? Toca la canela, la miel, la nata, la vainilla o el azucarero, o «Sin nada».'
      : carta.includes('vainilla')
      ? '¿Un toque final? Toca la canela, la miel, la nata o la vainilla, o «Sin nada».'
      : carta.includes('nata')
        ? '¿Un toque final? Toca la canela, la miel o la nata, o «Sin nada».'
        : '¿Un toque final? Toca la canela o la miel, o «Sin nada».',
};
/** Qué marca de la barra mira cada gesto (donde va la pista y, en la manivela y la miel, el centro del gesto). */
const MARCA = { manivela: 'manivela', apisonar: 'portafiltro', palanca: 'palanca', cuchara: 'tarros', tetera: 'tetera', colador: 'taza', vapor: 'vapor', verter: 'taza', agitar: 'taza', hilo: 'taza', molinillo: 'cazo', cazo: 'cazo', batir: 'bol', rascar: 'vaina', coctelera: 'coctelera', mortero: 'mortero', soplete: 'taza' };
/** El sonido al elegir cada cosa. */
const SONIDO_ELEGIR = {
  bebida: (v) => ({ te: 'tetera', chocolate: 'cazo', frio: 'cubitera', chai: 'mortero' })[v] ?? 'cafetera',
  grano: (v) => (v === 'casa' ? 'saco' : 'tarro'),
  leche: () => 'jarra',
  toque: (v) => (v === 'vainilla' ? 'vaina' : v === 'brulee' ? 'azucarero' : 'jarra'),
};
/** Los que se mantienen suenan mientras dura (el café que cae, el agua, el vapor). */
const SUENA_MIENTRAS = {
  palanca: (s) => s.pose.bajada >= 0.85,
  tetera: (s) => s.pose.alzada >= 0.6,
  vapor: (s) => Math.abs(s.pose.inclina) >= 0.5,
  cazo: (s) => s.pose.inclina >= 0.6,
  // Bloque 6c: el soplete, encendido mientras se aprieta
  soplete: (s) => Boolean(s.pose.llama),
};

/** La siguiente etapa y gesto que quedan por hacer con esta receta (5 = la taza está lista). */
function siguiente(receta, ei, gi) {
  for (let e = ei, g = gi; e < ETAPAS.length; e += 1, g = 0) {
    const parte = ELIGE[ETAPAS[e]];
    if (parte && receta[parte] == null) return { ei: e, gi: 0 };
    if (g < gestosDe(ETAPAS[e], receta).length) return { ei: e, gi: g };
  }
  return { ei: ETAPAS.length, gi: 0 };
}

function Estrellas({ n }) {
  return (
    <span className="cf3-estrellas" role="img" aria-label={`${n} de 3 estrellas`}>
      {[1, 2, 3].map((k) => (
        <span key={k} className="cf3-estrella" data-llena={k <= n ? 'true' : undefined} aria-hidden="true" />
      ))}
    </span>
  );
}

const SIN_CARTA = [];
const SIN_NUEVOS = new Set();
/** La opción de la barra que abre cada cosa nueva de la carta (el café con hielo es la opción «frio»). */
const OPCION_CARTA = { frio: 'hielo' };

const SIN_BALDA = [];
const SIN_DOMINIO = {};

/** Las tres filas del libro en el repaso: género, extensión y forma, con lo que pidió si no acertaste. */
function repasoLibro(libro, pedido, ok, forma) {
  const ext = extensionDe(libro.paginas);
  const nombreExt = (e) => (e === 'corto' ? 'Corto' : e === 'largo' ? 'Largo' : 'Sin páginas');
  const pags = Number(libro.paginas) > 0 ? ` (${libro.paginas} págs.)` : '';
  const nombreForma = (id) => formaPorId(id)?.nombre ?? 'Sin envolver';
  return [
    {
      id: 'genero',
      ok: Boolean(ok[0]),
      texto: ok[0] ? `✓ ${nombreGenero(libro.genero)}` : `✗ ${nombreGenero(libro.genero)} · pidió ${nombreGenero(pedido.genero).toLowerCase()}`,
    },
    {
      id: 'extension',
      ok: Boolean(ok[1]),
      texto: ok[1] ? `✓ ${nombreExt(ext)}${pags}` : `✗ ${nombreExt(ext)}${pags} · pidió ${pedido.extension === 'corto' ? 'corto' : 'largo'}`,
    },
    {
      id: 'forma',
      ok: Boolean(ok[2]),
      texto: ok[2] ? `✓ ${nombreForma(forma ?? pedido.forma)}` : `✗ ${nombreForma(forma)} · pidió ${nombreForma(pedido.forma).toLowerCase()}`,
    },
  ];
}

/** 1.139: el libro es uno de tus leídos (no del catálogo del café): paga más al llevárselo y el repaso lo dice. */
const esTuyo = (libro) => Boolean(libro) && (libro.tuyo ?? !String(libro.id ?? '').startsWith('cat:'));

export function Atender({ cliente, balda = SIN_BALDA, dominio = SIN_DOMINIO, obrador = null, especialidad = null, escena, registrarToque, onServir, onEmpezar, onCerrar, soundOn = false, ayudas = 'auto', nivel = 1, carta = SIN_CARTA, tazas = 0, nuevos = SIN_NUEVOS, onVisto }) {
  const [paso, setPaso] = useState('pide');
  const [receta, setReceta] = useState(VACIA);
  const [ei, setEi] = useState(0);
  const [gi, setGi] = useState(0);
  const [hechos, setHechos] = useState({});
  const [g, setG] = useState(null);
  const [pistaEn, setPistaEn] = useState(null);
  const [marcas, setMarcas] = useState(null);
  const [paradoEn, setParadoEn] = useState(null);
  const [libro, setLibro] = useState(null);
  // 1.130: lo que se entrega del libro ({ libro, forma, ok }) o null (solo el café)
  const [entrega, setEntrega] = useState(null);
  const [dado, setDado] = useState(null);
  const [error, setError] = useState('');
  // 1.130, Pilar: lo elegido en este servicio ('pilar' o 'mano'); si no, lo recordado para esa bebida
  const [prepara, setPrepara] = useState(null);
  const [sfx] = useState(() => crearSfxBarra());
  // Lo que dominabas al llegar el cliente (para el aviso de Pilar al despedirlo, aunque el café ya se haya actualizado)
  const [dominioAntes] = useState(dominio);
  const rec = useRef(null);
  const raf = useRef(0);
  const respiro = useRef(0);
  const zona = useRef(null);
  const llevaRef = useRef(null);
  const raro = cliente.raro;
  // 1.132: el influencer del día (con su ficha de cafeInfluencers.js) y los que vienen por su vídeo viral
  const inf = cliente.influencer ?? null;
  const esViral = cliente.viral !== undefined;
  const quien = cliente.habitual || raro || inf ? cliente.nombre : 'Cliente';
  // El reloj de arena: cuándo se le dio la vuelta (en este dispositivo; el servidor mide lo suyo, con margen) o null
  const [arena, setArena] = useState(null);
  const [empezando, setEmpezando] = useState(false);
  // Lo que pide del libro se fija al llegar (la balda cambia al servir y los pedidos del día se recalculan)
  const [pedido] = useState(() => cliente.pedido);
  const pideLibro = pedido?.id === 'libro';
  // 1.143: máximo dos cosas por cliente: quien pide comida (lo dice el servidor) no pide libro
  const pideComida = pedido?.id === 'comida';
  const lista = [receta.bebida, receta.grano, receta.leche, receta.toque];
  const enBarra = paso === 'barra';
  const lleva = paso === 'yendo' || paso === 'libro' || paso === 'sirviendo';
  const hayLibreria = pideLibro && balda.length > 0;

  const etapa = ETAPAS[ei] ?? null;
  const parte = etapa ? ELIGE[etapa] : null;
  const eligiendo = enBarra && Boolean(parte) && receta[parte] == null;
  const gesto = enBarra && etapa && !eligiendo ? (gestosDe(etapa, receta)[gi] ?? null) : null;
  const clave = gesto ? `${ei}:${gi}:${gesto}` : null;
  const lista_ = enBarra && ei >= ETAPAS.length;
  const actual = gesto && g?.clave === clave ? g : null;
  const pista = pistaEn?.clave === clave ? pistaEn : null;
  // Pilar: si la bebida ya la dominas (nunca al excéntrico ni al influencer), lo elegido aquí o lo recordado; y si este gesto
  // lo hace ella
  const puedePilar = enBarra && pilarPuede(dominio, receta.bebida, { excentrico: Boolean(raro || inf) });
  const modoPilar = puedePilar ? (prepara ?? preparaRecordado(receta.bebida)) : null;
  const pilarAhora = Boolean(gesto) && modoPilar === 'pilar' && pilarHaceEtapa(dominio, receta, etapa);
  const ofrecePilar = puedePilar && modoPilar == null && !lista_;
  // La «!» de ayuda: en qué punto estás (elegir una parte, un gesto o la taza lista) y si toca enseñarla
  const puntoClave = enBarra ? (lista_ ? 'lista' : eligiendo ? `e:${ei}:${parte}` : (clave ?? 'nada')) : paso;
  const ayuda = verAyuda(ayudas, nivel, paradoEn === puntoClave);
  const marcasAhora = marcas?.clave === puntoClave ? marcas.lista : [];
  const vista = useMemo(() => vistaTaza(receta, hechos, actual ? { tipo: gesto, pose: actual.pose } : null), [receta, hechos, actual, gesto]);

  useEffect(() => sfx.setActivo(soundOn), [sfx, soundOn]);
  // 1.126: cada momento del cliente con su sonido (la comanda, la taza, el libro, las estrellas y los granos, la despedida)
  useEffect(() => {
    sfx.play(cliente.influencer ? 'directo' : cliente.raro ? 'raro' : 'comanda');
    // Solo al empezar a atenderlo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sfx]);
  useEffect(() => {
    if (!dado) return undefined;
    const n = Math.max(1, Math.min(3, dado.estrellas ?? 1));
    const pasos = reduced() ? 0 : 0.22;
    const ids = [];
    for (let k = 0; k < n; k += 1) ids.push(setTimeout(() => sfx.play('estrella', { k }), 120 + k * pasos * 1000));
    ids.push(setTimeout(() => sfx.play('granos', { n: dado.granos ?? 3 }), 200 + n * pasos * 1000 + 150));
    if (dado.dorada) ids.push(setTimeout(() => sfx.play('dorada'), 200 + n * pasos * 1000 + 700));
    // Bloque 6b: el tueste de la casa, cobrado a quien lo pidió
    if (dado.tueste) ids.push(setTimeout(() => sfx.play('tueste'), 200 + n * pasos * 1000 + 450));
    // 1.132: el vídeo del influencer se hace viral
    if (dado.influencer?.viral) ids.push(setTimeout(() => sfx.play('viral'), 200 + n * pasos * 1000 + 700));
    // 1.130: la bebida ya la dominas (el aviso de Pilar, con su brillo)
    if (!cliente.raro && n >= 2 && haciaDominio(dominioAntes, receta.bebida) === DOMINIO - 1) ids.push(setTimeout(() => sfx.play('bordas'), 200 + n * pasos * 1000 + 950));
    return () => ids.forEach(clearTimeout);
    // Solo al llegar el resultado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dado, sfx]);
  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      clearTimeout(respiro.current);
      sfx.apagar();
    },
    [sfx],
  );
  // La escena sigue a la barra: entrar, lo que se ve en cada momento y adónde mira la cámara
  useEffect(() => () => escena?.barra(false), [escena]);
  useEffect(() => {
    if (enBarra) escena?.barra(true);
  }, [enBarra, escena]);
  useEffect(() => {
    if (!enBarra) return;
    escena?.setBarra({
      receta,
      gesto,
      pose: actual?.pose ?? {},
      pulsado: actual?.pulsado ?? false,
      hechos,
      vista,
      elige: eligiendo ? parte : null,
      lista: lista_,
      carta,
      tazas,
      // 1.131: mientras prepara Pilar, la cámara sigue sus manos, gesto a gesto, como a mano (en la etapa entera se quedaban
      // fuera de plano el vapor, el vertido, la canela, la coctelera, el mortero o el soplete); ella espera a que llegue
      enfoque: lista_ ? 'lista' : eligiendo ? etapa : (gesto ?? etapa),
      pilar: pilarAhora,
    });
  }, [enBarra, escena, receta, gesto, actual, hechos, vista, eligiendo, parte, lista_, etapa, carta, tazas, pilarAhora]);
  // Dónde cae el objeto del gesto en la pantalla, cuando la cámara ya ha llegado (para la pista y el centro del gesto)
  useEffect(() => {
    if (!gesto) return undefined;
    let vivo = true;
    let id = 0;
    const mira = () => {
      if (!vivo) return;
      if (escena && !escena.settled()) {
        id = requestAnimationFrame(mira);
        return;
      }
      const m = escena?.barraMarca(MARCA[gesto]);
      const r = zona.current?.getBoundingClientRect();
      if (m && r) setPistaEn({ clave, x: m.x - r.left, y: m.y - r.top, cx: m.x, cy: m.y });
      else if (r) setPistaEn({ clave, x: r.width / 2, y: r.height * 0.32, cx: r.left + r.width / 2, cy: r.top + r.height * 0.32 });
    };
    id = requestAnimationFrame(mira);
    return () => {
      vivo = false;
      cancelAnimationFrame(id);
    };
  }, [gesto, clave, escena]);

  // Pasado un rato sin avanzar (en los niveles altos), la «!» aparece igualmente
  useEffect(() => {
    if (ayudas !== 'auto' || (nivel ?? 1) <= AYUDA_NIVELES) return undefined;
    const id = setTimeout(() => setParadoEn(puntoClave), AYUDA_PARADO_MS);
    return () => clearTimeout(id);
  }, [ayudas, nivel, puntoClave]);
  // Al elegir: dónde caen, en la pantalla, las cosas de esa parte (encima de cada una, cuando la cámara ya ha llegado)
  useEffect(() => {
    if (!eligiendo || !escena) return undefined;
    let vivo = true;
    let id = 0;
    const mira = () => {
      if (!vivo) return;
      if (!escena.settled()) {
        id = requestAnimationFrame(mira);
        return;
      }
      const r = zona.current?.getBoundingClientRect();
      if (!r) return;
      const lista = [];
      for (const o of opcionesDe(parte, carta, receta.bebida)) {
        const p = escena.barraEnPantalla(`barra:${parte}:${o.id}`, { cima: true });
        if (p?.front) lista.push({ id: o.id, x: p.x - r.left, y: p.y - r.top });
      }
      setMarcas({ clave: puntoClave, lista });
    };
    id = requestAnimationFrame(mira);
    return () => {
      vivo = false;
      cancelAnimationFrame(id);
    };
  }, [eligiendo, escena, parte, puntoClave, carta, receta.bebida]);

  /** Pasar a lo siguiente (otra etapa o la taza lista), con su sonido. */
  const avanzar = (r, e, gIdx) => {
    const sig = siguiente(r, e, gIdx);
    if (sig.ei > e) sfx.play(sig.ei >= ETAPAS.length ? 'lista' : 'etapa');
    rec.current = null;
    setG(null);
    setEi(sig.ei);
    setGi(sig.gi);
  };
  // 1.128: la «!» roja en lo nuevo de la carta; se va al elegir en ese paso (se ha visto)
  const claveNueva = (id) => `carta:${OPCION_CARTA[id] ?? id}`;
  const elegir = (p, valor) => {
    if (!eligiendo || p !== parte) return;
    const vistas = opcionesDe(p, carta, p === 'bebida' ? null : receta.bebida)
      .map((o) => claveNueva(o.id))
      .filter((k) => nuevos.has(k));
    if (vistas.length) onVisto?.(vistas);
    // Solo lo que está en la carta (el cazo y el bol están en la barra desde el principio, pero se abren con los hitos)
    if (!opcionesDe(p, carta, p === 'bebida' ? null : receta.bebida).some((o) => o.id === valor)) return;
    // Bloque 6b: el tueste de la casa sale del saco; sin tazas, no hay (baja al tostadero)
    if (valor === 'casa' && tazas < 1) {
      sfx.play('noCabe');
      return;
    }
    const r = { ...receta, [p]: valor };
    sfx.play(SONIDO_ELEGIR[p](valor));
    setReceta(r);
    avanzar(r, ei, 0);
  };
  /** Antes de empezar el gesto de una etapa, se puede cambiar lo elegido. */
  const puedeCambiar = enBarra && !eligiendo && !lista_ && Boolean(parte) && gi === 0 && !(actual?.progreso > 0);
  const cambiar = () => {
    if (!puedeCambiar) return;
    rec.current = null;
    setG(null);
    setReceta({ ...receta, [parte]: null });
  };
  /** Tirar lo preparado y empezar otra taza (sin castigo). */
  const deNuevo = () => {
    cancelAnimationFrame(raf.current);
    clearTimeout(respiro.current);
    sfx.apagar();
    sfx.play('vaciar');
    rec.current = null;
    setG(null);
    setHechos({});
    setReceta(VACIA);
    setEi(0);
    setGi(0);
  };

  // ── El gesto: la zona sobre la escena recoge el dedo y el reconocedor dice el progreso y la postura ──
  const reconocedor = () => {
    if (rec.current?.clave !== clave) {
      const ancho = zona.current?.getBoundingClientRect().width || 390;
      const centro = pista ? { x: pista.cx, y: pista.cy } : null;
      // 1.139: la manivela se mide sobre la propia pieza 3D, con la cámara de cada momento (no con un centro guardado)
      const bajoDedo = gesto === 'manivela' && escena?.manivelaBajo ? (x, y) => escena.manivelaBajo(x, y) : null;
      rec.current = { clave, g: crearGesto(gesto, { escala: Math.min(ancho, 600) / 390, centro, bajoDedo }) };
    }
    return rec.current.g;
  };
  const aplicar = (s) => {
    setG({ ...s, clave });
    if (rec.current?.fin) return;
    for (const ev of s.eventos) if (ev !== 'hecho' && ev !== 'toca') sfx.play(ev);
    const suena = SUENA_MIENTRAS[gesto];
    if (suena) sfx.bucle(gesto, s.pulsado && !s.hecho && suena(s), gesto === 'vapor' ? s.pose.espuma : 0);
    if (s.hecho && rec.current && !rec.current.fin) {
      rec.current.fin = true;
      cancelAnimationFrame(raf.current);
      sfx.bucle(gesto, false);
      const h = { ...hechos, [gesto]: s.pose };
      const [r, e, gIdx] = [receta, ei, gi + 1];
      clearTimeout(respiro.current);
      const seguir = () => {
        setHechos(h);
        avanzar(r, e, gIdx);
      };
      if (reduced()) seguir();
      else respiro.current = setTimeout(seguir, RESPIRO_MS);
    }
  };
  const latido = () => {
    const r = rec.current?.g;
    if (!r) return;
    const s = r.paso(reloj());
    aplicar(s);
    if (s.pulsado && !s.hecho) raf.current = requestAnimationFrame(latido);
  };
  const completar = () => {
    if (!gesto || actual?.hecho) return;
    aplicar(reconocedor().completar());
  };
  // ── 1.130, Pilar: «Esto ya lo bordas; si quieres, te lo preparo yo» ──
  const elegirPrepara = (v) => {
    // Si estaba preparando ella, el gesto vuelve a empezar, a mano
    if (v === 'mano' && pilarAhora) {
      clearTimeout(respiro.current);
      rec.current = null;
      setG(null);
    }
    setPrepara(v);
    recordarPrepara(receta.bebida, v);
    sfx.play(v === 'pilar' ? 'bordas' : 'etapa');
  };
  const ofrecida = useRef(false);
  useEffect(() => {
    if (!ofrecePilar || ofrecida.current) return;
    ofrecida.current = true;
    sfx.play('bordas');
  }, [ofrecePilar, sfx]);
  // Los gestos que hace Pilar: la postura de cada momento, sus sonidos y el respiro (con movimiento reducido, de una vez).
  // 1.131: con el ritmo de una mano y distinto en cada taza (`semilla`): ni la duración, ni el respiro, ni el movimiento se
  // repiten igual (cafePilar.js)
  useEffect(() => {
    if (!pilarAhora || !clave) return undefined;
    const tipo = gesto;
    const [r, e, gIdx, antes] = [receta, ei, gi + 1, hechos];
    const semilla = Math.random();
    let id = 0;
    let tAntes = 0;
    let vivo = true;
    const acabar = (pose) => {
      sfx.bucle(tipo, false);
      setG({ clave, progreso: 1, pose, pulsado: false, hecho: true, eventos: [] });
      const seguir = () => {
        if (!vivo) return;
        setHechos({ ...antes, [tipo]: pose });
        avanzar(r, e, gIdx);
      };
      if (reduced()) seguir();
      else respiro.current = setTimeout(seguir, respiroPilar(Math.random()));
    };
    if (reduced()) {
      acabar(poseAuto(tipo, 1, { semilla }));
      return () => {
        vivo = false;
      };
    }
    const ms = duracionPilar(tipo, Math.random());
    let t0 = 0;
    const paso_ = (now) => {
      if (!vivo) return;
      const t = Math.min(1, Math.max(0, (now - t0) / ms));
      const pose = poseAuto(tipo, t, { semilla });
      for (const ev of sonidosEntre(tipo, tAntes, t, semilla)) sfx.play(ev);
      tAntes = t;
      const bucle = BUCLE_PILAR[tipo];
      const u = tiempoPilar(t, semilla);
      if (bucle) sfx.bucle(tipo, u >= bucle[0] && u < bucle[1], tipo === 'vapor' ? (pose.espuma ?? 0) : 0);
      if (t >= 1) {
        acabar(pose);
        return;
      }
      setG({ clave, progreso: t, pose, pulsado: true, hecho: false, eventos: [] });
      id = requestAnimationFrame(paso_);
    };
    // Antes de empezar, la cámara va hasta lo que va a coger (más rato si está lejos; casi nada si sigue en el mismo sitio)
    const desde = performance.now();
    const mira = (now) => {
      if (!vivo) return;
      if (escena?.vistaCerca?.() !== false || now - desde > PILAR_MIRA_MS) {
        t0 = now;
        paso_(now);
        return;
      }
      id = requestAnimationFrame(mira);
    };
    id = requestAnimationFrame(mira);
    return () => {
      vivo = false;
      cancelAnimationFrame(id);
      sfx.bucle(tipo, false);
    };
    // Solo al empezar cada gesto de Pilar (lo demás no cambia mientras dura)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pilarAhora, clave]);
  const onDown = (e) => {
    if (!gesto || actual?.hecho || pilarAhora) return;
    e.preventDefault();
    if (reduced()) return completar();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const r = reconocedor();
    aplicar(r.abajo(e.clientX, e.clientY, reloj()));
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(latido);
  };
  const onMove = (e) => {
    if (pilarAhora) return;
    const r = rec.current?.clave === clave ? rec.current.g : null;
    if (!r || !r.estado.pulsado) return;
    aplicar(r.mover(e.clientX, e.clientY, reloj()));
  };
  const onUp = () => {
    if (pilarAhora) return;
    const r = rec.current?.clave === clave ? rec.current.g : null;
    cancelAnimationFrame(raf.current);
    if (!r || !r.estado.pulsado) return;
    aplicar(r.arriba());
  };

  /** «A la barra»; con el influencer, antes se da la vuelta al reloj de arena (el servidor apunta la hora; empezar otra vez no castiga). */
  const aLaBarra = async () => {
    if (!inf) return setPaso('barra');
    if (empezando) return;
    setEmpezando(true);
    setError('');
    try {
      await onEmpezar?.(inf.nivel);
      sfx.play('arena');
      setArena(Date.now());
      setPaso('barra');
    } catch (e) {
      setError(errorCafe(e));
    } finally {
      setEmpezando(false);
    }
  };
  const llevar = async () => {
    sfx.play('bandeja');
    const lleva_ = { receta, vista: vistaTaza(receta, hechos) };
    llevaRef.current = lleva_;
    // 1.130: si pide libro y hay en la balda, de la barra a la estantería (la taza espera en la bandeja de la tabla)
    if (hayLibreria) {
      escena?.barra(false);
      escena?.libreria?.(true, { lleva: lleva_ });
      setPaso('libreria');
      return;
    }
    // 1.143: si pide comida y hay de lo que pide, de la barra a la vitrina (la taza espera en la bandeja)
    if (hayVitrina) {
      escena?.barra(false);
      escena?.vitrina?.(true);
      sfx.play('vitrina');
      setPaso('vitrina');
      return;
    }
    escena?.barra(false, { llevar: lleva_ });
    if (!escena) return setPaso('libro');
    setPaso('yendo');
    await escena.irACliente(cliente.n);
    sfx.play('tazaMesa');
    setPaso('libro');
  };
  /** Con el libro preparado (o «Solo el café»): la bandeja en la mano, hasta su mesa, y se le sirve. */
  const entregarLibro = async (r) => {
    const paquete = r?.paquete ?? null;
    escena?.libreria?.(false, { llevar: { ...llevaRef.current, paquete } });
    if (!escena) return servir(r);
    setPaso('yendo');
    await escena.irACliente(cliente.n);
    sfx.play('tazaMesa');
    servir(r);
  };
  const libreria = useLibreria({
    activo: paso === 'libreria',
    pedido,
    balda,
    escena,
    sfx,
    ayuda: verAyuda(ayudas, nivel, false),
    onListo: entregarLibro,
    onSolo: () => entregarLibro(null),
  });
  /** 1.143: con la pieza en el plato (o «Solo el café»): la taza y el plato en la bandeja, hasta su mesa, y se le sirve. */
  const entregarComida = async (comida) => {
    escena?.vitrina?.(false, { llevar: comida ? { ...llevaRef.current, plato: comida } : llevaRef.current });
    const r = comida ? { comida } : null;
    if (!escena) return servir(r);
    setPaso('yendo');
    await escena.irACliente(cliente.n);
    sfx.play('tazaMesa');
    if (comida) sfx.play('plato');
    servir(r);
  };
  const vitrina = useVitrina({
    activo: paso === 'vitrina',
    pedido: pideComida ? pedido : null,
    obrador,
    especialidad,
    escena,
    sfx,
    ayudas,
    nivel,
    onListo: entregarComida,
    onSolo: () => entregarComida(null),
  });
  const hayVitrina = pideComida && vitrina.opciones.length > 0;
  const lista3d = useRef(null);
  useEffect(() => {
    lista3d.current = { elegir };
  });
  // Los toques en la escena mientras atiendes: lo que se elige en la barra
  useEffect(() => {
    registrarToque?.((id) => {
      if (!lista3d.current) return false;
      if (id.startsWith('barra:')) {
        const [, p, valor] = id.split(':');
        lista3d.current.elegir(p, valor);
        return true;
      }
      return true;
    });
    return () => registrarToque?.(null);
  }, [registrarToque]);

  /** Servir: `r`, lo del libro ({ libro, forma, ok }), la comida ({ comida: receta }) o null (solo el café). */
  const servir = async (r) => {
    const b = r?.libro ?? null;
    if (b) sfx.play('libroDesliza');
    setLibro(b);
    setEntrega(r);
    setPaso('sirviendo');
    setError('');
    try {
      const res = await onServir({ receta: lista, libro: b, ok: b ? r.ok : null, comida: r?.comida ?? null });
      escena?.llevar(null);
      setDado(res);
      setPaso('gracias');
    } catch (e) {
      setError(errorCafe(e));
      setPaso('libro');
    }
  };

  // 1.143 (máximo dos): al darte las gracias quien comió, la mirada baja hasta su plato (que no lo tape el cuadro); al irte, vuelve
  const platoServido = paso === 'gracias' && Boolean(dado?.comida_receta);
  useEffect(() => {
    if (!platoServido || !escena?.mirarPlato) return undefined;
    escena.mirarPlato(cliente.n);
    return () => escena.mirarPlato(null);
  }, [platoServido, escena, cliente.n]);

  // Mientras Pilar prepara, el retrato del cuadro es el suyo
  const retrato =<PixelArt icono={pilarAhora ? PILAR : retratoDe(cliente.aspecto)} />;
  const pide = dado?.pide ?? cliente.pide;
  const enLibreria = paso === 'libreria';
  // 1.128 (Francisco, 13-11-2026: «la palanca se sigue tapando con las instrucciones» y, con el excéntrico, «tapan mucho más»):
  // en la barra, mientras haces un gesto, la comanda se pliega a su título; eligiendo, el excéntrico enseña solo el acertijo de
  // ese paso. Lo plegado sigue ahí para los lectores de pantalla. 1.130: en la librería, igual (el acertijo del libro de cada paso).
  const enVitrina = paso === 'vitrina';
  const plegada = (enBarra && Boolean(gesto)) || (enLibreria && libreria.plegada) || (enVitrina && Boolean(vitrina.gesto));
  const acertijoLibro = { estanteria: 4, seccion: 5, tabla: 5, mirar: 5, forma: 6 }[libreria.fase] ?? -1;
  const acertijoAhora = enBarra && eligiendo ? PARTES.findIndex((p) => p.id === parte) : enLibreria ? acertijoLibro : -1;
  const lineaLibro = comandaLibro(pedido);
  const comanda = !(paso === 'pide' || enBarra || paso === 'yendo' || enLibreria || enVitrina) ? null : (
    <section
      className={`cf3-comanda${raro ? ' cf3-comanda--raro' : ''}${inf ? ' cf3-comanda--influencer' : ''}`}
      data-plegada={plegada ? 'true' : undefined}
      data-solo-libro={enLibreria ? 'true' : undefined}
      data-solo-comida={enVitrina ? 'true' : undefined}
      data-un-acertijo={raro && (plegada || acertijoAhora >= 0) ? 'true' : undefined}
      aria-label={raro ? `La comanda de ${quien}, en acertijos` : inf ? `La comanda de ${quien}, en directo` : `La comanda de ${quien}`}
      style={raro ? { '--cf3-tema': rgb(raro.tema) } : inf ? { '--cf3-tema': rgb(inf.tema) } : undefined}
    >
      <h3 className="cf3-comanda__titulo">
        {inf && (
          <span className="cf3-rec" aria-hidden="true">
            REC
          </span>
        )}
        {raro ? `★ ${quien}` : inf ? quien : cliente.habitual ? `${quien}: lo de siempre` : 'Comanda'}
      </h3>
      {raro ? (
        <ul className="cf3-comanda__acertijos">
          {[...comandaAcertijo(cliente.pide), ...comandaLibroAcertijo(pedido)].map((t, k) => (
            <li key={`${k}:${t}`} data-ahora={k === acertijoAhora ? 'true' : undefined} data-libro={k >= 4 ? 'true' : undefined}>
              {t}
            </li>
          ))}
        </ul>
      ) : (
        <>
          <p className="cf3-comanda__linea">{comandaClara(cliente.pide)}</p>
          {lineaLibro && (
            <p className="cf3-comanda__linea cf3-comanda__linea--libro" data-ahora={enLibreria ? 'true' : undefined}>
              <span className="px-sr">Y un libro: </span>
              {lineaLibro}
            </p>
          )}
          {pideComida && (
            <p className="cf3-comanda__linea cf3-comanda__linea--comida" data-tipo={pedido.tipo} data-ahora={enVitrina ? 'true' : undefined}>
              <span className="px-sr">Y para acompañar: </span>
              {comandaComida(pedido.tipo, pedido)}
            </p>
          )}
        </>
      )}
    </section>
  );

  let texto;
  let botones;
  let extra = null;
  if (paso === 'pide') {
    // 1.130: y el libro, en tres partes (solo de lo que hay en la balda); el del excéntrico, en sus acertijos de la comanda
    const yLibro = pideLibro ? ` ${frasePedido(pedido)}` : pideComida ? ` ${fraseComida(pedido.tipo, cliente.n, pedido)}` : '';
    texto = raro
      ? raro.saludo
      : inf
        ? `«${inf.saludo}${yLibro}»`
        : esViral
          ? `«${saludoViral(cliente.viral)}${yLibro}»`
          : cliente.habitual
            ? `«¡Hola otra vez! Lo de siempre, por favor.${yLibro}»`
            : `«¡Buenas! ¿Me pones esto? Lo tienes apuntado.${yLibro}»`;
    botones = (
      <>
        <button type="button" className="cf3-btn cf3-btn--suave" onClick={onCerrar} data-atras>
          Luego
        </button>
        <button type="button" className="cf3-btn cf3-btn--verde" onClick={aLaBarra} disabled={empezando} aria-label={inf ? 'A la barra: se da la vuelta al reloj de arena' : undefined}>
          A la barra
        </button>
      </>
    );
  } else if (enBarra) {
    const opciones = eligiendo ? opcionesDe(parte, carta, parte === 'bebida' ? null : receta.bebida) : [];
    const def = gesto ? GESTOS[gesto] : null;
    // 1.126 (Francisco, 13-11-2026: «las indicaciones ocupan mucho»): una línea corta abajo; el cómo, junto al objeto
    const pregunta = eligiendo ? PREGUNTA[parte]({ ...receta, casa: opciones.some((o) => o.id === 'casa') }, carta) : '';
    const corte = pregunta.indexOf('? ');
    texto = lista_ ? (
      hayLibreria ? (
        '¡Lista! Huele de maravilla. Ahora, el libro.'
      ) : hayVitrina ? (
        `¡Lista! Huele de maravilla. Ahora, ${pedido.excentrico ? 'lo de su acertijo' : pedido.quiere ? recetaObrador(pedido.quiere)?.nombre.toLowerCase() : pedido.tipo === 'salado' ? 'algo salado' : 'algo dulce'} de la vitrina.`
      ) : (
        '¡Lista! Huele de maravilla.'
      )
    ) : pilarAhora ? (
      <>
        <span className="px-sr">Pilar: </span>«Deja, que esto lo bordo yo.» <span className="cf3-dice__como">{nombreEtapa(etapa, receta)}…</span>
      </>
    ) : eligiendo ? (
      corte > 0 ? (
        <>
          {pregunta.slice(0, corte + 1)} <span className="cf3-dice__como">{pregunta.slice(corte + 2)}</span>
        </>
      ) : (
        pregunta
      )
    ) : def ? (
      reduced() ? (
        `${def.orden}. Un toque basta.`
      ) : (
        <>
          {def.orden}.<span className="px-sr"> {def.ayuda}</span>
        </>
      )
    ) : (
      ''
    );
    const etapas = (
      <ol className="cf3-etapas" aria-label="Las etapas de la taza">
        {ETAPAS.map((id, k) => {
          const est = k < ei ? 'hecha' : k === ei && !lista_ ? 'ahora' : 'luego';
          const p = ELIGE[id];
          const valor = p && receta[p] != null && k <= ei ? nombreOpcion(p, receta[p]) : null;
          return (
            <li key={id} data-estado={est} aria-current={est === 'ahora' ? 'step' : undefined}>
              <span className="cf3-etapas__num" aria-hidden="true">
                {est === 'hecha' ? '✓' : k + 1}
              </span>
              <span className="cf3-etapas__nombre">{nombreEtapa(id, receta)}</span>
              {valor && <span className="px-sr">: {valor}</span>}
            </li>
          );
        })}
      </ol>
    );
    extra = (
      <>
        {ofrecePilar && (
          <div className="cf3-pilar" role="group" aria-label="Pilar te ofrece prepararla">
            <span className="cf3-pilar__retrato" aria-hidden="true">
              <PixelArt icono={PILAR} />
            </span>
            <p className="cf3-pilar__dice">
              <span className="px-sr">Pilar: </span>«Esto ya lo bordas; si quieres, te lo preparo yo.»
            </p>
            <span className="cf3-pilar__botones">
              <button type="button" className="cf3-btn cf3-btn--verde" onClick={() => elegirPrepara('pilar')}>
                Que lo prepare Pilar
              </button>
              <button type="button" className="cf3-btn cf3-btn--suave" onClick={() => elegirPrepara('mano')}>
                Lo hago yo
              </button>
            </span>
          </div>
        )}
        {etapas}
        {eligiendo && (
          <div className="cf3-opciones" role="group" aria-label={nombreEtapa(etapa, receta)}>
            {opciones.map((o) => (
              <button
                key={o.id}
                type="button"
                className="cf3-opcion"
                onClick={() => elegir(parte, o.id)}
                disabled={o.id === 'casa' && tazas < 1}
                data-opcion={o.id}
                data-nuevo={nuevos.has(claveNueva(o.id)) ? 'true' : undefined}
              >
                {nuevos.has(claveNueva(o.id)) && (
                  <span className="cf3-nuevo">
                    <span className="px-sr">, nuevo</span>
                  </span>
                )}
                {o.id === 'casa'
                  ? tazas > 0
                    ? `Tueste de la casa · ${tazas} ${tazas === 1 ? 'taza' : 'tazas'}`
                    : 'Tueste de la casa · sin tazas'
                  : parte === 'grano' && receta.bebida === 'chai'
                  ? o.id === 'suave'
                    ? 'Chai · suave'
                    : 'Chai · intenso'
                  : parte === 'grano' && receta.bebida === 'te'
                  ? o.id === 'suave'
                    ? 'Hoja verde · suave'
                    : 'Hoja negra · intensa'
                  : parte === 'grano' && receta.bebida === 'chocolate'
                    ? o.id === 'suave'
                      ? 'Cacao con leche'
                      : 'Cacao negro'
                    : o.nombre}
              </button>
            ))}
          </div>
        )}
        {gesto && (
          <div className="cf3-medidor" role="progressbar" aria-label={def.orden} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((actual?.progreso ?? 0) * 100)}>
            <span className="cf3-medidor__lleno" style={{ width: `${Math.round((actual?.progreso ?? 0) * 100)}%` }} />
          </div>
        )}
      </>
    );
    botones = (
      <>
        <button
          type="button"
          className="cf3-btn cf3-btn--suave"
          onClick={() => {
            sfx.apagar();
            onCerrar();
          }}
        >
          Luego
        </button>
        {puedeCambiar && (
          <button key="cambiar" type="button" className="cf3-btn cf3-btn--suave" onClick={cambiar}>
            Cambiar
          </button>
        )}
        {receta.bebida && !lista_ && (
          <button key="de-nuevo" type="button" className="cf3-btn cf3-btn--suave" onClick={deNuevo} aria-label="Tirar lo preparado y empezar otra taza">
            De nuevo
          </button>
        )}
        {puedePilar && modoPilar && !lista_ && (
          <button
            key="pilar"
            type="button"
            className="cf3-btn cf3-btn--suave cf3-btn--pilar"
            data-pilar={modoPilar}
            onClick={() => elegirPrepara(modoPilar === 'pilar' ? 'mano' : 'pilar')}
            aria-label={modoPilar === 'pilar' ? 'Prepara Pilar. Cambiar a hacerlo a mano' : 'A mano. Cambiar a que lo prepare Pilar'}
          >
            {modoPilar === 'pilar' ? 'Lo hago yo' : 'Que lo prepare Pilar'}
          </button>
        )}
        {gesto && reduced() && !pilarAhora && (
          <button key={`atajo-${clave}`} type="button" className="cf3-btn cf3-btn--verde" onClick={completar}>
            {def.atajo}
          </button>
        )}
        {lista_ && (
          <button key="llevar" type="button" className="cf3-btn cf3-btn--verde" onClick={llevar}>
            {hayVitrina ? 'A la vitrina' : 'Llevársela'}
          </button>
        )}
      </>
    );
  } else if (paso === 'yendo') {
    const hacia = raro || inf || cliente.habitual ? quien : 'su mesa';
    texto = entrega?.libro || libreria.fase === 'listo' || vitrina.fase === 'listo' ? `Con la bandeja, despacio… Vas hacia ${hacia}.` : `Con cuidado, que quema… Vas hacia ${hacia}.`;
    botones = null;
  } else if (enLibreria) {
    // 1.130: la librería (Libreria.jsx) dice y elige en este mismo cuadro
    texto = libreria.texto;
    extra = libreria.extra;
    botones = libreria.botones;
  } else if (enVitrina) {
    // 1.143: la vitrina (Vitrina.jsx), igual
    texto = vitrina.texto;
    extra = vitrina.extra;
    botones = vitrina.botones;
  } else if (paso === 'sirviendo' && (hayLibreria || hayVitrina)) {
    texto = '«¡Qué buena pinta!»';
    botones = null;
  } else if (paso === 'libro' && entrega) {
    // No se pudo servir (sin red, p. ej.): se vuelve a intentar con lo mismo
    texto = '«¡Qué buena pinta!»';
    botones = (
      <>
        <button key="solo" type="button" className="cf3-btn cf3-btn--suave" onClick={() => servir(null)}>
          Solo el café
        </button>
        <button key="otra-vez" type="button" className="cf3-btn cf3-btn--verde" onClick={() => servir(entrega)}>
          Volver a intentarlo
        </button>
      </>
    );
  } else if (paso === 'libro' || paso === 'sirviendo') {
    texto = pideComida ? sinPieza(pedido.tipo, pedido) : `«¡Qué buena pinta! ${frasePedido(pedido)}»`;
    extra = !pideComida && !balda.length ? (
      <p className="cf3-fichas__vacia">No te quedan libros en la balda. Compra una caja en la distribuidora para recomendar; hoy, solo el café.</p>
    ) : null;
    botones = (
      <button key="solo" type="button" className="cf3-btn cf3-btn--suave" disabled={paso === 'sirviendo'} onClick={() => servir(null)}>
        Solo el café
      </button>
    );
  } else {
    const e = dado?.estrellas ?? 1;
    // 1.132: sin pizarra; la nota del habitual y la reseña dorada se ven aquí, en su bocadillo
    const resena = cliente.habitual && dado?.frase != null ? ` Te dejo una nota: “${RESENAS[dado.frase] ?? ''}”` : '';
    const arte = hechos.verter?.arte;
    const piropo = arte === 'hoja' ? ' ¡Y qué hoja tan bonita!' : arte === 'corazon' ? ' ¡Un corazón en la espuma!' : '';
    const fueInf = inf && dado?.influencer ? dado.influencer : null;
    // 1.143: lo que dice de la pieza que le has llevado (sin sus comillas: va dentro de su frase)
    const comio = dado?.comida_receta ?? null;
    const yComida = comio ? ` ${(GRACIAS_COMIDA[comio] ?? '«¡Y qué buena pinta!»').replace(/[«»]/g, '')}` : '';
    texto = fueInf
      ? despedidaInfluencer(fueInf)
      : raro && dado?.dorada
        ? `«${raro.dorada}» Te ha dejado una reseña dorada.`
        : e === 3
          ? `«¡Perfecto! Justo lo que quería.${piropo}${yComida}${resena}»`
          : e === 2
            ? `«Muy rico, aunque no era del todo lo que pedí.${yComida}${resena}»`
            : `«No era lo que pedí… pero gracias igualmente.${yComida}${resena}»`;
    // 1.130: con esta, la bebida ya la dominas (la 12.ª de 2 estrellas o más): Pilar lo dice al despedirlo
    const yaLaBordas = !raro && e >= 2 && haciaDominio(dominioAntes, lista[0]) === DOMINIO - 1;
    extra = dado && (
      <div className="cf3-resultado">
        <Estrellas n={e} />
        {fueInf && (
          <div className="cf3-publica" style={{ '--cf3-tema': rgb(inf.tema) }} data-viral={fueInf.viral ? 'true' : undefined} data-a-tiempo={fueInf.a_tiempo ? 'true' : 'false'}>
            <p className="cf3-publica__titulo">
              <span className="cf3-rec" aria-hidden="true">
                REC
              </span>
              <span className="px-sr">Publica: </span>
              {`«${inf.publica}»`}
            </p>
            {fueInf.viral && (
              <ul className="cf3-publica__viral" aria-label="Su vídeo se hace viral">
                <li data-tipo="clientes">Mañana vendrán 3 clientes por su vídeo</li>
                <li data-tipo="foto">Foto firmada para tu pared</li>
              </ul>
            )}
          </div>
        )}
        {yaLaBordas && (
          <p className="cf3-pilar cf3-pilar--nota">
            <span className="cf3-pilar__retrato" aria-hidden="true">
              <PixelArt icono={PILAR} />
            </span>
            <span className="cf3-pilar__dice">
              <span className="px-sr">Pilar: </span>«Esto ya lo bordas. La próxima vez, si quieres, te lo preparo yo.»
            </span>
          </p>
        )}
        <ul className="cf3-repaso" aria-label="Lo que acertaste">
          {PARTES.map((p, k) => {
            const ok = lista[k] === pide[k];
            return (
              <li key={p.id} data-ok={ok ? 'true' : 'false'}>
                {ok ? `✓ ${nombreOpcion(p.id, lista[k])}` : `✗ ${nombreOpcion(p.id, lista[k])} · pidió ${nombreOpcion(p.id, pide[k]).toLowerCase()}`}
              </li>
            );
          })}
          {pideComida ? (
            <li data-ok={comio ? 'true' : 'nada'} data-parte="comida">
              {comio ? `✓ ${recetaObrador(comio)?.nombre ?? 'Algo para acompañar'}` : dado.comida_falla ? '· La pieza no llegó a servirse' : '· Hoy, sin nada para acompañar'}
            </li>
          ) : libro && pedido?.id === 'libro' ? (
            repasoLibro(libro, pedido, dado.libro_ok ?? entrega?.ok ?? [], entrega?.forma).map((r) => (
              <li key={r.id} data-ok={r.ok ? 'true' : 'false'} data-parte={r.id}>
                {r.texto}
              </li>
            ))
          ) : (
            <li data-ok="nada">{pedido?.id === 'libro' ? '· Sin libro' : '· Hoy, solo el café'}</li>
          )}
          {libro && (
            <li data-ok={dado.llevado ? 'true' : 'nada'} data-parte="ejemplar">
              {dado.llevado ? `✓ Se lleva «${libro.title}»${esTuyo(libro) ? ', que lo recomiendas tú' : ''}` : dado.en_balda === false ? '· El libro ya no estaba en la balda' : `· «${libro.title}» vuelve a su sección`}
            </li>
          )}
        </ul>
        <p className="cf3-dado" aria-label={`Has ganado ${dado.granos} granos y ${dado.reputacion} de reputación`}>
          <span className="cf3-dado__ficha">+{dado.granos} granos</span>
          {dado.extra > 0 && <span className="cf3-dado__ficha cf3-dado__ficha--libro">{dado.llevado && esTuyo(libro) ? `${dado.extra} por tu libro` : `${dado.extra} por el libro`}</span>}
          {comio && dado.comida_granos > 0 && (
            <span className="cf3-dado__ficha cf3-dado__ficha--comida">
              {dado.comida_excentrico ? `${dado.comida_granos} por ${laPieza(comio)}, el doble` : dado.comida_favorito ? `${dado.comida_granos} por su favorito` : `${dado.comida_granos} por ${laPieza(comio)}`}
            </span>
          )}
          {dado.tueste && dado.bono_granos > 0 && <span className="cf3-dado__ficha cf3-dado__ficha--tueste">{`+${dado.bono_granos} y +${dado.bono_reputacion} por el tueste`}</span>}
          <span className="cf3-dado__ficha cf3-dado__ficha--rep">+{dado.reputacion} reputación</span>
        </p>
      </div>
    );
    // Con su propia clave: si no, React reutilizaría otro botón y un toque a destiempo despediría al cliente
    botones = (
      <button
        key="hasta-luego"
        type="button"
        className="cf3-btn"
        onClick={() => {
          sfx.play('despedida');
          onCerrar();
        }}
      >
        Hasta luego
      </button>
    );
  }

  const def = gesto ? GESTOS[gesto] : null;
  // 1.132: el reloj de arena, a la vista desde la barra hasta que le sirves (en la librería, el camino y al servir también)
  const verArena = Boolean(inf && arena) && paso !== 'pide' && paso !== 'gracias';
  const tema = raro ? rgb(raro.tema) : inf ? rgb(inf.tema) : null;
  return (
    <>
      {comanda}
      {verArena && <RelojArena desde={arena} />}
      {enBarra && (
        <div
          ref={zona}
          className="cf3-gesto"
          data-activo={gesto && !pilarAhora ? 'true' : undefined}
          data-gesto={gesto ?? undefined}
          data-pilar={pilarAhora ? 'true' : undefined}
          role={gesto && !pilarAhora ? 'button' : undefined}
          tabIndex={gesto && !pilarAhora ? 0 : -1}
          aria-hidden={gesto && !pilarAhora ? undefined : 'true'}
          aria-label={gesto ? `${def.orden}. Con el teclado, Intro lo hace de una vez.` : undefined}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onLostPointerCapture={onUp}
          onKeyDown={(e) => {
            if (gesto && !pilarAhora && (e.key === 'Enter' || e.key === ' ') && !e.repeat) {
              e.preventDefault();
              completar();
            }
          }}
        >
          {ayuda && eligiendo && marcasAhora.map((m) => <span key={m.id} className="cf3-ayuda" data-para={m.id} style={{ left: `${m.x}px`, top: `${m.y}px` }} aria-hidden="true" />)}
          {ayuda && gesto && !pilarAhora && pista && !(actual?.progreso > 0) && <span className="cf3-ayuda cf3-ayuda--gesto" style={{ left: `${pista.x}px`, top: `${pista.y}px` }} aria-hidden="true" />}
          {gesto && !pilarAhora && pista && !(actual?.progreso > 0) && (
            <span className="cf3-gesto__pista" style={{ left: `${pista.x}px`, top: `${pista.y}px` }}>
              <Pista tipo={gesto} />
            </span>
          )}
          {gesto && !pilarAhora && pista && !(actual?.progreso > 0) && !reduced() && (
            <span
              className="cf3-gesto__nota"
              data-lado={ladoNota(pista.x, zona.current?.clientWidth ?? 390)}
              style={{ left: `${pista.x}px`, top: `${pista.y}px` }}
              aria-hidden="true"
            >
              {def.ayuda}
            </span>
          )}
          {gesto && actual?.hecho && (
            <span className="cf3-gesto__hecho" aria-hidden="true">
              ¡Hecho!
            </span>
          )}
        </div>
      )}
      {enLibreria && libreria.capa}
      {enVitrina && vitrina.capa}
      {lleva && <span className="px-sr">Llevas {comandaClara(lista).toLowerCase()}</span>}
      <div
        className={`cf3-franja cf3-franja--atender${raro ? ' cf3-franja--raro' : ''}${inf ? ' cf3-franja--influencer' : ''}${enBarra || enLibreria || enVitrina ? ' cf3-franja--barra' : ''}${enLibreria ? ' cf3-franja--libreria' : ''}${enVitrina ? ' cf3-franja--vitrina' : ''}`}
        role="region"
        aria-label={`Atender a ${quien}`}
        data-paso={paso}
        data-pedido={pedido.id}
        data-pide-libro={pideLibro ? `${pedido.genero}:${pedido.extension}:${pedido.forma}` : undefined}
        data-pide-comida={pideComida ? pedido.tipo : undefined}
        data-receta={lista.map((x) => x ?? '').join()}
        data-etapa={enBarra ? (lista_ ? 'lista' : etapa) : undefined}
        data-gesto={enLibreria ? (libreria.gesto ?? undefined) : enVitrina ? (vitrina.gesto ?? undefined) : (gesto ?? undefined)}
        data-lib={enLibreria ? libreria.fase : undefined}
        data-vitrina={enVitrina ? vitrina.fase : undefined}
        data-pilar={enBarra && modoPilar ? modoPilar : undefined}
        data-pilar-ahora={pilarAhora ? 'true' : undefined}
        data-ayuda={ayuda ? 'true' : undefined}
        data-progreso={enLibreria ? libreria.progreso : enVitrina ? vitrina.progreso : gesto ? Math.round((actual?.progreso ?? 0) * 100) : undefined}
        data-influencer={inf ? inf.nivel : undefined}
        data-viral={esViral ? 'true' : undefined}
        data-arena={verArena ? 'true' : undefined}
        style={tema ? { '--cf3-tema': tema } : undefined}
      >
        <span className="cf3-quien" aria-hidden="true">
          {raro ? `★ ${quien}` : quien}
        </span>
        <div className="cf3-caja">
          <span className={`cf3-retrato${raro ? ' cf3-retrato--raro' : ''}${inf ? ' cf3-retrato--influencer' : ''}`}>{retrato}</span>
          <p className="cf3-dice" aria-live="polite">
            <span className="px-sr">{quien}: </span>
            {texto}
          </p>
          {extra && <div className="cf3-extra">{extra}</div>}
          {error && (
            <p className="cf3-error" role="alert">
              {error}
            </p>
          )}
          {botones && <div className="cf3-botones">{botones}</div>}
        </div>
      </div>
    </>
  );
}
