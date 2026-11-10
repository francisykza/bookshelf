// El Almacén del Puerto (1.99, §99; encargo de Francisco del 9-11-2026): la Lonja pasa a ser un almacén de muebles en 3D.
// Se recorre como la recepción (arrastrar mira, tocar el suelo anda, tocar un mueble lo enseña de cerca), con:
// - la ficha de cada mueble: nombre, precio, medidas, sus tonos (se ven en el mismo mueble) y cuántos tienes;
// - un carrito con paquetes planos que va contigo, en la esquina, sin tapar la escena; se revisa en su papel;
// - el directorio por secciones y la caja con su cajero, con el descuento del día («Sella el albarán», opcional);
// - el mercadillo de siempre (puestos, «Se busca», «La estiba» y su pared de premios), en el muelle de carga;
// - la visita con un amigo: os veis con vuestro personaje, cada uno con su carrito y sus tickets, y «Mira esto».
// La escena es `almacen3d.js` (Three.js, se carga al entrar); las reglas de la compra, en el servidor.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usesLocked, validateAvatar } from '../actor';
import { catalogItem } from '../catalog';
import { isDeHabitacionEspecial, ticketsText } from '../economy';
import { ownedCopies } from '../inventory';
import { renderThumb } from '../render';
import { ReaderAvatar } from '../../../components/avatars/ReaderAvatar';
import { todayKey } from '../dailyMissions';
import { almacenAmigos, almacenComprar, almacenRopaComprar, almacenEmpezar, almacenInvitar, almacenPulso, almacenSalir, almacenSellar, almacenUnirse, loadAlmacen, loadArmario, loadInventario, loadMiPersonaje, savePersonaje } from '../service';
import { Caja, SellaAlbaran } from './AlmacenCaja';
import { ALBARAN, duracion } from './albaran';
import { ARTICULOS, BAJO, DE_PASO, EXPOSITORES, SECCIONES, medidasDe, nombreTono, plantaDe } from './almacenLayout';
import { Lonja } from './Lonja';
import { Probador } from './Probador';
import { CestaRopa, ZonaRopa } from './RopaPapeles';
import { CESTA_MAX, ZONAS_ROPA, cestaSana, zonaRopa } from './plantaRopa';
import { mismoLook } from './ropa';
import { ROTULO_OFERTA, mapaOfertas, precioOferta } from './ofertas';
import './almacen.css';

const CARRITO_KEY = 'bookshelf:almacen-carrito';
const COMPRA_KEY = 'bookshelf:almacen-compra';
/** 2.ª ampliación · La cesta de la planta de ropa (lo que llevas para probarte). */
const CESTA_KEY = 'bookshelf:almacen-cesta';
/** Bloque 3 · La clave del pago de la ropa (la misma en cada reintento mientras no cambie lo que se paga). */
const COMPRA_ROPA_KEY = 'bookshelf:almacen-compra-ropa';
/** La sala a la que se entra al llegar (la deja el aviso de invitación del edificio). */
export const UNIRSE_KEY = 'bookshelf:almacen-unirse';
const PULSO_MS = 1000;
const IDO_S = 15;
const MAX_N = 10;
const MAX_LINEAS = 12;

const leer = (k, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? fallback;
  } catch {
    return fallback;
  }
};
const guardar = (k, v) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {
    // Sin almacenamiento: el carrito vive mientras dure la visita
  }
};
const nuevaClave = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
const articulo = (id) => ARTICULOS.find((a) => a.id === id) ?? null;
const sano = (lista) => (Array.isArray(lista) ? lista.filter((l) => articulo(l?.id) && Number.isInteger(l.n) && l.n > 0).map((l) => ({ id: l.id, n: Math.min(MAX_N, l.n) })) : []);

/** Hasta cuándo valen: las del día, hasta medianoche; la de la semana, hasta el domingo (si no acaba hoy). */
function ofertasHasta(estado) {
  const acabaHoy = !estado?.semana_hasta || estado.semana_hasta <= (estado.vuelve ?? 0);
  return acabaHoy ? 'Hasta medianoche' : 'Las del día, hasta medianoche · la de la semana, hasta el domingo';
}

const thumbs = new Map();
function thumbOf(id, tono = 0, size = 44) {
  const key = `${id}:${tono}:${size}`;
  if (!thumbs.has(key)) {
    try {
      thumbs.set(key, renderThumb(id, tono, size).toDataURL());
    } catch {
      thumbs.set(key, '');
    }
  }
  return thumbs.get(key);
}

/** Lo que dice la caja ante un fallo del servidor; el carrito no se toca. */
function motivo(e, total, tickets) {
  const m = String(e?.message ?? '');
  if (e?.code === 'unavailable' || /PGRST202|42883/.test(m)) return 'La caja aún no está abierta en este servidor. Tu carrito sigue aquí.';
  if (m.includes('almacen:saldo')) return `No te llegan los tickets: el total es ${ticketsText(total)}${tickets != null ? ` y tienes ${ticketsText(tickets)}` : ''}. No se ha cobrado nada.`;
  if (m.includes('almacen:precio')) return 'El total ha cambiado desde que lo viste. Revisa la cuenta y vuelve a confirmar; no se ha cobrado nada.';
  if (m.includes('almacen:descuento')) return 'El descuento de hoy ya no está disponible. Revisa la cuenta; no se ha cobrado nada.';
  if (m.includes('almacen:retirado') || m.includes('almacen:no_se_vende')) return 'Algo del carrito ya no se vende. Quítalo y vuelve a intentarlo; no se ha cobrado nada.';
  if (m.includes('almacen:ya_tuya')) return 'Algo de la cesta ya es tuyo. Vuelve a abrir la cesta; no se ha cobrado nada.';
  if (m.includes('almacen:')) return 'La caja no ha podido cobrar ese carrito. No se ha cobrado nada.';
  return 'No se ha podido confirmar la compra (¿sin conexión?). Tu carrito sigue aquí: vuelve a intentarlo y no se cobrará dos veces.';
}

/** La carretilla de la esquina: los paquetes planos de lo que llevas, con el dibujo del mueble en la etiqueta. */
function Carretilla({ lineas, onOpen, abierto }) {
  const unidades = lineas.reduce((s, l) => s + l.n, 0);
  const paquetes = lineas.flatMap((l) => Array.from({ length: Math.min(l.n, 3) }, () => l.id)).slice(0, 6);
  return (
    <button type="button" className="alm-carretilla" onClick={onOpen} aria-pressed={abierto} aria-label={`Carrito: ${unidades} ${unidades === 1 ? 'artículo' : 'artículos'}`}>
      <span className="alm-carretilla__carga" aria-hidden="true">
        {paquetes.map((id, i) => (
          <span key={i} className="alm-paquete" style={{ '--i': i }}>
            <img src={thumbOf(id, 0, 24)} alt="" width="16" height="16" />
          </span>
        ))}
      </span>
      <svg className="alm-carretilla__dibujo" viewBox="0 0 32 16" width="64" height="32" aria-hidden="true" shapeRendering="crispEdges">
        <rect x="1" y="1" width="2" height="10" fill="#d6a24c" />
        <rect x="0" y="0" width="5" height="2" fill="#ecbe60" />
        <rect x="3" y="9" width="27" height="2" fill="#286460" />
        <rect x="3" y="11" width="27" height="1" fill="#1a4644" />
        <rect x="6" y="12" width="3" height="3" fill="#28262e" />
        <rect x="24" y="12" width="3" height="3" fill="#28262e" />
        <rect x="7" y="13" width="1" height="1" fill="#8a8890" />
        <rect x="25" y="13" width="1" height="1" fill="#8a8890" />
      </svg>
      {unidades > 0 && <span className="alm-carretilla__n">{unidades}</span>}
      <span className="alm-carretilla__rotulo" aria-hidden="true">
        {unidades ? 'Tu carro' : 'Carro vacío'}
      </span>
    </button>
  );
}

