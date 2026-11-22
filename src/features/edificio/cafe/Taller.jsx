// El café-librería del bajo, 1.133 (encargo de Francisco del 14-11-2026; plan en docs/qa/cafe-libreria.md §16.3, bloque 2 de
// §16.6): el taller de la trastienda. Detrás de la barra, una puerta baja lleva al banco de don Celestino. Cada encargo es un
// libro que ha dejado un cliente, con sus daños (de 2 a 5 según el nivel), y cada daño se arregla con su gesto, su objeto y su
// sonido sobre el propio libro (`cafeTallerGestos.js`): la brocha, la goma de miga y el canto de la mano, la plegadera, la cola
// y la prensa, y el hierro con el pan de oro. Al final, el ex libris del taller en la guarda y la ficha «antes / después» en
// una cartulina sobre el banco. Las estrellas salen del mimo de cada daño y el servidor paga (`cafe_restaurar`). Sin reloj ni
// prisas: lo que se deja a medias se recuerda mientras la app sigue abierta. Con movimiento reducido o con el teclado, cada
// gesto se hace de una vez. Pilar no restaura.
import { useEffect, useMemo, useRef, useState } from 'react';
import { CELESTINO_FIN, CELESTINO_PRIMERA, CELESTINO_SIN, DANO, DANOS, EXLIBRIS, LIBROS_TALLER, estrellasTaller } from './cafeTaller';
import { PLIEGUE, crearGestoTaller, gestosDano, letrasTapa, manchasDe, semillaEncargo, superficieDe } from './cafeTallerGestos';
import { pintarFicha, vistasDe } from './cafeTallerPintura';
import { AYUDA_PARADO_MS, ladoNota, verAyuda } from './cafeGestos';
import { crearSfxBarra } from './cafeSfx';
import { errorCafe, restaurarEncargo } from './cafeService';
import { DON_CELESTINO } from './cafeIconos';
import { PixelArt } from './PixelArt';
import { Pista } from './Pista';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const reloj = () => performance.now();
const minus = (s = '') => s.charAt(0).toLowerCase() + s.slice(1);
/** «a», «a y b», «a, b y c». */
const enLista = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : (xs[0] ?? ''));

/**
 * Lo de cada gesto en el banco: la vista de la cámara, el libro abierto (1) o cerrado (0), si va a la prensa, la herramienta en
 * la mano (y la nota del golpe de madera al cogerla), la pista del dedo y el bucle que suena mientras se trabaja.
 */
const GESTO_T = {
  polvo: { vista: 'tapa', abre: 0, herramienta: 'brocha', tono: 330, pista: 'pasadas', bucle: 'brocha' },
  manchas: { vista: 'pliego', abre: 1, herramienta: 'goma', tono: 294, pista: 'circulos', bucle: 'goma' },
  arrugas: { vista: 'derecha', abre: 1, herramienta: 'plegadera', tono: 392, pista: 'vaiven-vertical', bucle: 'plegadera' },
  cola: { vista: 'lomo', abre: 0, herramienta: 'pincel', tono: 262, pista: 'vaiven-vertical', bucle: 'cola' },
  prensa: { vista: 'prensa', abre: 0, enPrensa: 1, herramienta: null, pista: 'giro', bucle: null },
  dorado: { vista: 'titulo', abre: 0, herramienta: 'hierro', tono: 440, pista: 'mantener', bucle: null },
  exlibris: { vista: 'izquierda', abre: 1, herramienta: 'sello', tono: 196, pista: 'mantener', bucle: null },
};
const BUCLES_T = ['brocha', 'goma', 'plegadera', 'cola'];
/** Lo que suena al hacer un gesto de una vez (movimiento reducido o teclado), antes del «hecho». */
const ATAJO_SUENA = { polvo: ['moho'], manchas: ['migas'], arrugas: ['alisado', { ultima: true }], dorado: ['oro', { k: 4 }] };

/** Lo que se deja a medias, por encargo, mientras la app siga abierta: { i, mimo, hechas, colaMimo }. */
const A_MEDIAS = new Map();

/** Los pasos de un encargo, en el orden del banco (`DANOS`): cada daño con sus gestos y, al final, el ex libris. */
function pasosDe(encargo) {
  if (!encargo) return [];
  const out = [];
  for (const d of DANOS.filter((x) => encargo.danos.includes(x))) for (const tipo of gestosDano(d)) out.push({ dano: d, tipo });
  out.push({ dano: null, tipo: 'exlibris' });
  return out;
}

/** Dónde se apoya la herramienta antes de tocar: junto a lo que hay que arreglar. */
function poseInicial(tipo, encargo) {
  if (tipo === 'polvo') return { u: 0.7, v: 0.66, baja: 0 };
  if (tipo === 'manchas') {
    const m = manchasDe(semillaEncargo(encargo))[0];
    return { u: m.u, v: m.v, baja: 0 };
  }
  if (tipo === 'arrugas') return { u: PLIEGUE.a[0], v: PLIEGUE.a[1], baja: 0 };
  if (tipo === 'cola') return { u: 0.08, v: 0.12, baja: 0 };
  if (tipo === 'dorado') {
    const l = letrasTapa(encargo?.tapa ?? '')[0];
    return l ? { u: l.u, v: l.v + 0.08, baja: 0 } : null;
  }
  return null;
}

