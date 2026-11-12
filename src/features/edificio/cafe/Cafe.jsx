// El café-librería del bajo (encargo de Francisco del 11-11-2026, plan en docs/qa/cafe-libreria.md). Bloque 1 (1.119): la
// tienda del bajo deja de vender (los muebles, en el almacén del hotel; sobres y reciclaje fuera de la vista, sin borrar
// nada) y el antiguo videoclub queda vacío, en traspaso, en 3D (`cafe3d.js`, se carga al entrar). Pilar, la dependienta,
// se queda de camarera. Sin WebGL, el dibujo isométrico del local vacío.
// Bloque 2 (1.120): Pilar te da las llaves y eliges el nombre del café (lista cerrada); llegan los muebles del rincón y tus
// libros leídos llenan las estanterías. «Decorar»: la vista desde arriba con la rejilla; tocas un mueble para elegirlo, lo
// arrastras o tocas una casilla para llevarlo, lo giras o lo guardas, y añades muebles del café o de tu casa (una copia
// no está en dos sitios). Lo guarda el servidor (`cafeService.js`). Sin la migración del café, el bajo sigue en traspaso.
// Libros en cajas (§121.3): lo leído llega a la distribuidora; las cajas se compran con granos, llegan al café (una caja de
// reparto en el suelo, junto al mostrador) y sus lomos se colocan en la balda (`LibrosCafe.jsx`). Las estanterías enseñan
// lo que hay en la balda y solo eso se recomienda. Al abrir el café, una caja de bienvenida de 8, gratis.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLibrary } from '../../../state/useLibrary';
import { catalogItem } from '../catalog';
import { renderShopRoom } from '../shopRoom';
import { CAFE_MUEBLES, CAFE_NOMBRES, cabe, deCasa, hueco, libresDeCasa, libresDelCafe, progresoNivel, uidNuevo } from './cafeCatalogo';
import { GRANO, LIBROS, PILAR, PIZARRA, TAZA, iconoDe } from './cafeIconos';
import { PixelArt } from './PixelArt';
import { SITIOS } from './cafeLayout';
import { bienvenidaLibros, cargarCafe, cargarDia, comprarCafe, errorCafe, guardarCafe, inaugurarCafe, llegaHabitual, servirCliente } from './cafeService';
import { cartaDe, hayLogro, umbralHito } from './cafeNiveles';
import { LogroCafe } from './LogroCafe';
import { BIENVENIDA, EXCENTRICOS, HABITUALES, RESENAS, clientesDelDia, enBalda, enCajas, librosDeLaBalda, pedidosDelDia, sesionesDeHoy, titulosDelCafe } from './cafeClientes';
import { Atender } from './Atender';
import { LibrosCafe } from './LibrosCafe';
import { dayKey } from '../../../domain/dates';
import './cafe.css';

/** Lo que cuenta Pilar en el traspaso, por orden (frases cerradas). */
const PILAR_DICE = [
  '¡Hola! Soy Pilar. Treinta años detrás de este mostrador… y ya me toca descansar los pies.',
  'Los muebles ahora los vende el almacén del Gran Hotel, y los sobres siguen cerrados por la reforma. Lo tuyo no se toca: tus tickets y tus muebles siguen contigo.',
  'El bajo se traspasa… y me han dicho que tú lees mucho. ¿Te imaginas un café con libros? Yo me quedaría detrás de la barra.',
];
const PILAR_FIN_SIN = 'Estoy terminando de vaciarlo. En cuanto esté, te doy las llaves.';
const PILAR_FIN_CON = 'Ya está vacío. Si lo quieres, aquí tienes las llaves: solo falta ponerle nombre.';
const SALUDO = '¡Pasa, pasa! Cuidado con las cajas.';
const AVISOS = {
  cortina: 'Detrás de la cortina sigue el local. Se irá abriendo cuando el café crezca.',
  escaparate: 'Llueve sobre el muelle. Algún día, ese escaparate será tuyo.',
};
const AVISOS_ABIERTO = {
  cortina: 'Detrás de la cortina sigue el local. Se irá abriendo cuando el café crezca.',
  escaparate: 'Desde la calle ya se ve la luz de tu café.',
};

/** Tus libros para las estanterías: los leídos; con menos de 3, el café presta los de «Leyendo» y «Quiero leer». */
function librosDelCafe(books = []) {
  const leidos = books.filter((b) => b.status === 'read');
  const lista = leidos.length >= 3 ? leidos : [...leidos, ...books.filter((b) => b.status === 'reading'), ...books.filter((b) => b.status === 'want')];
  return lista.filter((b) => b.title).slice(0, 200);
}

const PLANO_VACIO = { v: 1, items: [] };
const nombreDe = (id) => CAFE_MUEBLES.find((m) => m.id === id)?.nombre ?? catalogItem(id)?.nombre ?? id;

