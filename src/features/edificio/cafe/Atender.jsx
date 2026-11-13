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
// 4. El libro, de extra: tres fichas de lo que tienes en la balda (§121.3: los ejemplares comprados en cajas) con sus pistas
//    (páginas, año, género), o «Solo el café». Si encaja, el cliente se lleva el ejemplar y paga 2 granos más; sin
//    ejemplares en la balda, solo el café.
// 5. Estrellas (de 1 a 3, según lo acertado; las pone el servidor con `cafe_servir`) y el repaso de qué acertaste. Los gestos
//    no cambian las estrellas: solo cuenta la receta.
import { useEffect, useMemo, useRef, useState } from 'react';
import { colorDe } from './cafeMuebles';
import { PARTES, PEDIDO_ACERTIJO, RESENAS, comandaAcertijo, comandaClara, librosParaRecomendar, nombreOpcion, opcionesDe } from './cafeClientes';
import { AYUDA_NIVELES, AYUDA_PARADO_MS, ELIGE, ladoNota, ETAPAS, GESTOS, crearGesto, gestosDe, nombreEtapa, verAyuda, vistaTaza } from './cafeGestos';
import { crearSfxBarra } from './cafeSfx';
import { retratoDe } from './cafeIconos';
import { errorCafe } from './cafeService';
import { PixelArt } from './PixelArt';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** La hora para los gestos que se mantienen (fuera del componente: solo se llama en los toques y en cada cuadro). */
const reloj = () => performance.now();
const rgb = (c) => `rgb(${c[0]} ${c[1]} ${c[2]})`;
const VACIA = { bebida: null, grano: null, leche: null, toque: null };
/** Cuánto se queda el objeto en su postura final antes de pasar al siguiente (un respiro; directo con movimiento reducido). */
const RESPIRO_MS = 420;
const CATEGORIAS = [
  [/science fiction|ciencia ficci/, 'Ciencia ficción'],
  [/fantas/, 'Fantasía'],
  [/myster|misterio|crime|crimen|thriller|polic|suspense|detective/, 'Misterio'],
  [/romanc|amor|love/, 'Amor'],
  [/classic|clásic/, 'Clásico'],
  [/poetry|poesía/, 'Poesía'],
  [/histor/, 'Historia'],
  [/biograph|biograf/, 'Biografía'],
  [/juvenile|young adult|juvenil/, 'Juvenil'],
  [/fiction|ficci|novel/, 'Novela'],
];
/** Las pistas de una ficha: género, páginas, año y si es de tus favoritos o el último que terminaste. */
function pistas(b, ctx) {
  const out = [];
  const cat = (b.categories ?? []).join(' ').toLowerCase();
  const genero = CATEGORIAS.find(([re]) => re.test(cat))?.[1];
  if (genero) out.push(genero);
  if (b.pageCount > 0) out.push(`${b.pageCount} págs.`);
  const anio = String(b.publishedDate ?? '').slice(0, 4);
  if (/^\d{4}$/.test(anio)) out.push(anio);
  if (b.favorite || b.rating >= 5) out.push('Favorito');
  if (ctx?.ultimo === b.id) out.push('Lo último que leíste');
  return out;
}