/** Iconos de píxel de la barra (rejilla de 16). */
function Icono({ id }) {
  const px = {
    directorio: [
      [7, 1, 2, 14, '#a8743a'],
      [3, 2, 10, 3, '#5a8f88'],
      [4, 6, 10, 3, '#b8624a'],
      [2, 10, 10, 3, '#cc9e46'],
      [12, 3, 2, 1, '#f6ecd8'],
      [2, 7, 2, 1, '#f6ecd8'],
    ],
    carrito: [
      [1, 2, 3, 1, '#ecbe60'],
      [3, 3, 1, 8, '#ecbe60'],
      [4, 10, 10, 2, '#5a8f88'],
      [5, 5, 4, 5, '#c08a56'],
      [9, 6, 4, 4, '#b0844e'],
      [6, 6, 2, 1, '#f6ecd8'],
      [5, 12, 2, 2, '#28262e'],
      [11, 12, 2, 2, '#28262e'],
    ],
    caja: [
      [2, 9, 12, 5, '#286460'],
      [2, 8, 12, 1, '#c08a56'],
      [8, 4, 5, 4, '#3a3a44'],
      [9, 5, 3, 2, '#96dcbe'],
      [3, 6, 4, 2, '#f6ecd8'],
      [4, 4, 2, 2, '#a8434c'],
    ],
    amigo: [
      [3, 3, 4, 4, '#e8c098'],
      [3, 2, 4, 2, '#6a4430'],
      [2, 7, 6, 7, '#5a8f88'],
      [9, 4, 4, 4, '#c8946a'],
      [9, 3, 4, 2, '#2a262c'],
      [8, 8, 6, 6, '#b8624a'],
    ],
    ficha: [
      [2, 3, 12, 10, '#e7d3ac'],
      [2, 3, 12, 2, '#286460'],
      [4, 7, 5, 1, '#6a4430'],
      [4, 9, 7, 1, '#6a4430'],
      [10, 10, 3, 2, '#a8434c'],
    ],
    // 1.102 · Una percha con una camisa colgada
    probador: [
      [7, 1, 2, 1, '#ecbe60'],
      [8, 2, 1, 2, '#ecbe60'],
      [3, 4, 10, 1, '#ecbe60'],
      [2, 5, 2, 1, '#ecbe60'],
      [12, 5, 2, 1, '#ecbe60'],
      [3, 6, 10, 8, '#b8624a'],
      [3, 6, 2, 3, '#9a4e3a'],
      [11, 6, 2, 3, '#9a4e3a'],
      [7, 6, 2, 8, '#f6ecd8'],
      [7, 8, 2, 1, '#28262e'],
      [7, 11, 2, 1, '#28262e'],
    ],
    ropa: [
      [2, 5, 12, 8, '#5a8f88'],
      [2, 5, 3, 3, '#3f6e68'],
      [11, 5, 3, 3, '#3f6e68'],
      [6, 4, 4, 2, '#f6ecd8'],
      [7, 6, 2, 7, '#3f6e68'],
      [3, 12, 10, 1, '#2a4e4a'],
    ],
    cesta: [
      [7, 1, 2, 1, '#6a4430'],
      [4, 2, 2, 4, '#6a4430'],
      [10, 2, 2, 4, '#6a4430'],
      [5, 1, 6, 1, '#6a4430'],
      [4, 5, 4, 3, '#b8624a'],
      [8, 4, 4, 4, '#5a8f88'],
      [2, 7, 12, 7, '#be9260'],
      [2, 9, 12, 1, '#8a6238'],
      [2, 12, 12, 1, '#8a6238'],
    ],
    mercadillo: [
      [1, 3, 14, 3, '#b8624a'],
      [1, 3, 2, 3, '#f6ecd8'],
      [5, 3, 2, 3, '#f6ecd8'],
      [9, 3, 2, 3, '#f6ecd8'],
      [13, 3, 2, 3, '#f6ecd8'],
      [2, 6, 1, 8, '#6a4430'],
      [13, 6, 1, 8, '#6a4430'],
      [3, 10, 10, 2, '#c08a56'],
    ],
  }[id];
  return (
    <svg className="alm-tool__icon" viewBox="0 0 16 16" width="26" height="26" aria-hidden="true" shapeRendering="crispEdges">
      {px.map(([x, y, w, h, c], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={c} />
      ))}
    </svg>
  );
}

const TITULOS = { directorio: 'Directorio', carrito: 'Tu carrito', caja: 'La caja', amigo: 'Con un amigo', probador: 'El probador', cesta: 'Tu cesta', ropa: 'Moda' };
const ANTETITULOS = { directorio: 'Todo el almacén, por pasillos', carrito: 'Paquetes planos', caja: 'Mostrador de salida', amigo: 'Visita compartida', probador: 'Tu ropa, delante del espejo', cesta: 'Para el probador', ropa: 'Planta −1 · Moda' };
const seccionDe = (e) => SECCIONES.find((x) => x.id === e.seccion);
const CARTEL_TEXTO = {
  'c:lectura': 'Pasillo 1 · Rincón de lectura',
  'c:salon': 'Pasillo 2 · Salón y estudio',
  'c:ambientes': 'Ambientes montados',
  'c:paredes': 'Paredes',
  'c:autoservicio': 'Autoservicio',
  'c:habitaciones': 'Pasillo 4 · Las habitaciones',
  'c:heroes': 'Capa y Antifaz',
  'c:pronto': 'Ala nueva · próximamente',
  'c:moda': 'Planta −1 · Moda',
};
const SITIO_TEXTO = {
  caja: 'Caja',
  directorio: 'Directorio',
  mercadillo: 'Mercadillo y estiba',
  probador: 'Probador',
  // 2.ª ampliación · Las escaleras mecánicas
  bajar: '↓ Planta −1 · Moda',
  subir: '↑ Planta 0 · Muebles y caja',
  // Bloque 2 · Las zonas de la planta de ropa
  ...Object.fromEntries(ZONAS_ROPA.map((z) => [`ropa:${z.id}`, z.nombre])),
};