/** La marca de la escena sobre la que va la pista (y la «!»): lo siguiente que hay que tocar. */
function marcaDe(tipo, g) {
  if (tipo === 'polvo') return 'tapa:0.58:0.52';
  if (tipo === 'manchas') {
    if (g?.fase === 'barrer') return 'pliego:0.5:0.55';
    const k = g ? g.vista.manchas.findIndex((m) => m.alfa > 0.05) : 0;
    return `mancha:${Math.max(0, k)}`;
  }
  if (tipo === 'arrugas') return 'pliegue';
  if (tipo === 'cola') return 'tapa:0.08:0.5';
  if (tipo === 'prensa') return 'husillo';
  if (tipo === 'dorado') {
    const k = g ? g.vista.oro.findIndex((o) => o < 1) : 0;
    return `letra:${Math.max(0, k)}`;
  }
  return 'guarda';
}

/** Lo que se pide en cada paso (y su cómo, en la notita junto al objeto). */
function ordenDe(paso, g) {
  if (!paso) return { orden: '', ayuda: '' };
  if (paso.tipo === 'exlibris') return EXLIBRIS;
  const d = DANO[paso.dano];
  if (paso.tipo === 'prensa') return { orden: d.prensa, ayuda: d.ayudaPrensa };
  if (paso.tipo === 'manchas' && g?.fase === 'barrer') return { orden: d.barrer, ayuda: d.ayudaBarrer };
  return d;
}