/** Lo que se pregunta al elegir cada parte. */
const PREGUNTA = {
  bebida: (r, carta = []) =>
    carta.includes('hielo')
      ? '¿Café, té, chocolate o café con hielo? Toca la cafetera, la tetera, el cazo o la cubitera.'
      : carta.includes('chocolate')
        ? '¿Café, té o chocolate? Toca la cafetera, la tetera o el cazo.'
        : '¿Café o té? Toca la cafetera o la tetera.',
  grano: (r) =>
    r.bebida === 'te'
      ? '¿Qué hoja? Toca un tarro: la verde es suave; la negra, intensa.'
      : r.bebida === 'chocolate'
        ? '¿Qué cacao? Toca un tarro: el claro, con leche; el oscuro, negro.'
        : r.casa
          ? '¿Qué grano? Toca un tarro o el saco: el claro es suave; el tostado, intenso; el saco, tu tueste de la casa.'
          : '¿Qué grano? Toca un tarro: el claro es suave; el tostado, intenso.',
  leche: () => '¿Leche? Toca una jarrita, o «Sin leche».',
  toque: (r, carta = []) =>
    carta.includes('vainilla')
      ? '¿Un toque final? Toca la canela, la miel, la nata o la vainilla, o «Sin nada».'
      : carta.includes('nata')
        ? '¿Un toque final? Toca la canela, la miel o la nata, o «Sin nada».'
        : '¿Un toque final? Toca la canela o la miel, o «Sin nada».',
};
/** Qué marca de la barra mira cada gesto (donde va la pista y, en la manivela y la miel, el centro del gesto). */
const MARCA = { manivela: 'manivela', apisonar: 'portafiltro', palanca: 'palanca', cuchara: 'tarros', tetera: 'tetera', colador: 'taza', vapor: 'vapor', verter: 'taza', agitar: 'taza', hilo: 'taza', molinillo: 'cazo', cazo: 'cazo', batir: 'bol', rascar: 'vaina', coctelera: 'coctelera' };
/** El sonido al elegir cada cosa. */
const SONIDO_ELEGIR = {
  bebida: (v) => ({ te: 'tetera', chocolate: 'cazo', frio: 'cubitera' })[v] ?? 'cafetera',
  grano: (v) => (v === 'casa' ? 'saco' : 'tarro'),
  leche: () => 'jarra',
  toque: (v) => (v === 'vainilla' ? 'vaina' : 'jarra'),
};
/** Los que se mantienen suenan mientras dura (el café que cae, el agua, el vapor). */
const SUENA_MIENTRAS = {
  palanca: (s) => s.pose.bajada >= 0.85,
  tetera: (s) => s.pose.alzada >= 0.6,
  vapor: (s) => Math.abs(s.pose.inclina) >= 0.5,
  cazo: (s) => s.pose.inclina >= 0.6,
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

/** La pista del gesto, dibujada sobre el objeto: una flecha de píxel por gesto (quieta con movimiento reducido). */
export function Pista({ tipo }) {
  const p = GESTOS[tipo]?.pista;
  const trazo = {
    giro: 'M 44 12 A 32 32 0 1 1 12 44',
    abajo: 'M 44 8 L 44 70',
    'abajo-mantener': 'M 44 8 L 44 62',
    // Bloque 6b: tirar del asa del tambor hacia ti (el asa arriba y el tirón hacia abajo)
    tirar: 'M 28 12 L 60 12 M 44 12 L 44 64',
    derecha: 'M 6 44 Q 44 10 82 44',
    'arriba-mantener': 'M 44 76 L 44 18',
    'vaiven-vertical': 'M 44 14 L 44 74',
    'lado-mantener': 'M 14 44 L 74 44',
    'izquierda-mantener': 'M 76 44 L 18 44',
    remover: 'M 44 10 A 34 26 0 1 1 10 44 A 34 26 0 0 1 44 10',
    batir: 'M 44 30 a 12 12 0 1 1 -1 0 m 1 10 a 12 12 0 1 1 -1 0 m 1 10 a 12 12 0 1 1 -1 0',
    rascar: 'M 30 10 L 30 70 M 44 10 L 44 70 M 58 10 L 58 70',
    coctelera: 'M 4 56 Q 44 16 84 56 M 84 56 L 74 50 M 4 56 L 14 50',
    trazo: 'M 44 6 Q 30 24 44 40 Q 58 56 44 78',
    vaiven: 'M 8 44 L 80 44',
    dibujo: 'M 44 44 m -6 0 a 6 6 0 1 1 12 0 a 12 12 0 1 1 -24 0 a 18 18 0 1 1 36 0',
  }[p];
  if (!trazo) return null;
  return (
    <svg className="cf3-pista" data-pista={p} viewBox="0 0 88 88" aria-hidden="true" shapeRendering="crispEdges">
      <path d={trazo} className="cf3-pista__trazo" />
      <circle className="cf3-pista__dedo" r="7" />
      {p.endsWith('mantener') && <circle className="cf3-pista__mantener" r="13" />}
    </svg>
  );
}

const SIN_CARTA = [];

export function Atender({ cliente, ctx, libros, escena, registrarToque, onServir, onCerrar, soundOn = false, ayudas = 'auto', nivel = 1, carta = SIN_CARTA, tazas = 0 }) {
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
  const [dado, setDado] = useState(null);
  const [error, setError] = useState('');
  // Las portadas que no cargan (sin red, o Open Library devuelve un píxel vacío): esas fichas vuelven a la tapa de color
  const [sinPortada, setSinPortada] = useState({});
  const [sfx] = useState(() => crearSfxBarra());
  const rec = useRef(null);
  const raf = useRef(0);
  const respiro = useRef(0);
  const zona = useRef(null);
  const raro = cliente.raro;
  const quien = cliente.habitual || raro ? cliente.nombre : 'Cliente';
  const fichas = useMemo(() => librosParaRecomendar(cliente.pedido, libros, ctx, cliente.semilla), [cliente.pedido, cliente.semilla, libros, ctx]);
  const lista = [receta.bebida, receta.grano, receta.leche, receta.toque];
  const encaja = libro ? cliente.pedido.encaja(libro, ctx) : false;
  const enBarra = paso === 'barra';
  const lleva = paso === 'yendo' || paso === 'libro' || paso === 'sirviendo';

  const etapa = ETAPAS[ei] ?? null;
  const parte = etapa ? ELIGE[etapa] : null;
  const eligiendo = enBarra && Boolean(parte) && receta[parte] == null;
  const gesto = enBarra && etapa && !eligiendo ? (gestosDe(etapa, receta)[gi] ?? null) : null;
  const clave = gesto ? `${ei}:${gi}:${gesto}` : null;
  const lista_ = enBarra && ei >= ETAPAS.length;
  const actual = gesto && g?.clave === clave ? g : null;
  const pista = pistaEn?.clave === clave ? pistaEn : null;
  // La «!» de ayuda: en qué punto estás (elegir una parte, un gesto o la taza lista) y si toca enseñarla
  const puntoClave = enBarra ? (lista_ ? 'lista' : eligiendo ? `e:${ei}:${parte}` : (clave ?? 'nada')) : paso;
  const ayuda = verAyuda(ayudas, nivel, paradoEn === puntoClave);
  const marcasAhora = marcas?.clave === puntoClave ? marcas.lista : [];
  const vista = useMemo(() => vistaTaza(receta, hechos, actual ? { tipo: gesto, pose: actual.pose } : null), [receta, hechos, actual, gesto]);

  useEffect(() => sfx.setActivo(soundOn), [sfx, soundOn]);
  // 1.126: cada momento del cliente con su sonido (la comanda, la taza, el libro, las estrellas y los granos, la despedida)
  useEffect(() => {
    sfx.play(cliente.raro ? 'raro' : 'comanda');
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
    return () => ids.forEach(clearTimeout);
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
      enfoque: lista_ ? 'lista' : eligiendo ? etapa : (gesto ?? etapa),
    });
  }, [enBarra, escena, receta, gesto, actual, hechos, vista, eligiendo, parte, lista_, etapa, carta, tazas]);
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
  const elegir = (p, valor) => {
    if (!eligiendo || p !== parte) return;
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
      rec.current = { clave, g: crearGesto(gesto, { escala: Math.min(ancho, 600) / 390, centro }) };
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
  const onDown = (e) => {
    if (!gesto || actual?.hecho) return;
    e.preventDefault();
    if (reduced()) return completar();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const r = reconocedor();
    aplicar(r.abajo(e.clientX, e.clientY, reloj()));
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(latido);
  };
  const onMove = (e) => {
    const r = rec.current?.clave === clave ? rec.current.g : null;
    if (!r || !r.estado.pulsado) return;
    aplicar(r.mover(e.clientX, e.clientY, reloj()));
  };
  const onUp = () => {
    const r = rec.current?.clave === clave ? rec.current.g : null;
    cancelAnimationFrame(raf.current);
    if (!r || !r.estado.pulsado) return;
    aplicar(r.arriba());
  };

  const llevar = async () => {
    sfx.play('bandeja');
    const lleva_ = { receta, vista: vistaTaza(receta, hechos) };
    escena?.barra(false, { llevar: lleva_ });
    if (!escena) return setPaso('libro');
    setPaso('yendo');
    await escena.irACliente(cliente.n);
    sfx.play('tazaMesa');
    setPaso('libro');
  };
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

  const servir = async (b) => {
    if (b) sfx.play('libroDesliza');
    setLibro(b);
    setPaso('sirviendo');
    setError('');
    try {
      const r = await onServir({ receta: lista, encaja: b ? cliente.pedido.encaja(b, ctx) : null, libro: b });
      escena?.llevar(null);
      setDado(r);
      setPaso('gracias');
    } catch (e) {
      setError(errorCafe(e));
      setPaso('libro');
    }
  };

  const retrato = <PixelArt icono={retratoDe(cliente.aspecto)} />;
  const pide = dado?.pide ?? cliente.pide;
  const comanda = !(paso === 'pide' || enBarra || paso === 'yendo') ? null : (
    <section
      className={`cf3-comanda${raro ? ' cf3-comanda--raro' : ''}`}
      aria-label={raro ? `La comanda de ${quien}, en acertijos` : `La comanda de ${quien}`}
      style={raro ? { '--cf3-tema': rgb(raro.tema) } : undefined}
    >
      <h3 className="cf3-comanda__titulo">{raro ? `★ ${quien}` : cliente.habitual ? `${quien}: lo de siempre` : 'Comanda'}</h3>
      {raro ? (
        <ul className="cf3-comanda__acertijos">
          {comandaAcertijo(cliente.pide).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      ) : (
        <p className="cf3-comanda__linea">{comandaClara(cliente.pide)}</p>
      )}
    </section>
  );

  let texto;
  let botones;
  let extra = null;
  if (paso === 'pide') {
    texto = raro ? raro.saludo : cliente.habitual ? '«¡Hola otra vez! Lo de siempre, por favor.»' : '«¡Buenas! ¿Me pones esto? Lo tienes apuntado.»';
    botones = (
      <>
        <button type="button" className="cf3-btn cf3-btn--suave" onClick={onCerrar}>
          Luego
        </button>
        <button type="button" className="cf3-btn cf3-btn--verde" onClick={() => setPaso('barra')}>
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
      '¡Lista! Huele de maravilla.'
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
        {etapas}
        {eligiendo && (
          <div className="cf3-opciones" role="group" aria-label={nombreEtapa(etapa, receta)}>
            {opciones.map((o) => (
              <button key={o.id} type="button" className="cf3-opcion" onClick={() => elegir(parte, o.id)} disabled={o.id === 'casa' && tazas < 1} data-opcion={o.id}>
                {o.id === 'casa'
                  ? tazas > 0
                    ? `Tueste de la casa · ${tazas} ${tazas === 1 ? 'taza' : 'tazas'}`
                    : 'Tueste de la casa · sin tazas'
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
        {gesto && reduced() && (
          <button key={`atajo-${clave}`} type="button" className="cf3-btn cf3-btn--verde" onClick={completar}>
            {def.atajo}
          </button>
        )}
        {lista_ && (
          <button key="llevar" type="button" className="cf3-btn cf3-btn--verde" onClick={llevar}>
            Llevársela
          </button>
        )}
      </>
    );
  } else if (paso === 'yendo') {
    texto = `Con cuidado, que quema… Vas hacia ${raro || cliente.habitual ? quien : 'su mesa'}.`;
    botones = null;
  } else if (paso === 'libro' || paso === 'sirviendo') {
    texto = `«¡Qué buena pinta! ${raro ? (PEDIDO_ACERTIJO[cliente.pedido.id] ?? PEDIDO_ACERTIJO.libre) : cliente.pedido.frase}»`;
    extra = !fichas.length ? (
      <p className="cf3-fichas__vacia">No te quedan libros en la balda. Compra una caja en la distribuidora para recomendar; hoy, solo el café.</p>
    ) : (
      <ul className="cf3-fichas" aria-label="Recomiéndale un libro (opcional)">
        {fichas.map((b) => (
          <li key={b.clave ?? b.id}>
            <button
              type="button"
              className="cf3-ficha"
              aria-label={`Recomendar «${b.title}»`}
              disabled={paso === 'sirviendo'}
              onClick={() => servir(b)}
              style={{ '--cf3-tapa': rgb(colorDe(b.title)) }}
            >
              {/* 1.126 (Francisco, 13-11-2026): la portada real, si la tiene y carga; si no, la tapa de color con el título */}
              <span className={`cf3-ficha__tapa${b.cover && !sinPortada[b.cover] ? ' cf3-ficha__tapa--portada' : ''}`} aria-hidden="true">
                {b.cover && !sinPortada[b.cover] && (
                  <img
                    className="cf3-ficha__portada"
                    src={b.cover}
                    alt=""
                    referrerPolicy="no-referrer"
                    decoding="async"
                    draggable="false"
                    onLoad={(e) => e.currentTarget.naturalWidth < 10 && setSinPortada((m) => ({ ...m, [b.cover]: true }))}
                    onError={() => setSinPortada((m) => ({ ...m, [b.cover]: true }))}
                  />
                )}
                {!(b.cover && !sinPortada[b.cover]) && <span className="cf3-ficha__titulo">{b.title}</span>}
              </span>
              {b.cover && !sinPortada[b.cover] && <span className="cf3-ficha__nombre">{b.title}</span>}
              <span className="cf3-ficha__autor">{b.author}</span>
              <span className="cf3-ficha__pistas">
                {pistas(b, ctx).map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
    botones = (
      <button key="solo" type="button" className="cf3-btn cf3-btn--suave" disabled={paso === 'sirviendo'} onClick={() => servir(null)}>
        Solo el café
      </button>
    );
  } else {
    const e = dado?.estrellas ?? 1;
    const resena = cliente.habitual && dado?.frase != null ? ` Te dejo una nota en la pizarra: “${RESENAS[dado.frase] ?? ''}”` : '';
    const arte = hechos.verter?.arte;
    const piropo = arte === 'hoja' ? ' ¡Y qué hoja tan bonita!' : arte === 'corazon' ? ' ¡Un corazón en la espuma!' : '';
    texto =
      raro && dado?.dorada
        ? `«${raro.dorada}» Te ha dejado una reseña dorada en la pizarra.`
        : e === 3
          ? `«¡Perfecto! Justo lo que quería.${piropo}${resena}»`
          : e === 2
            ? `«Muy rico, aunque no era del todo lo que pedí.${resena}»`
            : `«No era lo que pedí… pero gracias igualmente.${resena}»`;
    extra = dado && (
      <div className="cf3-resultado">
        <Estrellas n={e} />
        <ul className="cf3-repaso" aria-label="Lo que acertaste">
          {PARTES.map((p, k) => {
            const ok = lista[k] === pide[k];
            return (
              <li key={p.id} data-ok={ok ? 'true' : 'false'}>
                {ok ? `✓ ${nombreOpcion(p.id, lista[k])}` : `✗ ${nombreOpcion(p.id, lista[k])} · pidió ${nombreOpcion(p.id, pide[k]).toLowerCase()}`}
              </li>
            );
          })}
          <li data-ok={libro ? (dado.llevado ? 'true' : 'false') : 'nada'}>
            {libro ? (dado.llevado ? `✓ Se lleva «${libro.title}»` : encaja ? '✗ El libro no estaba en la balda' : '✗ El libro no era: vuelve a la balda') : '· Sin libro'}
          </li>
        </ul>
        <p className="cf3-dado" aria-label={`Has ganado ${dado.granos} granos y ${dado.reputacion} de reputación`}>
          <span className="cf3-dado__ficha">+{dado.granos} granos</span>
          {dado.extra > 0 && <span className="cf3-dado__ficha cf3-dado__ficha--libro">{`${dado.extra} por el libro`}</span>}
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
  return (
    <>
      {comanda}
      {enBarra && (
        <div
          ref={zona}
          className="cf3-gesto"
          data-activo={gesto ? 'true' : undefined}
          data-gesto={gesto ?? undefined}
          role={gesto ? 'button' : undefined}
          tabIndex={gesto ? 0 : -1}
          aria-hidden={gesto ? undefined : 'true'}
          aria-label={gesto ? `${def.orden}. Con el teclado, Intro lo hace de una vez.` : undefined}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onLostPointerCapture={onUp}
          onKeyDown={(e) => {
            if (gesto && (e.key === 'Enter' || e.key === ' ') && !e.repeat) {
              e.preventDefault();
              completar();
            }
          }}
        >
          {ayuda && eligiendo && marcasAhora.map((m) => <span key={m.id} className="cf3-ayuda" data-para={m.id} style={{ left: `${m.x}px`, top: `${m.y}px` }} aria-hidden="true" />)}
          {ayuda && gesto && pista && !(actual?.progreso > 0) && <span className="cf3-ayuda cf3-ayuda--gesto" style={{ left: `${pista.x}px`, top: `${pista.y}px` }} aria-hidden="true" />}
          {gesto && pista && !(actual?.progreso > 0) && (
            <span className="cf3-gesto__pista" style={{ left: `${pista.x}px`, top: `${pista.y}px` }}>
              <Pista tipo={gesto} />
            </span>
          )}
          {gesto && pista && !(actual?.progreso > 0) && !reduced() && (
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
      {lleva && <span className="px-sr">Llevas {comandaClara(lista).toLowerCase()}</span>}
      <div
        className={`cf3-franja cf3-franja--atender${raro ? ' cf3-franja--raro' : ''}${enBarra ? ' cf3-franja--barra' : ''}`}
        role="region"
        aria-label={`Atender a ${quien}`}
        data-paso={paso}
        data-pedido={cliente.pedido.id}
        data-receta={lista.map((x) => x ?? '').join()}
        data-etapa={enBarra ? (lista_ ? 'lista' : etapa) : undefined}
        data-gesto={gesto ?? undefined}
        data-ayuda={ayuda ? 'true' : undefined}
        data-progreso={gesto ? Math.round((actual?.progreso ?? 0) * 100) : undefined}
        style={raro ? { '--cf3-tema': rgb(raro.tema) } : undefined}
      >
        <span className="cf3-quien" aria-hidden="true">
          {raro ? `★ ${quien}` : quien}
        </span>
        <div className="cf3-caja">
          <span className={`cf3-retrato${raro ? ' cf3-retrato--raro' : ''}`}>{retrato}</span>
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