export function Cafe({ inventario = null, layoutPiso = null, soundOn = false }) {
  const { state } = useLibrary();
  const host = useRef(null);
  const api = useRef(null);
  const tagEls = useRef({});
  const pick = useRef(() => {});
  const decor = useRef(() => {});
  const [ready, setReady] = useState(false);
  const [sin3d, setSin3d] = useState(false);
  // undefined: cargando; null: el servidor aún no tiene el café; objeto: tu café
  const [local, setLocal] = useState(undefined);
  // null: Pilar solo saluda; un número: la frase que está diciendo
  const [hablando, setHablando] = useState(null);
  const [aviso, setAviso] = useState('');
  const [eligiendo, setEligiendo] = useState(false);
  const [nombre, setNombre] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  // Decorar: el plano que se está tocando (borrador), la pieza elegida y la pestaña de la balda
  const [borrador, setBorrador] = useState(null);
  const [sel, setSel] = useState(null);
  const [pestana, setPestana] = useState('cafe');
  // Bloque 4a: lo conseguido en el último servicio (subida, hitos, tickets del día), que se enseña al acabar con el cliente
  const [logro, setLogro] = useState(null);
  // Lo que ve la escena: el nivel de antes mientras quede por enseñar el cartel de la subida (al cerrarlo, se abre lo nuevo
  // con un recorrido de cámara)
  const nivelEscena = logro && logro.a > logro.de ? logro.de : (local?.nivel ?? 1);
  // Bloque 3: el día (undefined: cargando; null: sin la migración de clientes), a quién se atiende y la pizarra
  const [hoy] = useState(() => dayKey());
  const [dia, setDia] = useState(undefined);
  const [atendiendo, setAtendiendo] = useState(null);
  const [pizarra, setPizarra] = useState(false);
  const [ganado, setGanado] = useState(0);
  const dados = useRef({});
  // Libros en cajas: undefined, cargando; null, sin la migración; si no, { huecos, bienvenida, libros: [{ clave, titulo, genero, caja, balda }] }
  const [librosCafe, setLibrosCafe] = useState(undefined);
  // El cuadro de tus libros: null (cerrado) o { hoja, recien } (las claves que acaban de llegar, para que salten)
  const [panelLibros, setPanelLibros] = useState(null);
  const pidiendoBienvenida = useRef(false);
  // Al llegar la caja de bienvenida, la vista se vuelve hacia ella (en cuanto la escena esté lista)
  const mirarCaja = useRef(false);
  // Mientras atiendes, los toques en la escena (la barra, el cliente al que llevas la taza) los recoge Atender
  const atenderToque = useRef(null);
  const registrarToque = useRef((fn) => {
    atenderToque.current = fn;
  }).current;
  const pidiendoHabitual = useRef(false);
  const vacio = sin3d ? renderShopRoom({ vacio: true }) : null;
  const libros = useMemo(() => librosDelCafe(state?.books), [state?.books]);
  const titulosDistri = useMemo(() => titulosDelCafe(libros), [libros]);
  // Las estanterías enseñan lo que hay en la balda, un lomo por ejemplar (sin la migración de los libros, tus leídos, como en la 1.120)
  const titulos = useMemo(() => (librosCafe === null ? libros.map((b) => b.title) : (librosCafe?.libros ?? []).flatMap((b) => Array(b.balda).fill(b.titulo))), [librosCafe, libros]);
  const deLaBalda = useMemo(() => librosDeLaBalda(librosCafe, libros), [librosCafe, libros]);
  const porColocar = enCajas(librosCafe);
  const sesiones = sesionesDeHoy(state?.progress, hoy);
  const { pedidos, ctx } = useMemo(() => pedidosDelDia(dia, libros, hoy), [dia, libros, hoy]);
  const clientesHoy = useMemo(() => clientesDelDia(dia, pedidos), [dia, pedidos]);
  const pendientes = clientesHoy.filter((c) => !c.servido);
  const clienteAtendido = clientesHoy.find((c) => c.n === atendiendo) ?? null;
  const abierto = Boolean(local?.inaugurado);
  const decorando = borrador != null;
  // La carta abierta (bloque 4a): el chocolate y la nata, según la reputación
  const reputacion = local?.reputacion ?? 0;
  const carta = useMemo(() => cartaDe(reputacion), [reputacion]);
  const frases = [...PILAR_DICE, local ? PILAR_FIN_CON : PILAR_FIN_SIN];

  useEffect(() => {
    let alive = true;
    cargarCafe().then(
      (c) => alive && setLocal(c),
      () => alive && setLocal(null),
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    let mounted = null;
    import('./cafe3d')
      .then(({ mountCafe }) => {
        if (!alive || !host.current) return;
        try {
          mounted = mountCafe(host.current, {
            onPick: (id) => pick.current(id),
            onDecor: (e) => decor.current(e),
            onLost: () => alive && setSin3d(true),
            onFrame: (tags) => {
              const w = host.current?.clientWidth ?? 0;
              // Los bocadillos de clientes que caen uno encima de otro (uno sentado detrás de otro) se apilan hacia arriba
              const puestos = [];
              for (const [id, t] of Object.entries(tags)) {
                const el = tagEls.current[id];
                if (!el) continue;
                const half = t.visible ? el.offsetWidth / 2 : 0;
                const x = w ? Math.min(Math.max(t.x, half + 6), w - half - 6) : t.x;
                let y = t.y;
                if (t.visible && id.startsWith('cliente:')) {
                  const alto = el.offsetHeight + 4;
                  for (let choca = true; choca;) {
                    choca = puestos.some((q) => Math.abs(q.x - x) < q.half + half + 2 && Math.abs(q.y - y) < alto);
                    if (choca) y -= alto;
                  }
                  puestos.push({ x, y, half });
                }
                el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
                el.dataset.off = t.visible ? '' : 'true';
              }
            },
          });
        } catch {
          setSin3d(true);
          return;
        }
        api.current = mounted;
        if (import.meta.env.DEV) window.__cafe3d = mounted;
        setReady(true);
      })
      .catch(() => alive && setSin3d(true));
    return () => {
      alive = false;
      mounted?.destroy();
      api.current = null;
      if (import.meta.env.DEV && window.__cafe3d === mounted) window.__cafe3d = null;
    };
  }, []);

  // El día del café: los clientes los fija el servidor (sin la migración del bloque 3, no hay clientes)
  useEffect(() => {
    if (!abierto) return undefined;
    let alive = true;
    cargarDia(hoy).then(
      (r) => {
        if (!alive) return;
        setDia(r?.dia ?? null);
        setLibrosCafe(r?.libros ?? null);
        if (r?.cafe) setLocal(r.cafe);
      },
      () => {
        if (!alive) return;
        setDia(null);
        setLibrosCafe(null);
      },
    );
    return () => {
      alive = false;
    };
  }, [abierto, hoy]);
  // Has leído hoy: llegan los habituales que traen tus sesiones (el servidor pone el tope)
  useEffect(() => {
    if (!dia || pidiendoHabitual.current || dia.habituales.length >= sesiones) return;
    pidiendoHabitual.current = true;
    llegaHabitual(hoy)
      .then((r) => {
        if (r?.dia) setDia(r.dia);
        if (r?.cafe) setLocal(r.cafe);
      })
      .catch(() => {})
      .finally(() => {
        pidiendoHabitual.current = false;
      });
  }, [dia, sesiones, hoy]);

  // La caja de bienvenida: la primera vez que entras con el café abierto y algún título que ofrecer (una sola vez; el servidor
  // lo comprueba)
  useEffect(() => {
    if (!librosCafe || librosCafe.bienvenida || !titulosDistri.length || pidiendoBienvenida.current) return;
    pidiendoBienvenida.current = true;
    bienvenidaLibros(titulosDistri)
      .then((r) => {
        if (r.libros) setLibrosCafe(r.libros);
        if (r.cafe) setLocal(r.cafe);
        setHablando(null);
        if (r.caja.length) mirarCaja.current = true;
        setAviso(
          `¡Ha llegado una caja de la distribuidora! ${r.caja.length || BIENVENIDA} libros de los que has leído, de regalo. Tócala y colócalos en la balda: solo se recomienda lo que está a la vista.`,
        );
      })
      .catch(() => {})
      .finally(() => {
        pidiendoBienvenida.current = false;
      });
  }, [librosCafe, titulosDistri]);

  // La escena sigue al estado: el local, el plano (o el borrador de Decorar) y tus libros
  const plano = useMemo(() => borrador ?? local?.plano ?? PLANO_VACIO, [borrador, local?.plano]);
  const selItem = borrador?.items.find((i) => i.uid === sel) ?? null;
  useEffect(() => {
    if (!ready) return;
    api.current?.setLocal({ inaugurado: abierto, nombre: local?.nombre ?? null, plano, libros: titulos, cajas: porColocar, vacias: librosCafe != null, nivel: nivelEscena });
    api.current?.decorar(decorando, { sel, mal: false });
    if (mirarCaja.current && porColocar > 0 && !decorando) {
      mirarCaja.current = false;
      api.current?.go('libros');
    }
  }, [ready, abierto, local?.nombre, plano, titulos, porColocar, librosCafe, decorando, sel, nivelEscena]);
  // Los clientes, sentados: los atendidos, con el libro que les diste (o uno de tu estantería si fue en otra visita)
  useEffect(() => {
    if (!ready) return;
    api.current?.setClientes(
      clientesHoy.map((c) => ({
        n: c.n,
        aspecto: c.aspecto,
        raro: c.raro ? { tocado: c.raro.tocado, tema: c.raro.tema } : null,
        servido: c.servido,
        libro: c.servido ? (dados.current[c.n] ?? titulos[c.semilla % Math.max(1, titulos.length)] ?? null) : null,
      })),
    );
  }, [ready, clientesHoy, titulos, plano]);
  useEffect(() => {
    if (!ganado) return undefined;
    const t = setTimeout(() => setGanado(0), 2400);
    return () => clearTimeout(t);
  }, [ganado]);

  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(''), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  const hablar = () => {
    setAviso('');
    setHablando(0);
    api.current?.go('pilar');
  };
  useEffect(() => {
    pick.current = (id) => {
      if (decorando) return;
      if (atenderToque.current?.(id)) return;
      if (id.startsWith('cliente:')) {
        const c = clientesHoy.find((x) => x.n === Number(id.slice(8)));
        if (!c) return;
        if (!c.servido) return atender(c.n);
        setAtendiendo(null);
        setHablando(null);
        setAviso(c.habitual || c.raro ? `${c.nombre} está leyendo tan a gusto. Mejor no molestar.` : 'Está leyendo tan a gusto. Mejor no molestar.');
        return;
      }
      setAtendiendo(null);
      if (id === 'pilar') return hablar();
      if (id === 'libros') return abrirLibros('caja');
      setHablando(null);
      setAviso((abierto ? AVISOS_ABIERTO : AVISOS)[id] ?? '');
      api.current?.go(id);
    };
    // Decorar: elegir una pieza, llevarla a una casilla o arrastrarla
    decor.current = (e) => {
      if (!borrador) return;
      if (e.tipo === 'elegir') return setSel(e.uid);
      const uid = e.tipo === 'arrastre' ? e.uid : sel;
      const it = borrador.items.find((i) => i.uid === uid);
      if (!it) return;
      const movido = { ...it, x: e.x, y: e.y };
      if (cabe(borrador, movido, movido.uid, local?.nivel ?? 1)) setBorrador({ ...borrador, items: borrador.items.map((i) => (i.uid === uid ? movido : i)) });
    };
  });

  const inaugurar = async () => {
    if (!nombre || ocupado) return;
    setOcupado(true);
    setError('');
    try {
      const c = await inaugurarCafe(nombre);
      setLocal(c);
      setEligiendo(false);
      setHablando(null);
      setAviso(`¡Enhorabuena! «${c.nombre}» ya es tuyo. Te he dejado unas mesas y tus libros en las estanterías. Toca «Decorar» para colocarlo a tu gusto.`);
    } catch (e) {
      setError(errorCafe(e));
    } finally {
      setOcupado(false);
    }
  };

  // Atender a un cliente: el cuadro de abajo pasa a ser su conversación (Atender.jsx)
  function atender(n) {
    setAviso('');
    setHablando(null);
    setError('');
    setPizarra(false);
    setAtendiendo(n);
  }
  function abrirLibros(hoja, recien = []) {
    setAtendiendo(null);
    setPizarra(false);
    setAviso('');
    setHablando(null);
    setPanelLibros({ hoja, recien });
    if (hoja === 'caja' && porColocar > 0) api.current?.go('libros');
  }
  const servir = async ({ receta, encaja, libro }) => {
    const c = clienteAtendido;
    const r = await servirCliente(hoy, c.n, receta, encaja, libro?.clave ?? null);
    dados.current[c.n] = libro?.title ?? null;
    if (r.libros) setLibrosCafe(r.libros);
    if (r.cafe) setLocal(r.cafe);
    if (r.dia) setDia(r.dia);
    setGanado((r.dado?.granos ?? 0) + (r.progreso?.granos ?? 0));
    if (hayLogro(r.progreso)) setLogro(r.progreso);
    return r.dado;
  };

  const empezarDecorar = () => {
    setAtendiendo(null);
    setPanelLibros(null);
    setPizarra(false);
    setAviso('');
    setHablando(null);
    setError('');
    setSel(null);
    setBorrador({ v: 1, items: local.plano.items.map((i) => ({ ...i })) });
  };
  const cancelarDecorar = () => {
    setBorrador(null);
    setSel(null);
    setError('');
  };
  const guardar = async () => {
    if (ocupado) return;
    setOcupado(true);
    setError('');
    try {
      const c = await guardarCafe(borrador);
      setLocal(c);
      setBorrador(null);
      setSel(null);
      setAviso('Guardado. Así lo verán quienes entren.');
    } catch (e) {
      setError(errorCafe(e));
    } finally {
      setOcupado(false);
    }
  };
  const girar = () => {
    if (!selItem) return;
    for (const k of [1, 2, 3]) {
      const g = { ...selItem, rot: (selItem.rot + k) % 4 };
      if (cabe(borrador, g, g.uid, local?.nivel ?? 1)) {
        setBorrador({ ...borrador, items: borrador.items.map((i) => (i.uid === sel ? g : i)) });
        return;
      }
    }
    setError('No hay sitio para girarlo ahí.');
  };
  const quitar = () => {
    if (!selItem) return;
    setBorrador({ ...borrador, items: borrador.items.filter((i) => i.uid !== sel) });
    setSel(null);
  };
  const anadir = (id) => {
    setError('');
    const sitio = hueco(borrador, id, undefined, local?.nivel ?? 1);
    if (!sitio) return setError('No queda sitio libre para ese mueble. Quita o mueve algo antes.');
    const uid = uidNuevo(borrador);
    setBorrador({ ...borrador, items: [...borrador.items, { uid, id, ...sitio }] });
    setSel(uid);
  };

  // La balda de Decorar: lo del café (con copias libres) y lo de tu casa que puede venir
  const delCafe = decorando ? CAFE_MUEBLES.map((m) => ({ id: m.id, nombre: m.nombre, libres: libresDelCafe(local.inventario, borrador, m.id) })).filter((m) => (local.inventario[m.id] ?? 0) > 0) : [];
  const deTuCasa = decorando
    ? Object.keys(inventario?.copias ?? {})
        .filter(deCasa)
        .map((id) => ({ id, nombre: nombreDe(id), libres: libresDeCasa(inventario, layoutPiso, borrador, id) }))
    : [];
  const lista = pestana === 'cafe' ? delCafe : deTuCasa;
  // La tienda (bloque 4a): los muebles del café con su precio; los de otro nivel o de un hito aún no alcanzado, con cómo se abren
  const rep = local?.reputacion ?? 0;
  const tienda = decorando
    ? CAFE_MUEBLES.map((m) => {
        const porNivel = m.nivel > (local?.nivel ?? 1);
        const porHito = !porNivel && m.hito && rep < umbralHito(m.nivel, m.hito);
        const cerrado = porNivel ? `Se abre en el nivel ${m.nivel}` : porHito ? `Hito ${m.hito} del nivel ${m.nivel}: faltan ${umbralHito(m.nivel, m.hito) - rep} de reputación` : null;
        return { ...m, cerrado, tienes: local?.inventario?.[m.id] ?? 0 };
      })
    : [];
  /** Cerrar el cartel de lo conseguido; si fue una subida, se abre lo nuevo del local y la cámara lo enseña. */
  const cerrarLogro = () => {
    const sube = logro && logro.a > logro.de ? logro.a : 0;
    setLogro(null);
    if (sube) requestAnimationFrame(() => api.current?.recorrido?.(sube));
  };
  const comprar = async (m) => {
    setError('');
    setOcupado(true);
    try {
      setLocal(await comprarCafe(m.id));
      setAviso(`¡${m.nombre}, tuyo! Ya lo tienes en «Del café» para colocarlo.`);
    } catch (e) {
      setError(errorCafe(e));
    } finally {
      setOcupado(false);
    }
  };

  const prog = progresoNivel(local?.nivel ?? 1, local?.reputacion ?? 0);
  const titulo = abierto ? `${local.nombre}, tu café-librería.` : 'El café-librería del bajo: el local, vacío y en traspaso.';
  const ultima = hablando === frases.length - 1;
  // El cuadro de diálogo: quién habla (Pilar con su retrato o un aviso con la taza), qué dice y si hay más
  const quienHabla = eligiendo || !aviso;
  const texto = eligiendo
    ? '«¿Cómo se va a llamar? Lo verán todos los que pasen por el muelle.»'
    : aviso
      ? aviso
      : abierto && hablando == null && dia && pendientes.length
        ? `«${pendientes.length === 1 ? 'Tienes un cliente esperando' : `Tienes ${pendientes.length} clientes esperando`}${pendientes.some((c) => c.raro) ? (pendientes.length === 1 ? ', y es muy peculiar' : ', y uno es muy peculiar') : ''}. ${pendientes.length === 1 ? 'Tócalo' : 'Toca uno'} en el local, o «Atender», para ver qué pide.»`
        : abierto && hablando == null && dia && clientesHoy.length
          ? sesiones < 2
            ? '«Hoy ya está todo el mundo atendido. Si lees un rato, vendrá algún habitual.»'
            : '«Hoy ya está todo el mundo atendido. El local es tuyo para decorar.»'
          : abierto && hablando == null
            ? `«¡Qué bien huele hoy «${local.nombre}»! Si quieres cambiar algo de sitio, toca Decorar.»`
            : abierto
              ? '«Pronto vendrán clientes a pedirte libros. Yo pongo los cafés; tú recomiendas.»'
              : `«${hablando == null ? SALUDO : frases[hablando]}»`;
  const sigue = !eligiendo && !abierto && !aviso && hablando != null && !ultima;

  return (
    <div className="cf3" data-ready={(ready || sin3d) && local !== undefined ? 'true' : undefined} data-abierto={abierto ? 'true' : undefined} data-decorar={decorando ? 'true' : undefined}>
      <h2 className="px-sr" id="ed-title">
        {titulo}
      </h2>
      {sin3d ? (
        <div className="cf3-iso">
          <img src={vacio.scene} alt="El bajo, vacío y en traspaso: cajas de mudanza, sábanas y el mostrador con Pilar." />
        </div>
      ) : (
        <div className="cf3-stage" ref={host}>
          {!ready && <p className="cf3-loading">Abriendo el bajo…</p>}
        </div>
      )}
      {!sin3d && (
        <div className="cf3-tags" hidden={decorando}>
          {Object.entries(SITIOS).map(([id, s]) => (
            <button key={id} type="button" className={`cf3-tag${id === 'libros' ? ' cf3-tag--libros' : ''}`} data-off="true" ref={(el) => (tagEls.current[id] = el)} onClick={() => pick.current(id)}>
              {id === 'libros' ? `${s.nombre} · ${porColocar}` : s.nombre}
            </button>
          ))}
          {pendientes.map((c) => (
            <button
              key={c.n}
              type="button"
              className={`cf3-tag cf3-tag--cliente${c.raro ? ' cf3-tag--raro' : ''}`}
              data-off="true"
              style={c.raro ? { '--cf3-tema': `rgb(${c.raro.tema.join(' ')})` } : undefined}
              aria-label={`Atender a ${c.habitual || c.raro ? c.nombre : 'un cliente'}`}
              ref={(el) => (tagEls.current[`cliente:${c.n}`] = el)}
              onClick={() => pick.current(`cliente:${c.n}`)}
            >
              {c.habitual ? c.nombre : null}
            </button>
          ))}
        </div>
      )}
      {abierto && (
        <div className="cf3-hud" data-decorar={decorando ? 'true' : undefined}>
          <p className="cf3-placa" aria-label={`Tu café: ${local.nombre}, nivel ${local.nivel}, ${prog.nombre}. Reputación ${prog.lleva}${prog.meta ? ` de ${prog.meta}` : ''}.`}>
            <span className="cf3-placa__insignia" aria-hidden="true">
              <span className="cf3-placa__nv">NV</span>
              {local.nivel}
            </span>
            <span className="cf3-placa__texto" aria-hidden="true">
              <span className="cf3-placa__nombre">{local.nombre}</span>
              <span className="cf3-placa__nivel">{prog.nombre}</span>
              <span className="cf3-xp">
                <span className="cf3-xp__lleno" style={{ width: `${Math.round(prog.hecho * 100)}%` }} />
                {[1, 2, 3].map((k) => (
                  <span key={k} className="cf3-xp__hito" style={{ left: `${k * 25}%` }} data-hecho={(local.reputacion ?? 0) >= umbralHito(local.nivel, k) ? 'true' : undefined} />
                ))}
              </span>
              <span className="cf3-xp__cifra">{prog.meta ? `${prog.lleva} / ${prog.meta}` : `${prog.lleva}`}</span>
            </span>
          </p>
          <div className="cf3-hud__der">
            <p className="cf3-monedero" aria-label={`Granos: ${local.granos}`}>
              <PixelArt icono={GRANO} />
              <span aria-hidden="true">{local.granos}</span>
              {ganado > 0 && (
                <span className="cf3-monedero__mas" aria-hidden="true">
                  +{ganado}
                </span>
              )}
            </p>
            {librosCafe && !decorando && (
              <button
                type="button"
                className="cf3-pizarra-btn cf3-libros-btn"
                aria-label={`Tus libros: ${enBalda(librosCafe)} en la balda${porColocar ? `, ${porColocar} por colocar` : ''}`}
                aria-expanded={Boolean(panelLibros)}
                onClick={() => (panelLibros ? setPanelLibros(null) : abrirLibros(porColocar ? 'caja' : 'distribuidora'))}
              >
                <PixelArt icono={LIBROS} />
                {porColocar > 0 && <span className="cf3-pizarra-btn__n">{porColocar}</span>}
              </button>
            )}
            {dia && !decorando && (
              <button
                type="button"
                className="cf3-pizarra-btn"
                aria-label={`La pizarra: ${dia.pizarra.length} reseña${dia.pizarra.length === 1 ? '' : 's'}`}
                aria-expanded={pizarra}
                onClick={() => {
                  setPanelLibros(null);
                  setPizarra((v) => !v);
                }}
              >
                <PixelArt icono={PIZARRA} />
                {dia.pizarra.length > 0 && <span className="cf3-pizarra-btn__n">{dia.pizarra.length}</span>}
              </button>
            )}
          </div>
        </div>
      )}

      {pizarra && dia && !decorando && (
        <section className="cf3-pizarra" aria-label="La pizarra">
          <h3 className="cf3-pizarra__titulo">La pizarra</h3>
          {dia.pizarra.length ? (
            <ul className="cf3-pizarra__lista">
              {dia.pizarra.map((r) => (
                <li key={`${r.dia}-${r.dorada ? 'e' : 'h'}-${r.quien}`} data-dorada={r.dorada ? 'true' : undefined}>
                  <span className="cf3-pizarra__frase">«{r.dorada ? EXCENTRICOS[r.quien]?.dorada : RESENAS[r.frase]}»</span>
                  <span className="cf3-pizarra__firma">{r.dorada ? `★ ${EXCENTRICOS[r.quien]?.nombre}` : HABITUALES[r.quien]?.nombre}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cf3-pizarra__vacia">Aún no hay reseñas. Los habituales llegan cuando lees y te dejan una nota al irse; el cliente peculiar del día, si lo bordas, una dorada.</p>
          )}
          <button type="button" className="cf3-btn cf3-btn--suave" onClick={() => setPizarra(false)}>
            Cerrar
          </button>
        </section>
      )}
      {logro && !clienteAtendido && !decorando && <LogroCafe logro={logro} soundOn={soundOn} onCerrar={cerrarLogro} />}
      {decorando ? (
        <div className="cf3-balda" role="region" aria-label="Decorar tu café">
          <div className="cf3-balda__cabeza">
            <p className="cf3-balda__elegido">
              {selItem && (
                <span className="cf3-balda__icono">
                  <PixelArt icono={iconoDe(selItem.id)} />
                </span>
              )}
              {/* Mientras se decora, el aviso (p. ej., lo que acabas de comprar en la tienda) va aquí: el cuadro de Pilar no se ve */}
              <span className="cf3-balda__titulo" role={aviso && !selItem ? 'status' : undefined}>
                {selItem ? nombreDe(selItem.id) : aviso || 'Toca un mueble para moverlo'}
              </span>
            </p>
            {selItem ? (
              <div className="cf3-balda__herr">
                <button type="button" className="cf3-btn cf3-btn--suave" onClick={girar}>
                  Girar
                </button>
                <button type="button" className="cf3-btn cf3-btn--suave" onClick={quitar}>
                  Guardar en la balda
                </button>
                <button type="button" className="cf3-btn" onClick={() => setSel(null)}>
                  Soltar
                </button>
              </div>
            ) : (
              <div className="cf3-balda__herr">
                <button type="button" className="cf3-btn cf3-btn--suave" onClick={cancelarDecorar} disabled={ocupado}>
                  Cancelar
                </button>
                <button type="button" className="cf3-btn cf3-btn--verde" onClick={guardar} disabled={ocupado}>
                  {ocupado ? 'Guardando...' : 'Listo'}
                </button>
              </div>
            )}
          </div>
          {selItem ? (
            <p className="cf3-balda__ayuda">Arrástralo o toca una casilla libre para llevarlo allí.</p>
          ) : (
            <>
              <div className="cf3-balda__pestanas" role="tablist" aria-label="De dónde sacar muebles">
                <button type="button" role="tab" aria-selected={pestana === 'cafe'} className="cf3-pestana" onClick={() => setPestana('cafe')}>
                  Del café
                </button>
                <button type="button" role="tab" aria-selected={pestana === 'casa'} className="cf3-pestana" onClick={() => setPestana('casa')}>
                  De tu casa
                </button>
                <button type="button" role="tab" aria-selected={pestana === 'tienda'} className="cf3-pestana" onClick={() => setPestana('tienda')}>
                  Tienda
                </button>
              </div>
              {pestana === 'tienda' ? (
                <ul className="cf3-balda__fila cf3-tienda">
                  {tienda.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        className="cf3-mueble cf3-mueble--tienda"
                        data-cerrado={m.cerrado ? 'true' : undefined}
                        disabled={ocupado || Boolean(m.cerrado) || local.granos < m.precio}
                        onClick={() => comprar(m)}
                        aria-label={m.cerrado ? `${m.nombre}: ${m.cerrado}` : `Comprar ${m.nombre} por ${m.precio} granos${m.tienes ? ` (tienes ${m.tienes})` : ''}`}
                      >
                        <span className="cf3-mueble__icono">
                          <PixelArt icono={iconoDe(m.id)} />
                        </span>
                        {m.tienes > 0 && <span className="cf3-mueble__n">{m.tienes}</span>}
                        <span className="cf3-mueble__nombre">{m.nombre}</span>
                        {m.cerrado ? (
                          <span className="cf3-mueble__cerrado">{m.cerrado}</span>
                        ) : (
                          <span className="cf3-mueble__precio" data-falta={local.granos < m.precio ? 'true' : undefined}>
                            <PixelArt icono={GRANO} />
                            {m.precio}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="cf3-balda__fila">
                  {lista.length ? (
                    lista.map((m) => {
                      const libres = m.libres > 0 ? `${m.libres} libre${m.libres === 1 ? '' : 's'}` : 'Todo puesto';
                      return (
                        <li key={m.id}>
                          <button
                            type="button"
                            className="cf3-mueble"
                            disabled={m.libres <= 0}
                            onClick={() => anadir(m.id)}
                            aria-label={`Poner ${m.nombre} (${m.libres > 0 ? libres : 'ninguno libre'})`}
                          >
                            <span className="cf3-mueble__icono">
                              <PixelArt icono={iconoDe(m.id)} />
                            </span>
                            <span className="cf3-mueble__n" data-cero={m.libres > 0 ? undefined : 'true'}>
                              {Math.max(0, m.libres)}
                            </span>
                            <span className="cf3-mueble__nombre">{m.nombre}</span>
                            <span className="px-sr">{libres}</span>
                          </button>
                        </li>
                      );
                    })
                  ) : (
                    <li className="cf3-balda__vacio">{pestana === 'cafe' ? 'Aún no hay más muebles del café.' : 'De tu casa pueden venir mesas y lámparas que tengas libres.'}</li>
                  )}
                </ul>
              )}
            </>
          )}
          {error && (
            <p className="cf3-error" role="alert">
              {error}
            </p>
          )}
        </div>
      ) : panelLibros && librosCafe ? (
        <LibrosCafe
          estado={librosCafe}
          titulos={titulosDistri}
          granos={local?.granos ?? 0}
          hoja={panelLibros.hoja}
          recien={panelLibros.recien}
          soundOn={soundOn}
          onCambio={(r) => {
            if (r.libros) setLibrosCafe(r.libros);
            if (r.cafe) setLocal(r.cafe);
          }}
          onCerrar={() => setPanelLibros(null)}
        />
      ) : clienteAtendido ? (
        <Atender
          key={clienteAtendido.n}
          cliente={clienteAtendido}
          ctx={ctx}
          libros={deLaBalda}
          escena={ready && !sin3d ? api.current : null}
          registrarToque={registrarToque}
          soundOn={soundOn}
          ayudas={state.settings.ayudasCafe ?? 'auto'}
          nivel={local?.nivel ?? 1}
          carta={carta}
          onServir={servir}
          onCerrar={() => setAtendiendo(null)}
        />
      ) : (
        <div className={`cf3-franja${eligiendo ? ' cf3-franja--nombres' : ''}`} role="region" aria-label={eligiendo ? 'El nombre de tu café' : 'Pilar, en el mostrador'}>
          {quienHabla && (
            <span className="cf3-quien" aria-hidden="true">
              Pilar
            </span>
          )}
          <div className="cf3-caja">
            <span className="cf3-retrato" data-aviso={quienHabla ? undefined : 'true'}>
              <PixelArt icono={quienHabla ? PILAR : TAZA} />
            </span>
            <p className="cf3-dice" aria-live="polite">
              {quienHabla && <span className="px-sr">Pilar: </span>}
              {texto}
              {sigue && <span className="cf3-sigue" aria-hidden="true" />}
            </p>
            {eligiendo ? (
              <>
                <div className="cf3-nombres" role="radiogroup" aria-label="Nombres del café">
                  {CAFE_NOMBRES.map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={nombre === n} className="cf3-nombre" onClick={() => setNombre(n)}>
                      {n}
                    </button>
                  ))}
                </div>
                {error && (
                  <p className="cf3-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="cf3-botones cf3-botones--fila">
                  <button type="button" className="cf3-btn cf3-btn--suave" onClick={() => setEligiendo(false)} disabled={ocupado}>
                    Ahora no
                  </button>
                  <button type="button" className="cf3-btn cf3-btn--verde" onClick={inaugurar} disabled={!nombre || ocupado}>
                    {ocupado ? 'Abriendo...' : 'Inaugurar el café'}
                  </button>
                </div>
              </>
            ) : (
              <div className="cf3-botones">
                {abierto ? (
                  hablando != null && !aviso ? (
                    <button type="button" className="cf3-btn" onClick={() => setHablando(null)}>
                      Hasta luego
                    </button>
                  ) : (
                    <>
                      {pendientes.length ? (
                        !sin3d && (
                          <button type="button" className="cf3-btn cf3-btn--suave" onClick={empezarDecorar}>
                            Decorar
                          </button>
                        )
                      ) : (
                        <button type="button" className="cf3-btn cf3-btn--suave" onClick={hablar}>
                          Hablar con Pilar
                        </button>
                      )}
                      {pendientes.length ? (
                        <button type="button" className="cf3-btn cf3-btn--verde" onClick={() => atender(pendientes[0].n)}>
                          Atender
                        </button>
                      ) : (
                        !sin3d && (
                          <button type="button" className="cf3-btn" onClick={empezarDecorar}>
                            Decorar
                          </button>
                        )
                      )}
                    </>
                  )
                ) : hablando == null || aviso ? (
                  <button type="button" className="cf3-btn" onClick={hablar}>
                    Hablar con Pilar
                  </button>
                ) : ultima && local ? (
                  <>
                    <button type="button" className="cf3-btn cf3-btn--suave" onClick={() => setHablando(null)}>
                      Ahora no
                    </button>
                    <button type="button" className="cf3-btn cf3-btn--verde" onClick={() => setEligiendo(true)}>
                      Quedarme con las llaves
                    </button>
                  </>
                ) : ultima ? (
                  <button type="button" className="cf3-btn" onClick={() => setHablando(null)}>
                    Hasta pronto
                  </button>
                ) : (
                  <button type="button" className="cf3-btn" onClick={() => setHablando((k) => k + 1)}>
                    Seguir
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