/** Cuando la cámara ha llegado (la escena está quieta), una vez. Devuelve cómo cancelarlo. */
function alQuedarQuieta(escena, fn) {
  let vivo = true;
  let id = 0;
  const mira = () => {
    if (!vivo) return;
    if (escena && !escena.settled()) {
      id = requestAnimationFrame(mira);
      return;
    }
    fn();
  };
  id = requestAnimationFrame(mira);
  return () => {
    vivo = false;
    cancelAnimationFrame(id);
  };
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

/**
 * `estado`: el taller del día ({ encargo, hechos, hoy }, de `cargarTaller`); `dia`, el día que juegas; `onHecho(r)`, con lo que
 * devuelve el servidor al terminar un encargo (el café, el día, los libros, el taller y el progreso). `nombre`, el del café (va
 * en el ex libris).
 */
export function Taller({ escena, estado, dia, nombre = null, soundOn = false, ayudas = 'auto', nivel = 3, onHecho, onCerrar }) {
  // El encargo de cuando entraste (al terminarlo, el servidor ya no lo tiene pendiente, pero la ficha sigue siendo suya)
  const [encargo] = useState(() => estado?.encargo ?? null);
  const [primera] = useState(() => Boolean(estado?.encargo?.primero && !estado?.hechos));
  const medias = encargo ? (A_MEDIAS.get(encargo.n) ?? null) : null;
  const pasos = useMemo(() => pasosDe(encargo), [encargo]);
  // 'entrando', 'primera' (lo que cuenta don Celestino la primera vez), 'encargo', 'sin' (no hay encargo), 'gesto', 'respiro'
  // (un daño arreglado), 'guardando', 'ficha' (el resultado) y 'error'
  const [fase, setFase] = useState('entrando');
  const [habla, setHabla] = useState(0);
  const [pi, setPi] = useState(0);
  const [g, setG] = useState(null);
  const [listo, setListo] = useState(false);
  const [pistaEn, setPistaEn] = useState(null);
  const [parado, setParado] = useState(false);
  const [toques, setToques] = useState(0);
  const [mimoV, setMimoV] = useState(() => medias?.mimo ?? {});
  const [comenta, setComenta] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  // 1.133.2: el ex libris recién puesto (el sello en grande sobre la pantalla y lo que dice don Celestino)
  const [sellado, setSellado] = useState(false);
  const [sfx] = useState(() => crearSfxBarra());
  const zona = useRef(null);
  const rec = useRef(null);
  const raf = useRef(0);
  const anim = useRef(0);
  const pinta = useRef(0);
  const espera = useRef(0);
  const entrando = useRef(null);
  const terminado = useRef(false);
  const piRef = useRef(0);
  const ultimaNube = useRef(0);
  const cuartos = useRef(0);
  const borradas = useRef(0);
  // Lo hecho en cada gesto (sus vistas), cómo quedó cada daño y lo que se ve en la escena
  const hechas = useRef(medias?.hechas ? { ...medias.hechas } : {});
  const mimo = useRef(medias?.mimo ? { ...medias.mimo } : {});
  const colaMimo = useRef(medias?.colaMimo ?? null);
  const sc = useRef({ vista: 'entrada', abre: 0, enPrensa: 0, herramienta: null, superficie: null, pose: null, nube: [], golpe: 0, levanta: 0, brillo: null });

  const paso = fase === 'gesto' ? (pasos[pi] ?? null) : null;
  const def = paso ? GESTO_T[paso.tipo] : null;
  const actual = paso && g?.tipo === paso.tipo ? g : null;

  useEffect(() => sfx.setActivo(soundOn), [sfx, soundOn]);

  // ── La escena: lo que se ve en el banco ──
  const estadoEscena = () => {
    const s = sc.current;
    const vivas = { ...hechas.current };
    const r = rec.current?.estado;
    if (r && !r.hecho) vivas[r.tipo] = r.vista;
    const vistas = encargo ? { ...vistasDe(encargo, vivas), nombre } : null;
    // El brillo de la tinta fresca, que cruza el ex libris al levantar el sello
    if (vistas?.exlibris?.exlibris && s.brillo != null) vistas.exlibris = { exlibris: { ...vistas.exlibris.exlibris, brillo: s.brillo } };
    return {
      vista: s.vista,
      encargo,
      vistas,
      abre: s.abre,
      enPrensa: s.enPrensa,
      herramienta: s.herramienta,
      superficie: s.superficie,
      pose: s.pose,
      nube: s.nube,
      golpe: s.golpe,
      levanta: s.levanta,
      ahora: reloj(),
    };
  };
  const pintarYa = () => escena?.setTaller(estadoEscena());
  const pintar = () => {
    if (!escena || pinta.current) return;
    pinta.current = requestAnimationFrame(() => {
      pinta.current = 0;
      pintarYa();
    });
  };
  /** Animaciones cortas una detrás de otra ([ms, fn(t), alEmpezar]); directas con movimiento reducido o sin escena. */
  const encadenar = (lista, fin) => {
    cancelAnimationFrame(anim.current);
    const directo = reduced() || !escena;
    let k = 0;
    const siguiente = () => {
      if (k >= lista.length) {
        pintarYa();
        fin?.();
        return;
      }
      const [ms, fn, alEmpezar] = lista[k];
      k += 1;
      alEmpezar?.();
      if (directo) {
        fn(1);
        siguiente();
        return;
      }
      const t0 = reloj();
      const paso_ = () => {
        const t = Math.min(1, (reloj() - t0) / ms);
        fn(t);
        pintarYa();
        if (t < 1) anim.current = requestAnimationFrame(paso_);
        else siguiente();
      };
      anim.current = requestAnimationFrame(paso_);
    };
    siguiente();
  };

  // Entrar por la puerta (con el libro ya en el banco) y, al irte, salir por ella hacia el café
  const montado = useRef(false);
  useEffect(() => {
    let vivo = true;
    montado.current = true;
    const dentro = () => {
      if (!vivo) return;
      setFase(!encargo ? 'sin' : primera && !medias ? 'primera' : 'encargo');
      pintarYa();
    };
    if (!escena) dentro();
    else {
      entrando.current = escena.taller(true, { vista: 'entrada', encargo, vistas: encargo ? { ...vistasDe(encargo, hechas.current), nombre } : null });
      entrando.current.then(dentro);
    }
    return () => {
      vivo = false;
      montado.current = false;
      cancelAnimationFrame(raf.current);
      cancelAnimationFrame(anim.current);
      cancelAnimationFrame(pinta.current);
      clearTimeout(espera.current);
      sfx.apagar();
      // Se sale por la puerta al llegar (si aún estabas entrando) y solo si de verdad te has ido (el modo estricto de React
      // desmonta y vuelve a montar en desarrollo)
      Promise.resolve(entrando.current).then(() => {
        if (!montado.current) escena?.taller(false);
      });
    };
    // Solo al abrir y cerrar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escena]);
  // Con el encargo delante, la cámara mira el libro en el banco
  useEffect(() => {
    if (fase !== 'encargo') return;
    sc.current = { ...sc.current, vista: 'ficha' };
    pintarYa();
    // Solo al cambiar de fase
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  // Don Celestino habla (un «mm» amable) cada vez que dice algo nuevo
  useEffect(() => {
    if (['primera', 'encargo', 'respiro', 'ficha', 'sin'].includes(fase)) sfx.play('celestino');
  }, [fase, habla, sfx]);

  // ── Los pasos ──
  const apagarBucles = () => {
    for (const b of BUCLES_T) sfx.bucle(b, false);
  };
  const irAPaso = (i) => {
    const p = pasos[i];
    if (!p) return;
    const t = GESTO_T[p.tipo];
    const antes = { ...sc.current };
    cancelAnimationFrame(raf.current);
    clearTimeout(espera.current);
    apagarBucles();
    rec.current = null;
    terminado.current = false;
    cuartos.current = 0;
    borradas.current = 0;
    piRef.current = i;
    setPi(i);
    setG(null);
    setPistaEn(null);
    setComenta(null);
    setListo(false);
    setSellado(false);
    setFase('gesto');
    // 1.133.2: la herramienta se coge al terminar de abrir (o cerrar) el libro, no mientras gira la tapa
    sc.current = { ...sc.current, vista: t.vista, herramienta: null, superficie: superficieDe(p.tipo), pose: poseInicial(p.tipo, encargo), nube: [], golpe: 0, levanta: 0, brillo: null };
    const abre = t.abre;
    const prensa = t.enPrensa ?? 0;
    const lista = [];
    // De la prensa al banco: el husillo sube y el libro vuelve a su sitio
    if (antes.enPrensa > 0 && prensa === 0) {
      lista.push([
        1000,
        (k) => {
          hechas.current.prensa = { ...(hechas.current.prensa ?? { angulo: 0 }), prensa: Math.max(0, 1 - k * 2) };
          sc.current.enPrensa = Math.min(1, Math.max(0, 2 - k * 2));
        },
      ]);
    }
    if (antes.abre !== abre)
      lista.push([
        650,
        (k) => {
          sc.current.abre = abre ? k : 1 - k;
        },
        () => sfx.play('libroAbre'),
      ]);
    if (prensa > antes.enPrensa)
      lista.push([
        1100,
        (k) => {
          sc.current.enPrensa = k;
        },
      ]);
    encadenar(lista, () => {
      if (t.herramienta) {
        sc.current.herramienta = t.herramienta;
        sfx.play('herramienta', { f: t.tono });
        pintarYa();
      }
      setListo(true);
    });
  };
  const empezar = () => irAPaso(medias?.i ?? 0);

  /** Un gesto terminado: lo que deja en el libro, cómo quedó el daño y lo que dice don Celestino. */
  const terminarPaso = (s) => {
    cancelAnimationFrame(raf.current);
    apagarBucles();
    const p = pasos[piRef.current];
    hechas.current[p.tipo] = s.vista;
    sc.current.nube = [];
    if (p.tipo === 'exlibris') {
      // 1.133.2 (Francisco: «el sello necesito que sea mas impactante»): el golpe (el sonido, la vista que se sacude y el
      // polvillo), el sello que se queda un instante apretado, se despega ladeándose y deja la tinta fresca brillando
      sc.current = { ...sc.current, golpe: reloj(), levanta: 0, brillo: 0 };
      encadenar(
        [
          [300, () => {}],
          [
            650,
            (k) => {
              sc.current.levanta = k;
              sc.current.brillo = k * 0.55;
            },
            () => sfx.play('selloLevanta'),
          ],
          [
            550,
            (k) => {
              sc.current.brillo = 0.55 + k * 0.45;
            },
          ],
        ],
        () => {
          sc.current = { ...sc.current, herramienta: null, levanta: 0, brillo: null };
          pintarYa();
          espera.current = setTimeout(guardar, reduced() ? 1100 : 900);
        },
      );
      return;
    }
    if (p.tipo === 'cola') {
      // El lomo sigue en la prensa: el pincel vuelve al cazo y el libro va hacia la prensa
      colaMimo.current = s.mimo;
      sc.current.herramienta = null;
      pintar();
      sfx.play('herramienta', { f: 220 });
      espera.current = setTimeout(() => irAPaso(piRef.current + 1), reduced() ? 0 : 450);
      return;
    }
    const m = p.tipo === 'prensa' ? Math.min(colaMimo.current ?? 2, s.mimo) : s.mimo;
    mimo.current = { ...mimo.current, [p.dano]: m };
    setMimoV(mimo.current);
    sfx.play('danoHecho', { bien: m === 2 });
    // La herramienta vuelve al banco
    sc.current.herramienta = null;
    pintar();
    setComenta({ dano: p.dano, bien: m === 2 });
    setFase('respiro');
  };
  const aplicar = (s) => {
    setG(s);
    if (terminado.current) return;
    const p = pasos[piRef.current];
    for (const ev of s.eventos) {
      if (ev === 'moho') sfx.play('moho');
      else if (ev.startsWith('claro:')) sfx.play('polvoClaro', { k: Number(ev.slice(6)) });
      else if (ev === 'mancha') {
        sfx.play('manchaFuera', { k: borradas.current });
        borradas.current += 1;
      } else if (ev === 'barrer') {
        // Las manchas, fuera: la goma vuelve al banco y se barren las migas con el canto de la mano
        sfx.play('herramienta', { f: 247 });
        sc.current.herramienta = 'mano';
      } else if (ev === 'migas') sfx.play('migas');
      else if (ev.startsWith('aplana:')) sfx.play('aplana', { k: Number(ev.slice(7)) });
      else if (ev.startsWith('liso:')) sfx.play('liso', { k: Number(ev.slice(5)) });
      else if (ev === 'alisado') sfx.play('alisado', { ultima: s.hecho });
      else if (ev === 'husillo') {
        sfx.play('husillo', { k: cuartos.current });
        cuartos.current += 1;
      } else if (ev === 'tope') sfx.play('tope');
      else if (ev === 'hierro') sfx.play('hierro');
      else if (ev.startsWith('oro:')) sfx.play('oro', { k: Number(ev.slice(4)) });
      else if (ev === 'sellado') {
        sfx.play('exlibris');
        escena?.tallerGolpe?.(1);
        setSellado(true);
        espera.current = setTimeout(() => sfx.play('celestino'), reduced() ? 300 : 650);
      }
    }
    const bucle = s.fase === 'barrer' ? 'plegadera' : GESTO_T[p.tipo].bucle;
    for (const b of BUCLES_T) sfx.bucle(b, b === bucle && s.frota && !s.hecho);
    if (s.tipo !== 'prensa' && s.tipo !== 'exlibris' && s.pose?.u != null) sc.current.pose = { ...s.pose };
    if (s.tipo === 'polvo') {
      sc.current.nube = s.vista.nube;
      if (s.frota) ultimaNube.current = reloj();
    }
    pintar();
    if (s.hecho) {
      terminado.current = true;
      terminarPaso(s);
    }
  };
  const reconocedor = () => {
    if (!rec.current) {
      const p = pasos[piRef.current];
      const r = zona.current?.getBoundingClientRect();
      const m = p.tipo === 'prensa' ? escena?.tallerMarca('husillo') : null;
      rec.current = crearGestoTaller(p.tipo, {
        tapa: encargo.tapa,
        semilla: semillaEncargo(encargo),
        centro: m ? { x: m.x, y: m.y } : null,
        escala: Math.min(r?.width || 390, 600) / 390,
      });
    }
    return rec.current;
  };
  /** Lo que se mantiene (el oro y el sello) avanza con el tiempo; el polvo que levanta la brocha sigue flotando un rato. */
  const latido = () => {
    const r = rec.current;
    if (!r || terminado.current) return;
    const s0 = r.estado;
    if (s0.pulsado && (s0.tipo === 'dorado' || s0.tipo === 'exlibris')) aplicar(r.paso(reloj()));
    else if (s0.tipo === 'polvo') pintarYa();
    const s = r.estado;
    const sigue = (s.pulsado && !s.hecho) || (s.tipo === 'polvo' && !s.hecho && reloj() - ultimaNube.current < 1700);
    if (sigue && !terminado.current) raf.current = requestAnimationFrame(latido);
  };
  const punto = (e) => {
    const sup = superficieDe(pasos[piRef.current]?.tipo);
    const uv = sup && escena ? escena.tallerPunto(e.clientX, e.clientY, sup) : null;
    return { u: uv?.u, v: uv?.v, x: e.clientX, y: e.clientY, t: reloj() };
  };
  const completar = () => {
    if (fase !== 'gesto' || !listo || terminado.current) return;
    const p = pasos[piRef.current];
    const [son, datos] = ATAJO_SUENA[p.tipo] ?? [];
    if (son) sfx.play(son, datos);
    aplicar(reconocedor().completar());
  };
  const onDown = (e) => {
    if (fase !== 'gesto' || !listo || terminado.current) return;
    e.preventDefault();
    setToques((n) => n + 1);
    if (reduced() || !escena) {
      completar();
      return;
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (pasos[piRef.current]?.tipo === 'exlibris') sfx.play('selloApoya');
    aplicar(reconocedor().abajo(punto(e)));
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(latido);
  };
  const onMove = (e) => {
    const r = rec.current;
    if (r?.estado.pulsado) {
      aplicar(r.mover(punto(e)));
      return;
    }
    // Con ratón, sin apretar, la herramienta sigue a la mano por encima del libro
    if (e.pointerType !== 'mouse' || fase !== 'gesto' || !listo || terminado.current || !sc.current.superficie || sc.current.herramienta === 'sello') return;
    const p = punto(e);
    if (p.u == null || p.u < -0.1 || p.u > 1.1 || p.v < -0.1 || p.v > 1.1) return;
    sc.current.pose = { u: p.u, v: p.v, baja: 0 };
    pintar();
  };
  const onUp = () => {
    const r = rec.current;
    if (!r || !r.estado.pulsado) return;
    aplicar(r.arriba());
    if (r.estado.tipo === 'polvo' && !terminado.current) {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(latido);
    }
  };

  // ── Terminar: el ex libris puesto, el libro se cierra y el servidor apunta el encargo ──
  const enviar = () => {
    setError('');
    setFase('guardando');
    const lista = encargo.danos.map((d) => (mimo.current[d] === 1 ? 1 : 2));
    restaurarEncargo(dia, encargo.n, lista).then(
      (r) => {
        A_MEDIAS.delete(encargo.n);
        setResultado({ granos: r.dado?.granos ?? 0, reputacion: r.dado?.reputacion ?? 0, estrellas: r.dado?.estrellas ?? estrellasTaller(lista) });
        onHecho?.(r);
        sfx.play('ficha');
        espera.current = setTimeout(() => sfx.play('entregaTaller'), reduced() ? 0 : 700);
        setFase('ficha');
      },
      (e) => {
        setError(errorCafe(e));
        setFase('error');
      },
    );
  };
  const guardar = () => {
    sc.current = { ...sc.current, vista: 'ficha', herramienta: null, superficie: null, pose: null };
    encadenar([
      [
        650,
        (k) => {
          sc.current.abre = 1 - k;
        },
        () => sfx.play('libroAbre'),
      ],
    ]);
    enviar();
  };

  /** Irse a medias: lo hecho se recuerda (el gesto empezado, no) y el encargo sigue en el banco. */
  const salir = () => {
    if (encargo && (fase === 'gesto' || fase === 'respiro' || fase === 'error')) {
      const h = { ...hechas.current };
      // Sin poder apuntarlo, al volver solo queda poner otra vez el ex libris
      const i = fase === 'respiro' ? pi + 1 : fase === 'error' ? pasos.length - 1 : pi;
      delete h[pasos[i]?.tipo];
      A_MEDIAS.set(encargo.n, { i, mimo: { ...mimo.current }, hechas: h, colaMimo: colaMimo.current });
    }
    onCerrar?.();
  };

  // ── La pista, la nota y la «!» sobre lo siguiente que hay que tocar, cuando la cámara ya ha llegado ──
  const objetivo = paso && listo ? marcaDe(paso.tipo, actual) : null;
  useEffect(() => {
    if (!objetivo || !escena) return undefined;
    return alQuedarQuieta(escena, () => {
      const r = zona.current?.getBoundingClientRect();
      if (!r) return;
      const m = escena.tallerMarca(objetivo);
      let ang = 0;
      if (objetivo === 'pliegue') {
        const a = escena.tallerMarca('pliegue:a');
        const b = escena.tallerMarca('pliegue:b');
        if (a && b) ang = Math.atan2(-(b.x - a.x), b.y - a.y);
      }
      if (m) setPistaEn({ clave: objetivo, x: m.x - r.left, y: m.y - r.top, ang });
    });
  }, [objetivo, escena]);
  const progreso10 = Math.floor((actual?.progreso ?? 0) * 10);
  // Mientras aprietas no se está parado: una pasada lenta de brocha no saca la «!» a mitad
  const apretando = Boolean(actual?.pulsado);
  useEffect(() => {
    setParado(false);
    if (fase !== 'gesto' || !listo || ayudas !== 'auto' || apretando) return undefined;
    const id = setTimeout(() => setParado(true), AYUDA_PARADO_MS);
    return () => clearTimeout(id);
  }, [fase, listo, ayudas, objetivo, toques, progreso10, apretando]);
  const pista = pistaEn && pistaEn.clave === objetivo ? pistaEn : null;
  const sinEmpezar = actual ? (actual.fase === 'barrer' ? !(actual.vista.barrido > 0) : !(actual.progreso > 0)) : true;
  const ayuda = Boolean(paso && listo && !apretando && verAyuda(ayudas, nivel, parado));

  // ── La ficha «antes / después»: dos tapas pintadas en su cartulina ──
  const ficha = useMemo(() => {
    if (fase !== 'ficha' || !encargo || typeof document === 'undefined') return null;
    try {
      const { antes, despues } = pintarFicha(encargo);
      return { antes: antes.toDataURL(), despues: despues.toDataURL() };
    } catch {
      return null;
    }
  }, [fase, encargo]);

  // ── El cuadro de abajo ──
  const libro = encargo ? LIBROS_TALLER[encargo.libro] : null;
  const que = ordenDe(paso, actual);
  const progreso = Math.round((actual?.progreso ?? 0) * 100);
  const trabajando = fase === 'gesto';
  const danosOrden = encargo ? DANOS.filter((d) => encargo.danos.includes(d)) : [];
  const etapaAhora = paso ? (paso.dano ?? 'exlibris') : null;
  // Lo que falta del encargo que dejaste a medias: cada daño una vez (el lomo son dos pasos), sin el ex libris
  const faltan = medias ? [...new Set(pasos.slice(medias.i).map((p) => p.dano).filter(Boolean))].map((d) => DANO[d].nombre.toLowerCase()) : [];
  const texto =
    fase === 'entrando'
      ? ''
      : fase === 'primera'
        ? `«${CELESTINO_PRIMERA[habla]}»`
        : fase === 'encargo'
          ? medias
            ? `«Lo dejaste a medias y aquí sigue, esperándote. ${faltan.length ? `Te falta: ${enLista(faltan)}` : 'Solo falta el ex libris'}.»`
            : encargo.primero
              ? `«Mira, tu primer encargo: lo ha traído ${minus(encargo.cliente.quien)}.»`
              : `«Te han dejado un libro en el banco: lo ha traído ${minus(encargo.cliente.quien)}.»`
          : fase === 'sin'
            ? `«${CELESTINO_SIN}»`
            : fase === 'respiro' && comenta
              ? comenta.bien
                ? DANO[comenta.dano].bien
                : `«Bien hecho. ${DANO[comenta.dano].mejor}»`
              : fase === 'guardando'
                ? '«Deja que lo mire a la luz…»'
                : fase === 'ficha' && resultado
                  ? CELESTINO_FIN[resultado.estrellas]
                  : fase === 'error'
                    ? '«Vaya, no he podido apuntarlo. ¿Lo intentamos otra vez?»'
                    : trabajando && sellado
                      ? EXLIBRIS.sellado
                      : que.orden
                      ? `${que.orden}.`
                      : '';
  const hoy = estado?.hoy && fase === 'sin' ? estado.hoy : null;

  return (
    <>
      <div
        ref={zona}
        className="cf3-gesto cf3-taller"
        data-activo={trabajando && listo ? 'true' : undefined}
        data-gesto={trabajando ? (actual?.fase === 'barrer' ? 'barrer' : paso.tipo) : undefined}
        data-fase={fase}
        role={trabajando && listo ? 'button' : undefined}
        tabIndex={trabajando && listo ? 0 : -1}
        aria-hidden={trabajando && listo ? undefined : 'true'}
        aria-label={trabajando && listo ? `${que.orden}. Con el teclado, Intro lo hace de una vez.` : undefined}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onLostPointerCapture={onUp}
        onKeyDown={(e) => {
          if (trabajando && (e.key === 'Enter' || e.key === ' ') && !e.repeat) {
            e.preventDefault();
            completar();
          }
        }}
      >
        {trabajando && ayuda && pista && <span className="cf3-ayuda cf3-ayuda--gesto" data-para={objetivo} style={{ left: `${pista.x}px`, top: `${pista.y}px` }} aria-hidden="true" />}
        {trabajando && pista && sinEmpezar && (
          <span className="cf3-gesto__pista" style={{ left: `${pista.x}px`, top: `${pista.y}px`, transform: `translate(-50%, -50%) rotate(${pista.ang}rad)` }}>
            <Pista trazo={actual?.fase === 'barrer' ? 'barrer' : def.pista} />
          </span>
        )}
        {trabajando && pista && sinEmpezar && !reduced() && (
          <span
            className="cf3-gesto__nota"
            data-lado={paso.tipo === 'dorado' ? 'arriba' : ladoNota(pista.x, zona.current?.clientWidth ?? 390)}
            style={{
              // encima del título, centrada en la letra pero sin salirse de la pantalla
              left: `${paso.tipo === 'dorado' ? Math.min(Math.max(pista.x, 84), (zona.current?.clientWidth ?? 390) - 84) : pista.x}px`,
              top: `${pista.y}px`,
            }}
            aria-hidden="true"
          >
            {que.ayuda}
          </span>
        )}
        {trabajando && sellado && (
          <span className="cf3-gesto__sellado" aria-hidden="true">
            <span className="cf3-gesto__sellado-ex">Ex libris</span>
            <span className="cf3-gesto__sellado-de">{nombre || 'El taller'}</span>
          </span>
        )}
        {fase === 'respiro' && comenta && (
          <span className="cf3-gesto__hecho" data-bien={comenta.bien ? 'true' : undefined} aria-hidden="true">
            {comenta.bien ? '¡Perfecto!' : '¡Hecho!'}
          </span>
        )}
        {fase === 'ficha' && resultado && (
          <figure className="cf3-cartulina" aria-label={`La ficha del taller: «${libro.titulo}», antes y después`}>
            <figcaption className="cf3-cartulina__titulo">{libro.titulo}</figcaption>
            <div className="cf3-cartulina__tapas">
              {[
                ['Antes', ficha?.antes],
                ['Después', ficha?.despues],
              ].map(([nombre, src]) => (
                <span key={nombre} className="cf3-cartulina__tapa">
                  {src ? <img src={src} alt={`${nombre}: la tapa ${nombre === 'Antes' ? 'como llegó' : 'restaurada'}`} /> : <span className="cf3-cartulina__vacia" />}
                  <span className="cf3-cartulina__pie">{nombre}</span>
                </span>
              ))}
            </div>
            <span className="cf3-cartulina__sello" aria-hidden="true">
              Ex libris
            </span>
          </figure>
        )}
      </div>
      {fase === 'entrando' ? (
        <p className="px-sr" role="status">
          Entrando en el taller de la trastienda.
        </p>
      ) : (
        <div
          className={`cf3-franja cf3-franja--atender cf3-franja--taller${trabajando ? ' cf3-franja--barra' : ''}`}
          role="region"
          aria-label="El taller de la trastienda"
          data-fase={fase}
          data-paso={trabajando ? paso.tipo : undefined}
          data-progreso={trabajando ? progreso : undefined}
          data-ayuda={trabajando && ayuda ? 'true' : undefined}
        >
          <span className="cf3-quien" aria-hidden="true">
            Don Celestino
          </span>
          <div className="cf3-caja">
            <span className="cf3-retrato">
              <PixelArt icono={DON_CELESTINO} />
            </span>
            <p className="cf3-dice" aria-live="polite">
              {trabajando ? (
                <>
                  {texto}
                  <span className="px-sr"> {que.ayuda}</span>
                </>
              ) : (
                <>
                  <span className="px-sr">Don Celestino: </span>
                  {texto}
                  {fase === 'primera' && <span className="cf3-sigue" aria-hidden="true" />}
                </>
              )}
            </p>
            {fase === 'encargo' && (
              <div className="cf3-extra cf3-encargo">
                <p className="cf3-encargo__cita">
                  <span className="px-sr">{encargo.cliente.quien} dice: </span>«{encargo.cliente.dice}»
                </p>
                <p className="cf3-encargo__libro">
                  <cite>{libro.titulo}</cite> · {libro.autor}
                </p>
                <ul className="cf3-encargo__danos" aria-label="Lo que tiene">
                  {danosOrden.map((d) => (
                    <li key={d} data-hecho={mimoV[d] ? 'true' : undefined}>
                      {mimoV[d] ? '✓ ' : ''}
                      {DANO[d].nombre}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {hoy && (
              <div className="cf3-extra cf3-encargo">
                <p className="cf3-encargo__libro">
                  Hoy restauraste <cite>{LIBROS_TALLER[hoy.libro]?.titulo}</cite>.
                </p>
                <Estrellas n={hoy.estrellas} />
              </div>
            )}
            {trabajando && (
              <div className="cf3-extra">
                <ol className="cf3-etapas" aria-label="Lo que hay que arreglar">
                  {[...danosOrden, 'exlibris'].map((d, k) => {
                    const est = d === etapaAhora ? 'ahora' : d !== 'exlibris' && mimoV[d] ? 'hecha' : 'luego';
                    return (
                      <li key={d} data-estado={est} aria-current={est === 'ahora' ? 'step' : undefined}>
                        <span className="cf3-etapas__num" aria-hidden="true">
                          {est === 'hecha' ? '✓' : k + 1}
                        </span>
                        <span className="cf3-etapas__nombre">{d === 'exlibris' ? 'Ex libris' : DANO[d].nombre}</span>
                      </li>
                    );
                  })}
                </ol>
                <div className="cf3-medidor" role="progressbar" aria-label={que.orden} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progreso}>
                  <span className="cf3-medidor__lleno" style={{ width: `${progreso}%` }} />
                </div>
              </div>
            )}
            {fase === 'ficha' && resultado && (
              <div className="cf3-extra cf3-resultado">
                <Estrellas n={resultado.estrellas} />
                <ul className="cf3-repaso" aria-label="Cómo quedó cada cosa">
                  {encargo.danos.map((d) => (
                    <li key={d} data-ok={mimo.current[d] === 1 ? 'mejor' : 'true'}>
                      {mimo.current[d] === 1 ? `${DANO[d].nombre} · ${DANO[d].mejor}` : `✓ ${DANO[d].nombre}`}
                    </li>
                  ))}
                </ul>
                <p className="cf3-dado" aria-label={`Has ganado ${resultado.granos} granos y ${resultado.reputacion} de reputación`}>
                  <span className="cf3-dado__ficha">+{resultado.granos} granos</span>
                  <span className="cf3-dado__ficha cf3-dado__ficha--rep">+{resultado.reputacion} reputación</span>
                </p>
              </div>
            )}
            {error && (
              <p className="cf3-error" role="alert">
                {error}
              </p>
            )}
            <div className="cf3-botones">
              {fase === 'primera' ? (
                <button
                  type="button"
                  className="cf3-btn"
                  onClick={() => {
                    if (habla + 1 < CELESTINO_PRIMERA.length) setHabla((k) => k + 1);
                    else setFase('encargo');
                  }}
                >
                  Seguir
                </button>
              ) : fase === 'encargo' ? (
                <>
                  <button type="button" className="cf3-btn cf3-btn--suave" onClick={salir}>
                    Luego
                  </button>
                  <button type="button" className="cf3-btn cf3-btn--verde" onClick={empezar}>
                    {medias ? 'Seguir' : 'Empezar'}
                  </button>
                </>
              ) : trabajando ? (
                <>
                  <button type="button" className="cf3-btn cf3-btn--suave" onClick={salir}>
                    Luego
                  </button>
                  {(reduced() || !escena) && (
                    <button type="button" className="cf3-btn cf3-btn--verde" onClick={completar} disabled={!listo}>
                      {paso.tipo === 'exlibris' ? EXLIBRIS.atajo : DANO[paso.dano].atajo}
                    </button>
                  )}
                </>
              ) : fase === 'respiro' ? (
                <>
                  <button type="button" className="cf3-btn cf3-btn--suave" onClick={salir}>
                    Luego
                  </button>
                  <button type="button" className="cf3-btn cf3-btn--verde" onClick={() => irAPaso(pi + 1)}>
                    Seguir
                  </button>
                </>
              ) : fase === 'error' ? (
                <>
                  <button type="button" className="cf3-btn cf3-btn--suave" onClick={salir}>
                    Luego
                  </button>
                  <button type="button" className="cf3-btn cf3-btn--verde" onClick={enviar}>
                    Otra vez
                  </button>
                </>
              ) : fase === 'guardando' ? null : (
                <button type="button" className="cf3-btn" onClick={onCerrar} data-atras>
                  Volver al café
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