export function Almacen({ onStreet, onInventory = () => {}, soundOn = false }) {
  const wrap = useRef(null);
  const host = useRef(null);
  const api = useRef(null);
  const tagEls = useRef({});
  const [ready, setReady] = useState(false);
  const [sin3d, setSin3d] = useState(false);
  // La escena 3D, para el albarán que se juega en el propio mostrador
  const [escena3d, setEscena3d] = useState(null);
  // El albarán en el mostrador: la cámara baja a la cinta y solo queda el botón (empezado del que ya se cerró)
  const [mostrador, setMostrador] = useState(false);
  const [mostradorHecho, setMostradorHecho] = useState(null);
  const [mercadillo, setMercadillo] = useState(false);
  // El papel abierto: 'ficha' | 'directorio' | 'carrito' | 'caja' | 'amigo' | null
  const [papel, setPapel] = useState(null);
  const [ficha, setFicha] = useState(null); // { i (expositor), tono }
  const [carrito, setCarrito] = useState(() => sano(leer(CARRITO_KEY, [])));
  const [inventario, setInventario] = useState(null);
  const [estado, setEstado] = useState(null);
  const [cerrada, setCerrada] = useState(false);
  const [offset, setOffset] = useState(0);
  const [usar, setUsar] = useState(true);
  const [fase, setFase] = useState('lista');
  const [error, setError] = useState('');
  const [recibo, setRecibo] = useState(null);
  const [empezando, setEmpezando] = useState(false);
  const [aviso, setAviso] = useState('');
  // 1.102 · El probador: { uid, base (como ibas), look (como vas en el espejo), prendas, guardando, error }, o { error }
  const [probador, setProbador] = useState(null);
  const [enEspejo, setEnEspejo] = useState(false);
  const espejoPuesto = useRef(false);
  // La visita: { sala, uid, alias, anfitrion } y quienes están (del último pulso)
  const [visita, setVisita] = useState(null);
  const [otros, setOtros] = useState([]);
  const [amigos, setAmigos] = useState(null);
  const [mira, setMira] = useState(null); // lo que me señalan: { uid, alias, id, i }
  const miraN = useRef(0);
  const miraMia = useRef(null);
  const vistos = useRef({});
  const papelRef = useRef(null);
  const pagando = useRef(false);
  // 2.ª ampliación · En qué planta estás y el aviso de «pasa por caja primero» (con muebles en el carrito no se baja)
  const [planta, setPlanta] = useState(0);
  const [bloqueo, setBloqueo] = useState(false);
  const carritoRef = useRef(carrito);
  carritoRef.current = carrito;
  // Bloque 2 · La planta de ropa: la zona abierta, la cesta y tu ropa (lo ganado y cómo vas), para decir qué es tuyo
  const [zonaId, setZonaId] = useState(null);
  const [cesta, setCesta] = useState(() => cestaSana(leer(CESTA_KEY, [])));
  const [ropaMia, setRopaMia] = useState(null); // { prendas, base }
  const ropaPedida = useRef(false);
  useEffect(() => guardar(CESTA_KEY, cesta.length ? cesta : null), [cesta]);
  useEffect(() => {
    if (ready) api.current?.cesta?.(cesta);
  }, [ready, cesta]);
  const pedirRopa = useCallback(() => {
    if (ropaPedida.current) return;
    ropaPedida.current = true;
    Promise.all([loadMiPersonaje().catch(() => null), loadArmario(todayKey()).catch(() => null)]).then(([yo, armario]) => setRopaMia({ prendas: armario?.prendas ?? null, base: yo?.personaje ?? null }));
  }, []);
  // Bloque 3 · El pago de la ropa de la planta, desde la cesta
  const [cobroRopa, setCobroRopa] = useState({ fase: 'lista', error: '', hecho: null });
  const pagandoRopa = useRef(false);
  async function pagarRopa(prendas, total) {
    if (pagandoRopa.current || !prendas.length) return;
    pagandoRopa.current = true;
    setCobroRopa({ fase: 'pagando', error: '', hecho: null });
    const firma = JSON.stringify({ prendas, total });
    let pendiente = leer(COMPRA_ROPA_KEY, null);
    if (!pendiente || pendiente.firma !== firma) {
      pendiente = { clave: nuevaClave(), firma };
      guardar(COMPRA_ROPA_KEY, pendiente);
    }
    try {
      const r = await almacenRopaComprar(pendiente.clave, prendas, total);
      guardar(COMPRA_ROPA_KEY, null);
      setRopaMia((m) => ({ ...(m ?? {}), prendas: r.prendas }));
      setCobroRopa({ fase: 'lista', error: '', hecho: { ropa: r.ropa, total: r.total } });
      cargar();
    } catch (e) {
      if (String(e?.message ?? '').includes('almacen:')) guardar(COMPRA_ROPA_KEY, null);
      setCobroRopa({ fase: 'lista', error: motivo(e, total, estado?.tickets).replace('ese carrito', 'esa ropa').replace('Tu carrito sigue aquí', 'Tu cesta sigue aquí'), hecho: null });
      cargar();
    } finally {
      pagandoRopa.current = false;
    }
  }
  const ponerEnCesta = useCallback((p) => setCesta((c) => (c.includes(p) ? c.filter((x) => x !== p) : c.length >= CESTA_MAX ? c : [...c, p])), []);

  useEffect(() => guardar(CARRITO_KEY, carrito), [carrito]);
  useEffect(() => {
    if (!carrito.length) setBloqueo(false);
  }, [carrito.length]);
  useEffect(() => {
    papelRef.current = papel;
  });

  // El alto, como en la recepción: hasta el pie de la pantalla (o del panel, en escritorio)
  useLayoutEffect(() => {
    if (mercadillo) return undefined;
    const fit = () => {
      const el = wrap.current;
      if (!el) return;
      let bottom = window.innerHeight;
      const shell = el.closest('[role="dialog"]');
      const shellBottom = shell?.getBoundingClientRect().bottom ?? bottom;
      if (shell && shellBottom < bottom - 1) {
        const cs = getComputedStyle(shell);
        bottom = shellBottom - parseFloat(cs.borderBottomWidth) - parseFloat(cs.paddingBottom);
      }
      el.style.setProperty('--alm-h', `${Math.max(380, bottom - el.getBoundingClientRect().top)}px`);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [mercadillo]);

  // La escena
  useEffect(() => {
    if (mercadillo) return undefined;
    let alive = true;
    let mounted = null;
    import('./almacen3d')
      .then(({ mountAlmacen }) => {
        if (!alive) return;
        try {
          mounted = mountAlmacen(host.current, {
            onPick: (id) => elegir.current(id),
            onLost: () => alive && setSin3d(true),
            onMove: (p) => alive && setPlanta(plantaDe(p.z ?? 0)),
            puedeBajar: () => carritoRef.current.length === 0,
            onBloqueo: () => alive && setBloqueo(true),
            onFrame: (tags) => {
              const w = host.current?.clientWidth ?? 0;
              for (const [id, t] of Object.entries(tags)) {
                const el = tagEls.current[id];
                if (!el) continue;
                // Que no se salga por los lados: el letrero se queda dentro de la pantalla
                const half = t.visible ? el.offsetWidth / 2 : 0;
                const x = w ? Math.min(Math.max(t.x, half + 6), w - half - 6) : t.x;
                el.style.transform = `translate(${Math.round(x)}px, ${Math.round(t.y)}px) translate(-50%, -100%)`;
                el.dataset.off = t.visible ? '' : 'true';
              }
            },
          });
        } catch {
          setSin3d(true);
          return;
        }
        api.current = mounted;
        if (import.meta.env.DEV) window.__almacen3d = mounted;
        setReady(true);
        setEscena3d(mounted);
      })
      .catch(() => alive && setSin3d(true));
    return () => {
      alive = false;
      mounted?.destroy();
      api.current = null;
      setEscena3d(null);
      setReady(false);
    };
  }, [mercadillo]);

  // Lo del servidor: inventario y caja
  const cargar = useCallback(async () => {
    try {
      const t0 = Date.now();
      const s = await loadAlmacen();
      if (!s) {
        setCerrada(true);
        return null;
      }
      setCerrada(false);
      setOffset(s.ahora - Math.round((t0 + Date.now()) / 2));
      setEstado(s);
      return s;
    } catch {
      return null;
    }
  }, []);
  useEffect(() => {
    cargar();
    loadInventario().then(
      (inv) => setInventario(inv),
      () => {},
    );
  }, [cargar]);
  // Al acabar el tiempo del albarán, el servidor da el resultado
  useEffect(() => {
    const d = estado?.descuento;
    if (d?.estado !== 'jugando') return undefined;
    const quedan = d.empezado + duracion(d.modo) + ALBARAN.margen + 300 - (Date.now() + offset);
    const t = setTimeout(cargar, Math.max(200, quedan));
    return () => clearTimeout(t);
  }, [estado, offset, cargar]);

  // El carro de la escena lleva un paquete por cada cosa del carrito
  useEffect(() => {
    escena3d?.carga(carrito.map((l) => ({ id: l.id, n: l.n, url: thumbOf(l.id, l.tono ?? 0, 32) })));
  }, [escena3d, carrito]);
  // El albarán se juega en el mostrador 3D: la cámara se acerca a la cinta, sin abrir nada encima
  const dJuego = estado?.descuento;
  const enJuego = papel === 'caja' && dJuego?.estado === 'jugando' && !!escena3d && !sin3d && dJuego.empezado !== mostradorHecho;
  if (enJuego && !mostrador) setMostrador(true);
  if (mostrador && papel !== 'caja') setMostrador(false);
  useEffect(() => {
    if (!escena3d) return;
    if (mostrador) {
      escena3d.mostrador(true, { top: 0.72, dibujos: carrito.map((l) => thumbOf(l.id, 0, 32)) });
      return;
    }
    escena3d.mostrador(false);
    if (papelRef.current !== 'caja') return;
    // De vuelta a la caja: la tarjeta vuelve y la cámara se aparta para dejarle sitio
    requestAnimationFrame(() => {
      const stage = host.current?.getBoundingClientRect();
      const card = wrap.current?.querySelector('.alm-card')?.getBoundingClientRect();
      escena3d.mirarCaja(stage?.height && card ? Math.max(0.2, (card.top - stage.top) / stage.height) : 1);
    });
    // Solo al entrar y salir del mostrador
  }, [mostrador, escena3d]); // eslint-disable-line react-hooks/exhaustive-deps
  const finMostrador = useCallback(() => {
    setMostradorHecho(estado?.descuento?.empezado ?? null);
    setMostrador(false);
    cargar();
  }, [estado?.descuento?.empezado, cargar]);

  // ── Lo que se toca ──
  const abrirFicha = useCallback((i, tono = null) => {
    const e = EXPOSITORES[i];
    if (!e) return;
    const t = tono ?? e.tono;
    setFicha({ i, tono: t });
    setPapel('ficha');
    setError('');
  }, []);
  const cerrar = useCallback(() => {
    const cur = api.current?.examining();
    if (cur != null) api.current.setTono(cur, EXPOSITORES[cur].tono);
    api.current?.leave();
    espejoPuesto.current = false;
    setEnEspejo(false);
    setProbador(null);
    setPapel(null);
    setFicha(null);
    if (fase === 'hecha') {
      setFase('lista');
      setRecibo(null);
    }
  }, [fase]);
  const elegir = useRef(() => {});
  useEffect(() => {
    elegir.current = (id) => {
      if (!id) {
        if (papelRef.current) cerrar();
        return;
      }
      if (id.startsWith('e:')) abrirFicha(Number(id.slice(2)));
      else if (id === 'caja') irACaja();
      else if (id === 'directorio') setPapel((p) => (p === 'directorio' ? null : 'directorio'));
      else if (id === 'carrito') setPapel((p) => (p === 'carrito' ? null : 'carrito'));
      else if (id === 'mercadillo') irAlMercadillo();
      else if (id === 'probador') irAlProbador();
      else if (id === 'bajar') irAPlanta('ropa');
      else if (id === 'subir') irAPlanta('arriba');
      else if (id.startsWith('ropa:')) irAZona(id.slice(5));
    };
  });
  // De cerca: el mueble queda en el hueco que deja el papel
  useEffect(() => {
    if (!ready || papel !== 'ficha' || !ficha) return;
    const stage = host.current?.getBoundingClientRect();
    const card = wrap.current?.querySelector('.alm-card')?.getBoundingClientRect();
    const top = stage?.height && card ? Math.max(0.2, (card.top - stage.top) / stage.height) : 1;
    api.current?.examine(ficha.i, top);
    // Solo al cambiar de mueble (cambiar de tono no mueve la cámara)
  }, [ready, papel, ficha?.i]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (ready && ficha) api.current?.setTono(ficha.i, ficha.tono);
  }, [ready, ficha]);

  function irACaja() {
    setBloqueo(false);
    if (papelRef.current === 'ficha') api.current?.leave(true);
    setFicha(null);
    setPapel('caja');
    setError('');
    cargar();
    const p = api.current?.go('caja');
    p?.then(() => {
      if (papelRef.current !== 'caja') return;
      const stage = host.current?.getBoundingClientRect();
      const card = wrap.current?.querySelector('.alm-card')?.getBoundingClientRect();
      api.current?.mirarCaja(stage?.height && card ? Math.max(0.2, (card.top - stage.top) / stage.height) : 1);
    });
  }
  // ── 1.102 · El probador: se va andando hasta el espejo, la cámara se pone delante y tu personaje sale reflejado ──
  function irAlProbador() {
    if (papelRef.current === 'ficha') api.current?.leave(true);
    setFicha(null);
    setPapel('probador');
    setProbador(null);
    setEnEspejo(false);
    espejoPuesto.current = false;
    Promise.all([loadMiPersonaje(), loadArmario(todayKey()).catch(() => null)]).then(
      ([yo, armario]) => {
        if (papelRef.current === 'probador') setProbador({ uid: yo.uid, base: yo.personaje, look: yo.personaje, prendas: armario?.prendas ?? null, guardando: false, error: '' });
      },
      (e) => {
        if (papelRef.current === 'probador') setProbador({ error: e?.message || 'No se ha podido abrir el probador. Prueba otra vez.' });
      },
    );
    const p = api.current?.go('probador');
    p?.then(() => {
      if (papelRef.current === 'probador') setEnEspejo(true);
    });
  }
  // Delante del espejo: la primera vez se coloca la cámara; después, solo cambia el reflejo
  useEffect(() => {
    if (papel !== 'probador' || !enEspejo || !probador?.look) return;
    if (espejoPuesto.current) {
      api.current?.vestir(probador.look);
      return;
    }
    espejoPuesto.current = true;
    const stage = host.current?.getBoundingClientRect();
    const card = wrap.current?.querySelector('.alm-card')?.getBoundingClientRect();
    api.current?.probador(true, { avatar: probador.look, top: stage?.height && card ? Math.max(0.2, (card.top - stage.top) / stage.height) : 1 });
  }, [papel, enEspejo, probador?.look]);
  // Si se abre otro papel desde la barra, el espejo se deja
  useEffect(() => {
    if (papel === 'probador' || !espejoPuesto.current) return;
    espejoPuesto.current = false;
    api.current?.leave(true);
  }, [papel]);
  async function listoProbador() {
    const pr = probador;
    if (!pr?.look || pr.guardando) return;
    if (mismoLook(pr.look, pr.base)) return cerrar();
    if (usesLocked(pr.look, pr.prendas ?? []) && !usesLocked(pr.base, pr.prendas ?? [])) return;
    setProbador({ ...pr, guardando: true, error: '' });
    try {
      await savePersonaje(pr.uid, pr.look);
      setAviso('Listo: así vas. Te ven así en tu piso y en el hotel.');
      cerrar();
    } catch (e) {
      setProbador({ ...pr, guardando: false, error: e?.message || 'No se ha podido guardar. Prueba otra vez.' });
    }
  }
  // ── Bloque 2 · Una zona de la planta de ropa: se va andando hasta ella y se abre su papel ──
  function irAZona(id) {
    if (!zonaRopa(id)) return;
    if (papelRef.current === 'ficha') api.current?.leave(true);
    setFicha(null);
    setZonaId(id);
    setPapel('ropa');
    pedirRopa();
    api.current?.go(`ropa:${id}`);
  }
  // ── 2.ª ampliación · Bajar a la planta de ropa o subir a la de muebles, por las escaleras mecánicas ──
  function irAPlanta(a) {
    if (papelRef.current === 'ficha') api.current?.leave(true);
    setFicha(null);
    setPapel(null);
    setBloqueo(false);
    api.current?.go(a);
  }
  function irAlMercadillo() {
    const ir = () => {
      setPapel(null);
      setFicha(null);
      setMercadillo(true);
    };
    const p = api.current?.go('mercadillo');
    if (p) p.then(ir);
    else ir();
  }

  // Escape: cierra el papel; sin papel, sale a la plaza
  useEffect(() => {
    if (mercadillo) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (papelRef.current) cerrar();
      else onStreet();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onStreet, cerrar, mercadillo]);

  // ── Las ofertas de hoy (las elige el servidor; sin su migración no hay) ──
  const ofertas = useMemo(() => mapaOfertas(estado?.ofertas), [estado?.ofertas]);
  const precioHoy = (a) => (a ? precioOferta(a.precio, ofertas.get(a.id)?.pct) : null);

  // ── El carrito ──
  const lineas = useMemo(
    () =>
      carrito
        .map((l) => {
          const a = articulo(l.id);
          const o = ofertas.get(l.id) ?? null;
          return a ? { ...l, nombre: a.nombre, base: a.precio, precio: precioOferta(a.precio, o?.pct), oferta: o } : null;
        })
        .filter(Boolean),
    [carrito, ofertas],
  );
  const cambiar = (id, n) => {
    setError('');
    setCarrito((c) => {
      const cur = c.find((l) => l.id === id);
      if (n <= 0) return c.filter((l) => l.id !== id);
      if (!cur) return c.length >= MAX_LINEAS ? c : [...c, { id, n: Math.min(MAX_N, n) }];
      return c.map((l) => (l.id === id ? { ...l, n: Math.min(MAX_N, n) } : l));
    });
  };
  const enCarrito = (id) => carrito.find((l) => l.id === id)?.n ?? 0;

  // ── La caja ──
  const empezar = async (modo) => {
    setEmpezando(true);
    setError('');
    try {
      const t0 = Date.now();
      const s = await almacenEmpezar(modo);
      setOffset(s.ahora - Math.round((t0 + Date.now()) / 2));
      setEstado(s);
    } catch {
      setError('No se ha podido empezar el albarán. Puedes comprar sin descuento o intentarlo otra vez.');
      cargar();
    } finally {
      setEmpezando(false);
    }
  };
  const sellar = async (plano, acierto) => {
    try {
      const s = await almacenSellar(plano, acierto);
      setEstado((cur) => (cur ? { ...s, descuento: s.descuento } : s));
    } catch {
      // Si no llega, el servidor lo da por fallado al acabar el tiempo
    }
  };
  const comprar = async ({ total, usar: conDescuento }) => {
    if (pagando.current || !lineas.length) return;
    pagando.current = true;
    setFase('pagando');
    setError('');
    const articulos = carrito.map((l) => ({ id: l.id, n: l.n }));
    const firma = JSON.stringify({ articulos, total, conDescuento });
    // La misma clave mientras el carrito y la cuenta no cambien: un reintento nunca cobra dos veces
    let pendiente = leer(COMPRA_KEY, null);
    if (!pendiente || pendiente.firma !== firma) {
      pendiente = { clave: nuevaClave(), firma };
      guardar(COMPRA_KEY, pendiente);
    }
    try {
      const r = await almacenComprar(pendiente.clave, articulos, total, conDescuento);
      guardar(COMPRA_KEY, null);
      setRecibo({ lineas, subtotal: r.subtotal, ahorro: r.ahorro ?? 0, pct: r.pct, descuento: r.descuento, total: r.total, tickets: r.inventario?.tickets ?? null });
      setCarrito([]);
      setInventario(r.inventario);
      onInventory(r.inventario);
      setFase('hecha');
      cargar();
    } catch (e) {
      setError(motivo(e, total, estado?.tickets));
      setFase('lista');
      // Un fallo que dice algo del servidor (saldo, precio, descuento) cambia la cuenta: otra clave la próxima vez
      if (String(e?.message ?? '').includes('almacen:')) guardar(COMPRA_KEY, null);
      cargar();
    } finally {
      pagando.current = false;
    }
  };

  // ── La visita con un amigo ──
  const cargarAmigos = useCallback(() => {
    almacenAmigos().then(
      (a) => {
        setAmigos(a ?? { amigos: [], invitaciones: [], mia: null, cerrado: true });
        if (a?.mia && !visita) setVisita({ sala: a.mia.sala, uid: a.mia.uid, alias: a.mia.alias, anfitrion: true });
      },
      () => setAmigos({ amigos: [], invitaciones: [], mia: null, fallo: true }),
    );
  }, [visita]);
  const unirse = useCallback(async (inv) => {
    try {
      await almacenUnirse(inv.sala);
      setVisita({ sala: inv.sala, uid: inv.uid, alias: inv.alias, anfitrion: false });
      setAviso(`Estás en el almacén con ${inv.alias ?? 'tu amigo'}.`);
      setPapel(null);
    } catch {
      setAviso('Esa invitación ya no está abierta.');
    }
  }, []);
  // Si se llega desde el aviso de una invitación, se entra directamente
  useEffect(() => {
    let sala = null;
    try {
      sala = sessionStorage.getItem(UNIRSE_KEY);
      sessionStorage.removeItem(UNIRSE_KEY);
    } catch {
      sala = null;
    }
    if (!sala) return;
    almacenAmigos().then(
      (a) => {
        const inv = a?.invitaciones?.find((x) => x.sala === sala);
        if (inv) unirse(inv);
      },
      () => {},
    );
  }, [unirse]);
  useEffect(() => {
    if (papel === 'amigo') cargarAmigos();
  }, [papel, cargarAmigos]);
  const invitar = async (amigo) => {
    try {
      const r = await almacenInvitar(amigo.uid);
      setVisita({ sala: r.sala, uid: amigo.uid, alias: amigo.alias, anfitrion: true });
      setAviso(`Has invitado a ${amigo.alias ?? 'tu amigo'}. Le llegará el aviso esté donde esté del edificio.`);
    } catch {
      setAviso('No se ha podido invitar. Inténtalo otra vez.');
    }
  };
  const dejar = useCallback(async () => {
    const v = visita;
    setVisita(null);
    setOtros([]);
    api.current?.setPeers([]);
    api.current?.mark(null);
    setMira(null);
    if (v) almacenSalir(v.sala).catch(() => {});
  }, [visita]);
  // El pulso: cada segundo o así, dónde estoy, qué señalo y cómo va mi albarán; y lo mismo del otro
  const estadoRef = useRef(estado);
  useEffect(() => {
    estadoRef.current = estado;
  });
  useEffect(() => {
    if (!visita) return undefined;
    let alive = true;
    let enVuelo = false;
    const latir = async () => {
      if (enVuelo || document.hidden) return;
      enVuelo = true;
      const pose = api.current?.pose() ?? { x: 15.5, y: 23.6, yaw: 3.5 };
      const d = estadoRef.current?.descuento;
      const zona = mercadillo ? 'mercadillo' : plantaDe(pose.z ?? 0) === BAJO.z ? 'ropa' : papelRef.current === 'caja' ? 'caja' : 'pasillos';
      try {
        const r = await almacenPulso(visita.sala, {
          x: pose.x,
          y: pose.y,
          yaw: ((pose.yaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI),
          zona,
          mira: miraMia.current,
          mira_n: miraN.current,
          sello: d && d.estado !== 'libre' ? { modo: d.modo, empezado: d.empezado, marcas: d.marcas } : null,
        });
        if (!alive) return;
        if (r?.estado === 'cerrada') {
          setAviso('La visita ha terminado. Sigues en el almacén.');
          setVisita(null);
          setOtros([]);
          api.current?.setPeers([]);
          return;
        }
        const aqui = (r?.otros ?? []).filter((o) => o.hace < IDO_S);
        setOtros((antes) => {
          if (antes.length && !aqui.length) setAviso(`${antes[0].alias ?? 'Tu amigo'} se ha ido del almacén. Tú sigues aquí.`);
          if (!antes.length && aqui.length) setAviso(`${aqui[0].alias ?? 'Tu amigo'} está en el almacén contigo.`);
          return aqui;
        });
        api.current?.setPeers(aqui.filter((o) => o.zona !== 'mercadillo').map((o) => ({ uid: o.uid, avatar: validateAvatar(o.personaje), x: o.x, y: o.y, z: o.zona === 'ropa' ? BAJO.z : 0, yaw: o.yaw })));
        for (const o of aqui) {
          const visto = vistos.current[o.uid];
          if (visto == null) vistos.current[o.uid] = o.mira_n;
          else if (o.mira_n > visto && o.mira) {
            vistos.current[o.uid] = o.mira_n;
            const e = EXPOSITORES.find((x) => x.id === o.mira && !x.muestra && !DE_PASO.has(x.seccion)) ?? EXPOSITORES.find((x) => x.id === o.mira);
            if (e) {
              setMira({ uid: o.uid, alias: o.alias ?? 'Tu amigo', id: o.mira, i: e.i });
              api.current?.mark(e.i);
            }
          }
        }
      } catch {
        // Sin conexión un momento: el siguiente pulso lo intenta otra vez
      } finally {
        enVuelo = false;
      }
    };
    latir();
    const t = setInterval(latir, PULSO_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [visita, mercadillo]);
  const miraEsto = (id) => {
    miraMia.current = id;
    miraN.current += 1;
    setAviso(`Se lo has señalado a ${otros[0]?.alias ?? 'tu amigo'}.`);
  };
  // Los avisos se van solos
  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(''), 4200);
    return () => clearTimeout(t);
  }, [aviso]);

  if (mercadillo) {
    return (
      <div className="alm-mercadillo">
        <div className="alm-volver__franja">
          <button type="button" className="alm-volver" onClick={() => setMercadillo(false)}>
            Volver al almacén
          </button>
          <span>Estás en el mercadillo del muelle</span>
        </div>
        <Lonja onStreet={() => setMercadillo(false)} onInventory={onInventory} soundOn={soundOn} />
      </div>
    );
  }

  const fichaE = ficha ? EXPOSITORES[ficha.i] : null;
  const fichaA = fichaE ? articulo(fichaE.id) : null;
  const fichaCat = fichaE ? catalogItem(fichaE.id) : null;
  const tienes = fichaE && inventario ? ownedCopies(inventario, fichaE.id) : null;
  const amigoAqui = otros[0] ?? null;
  const unidades = carrito.reduce((s, l) => s + l.n, 0);
  const selloAmigo = amigoAqui?.zona === 'caja' && amigoAqui.sello ? amigoAqui.sello : null;

  return (
    <section className="alm" ref={wrap} aria-labelledby="alm-title" data-escape-local="open" data-papel={papel || undefined} data-ready={ready || undefined} data-mostrador={mostrador || undefined}>
      <h3 className="px-sr" id="alm-title">
        El Almacén del Puerto
      </h3>
      <div className="alm-stage" ref={host}>
        {!ready && !sin3d && <p className="alm-loading">Abriendo el portón del almacén…</p>}
        {sin3d && (
          <div className="alm-sin3d">
            <p>Este dispositivo no puede enseñar el almacén en 3D. Puedes comprar igual desde el directorio.</p>
            <button type="button" className="alm-btn alm-btn--primario" onClick={() => setPapel('directorio')}>
              Abrir el directorio
            </button>
          </div>
        )}
        <div className="alm-tags">
          {Object.keys(CARTEL_TEXTO).map((id) => (
            <span key={id} className="alm-cartel" ref={(el) => (tagEls.current[id] = el)} data-off="true" aria-hidden="true">
              {/^Pasillo [0-9] · /.test(CARTEL_TEXTO[id]) ? (
                <>
                  <i>{CARTEL_TEXTO[id].charAt(8)}</i>
                  {CARTEL_TEXTO[id].slice(12)}
                </>
              ) : (
                CARTEL_TEXTO[id]
              )}
            </span>
          ))}
          {Object.keys(SITIO_TEXTO).map((id) => (
            <button key={id} type="button" className="alm-tag alm-tag--sitio" ref={(el) => (tagEls.current[id] = el)} data-off="true" tabIndex={papel ? -1 : 0} onClick={() => elegir.current(id)}>
              {SITIO_TEXTO[id]}
            </button>
          ))}
          {EXPOSITORES.map((e) => {
            const a = articulo(e.id);
            const o = ofertas.get(e.id);
            return (
              <button
                key={e.i}
                type="button"
                className="alm-tag alm-tag--precio"
                data-oferta={o?.tipo}
                ref={(el) => (tagEls.current[`e:${e.i}`] = el)}
                data-off="true"
                tabIndex={-1}
                onClick={() => abrirFicha(e.i)}
              >
                {o && <i className="alm-tag__oferta">−{o.pct} %</i>}
                <span>{a?.nombre}</span>
                {o && <s>{a?.precio}</s>}
                <b>{precioHoy(a)}</b>
              </button>
            );
          })}
          {otros.map((o) => (
            <span key={o.uid} className="alm-nombre" ref={(el) => (tagEls.current[`p:${o.uid}`] = el)} data-off="true">
              {o.alias ?? 'Tu amigo'}
            </span>
          ))}
        </div>
        {sin3d && <Carretilla lineas={carrito} abierto={papel === 'carrito'} onOpen={() => setPapel((p) => (p === 'carrito' ? null : 'carrito'))} />}
      </div>

      {(aviso || mira || bloqueo) && (
        <div className="alm-avisos" role="status">
          {bloqueo && (
            <div className="alm-mira alm-bloqueo">
              <Icono id="carrito" />
              <p>
                Antes de bajar, <b>pasa por caja</b>: llevas muebles en el carrito.
              </p>
              <button type="button" className="alm-btn alm-btn--primario" onClick={irACaja}>
                Ir a caja
              </button>
              <button type="button" className="alm-x" aria-label="Ahora no" onClick={() => setBloqueo(false)}>
                ×
              </button>
            </div>
          )}
          {mira && (
            <div className="alm-mira">
              <Icono id="amigo" />
              <p>
                {mira.alias} te señala: <b>{articulo(mira.id)?.nombre}</b>
              </p>
              <button
                type="button"
                className="alm-btn alm-btn--primario"
                onClick={() => {
                  setMira(null);
                  api.current?.mark(null);
                  abrirFicha(mira.i);
                }}
              >
                Ver
              </button>
              <button
                type="button"
                className="alm-x"
                aria-label="Ahora no"
                onClick={() => {
                  setMira(null);
                  api.current?.mark(null);
                }}
              >
                ×
              </button>
            </div>
          )}
          {aviso && <p className="alm-aviso-flota">{aviso}</p>}
        </div>
      )}

      {mostrador && dJuego?.empezado && (
        <div className="alm-juego">
          <SellaAlbaran
            sello={dJuego}
            offset={offset}
            onSellar={sellar}
            piezas={lineas.map((l) => l.id)}
            dibujo={(id) => thumbOf(id, 0, 32)}
            soundOn={soundOn}
            escena={escena3d}
            onFin={finMostrador}
          />
        </div>
      )}

      {papel === 'ficha' && fichaE && fichaA && (
        <section className="alm-card alm-card--ficha" aria-labelledby="alm-card-title">
          <header className="alm-card__head">
            <span className="alm-card__sello" aria-hidden="true">
              <Icono id="ficha" />
            </span>
            <div className="alm-card__titulo">
              <small>{seccionDe(fichaE) ? `${seccionDe(fichaE).donde} · ${seccionDe(fichaE).nombre}` : 'Expositor'}</small>
              <h4 id="alm-card-title">{fichaA.nombre}</h4>
            </div>
            <button type="button" className="alm-card__back" onClick={cerrar}>
              Volver
            </button>
          </header>
          <div className="alm-card__body">
            <div className="alm-ficha">
              <div className="alm-ficha__muestra">
                <img className="alm-ficha__thumb" src={thumbOf(fichaE.id, ficha.tono, 64)} alt="" width="80" height="80" />
                <span className="alm-precio" aria-hidden="true" data-oferta={ofertas.get(fichaA.id)?.tipo} data-especial={isDeHabitacionEspecial(fichaA.id) || undefined}>
                  {ofertas.has(fichaA.id) && <s>{fichaA.precio}</s>}
                  <b>{precioHoy(fichaA)}</b>
                  <small>tickets</small>
                </span>
              </div>
              <dl className="alm-ficha__datos">
                <div>
                  <dt>Precio</dt>
                  <dd>
                    {ofertas.has(fichaA.id) ? (
                      <>
                        <s>{ticketsText(fichaA.precio)}</s> {ticketsText(precioHoy(fichaA))}{' '}
                        <em className="alm-oferta" data-tipo={ofertas.get(fichaA.id).tipo}>
                          {ROTULO_OFERTA[ofertas.get(fichaA.id).tipo]} · −{ofertas.get(fichaA.id).pct} %
                        </em>
                      </>
                    ) : isDeHabitacionEspecial(fichaA.id) ? (
                      <>
                        {ticketsText(fichaA.precio)}{' '}
                        <em className="alm-oferta" data-tipo="especial">
                          De habitación especial · nunca se rebaja
                        </em>
                      </>
                    ) : (
                      ticketsText(fichaA.precio)
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Medidas</dt>
                  <dd>{medidasDe(fichaE.id)}</dd>
                </div>
                <div>
                  <dt>En casa</dt>
                  <dd>{tienes == null ? '…' : tienes === Infinity ? 'Siempre lo tienes' : tienes > 0 ? `Ya tienes ${tienes}` : 'Aún no lo tienes'}</dd>
                </div>
              </dl>
            </div>
            <fieldset className="alm-tonos">
              <legend>
                Tonos <span>{nombreTono(fichaCat.tonos[ficha.tono] ?? fichaCat.tonos[0])}</span>
              </legend>
              <div className="alm-tonos__fila">
                {fichaCat.tonos.map((c, k) => (
                  <label key={k} className="alm-tono" title={nombreTono(c)}>
                    <input type="radio" name="alm-tono" checked={ficha.tono === k} onChange={() => setFicha((f) => ({ ...f, tono: k }))} />
                    <span className="alm-tono__muestra" style={{ background: `rgb(${c.join(',')})` }} aria-hidden="true" />
                    <span className="alm-tono__nombre">{nombreTono(c)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="alm-nota">Los tonos se ven en el mueble; el tuyo lo eliges al colocarlo en Decorar. Arrastra el mueble para girarlo.</p>
            <div className="alm-acciones">
              <button type="button" className="alm-btn alm-btn--primario" onClick={() => cambiar(fichaE.id, enCarrito(fichaE.id) + 1)} disabled={enCarrito(fichaE.id) >= MAX_N}>
                {enCarrito(fichaE.id) ? `Añadir otro (llevas ${enCarrito(fichaE.id)})` : 'Añadir al carrito'}
              </button>
              {amigoAqui && (
                <button type="button" className="alm-btn" onClick={() => miraEsto(fichaE.id)}>
                  Mira esto
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {papel && papel !== 'ficha' && (
        <section className={`alm-card alm-card--${papel}`} aria-labelledby="alm-card-title">
          <header className="alm-card__head">
            <span className="alm-card__sello" aria-hidden="true">
              <Icono id={papel === 'amigo' ? 'amigo' : papel} />
            </span>
            <div className="alm-card__titulo">
              <small>{ANTETITULOS[papel]}</small>
              <h4 id="alm-card-title">{papel === 'ropa' ? (zonaRopa(zonaId)?.nombre ?? TITULOS.ropa) : TITULOS[papel]}</h4>
            </div>
            <button type="button" className="alm-card__back" onClick={cerrar}>
              Volver
            </button>
          </header>
          <div className="alm-card__body">
            {papel === 'directorio' && (
              <div className="alm-dir">
                {ofertas.size > 0 && (
                  <section className="alm-dir__seccion alm-dir__ofertas" aria-label="Ofertas de hoy">
                    <h5>
                      <span className="alm-dir__pasillo">%</span>
                      Ofertas <small>{ofertasHasta(estado)}</small>
                    </h5>
                    <ul>
                      {[...ofertas.values()].map((o) => {
                        const a = articulo(o.id);
                        if (!a || a.expositor == null) return null;
                        return (
                          <li key={o.id}>
                            <button
                              type="button"
                              className="alm-dir__item"
                              data-oferta={o.tipo}
                              onClick={() => {
                                setPapel(null);
                                const p = api.current?.go(a.expositor);
                                if (p) p.then(() => abrirFicha(a.expositor));
                                else abrirFicha(a.expositor);
                              }}
                            >
                              <img src={thumbOf(a.id, 0, 48)} alt="" width="40" height="40" />
                              <span>
                                {a.nombre}
                                <small>{ROTULO_OFERTA[o.tipo]}</small>
                              </span>
                              <b>
                                <s>{a.precio}</s> {ticketsText(precioHoy(a))} · −{o.pct} %
                              </b>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}
                {SECCIONES.filter((s) => !DE_PASO.has(s.id)).map((s) => (
                  <section key={s.id} className="alm-dir__seccion">
                    <h5>
                      <span className="alm-dir__pasillo">{s.donde.replace('Pasillo ', '').split(',')[0]}</span>
                      {s.nombre} <small>{s.donde}</small>
                    </h5>
                    <ul>
                      {ARTICULOS.filter((a) => a.expositor != null && EXPOSITORES[a.expositor].seccion === s.id).map((a) => (
                        <li key={a.id}>
                          <button
                            type="button"
                            className="alm-dir__item"
                            onClick={() => {
                              setPapel(null);
                              const p = api.current?.go(a.expositor);
                              if (p) p.then(() => abrirFicha(a.expositor));
                              else abrirFicha(a.expositor);
                            }}
                          >
                            <img src={thumbOf(a.id, 0, 48)} alt="" width="40" height="40" />
                            <span>{a.nombre}</span>
                            <b data-oferta={ofertas.get(a.id)?.tipo}>{ticketsText(precioHoy(a))}</b>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
                <div className="alm-acciones alm-acciones--pie">
                  <button type="button" className="alm-btn alm-btn--primario" onClick={irACaja}>
                    Ir a caja
                  </button>
                  <button type="button" className="alm-btn alm-btn--papel" onClick={() => irAPlanta(planta === BAJO.z ? 'arriba' : 'ropa')}>
                    {planta === BAJO.z ? 'Subir a muebles' : 'Bajar a la planta de ropa'}
                  </button>
                  <button type="button" className="alm-btn alm-btn--papel" onClick={irAlMercadillo}>
                    Mercadillo y estiba
                  </button>
                </div>
              </div>
            )}
            {papel === 'carrito' &&
              (lineas.length ? (
                <div className="alm-carro">
                  <ul>
                    {lineas.map((l) => (
                      <li key={l.id}>
                        <span className="alm-paquete alm-paquete--grande" aria-hidden="true">
                          <img src={thumbOf(l.id, 0, 32)} alt="" width="24" height="24" />
                        </span>
                        <span className="alm-carro__nombre">
                          {l.nombre}
                          <small>
                            {l.oferta && <s>{l.base}</s>} {ticketsText(l.precio)} cada uno{l.oferta ? ` · −${l.oferta.pct} %` : ''}
                          </small>
                        </span>
                        <span className="alm-carro__n">
                          <button type="button" aria-label={`Uno menos de ${l.nombre}`} onClick={() => cambiar(l.id, l.n - 1)}>
                            −
                          </button>
                          <output aria-label={`Cantidad de ${l.nombre}`}>{l.n}</output>
                          <button type="button" aria-label={`Uno más de ${l.nombre}`} onClick={() => cambiar(l.id, l.n + 1)} disabled={l.n >= MAX_N}>
                            +
                          </button>
                        </span>
                        <button type="button" className="alm-quitar" onClick={() => cambiar(l.id, 0)}>
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="alm-carro__pie">
                    <p className="alm-carro__total">
                      <span>{unidades === 1 ? '1 paquete' : `${unidades} paquetes`}</span>
                      <b>{ticketsText(lineas.reduce((s, l) => s + l.precio * l.n, 0))}</b>
                    </p>
                    <button type="button" className="alm-btn alm-btn--primario" onClick={irACaja}>
                      Ir a caja
                    </button>
                  </div>
                </div>
              ) : (
                <div className="alm-vacio">
                  <Icono id="carrito" />
                  <p>Está vacío. Toca un mueble para verlo y añadirlo: aquí se lleva en paquetes planos.</p>
                </div>
              ))}
            {papel === 'caja' && (
              <>
                {selloAmigo && (
                  <div className="alm-mirando">
                    <SellaAlbaran sello={selloAmigo} offset={offset} quien={amigoAqui.alias ?? 'Tu amigo'} soloMirar />
                  </div>
                )}
                <Caja
                  lineas={lineas}
                  estado={estado}
                  offset={offset}
                  cerrada={cerrada}
                  usar={usar}
                  onUsar={setUsar}
                  onEmpezar={empezar}
                  onSellar={sellar}
                  onComprar={comprar}
                  fase={fase}
                  error={error}
                  recibo={recibo}
                  empezando={empezando}
                  onCarrito={() => setPapel('carrito')}
                  dibujo={(id) => thumbOf(id, 0, 32)}
                  soundOn={soundOn}
                  enEscena={!!escena3d && !sin3d}
                  onSeguir={() => {
                    setFase('lista');
                    setRecibo(null);
                    setPapel(null);
                  }}
                />
              </>
            )}
            {papel === 'ropa' && zonaRopa(zonaId) && (
              <ZonaRopa zona={zonaRopa(zonaId)} cesta={cesta} prendas={ropaMia?.prendas ?? null} base={ropaMia?.base ?? undefined} onCesta={ponerEnCesta} onProbador={irAlProbador} />
            )}
            {papel === 'cesta' && (
              <CestaRopa
                cesta={cesta}
                prendas={ropaMia?.prendas ?? null}
                base={ropaMia?.base ?? undefined}
                tickets={estado?.tickets ?? null}
                cobro={cobroRopa}
                onPagar={pagarRopa}
                onCesta={ponerEnCesta}
                onVaciar={() => setCesta([])}
                onProbador={irAlProbador}
              />
            )}
            {papel === 'probador' &&
              (probador?.look ? (
                <Probador look={probador.look} base={probador.base} prendas={probador.prendas} cesta={cesta} guardando={probador.guardando} error={probador.error} sin3d={!escena3d || sin3d} onLook={(look) => setProbador((pr) => pr && { ...pr, look, error: '' })} onListo={listoProbador} />
              ) : probador?.error ? (
                <p className="alm-aviso" role="alert">
                  {probador.error}
                </p>
              ) : (
                <p className="alm-nota">Abriendo el probador…</p>
              ))}
            {papel === 'amigo' && (
              <div className="alm-amigos">
                {visita ? (
                  <>
                    <p>
                      {amigoAqui ? `Estás con ${amigoAqui.alias ?? 'tu amigo'}.` : visita.anfitrion ? `Esperando a ${visita.alias ?? 'tu amigo'}…` : `Con ${visita.alias ?? 'tu amigo'}.`} Cada uno
                      lleva su carrito y sus tickets; el otro solo ve dónde estás, lo que le señalas y tu albarán.
                    </p>
                    <button type="button" className="alm-btn" onClick={dejar}>
                      Dejar la visita
                    </button>
                  </>
                ) : amigos == null ? (
                  <p className="alm-nota">Mirando quién puede venir…</p>
                ) : amigos.cerrado ? (
                  <p className="alm-nota">Las visitas aún no están abiertas en este servidor.</p>
                ) : (
                  <>
                    {amigos.invitaciones?.length > 0 && (
                      <ul className="alm-amigos__lista">
                        {amigos.invitaciones.map((inv) => (
                          <li key={inv.sala} className="alm-amigos__invita">
                            <ReaderAvatar avatarId={inv.avatar_id} alias={inv.alias ?? 'Alguien'} size="list" decorative />
                            <span>{inv.alias ?? 'Alguien'} te invita a recorrer el almacén.</span>
                            <button type="button" className="alm-btn alm-btn--primario" onClick={() => unirse(inv)}>
                              Entrar con {inv.alias ?? 'él'}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p>Invita a un amigo (os seguís los dos) a recorrer el almacén contigo.</p>
                    {amigos.amigos?.length ? (
                      <ul className="alm-amigos__lista">
                        {amigos.amigos.map((a) => (
                          <li key={a.uid}>
                            <ReaderAvatar avatarId={a.avatar_id} alias={a.alias ?? 'Tu amigo'} size="list" decorative />
                            <span>{a.alias ?? 'Tu amigo'}</span>
                            <button type="button" className="alm-btn" onClick={() => invitar(a)}>
                              Invitar
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="alm-nota">Aún no tienes amigos con seguimiento mutuo en la comunidad.</p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <nav className="alm-bar" aria-label="Lo que hay en el almacén">
        <button type="button" className="alm-tool" aria-pressed={papel === 'directorio'} onClick={() => setPapel((p) => (p === 'directorio' ? null : 'directorio'))}>
          <Icono id="directorio" />
          <span>Directorio</span>
        </button>
        {planta === BAJO.z ? (
          <button type="button" className="alm-tool" aria-pressed={papel === 'cesta'} aria-label={`Cesta: ${cesta.length} ${cesta.length === 1 ? 'prenda' : 'prendas'}`} onClick={() => (pedirRopa(), cargar(), setCobroRopa((c) => ({ ...c, error: '', hecho: null })), setPapel((p) => (p === 'cesta' ? null : 'cesta')))}>
            <Icono id="cesta" />
            <span>Cesta</span>
            {cesta.length > 0 && (
              <i className="alm-tool__chapa" aria-hidden="true">
                {cesta.length}
              </i>
            )}
          </button>
        ) : (
        <button
          type="button"
          className="alm-tool"
          aria-pressed={papel === 'carrito'}
          aria-label={`Carrito: ${unidades} ${unidades === 1 ? 'artículo' : 'artículos'}`}
          onClick={() => setPapel((p) => (p === 'carrito' ? null : 'carrito'))}
        >
          <Icono id="carrito" />
          <span>Carrito</span>
          {unidades > 0 && (
            <i className="alm-tool__chapa" aria-hidden="true">
              {unidades}
            </i>
          )}
        </button>
        )}
        <button type="button" className="alm-tool alm-tool--caja" aria-pressed={papel === 'caja'} onClick={irACaja}>
          <Icono id="caja" />
          <span>Caja</span>
          <small aria-hidden="true">{unidades ? ticketsText(lineas.reduce((t, l) => t + l.precio * l.n, 0)) : 'pagar'}</small>
        </button>
        <button type="button" className="alm-tool" aria-pressed={papel === 'amigo'} onClick={() => setPapel((p) => (p === 'amigo' ? null : 'amigo'))}>
          <Icono id="amigo" />
          <span>{amigoAqui ? 'Acompañado' : 'Con un amigo'}</span>
        </button>
        <button type="button" className="alm-tool" onClick={irAlMercadillo}>
          <Icono id="mercadillo" />
          <span>Mercadillo</span>
        </button>
      </nav>
    </section>
  );
}
