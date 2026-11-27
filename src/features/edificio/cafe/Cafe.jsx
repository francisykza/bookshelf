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
// 1.130 (Francisco, 14-11-2026; `cafe-libreria.md` §15): los clientes piden de lo que hay en la balda (género, extensión y
// cómo se lo lleva; `pedidosLibro`), la estantería de la pared va por secciones (`Libreria.jsx`), Pilar prepara lo que
// dominas y, cada mañana, el reparto repone lo vendido (una caja junto al mostrador, con su aviso).
// 1.133 (§16.3): desde el nivel 3, la puerta de detrás de la barra lleva al taller de la trastienda (`Taller.jsx`), con su
// música; un encargo al día como mucho, que espera en el banco hasta que lo hagas.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLibrary } from '../../../state/useLibrary';
import { catalogItem } from '../catalog';
import { SinTresD } from '../SinTresD';
import { CAFE_MUEBLES, CAFE_NOMBRES, asientosDe, cabe, deCasa, hueco, libresDeCasa, libresDelCafe, maxCosas, progresoNivel, uidNuevo } from './cafeCatalogo';
import { COPA, CUADERNO, GRANO, HORNO, LIBROS, SUBIR, TAZA, iconoDe } from './cafeIconos';
import { PixelArt } from './PixelArt';
import { anfitrion } from './cafePersonaje';
import { MOMENTO_OLMO, poseOlmoAlHablar, poseOlmoEnReposo } from './olmoPoses';
import { useReposoOlmo } from './useReposoOlmo';
import { GuiaCafe } from './GuiaCafe';
import { conLoDeAqui, marcarAqui, marcarVistos, pasosDe } from './cafeGuia';
import { anclaVisible } from '../../libo/LiboRincon';
import { haVisto, liboDe, presentadoAqui } from '../../libo/libo';
import { fijarVistaPrevia } from '../../../domain/suscripcion';
import { SITIOS } from './cafeLayout';
import { bienvenidaLibros, cargarCafe, misTitulos, cargarDia, cargarJornada, cargarObrador, cargarTaller, cobrarMostrador, comprarCafe, empezarInfluencer, entregarInfluencer, errorCafe, guardarCafe, entregarCliente, inaugurarCafe, llegaHabitual, nuevaJornada, ponerEscaparate, recogerHucha, servirComida } from './cafeService';
import { enFrase } from './cafeInfluencers';
import { cartaDe, hayLogro, sacoListo, tuesteAbierto, umbralHito } from './cafeNiveles';
import { LogroCafe } from './LogroCafe';
import { BIENVENIDA, TOPE_CLIENTES, clientesDelDia, clientesDelNivel, enBalda, enCajas, librosDeLaBalda, sesionesDeHoy, titulosDelCafe, titulosDistribuidora } from './cafeClientes';
import { pedidosLibro } from './cafeLibreria';
import { usePortadasBalda } from './usePortadasBalda';
import { RankingCafes } from './RankingCafes';
import { CuadernoPilar } from './CuadernoPilar';
import { Atender } from './Atender';
import { LibrosCafe } from './LibrosCafe';
import { Tostadero } from './Tostadero';
import { Obrador } from './Obrador';
import { CajaMostrador } from './CajaMostrador';
import { FOGON_NIVEL, HITO_CAMPANILLA, HITOS_OBRADOR, OBRADOR_NIVEL, PILAR_OBRADOR, enElHornoTexto, enVitrina, estadoHorno, fraseMostrador, pedidoComida, yaEsta } from './cafeObrador';
import { Taller } from './Taller';
import { TALLER_NIVEL } from './cafeTaller';
import { crearTallerMusica } from './cafeTallerMusica';
import { portadaPorIsbn } from './cafePortadaIsbn';
import { SITIOS_NUEVOS, marcarVisto, nuevosDe, vistosDe } from './cafeNuevo';
import { dayKey } from '../../../domain/dates';
import { crearCafeMusica } from './cafeMusica';
import { crearSfxBarra } from './cafeSfx';
import { portadaPixel } from './cafePortadas';
import { sceneMusicOut, setMusicBlocked } from '../../../audio/audioController';
import './cafe.css';
import { PantallaCarga } from '../../../ui/PantallaCarga';
import { guardarCafeLibo } from '../../libo/sugerencias';
import { pulsarAtras, useAtras } from '../../../hooks/useAtras';

/** Lo que cuenta Pilar en el traspaso, por orden (frases cerradas). */
const PILAR_DICE = [
  '¡Hola! Soy Pilar. Treinta años detrás de este mostrador… y ya me toca descansar los pies.',
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
  trampilla: '«Cuidado con el escalón, que el tercero cruje.»',
  subir: '',
  tostador: '',
};
/** Bloque 6a: desde el nivel 6 se decoran dos plantas, el café y la bodega. */
/** 1.128: la «!» roja de lo nuevo (lo que acabas de desbloquear); se va al tocarlo o verlo. */
function Nuevo() {
  return (
    <span className="cf3-nuevo">
      <span className="px-sr">, nuevo</span>
    </span>
  );
}

const BODEGA_NIVEL = 6;
/** Bloque 4b: el escaparate se elige desde el nivel 5; tres de tus leídos, de cara a la calle. */
const ESCAPARATE_NIVEL = 5;
const ESCAPARATE_MAX = 3;

/** Tus libros para el café: solo los leídos (1.139: ya no se prestan «Leyendo» ni «Quiero leer»; el resto lo pone el catálogo). */
function librosDelCafe(books = []) {
  return books.filter((b) => b.status === 'read' && b.title).slice(0, 200);
}

const PLANO_VACIO = { v: 1, items: [] };
const nombreDe = (id) => CAFE_MUEBLES.find((m) => m.id === id)?.nombre ?? catalogItem(id)?.nombre ?? id;

export function Cafe({ inventario = null, layoutPiso = null, soundOn = false, onVisitar = null, userId = null }) {
  // 1.141: el ranking de los cafés (tu edificio y a quien sigues), en la franja de abajo
  const [panelRanking, setPanelRanking] = useState(false);
  // 1.142: el cuaderno de Pilar (las tareas que se le encargan)
  const [panelCuaderno, setPanelCuaderno] = useState(false);
  const { state, actions } = useLibrary();
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
  // 1.150: quién atiende (Pilar u Olmo, con la suscripción o en vista previa) y cuál de sus frases dice Olmo si le tocas
  const quien = anfitrion();
  const [fraseOlmo, setFraseOlmo] = useState(-1);
  // 1.156: Olmo vivo en la franja (sus poses, como Libo): lee o se duerme si no tocas nada y se marea si le tocas mucho
  const reposoOlmo = useReposoOlmo(quien.id === 'olmo');
  const [aviso, setAviso] = useState('');
  const [eligiendo, setEligiendo] = useState(false);
  // El escaparate (nivel 5): null, cerrado; si no, las claves elegidas
  const [escaparate, setEscaparate] = useState(null);
  const [nombre, setNombre] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  // Decorar: el plano que se está tocando (borrador), la pieza elegida y la pestaña de la balda
  const [borrador, setBorrador] = useState(null);
  const [sel, setSel] = useState(null);
  const [pestana, setPestana] = useState('cafe');
  // 1.128: lo ya visto de lo desbloqueado (para la «!» roja de lo nuevo; cafeNuevo.js) y lo nuevo de la tienda al abrirla
  const [vistos, setVistos] = useState(null);
  const [nuevosTienda, setNuevosTienda] = useState(null);
  // Bloque 6a: la planta que se decora ('calle' o 'bodega'); al empezar, la planta en la que estás
  const [plantaDecor, setPlantaDecor] = useState('calle');
  const [plantaEscena, setPlantaEscena] = useState('calle');
  // Bloque 4a: lo conseguido en el último servicio (subida, hitos, tickets del día), que se enseña al acabar con el cliente
  const [logro, setLogro] = useState(null);
  // Lo que ve la escena: el nivel de antes mientras quede por enseñar el cartel de la subida (al cerrarlo, se abre lo nuevo
  // con un recorrido de cámara)
  const nivelEscena = logro && logro.a > logro.de ? logro.de : (local?.nivel ?? 1);
  // Bloque 3: el día (undefined: cargando; null: sin la migración de clientes) y a quién se atiende (la pizarra, fuera en la 1.132)
  const [hoy] = useState(() => dayKey());
  // Jornadas de prueba (solo las cuentas de `cafe_probadores`, la de Francisco): undefined, comprobando; null, se juega el día
  // de hoy; si no, el día de prueba, y al atender a todos se puede abrir otra jornada
  const [jornada, setJornada] = useState(undefined);
  const diaJuego = jornada || hoy;
  const [dia, setDia] = useState(undefined);
  const [atendiendo, setAtendiendo] = useState(null);
  // Bloque 6b: delante del tostador, recogiendo el saco del día (Tostadero.jsx)
  const [tostando, setTostando] = useState(false);
  // 1.133: el taller del día (undefined: cargando o por debajo del nivel 3; null: sin la migración) y si estás dentro
  const [taller, setTaller] = useState(undefined);
  const [enTaller, setEnTaller] = useState(false);
  // 1.143: el obrador del día (undefined: cargando o por debajo del nivel 4; null: sin la migración; si no, { obrador (null si aún
  // no se ha abierto), piden }), si estás dentro y a quién le llevas algo de la vitrina al acabar de servir ({ cliente, tipo })
  const [obradorDia, setObradorDia] = useState(undefined);
  const [enObrador, setEnObrador] = useState(false);
  // 1.144: delante de la caja del mostrador, cobrando lo que vendió Pilar mientras no estabas
  const [enCaja, setEnCaja] = useState(false);
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
  const libros = useMemo(() => librosDelCafe(state?.books), [state?.books]);
  // 1.139: al servidor van solo tus leídos (hasta 200); la distribuidora enseña además el catálogo del café
  const titulosTuyos = useMemo(() => titulosDelCafe(libros), [libros]);
  const titulosDistri = useMemo(() => titulosDistribuidora(titulosTuyos), [titulosTuyos]);
  const tuyosRef = useRef(titulosTuyos);
  tuyosRef.current = titulosTuyos;
  // Si el servidor ya tiene el catálogo (la migración de la 1.139): sin ella, la bienvenida sin leídos llegaría vacía y se gastaría
  const conCatalogo = useRef(false);
  // Para el escaparate, solo tus leídos
  const leidosEscaparate = useMemo(() => titulosDelCafe((state?.books ?? []).filter((b) => b.status === 'read' && b.title)).slice(0, 24), [state?.books]);
  // Las estanterías enseñan lo que hay en la balda, un lomo por ejemplar (sin la migración de los libros, tus leídos, como en la 1.120)
  const titulos = useMemo(() => (librosCafe === null ? libros.map((b) => b.title) : (librosCafe?.libros ?? []).flatMap((b) => Array(b.balda).fill(b.titulo))), [librosCafe, libros]);
  const deLaBalda = useMemo(() => librosDeLaBalda(librosCafe, libros), [librosCafe, libros]);
  const porColocar = enCajas(librosCafe);
  const sesiones = sesionesDeHoy(state?.progress, hoy);
  // 1.130: cada cliente pide de lo que hay en la balda ahora (con la balda vacía, solo el café)
  // 1.143: máximo dos cosas por cliente (Francisco, 17-11-2026, «Dos máx., 1 de cada 3»): quien pide comida (lo dice el servidor,
  // `cafe_obrador`) no pide libro; los libros se reparten entre los demás
  // 1.145: el excéntrico (los días que pide algo con un acertijo) y los habituales con su favorito traen `quiere`
  const comen = useMemo(() => new Map((obradorDia?.piden ?? []).map((p) => [p.n, p])), [obradorDia?.piden]);
  const pedidos = useMemo(() => {
    if (!comen.size || !dia) return pedidosLibro(dia, deLaBalda);
    const sin = (l) => (l ?? []).filter((c) => !comen.has(c.n));
    const out = pedidosLibro({ ...dia, clientes: sin(dia.clientes), habituales: sin(dia.habituales), virales: sin(dia.virales) }, deLaBalda);
    const excentrico = (dia.clientes ?? []).find((c) => c.excentrico)?.n ?? null;
    for (const [n, p] of comen) out[n] = pedidoComida(p.tipo, p.quiere ?? null, n === excentrico);
    return out;
  }, [dia, deLaBalda, comen]);
  // En las baldas de los muebles, tus leídos (los de la balda del café ya van en la estantería de la pared, por secciones)
  const decorLeidos = useMemo(() => leidosEscaparate.map((b) => b.titulo), [leidosEscaparate]);
  const clientesHoy = useMemo(() => clientesDelDia(dia, pedidos), [dia, pedidos]);
  const pendientes = clientesHoy.filter((c) => !c.servido);
  const clienteAtendido = clientesHoy.find((c) => c.n === atendiendo) ?? null;
  // Mientras atiendes, la vitrina la lleva Atender (Vitrina.jsx): la de fuera no se toca hasta despedirle
  const atiende = Boolean(clienteAtendido);
  const abierto = Boolean(local?.inaugurado);
  const pilarCaja = local?.pilar?.caja ?? false;
  const decorando = borrador != null;
  // Libo (docs/qa/libo.md, bloque 3): lo que queda hoy y la hucha, apuntado en este aparato para que en tu piso te avise del
  // café solo si es verdad. Sin el día cargado (o sin la migración de clientes), nada
  const hucha = local?.pilar?.hucha ?? 0;
  useEffect(() => {
    if (abierto && dia && userId) guardarCafeLibo(userId, { pendientes: pendientes.length, hucha });
  }, [abierto, dia, userId, pendientes.length, hucha]);
  // La carta abierta (bloque 4a): el chocolate y la nata, según la reputación
  const reputacion = local?.reputacion ?? 0;
  const carta = useMemo(() => cartaDe(reputacion), [reputacion]);
  // Bloque 6b: el saco del día en el tambor (con el tueste de la casa en la carta) y las tazas que te quedan
  const tazas = local?.tostadero?.tazas ?? 0;
  const hayTostador = abierto && (local?.nivel ?? 1) >= 7;
  const saco = hayTostador && jornada !== undefined && sacoListo(reputacion, local?.tostadero?.sacoDia ?? null, diaJuego);
  const hayTaller = abierto && (local?.nivel ?? 1) >= TALLER_NIVEL;
  const hayObrador = abierto && (local?.nivel ?? 1) >= OBRADOR_NIVEL;
  const frases = [...PILAR_DICE, local ? PILAR_FIN_CON : PILAR_FIN_SIN];

  // La música propia del café (1.126): mientras estás aquí suena en vez de la de Sonido y sigue su volumen, «Sin música» y la
  // radio; nunca antes de un gesto (si aún no se puede, lo intenta en el siguiente toque). 1.133: en el taller, la suya.
  const musica = useRef(null);
  // Los sonidos de cada acción (1.126): andar, Pilar, decorar, comprar… (los de la barra, en Atender)
  const [sfx] = useState(() => crearSfxBarra());
  useEffect(() => sfx.setActivo(soundOn), [sfx, soundOn]);
  useEffect(() => {
    if (!soundOn) return undefined;
    setMusicBlocked('cafe', true);
    const m = enTaller ? crearTallerMusica(sceneMusicOut) : crearCafeMusica(sceneMusicOut);
    musica.current = m;
    const intentar = () => {
      if (m.arrancar()) window.removeEventListener('pointerdown', intentar, true);
    };
    if (!m.arrancar()) window.addEventListener('pointerdown', intentar, true);
    return () => {
      window.removeEventListener('pointerdown', intentar, true);
      m.parar();
      musica.current = null;
      setMusicBlocked('cafe', false);
    };
  }, [soundOn, enTaller]);

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
            // Bloque 6a: en qué planta estás (al llegar a un sitio o al cambiar de planta)
            onMove: () => alive && setPlantaEscena(mounted?.planta?.() ?? 'calle'),
            onLost: () => alive && setSin3d(true),
            onSonido: (nombre, datos) => sfx.play(nombre, datos),
            onFrame: (tags) => {
              const w = host.current?.clientWidth ?? 0;
              // Los bocadillos de clientes que caen uno encima de otro (uno sentado detrás de otro) se apilan hacia arriba
              const puestos = [];
              for (const [id, t] of Object.entries(tags)) {
                const el = tagEls.current[id];
                if (!el) continue;
                // Libo, bloque 4: los letreros de los clientes se tocan en 44 px, pero el dibujo es 20 px más bajo (y más estrecho, el
                // de la «!» sola): se apilan y se ciñen al borde por el dibujo
                const margen = el.classList.contains('cf3-tag--cliente') ? 20 : 0;
                const half = t.visible ? (el.offsetWidth - (el.classList.contains('cf3-tag--solo') ? margen : 0)) / 2 : 0;
                const x = w ? Math.min(Math.max(t.x, half + 6), w - half - 6) : t.x;
                let y = t.y;
                if (t.visible && id.startsWith('cliente:')) {
                  const alto = el.offsetHeight - margen + 4;
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
  }, [sfx]);

  // El día del café: los clientes los fija el servidor (sin la migración del bloque 3, no hay clientes)
  useEffect(() => {
    if (!abierto || jornada !== undefined) return undefined;
    let vivo = true;
    cargarJornada().then((j) => {
      if (!vivo) return;
      // 1.150: las cuentas de `cafe_probadores` ven a Olmo en vista previa (sin precios de suscriptor)
      fijarVistaPrevia(Boolean(j));
      setJornada(j);
    });
    return () => {
      vivo = false;
    };
  }, [abierto, jornada]);
  useEffect(() => {
    if (!abierto || jornada === undefined) return undefined;
    let alive = true;
    // 1.139: antes de abrir el día, tus leídos, para que el reparto de la mañana traiga alguno tuyo (sin la migración, nada)
    misTitulos(tuyosRef.current)
      .then((ok) => {
        conCatalogo.current = ok;
        return cargarDia(diaJuego);
      })
      .then(
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
  }, [abierto, jornada, diaJuego]);
  // 1.133: el taller del día (el encargo que espera en el banco); sin la migración, la puerta no se ofrece
  useEffect(() => {
    if (!hayTaller || jornada === undefined) return undefined;
    let vivo = true;
    cargarTaller(diaJuego).then(
      (t) => vivo && setTaller(t),
      () => vivo && setTaller(null),
    );
    return () => {
      vivo = false;
    };
  }, [hayTaller, jornada, diaJuego]);
  // 1.143: el obrador (el horno, la vitrina y quién pide algo para acompañar hoy); sin la migración, no se ofrece. Se vuelve a
  // pedir cuando cambian los clientes del día (llega un habitual u otra jornada) y al abrirlo (antes nadie pide comida)
  const nClientes = dia?.clientes?.length ?? 0;
  const nHabituales = dia?.habituales?.length ?? 0;
  const obradorAbierto = Boolean(obradorDia?.obrador);
  useEffect(() => {
    if (!hayObrador || jornada === undefined) return undefined;
    let vivo = true;
    cargarObrador(diaJuego).then(
      (o) => vivo && setObradorDia(o),
      () => vivo && setObradorDia(null),
    );
    return () => {
      vivo = false;
    };
  }, [hayObrador, jornada, diaJuego, nClientes, nHabituales, obradorAbierto]);
  // El letrero del taller aparece (o cambia de texto) cuando llega el encargo: un fotograma para colocarlo, porque con la
  // escena quieta (movimiento reducido) no se vuelve a dibujar sola y se quedaría escondido
  const letreroTaller = taller ? (taller.encargo ? 'encargo' : 'taller') : null;
  useEffect(() => {
    if (letreroTaller) api.current?.invalidate?.();
  }, [letreroTaller]);
  // Has leído hoy: llegan los habituales que traen tus sesiones (el servidor pone el tope)
  useEffect(() => {
    if (!dia || pidiendoHabitual.current || dia.habituales.length >= sesiones) return;
    pidiendoHabitual.current = true;
    llegaHabitual(diaJuego)
      .then((r) => {
        if (r?.dia) setDia(r.dia);
        if (r?.cafe) setLocal(r.cafe);
      })
      .catch(() => {})
      .finally(() => {
        pidiendoHabitual.current = false;
      });
  }, [dia, sesiones, diaJuego]);

  // La caja de bienvenida: la primera vez que entras con el café abierto (una sola vez; el servidor lo comprueba). Desde la
  // 1.139 llega aunque no hayas leído nada: el catálogo del café pone el resto
  useEffect(() => {
    if (!librosCafe || librosCafe.bienvenida || pidiendoBienvenida.current) return;
    if (!tuyosRef.current.length && !conCatalogo.current) return;
    pidiendoBienvenida.current = true;
    bienvenidaLibros(tuyosRef.current)
      .then((r) => {
        if (r.libros) setLibrosCafe(r.libros);
        if (r.cafe) setLocal(r.cafe);
        setHablando(null);
        if (r.caja.length) mirarCaja.current = true;
        setAviso(
          `¡Ha llegado una caja de la distribuidora! ${r.caja.length || BIENVENIDA} libros de regalo${titulosTuyos.length ? ', y entre ellos alguno de los que has leído' : ''}. Tócala y colócalos en la balda: solo se recomienda lo que está a la vista.`,
        );
      })
      .catch(() => {})
      .finally(() => {
        pidiendoBienvenida.current = false;
      });
  }, [librosCafe, titulosTuyos.length]);

  // La escena sigue al estado: el local, el plano (o el borrador de Decorar) y tus libros
  const plano = useMemo(() => borrador ?? local?.plano ?? PLANO_VACIO, [borrador, local?.plano]);
  const escaparateTitulos = useMemo(() => (local?.escaparate ?? []).map((b) => b.titulo), [local?.escaparate]);
  // 1.126: las portadas reales del escaparate (las de tu biblioteca, por su clave), en píxeles; null las que no cargan
  const [portadasEsc, setPortadasEsc] = useState([]);
  const nivelLocal = local?.nivel ?? 1;
  // 1.128: cada una con su portada y su ISBN («portada~isbn»); si la portada no carga, la de su misma edición en Google Books
  const coversEsc = useMemo(
    () =>
      nivelLocal >= ESCAPARATE_NIVEL
        ? (local?.escaparate ?? []).map((e) => {
            const b = (state?.books ?? []).find((x) => String(x.id).slice(0, 80) === e.clave);
            return `${b?.cover || ''}~${b?.isbn || ''}`;
          })
        : [],
    [nivelLocal, local?.escaparate, state?.books],
  );
  const clavePortadas = coversEsc.join('|');
  useEffect(() => {
    let vivo = true;
    const urls = clavePortadas ? clavePortadas.split('|') : [];
    const una = (par) => {
      const [u, isbn] = par.split('~');
      return portadaPixel(u || null).then((p) => p ?? (isbn ? portadaPorIsbn(isbn).then((otra) => portadaPixel(otra || null)) : null));
    };
    Promise.all(urls.map(una)).then((r) => vivo && setPortadasEsc(r));
    return () => {
      vivo = false;
    };
  }, [clavePortadas]);
  // 1.140: las portadas de los libros de cara de la estantería (uno por sección), en píxeles; los que no cargan, con su tapa
  const portadasBalda = usePortadasBalda(deLaBalda);
  // Bloque 4b: con menos asientos que clientes posibles en el nivel 4 o 5, vienen menos (nunca menos de 5). Pilar lo dice sin
  // agobiar: una vez al día al entrar y, después, cuando no hay nadie esperando.
  const nivelAhora = local?.nivel ?? 1;
  const tope = TOPE_CLIENTES[Math.min(7, nivelAhora)];
  const caben = clientesDelNivel(nivelAhora, asientosDe(local?.plano));
  const faltanAsientos = Boolean(abierto && tope != null && caben < tope);
  const textoAsientos = `Con más sitios para sentarse vendría más gente: ahora caben ${caben} clientes al día y podrían venir ${tope}. Cuando quieras, coloca sillas o bancos en Decorar.`;
  const avisadoAsientos = useRef(null);
  useEffect(() => {
    if (!dia || !faltanAsientos || avisadoAsientos.current === hoy) return;
    avisadoAsientos.current = hoy;
    setAviso(textoAsientos);
  }, [dia, faltanAsientos, hoy, textoAsientos]);
  // 1.130: el reparto de la mañana. Pilar lo cuenta una vez al día (en este dispositivo), con su sonido; la caja espera junto
  // al mostrador y sus lomos saltan al abrirla
  const recienReparto = useRef([]);
  useEffect(() => {
    const r = dia?.reparto;
    if (!r || !librosCafe) return;
    const marca = `cafe-reparto:${dia.dia}`;
    try {
      if (localStorage.getItem(marca)) return;
      localStorage.setItem(marca, '1');
    } catch {
      /* sin almacenamiento, se avisa cada vez que se entra */
    }
    recienReparto.current = r.claves;
    // 1.142: con «Colocar la caja» encargada, Pilar ya lo ha subido a la balda (lo que no cabía sigue en la caja)
    const coloca = Boolean(pilarCaja);
    const quedan = enCajas(librosCafe);
    if (r.claves.length) {
      sfx.play('reparto');
      if (!coloca || quedan > 0) mirarCaja.current = true;
    }
    const n = r.claves.length;
    // 1.139: el reparto es gratis (de antes quedaba el que cobraba 2 granos por ejemplar: se cuenta igual, sin precio)
    const tuyos = r.claves.filter((c) => !String(c).startsWith('cat:')).length;
    const repuso = r.repuestos > 0 ? ` ${r.repuestos === 1 ? 'Uno repone' : `${r.repuestos} reponen`} lo que se llevaron ayer.` : '';
    const deTi = tuyos > 0 ? ` ${tuyos === 1 ? 'Hay uno' : `Hay ${tuyos}`} de los que has leído.` : '';
    // 1.142: los que pidió Pilar a la distribuidora (2.º grado de «Colocar la caja»)
    const pidio = r.pilar > 0 ? ` ${r.pilar === 1 ? 'Uno lo pedí yo' : `${r.pilar} los pedí yo`} a la distribuidora.` : '';
    setAviso(
      n
        ? `«Ha pasado el reparto de la mañana: ${n === 1 ? 'un libro' : `${n} libros`}${r.granos > 0 ? ` por ${r.granos} granos` : ' de regalo de la distribuidora'}.${repuso}${deTi}${pidio} ${coloca ? (quedan > 0 ? 'He colocado lo que cabía en la balda; el resto sigue en la caja.' : 'Ya lo he colocado todo en la balda.') : 'Te he dejado la caja junto al mostrador.'}»`
        : '«Ha pasado el reparto de la mañana, pero la balda está llena: hoy no traía nada.»',
    );
  }, [dia, librosCafe, sfx, pilarCaja]);
  // 1.142: la hucha de propinas se recoge al entrar (una vez por visita), con Pilar contándolo
  const huchaRecogida = useRef(false);
  const huchaLista = local?.pilar?.huchaLista ?? 0;
  useEffect(() => {
    if (!abierto || huchaLista <= 0 || huchaRecogida.current) return;
    huchaRecogida.current = true;
    recogerHucha().then(
      (r) => {
        if (!r?.cafe || r.recogido <= 0) return;
        setLocal(r.cafe);
        setGanado(r.recogido);
        sfx.play('campanilla');
        setAviso(`«He vaciado la hucha de propinas mientras no estabas: ${r.recogido} granos para ti.»`);
      },
      () => {
        huchaRecogida.current = false;
      },
    );
  }, [abierto, huchaLista, sfx]);
  // Bloque 6b: Pilar avisa una vez al día de que hay saco en el tambor
  const avisadoSaco = useRef(null);
  useEffect(() => {
    if (!saco || !dia || avisadoSaco.current === diaJuego) return;
    avisadoSaco.current = diaJuego;
    setAviso('«Huele a tostado: hay un saco recién hecho esperando en el tambor del sótano. Bájalo cuando quieras.»');
  }, [saco, dia, diaJuego]);
  // Lo que se ve del tostador cuando no estás delante (encendido con el tueste en la carta; la mirilla, con el saco listo)
  useEffect(() => {
    if (!ready || tostando || !hayTostador) return;
    api.current?.setTostador?.({ encendido: tuesteAbierto(reputacion), listo: saco });
  }, [ready, tostando, hayTostador, reputacion, saco]);
  // 1.143: el horno y la vitrina vistos desde fuera: la hornada se dora poco a poco y, cuando está lista, suena la campanilla y
  // el letrero lo dice. Dentro del obrador (o en la vitrina, sirviendo) lo llevan Obrador.jsx y Vitrina.jsx
  const obradorHoy = obradorDia?.obrador ?? null;
  // Libo, bloque 4 (hooks/useAtras.js): con una pantalla del café abierta (la barra, el obrador, el taller, los libros, Decorar…),
  // Atrás del móvil hace lo mismo que su botón de volver; a mitad de una taza, sin botón de volver, no hace nada. En Decorar con
  // cambios sin guardar tampoco, para no perderlos
  const raizCafe = useRef(null);
  const capaAbierta = Boolean(
    (panelLibros && librosCafe) ||
      (panelRanking && onVisitar && !enTaller) ||
      (panelCuaderno && local?.pilar && !enTaller) ||
      (enTaller && taller) ||
      (enCaja && obradorHoy) ||
      (enObrador && obradorDia) ||
      (tostando && local) ||
      clienteAtendido ||
      decorando ||
      eligiendo ||
      escaparate != null,
  );
  useAtras(capaAbierta, () => {
    if (decorando && JSON.stringify(borrador.items) !== JSON.stringify(local?.plano?.items)) return false;
    return pulsarAtras(raizCafe.current);
  });
  const [relojHorno, setRelojHorno] = useState(() => Date.now());
  const nHorneando = obradorHoy?.horneando.length ?? 0;
  // 1.145.1: el reloj sigue también dentro del obrador, para la nota de la campanilla (cada segundo: la nota llega a tiempo)
  useEffect(() => {
    if (!nHorneando) return undefined;
    const id = setInterval(() => setRelojHorno(Date.now()), 1000);
    return () => clearInterval(id);
  }, [nHorneando]);
  const hornadaLista = Boolean(obradorHoy?.horneando.some((h) => estadoHorno(h, relojHorno).listo));
  const listasHorno = (obradorHoy?.horneando ?? []).filter((h) => estadoHorno(h, relojHorno).listo);
  const claveListas = listasHorno.map((h) => `${h.bandeja}:${h.receta}`).join(',');
  useEffect(() => {
    if (!ready || enObrador || !hayObrador) return;
    api.current?.setObrador?.({
      abierto: Boolean(obradorHoy),
      horneando: (obradorHoy?.horneando ?? []).map((h) => ({ receta: h.receta, t: estadoHorno(h, relojHorno).t })),
      listo: hornadaLista,
      horno: obradorHoy?.horno ?? 1,
      // 1.145: el fogón, los adornos de los hitos y la masa del pan
      fogon: (local?.nivel ?? 1) >= FOGON_NIVEL,
      hitos: obradorHoy?.hitos ?? 0,
      masa: obradorHoy?.masa ? (obradorHoy.masa.lista ? 'lista' : 'reposa') : null,
    });
  }, [ready, enObrador, hayObrador, obradorHoy, relojHorno, hornadaLista, local?.nivel]);
  // 1.144: la vitrina, con su grado y la pizarrita de la especialidad del día
  const especialidad = obradorDia?.especialidad ?? null;
  useEffect(() => {
    if (!ready || atiende || enCaja || !hayObrador) return;
    api.current?.setVitrina?.({ piezas: obradorHoy?.piezas ?? {}, grado: obradorHoy?.vitrina ?? 1, especialidad: obradorHoy ? especialidad : null, hitos: obradorHoy?.hitos ?? 0 });
  }, [ready, atiende, enCaja, hayObrador, obradorHoy, especialidad]);
  // 1.144: lo que vendió Pilar en el mostrador mientras no estabas. Con piezas en la vitrina, a la caja a tirar del cajón (una vez
  // por visita, cuando no haya otra cosa); con la vitrina vacía no pudo vender nada: se apuntan los días sin decir nada
  const cajaVista = useRef(false);
  // 1.145: los hitos que llegan al cobrar la caja: la campanilla suena al momento y Pilar lo dice al cerrarla (con la caja abierta
  // su bocadillo no se ve y el aviso se iría solo)
  const hitosCaja = useRef(null);
  const diasMostrador = obradorHoy?.mostrador?.dias ?? 0;
  const conPiezas = enVitrina(obradorHoy) > 0;
  // 1.145.1 (Francisco, 25-11-2026: «cuando tengas cosas haciéndose en el horno te salga una notificación cuando se terminen, o
  // un indicador visual claro»): al terminar una hornada, estés donde estés del café (la sala, la barra, la librería, el taller,
  // el obrador…), suena la campanilla y baja una nota de papel bajo la placa, «¡Ding! Ya están las magdalenas.», que se va sola
  // y no se toca (nunca tapa las herramientas). Lo que terminó mientras no estabas, al entrar. Además, el horno del HUD (abajo).
  const listasAntes = useRef(new Set());
  const [notaHorno, setNotaHorno] = useState(null);
  useEffect(() => {
    if (!ready) return;
    const nuevas = listasHorno.filter((h) => !listasAntes.current.has(`${h.bandeja}:${h.receta}`));
    listasAntes.current = new Set(listasHorno.map((h) => `${h.bandeja}:${h.receta}`));
    if (!nuevas.length) return;
    // Dentro del obrador, la campanilla la toca Obrador.jsx (mirando el horno o con otra receta entre manos)
    if (!enObrador) sfx.play('campanillaHorno');
    setNotaHorno({ texto: yaEsta(nuevas.map((h) => h.receta)), n: Date.now(), ding: true });
    // claveListas resume listasHorno
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveListas, ready]);
  useEffect(() => {
    if (!notaHorno) return undefined;
    const t = setTimeout(() => setNotaHorno(null), 5500);
    return () => clearTimeout(t);
  }, [notaHorno]);
  // Con un cliente delante, su comanda ocupa ese sitio: la nota baja justo debajo de ella (nunca la tapa)
  const notaHornoEl = useRef(null);
  useLayoutEffect(() => {
    const el = notaHornoEl.current;
    const raiz = raizCafe.current;
    if (!el || !raiz) return;
    const comanda = raiz.querySelector('.cf3-comanda');
    el.style.top = comanda ? `${Math.round(comanda.getBoundingClientRect().bottom - raiz.getBoundingClientRect().top + 8)}px` : '';
  }, [notaHorno, clienteAtendido]);
  // En el nivel 3, una vez (en este dispositivo): Pilar huele algo detrás de la pared. Solo cuando no tiene otra cosa que
  // decir y tras un rato de calma: nunca pisa el reparto de la mañana, la hucha, el saco, la subida ni lo que estés haciendo
  const pilarCalla =
    !aviso && hablando == null && !clienteAtendido && !logro && !decorando && !eligiendo && escaparate == null && !tostando && !enTaller && !enObrador && !enCaja && !panelLibros && !panelCuaderno && !panelRanking;
  useEffect(() => {
    if ((!ready && !sin3d) || diasMostrador <= 0 || cajaVista.current || !pilarCalla) return undefined;
    // Sin la escena en 3D (no hay caja que abrir), Pilar lo cobra y lo cuenta
    if (!conPiezas || sin3d) {
      cajaVista.current = true;
      cobrarMostrador(diaJuego).then(
        (r) => {
          if (!r) return;
          if (r.obrador) setObradorDia((d) => ({ piden: [], ...d, obrador: r.obrador }));
          if (r.cafe) setLocal(r.cafe);
          if (sin3d && r.cobrado?.granos > 0) {
            setGanado(r.cobrado.granos);
            setAviso(fraseMostrador(r.cobrado.vendidas));
          }
          darHitos(r.cobrado?.hitos);
        },
        () => {},
      );
      return undefined;
    }
    const t = setTimeout(() => {
      cajaVista.current = true;
      setEnCaja(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [ready, sin3d, diasMostrador, conPiezas, pilarCalla, diaJuego]);
  useEffect(() => {
    if (!abierto || nivelLocal !== 3 || !dia || !pilarCalla) return undefined;
    const t = setTimeout(() => {
      try {
        if (localStorage.getItem('bookshelf:cafe-obrador-pista')) return;
        localStorage.setItem('bookshelf:cafe-obrador-pista', '1');
      } catch {
        return;
      }
      setAviso(PILAR_OBRADOR.pista);
    }, 2500);
    return () => clearTimeout(t);
  }, [abierto, nivelLocal, dia, pilarCalla]);
  const selItem = borrador?.items.find((i) => i.uid === sel) ?? null;
  useEffect(() => {
    if (!ready) return;
    api.current?.setLocal({
      inaugurado: abierto,
      nombre: local?.nombre ?? null,
      plano,
      libros: titulos,
      cajas: porColocar,
      vacias: librosCafe != null,
      nivel: nivelEscena,
      escaparate: escaparateTitulos,
      portadas: portadasEsc,
      // 1.130: la estantería de la pared, por secciones (sin la migración de los libros, como antes)
      balda: librosCafe != null ? deLaBalda : null,
      decor: decorLeidos,
      portadasBalda,
    });
    api.current?.decorar(decorando, { sel, mal: false, planta: plantaDecor });
    if (mirarCaja.current && porColocar > 0 && !decorando) {
      mirarCaja.current = false;
      api.current?.go('libros');
    }
  }, [ready, abierto, local?.nombre, plano, titulos, porColocar, librosCafe, decorando, sel, nivelEscena, escaparateTitulos, portadasEsc, plantaDecor, deLaBalda, decorLeidos, portadasBalda]);
  // Los clientes, sentados: los atendidos, con el libro que les diste (o uno de tu estantería si fue en otra visita)
  useEffect(() => {
    if (!ready) return;
    api.current?.setClientes(
      clientesHoy.map((c) => ({
        n: c.n,
        aspecto: c.aspecto,
        raro: c.raro ? { tocado: c.raro.tocado, tema: c.raro.tema } : null,
        // 1.132: el influencer, con su accesorio y su color (la luz «REC» mientras espera y el aro del suelo)
        influencer: c.influencer ? { accesorio: c.influencer.accesorio, tema: c.influencer.tema } : null,
        servido: c.servido,
        libro: c.servido ? (dados.current[c.n] ?? titulos[c.semilla % Math.max(1, titulos.length)] ?? null) : null,
        // 1.143: lo que se le sirvió de la vitrina, en su plato junto a la mesa
        comida: obradorDia?.piden?.find((p) => p.n === c.n && p.servido)?.receta ?? null,
      })),
    );
  }, [ready, clientesHoy, titulos, plano, obradorDia]);
  // 1.132: las fotos firmadas de los influencers que se hicieron virales, en la pared de la derecha
  const fotosClave = abierto ? (local?.fotos ?? []).join() : '';
  useEffect(() => {
    if (!ready) return;
    api.current?.setFotos?.(fotosClave ? fotosClave.split(',').map(Number) : []);
  }, [ready, fotosClave]);
  // Mientras preparas y sirves, la música baja un poco para que se oiga lo que haces
  useEffect(() => {
    musica.current?.atenuar(Boolean(clienteAtendido));
  }, [clienteAtendido]);
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
    sfx.play(quien.sonido);
    reposoOlmo.tocado();
    setAviso('');
    setHablando(0);
    // Olmo, con el café abierto: una frase suya cada vez que le tocas
    if (abierto && quien.frases) setFraseOlmo((k) => (k + 1) % quien.frases.length);
    api.current?.go('pilar');
  };
  // Quién está detrás de la barra en el 3D
  useEffect(() => {
    if (ready) api.current?.setAnfitrion(quien.id);
  }, [ready, quien.id]);
  useEffect(() => {
    pick.current = (id) => {
      if (decorando || tostando || enTaller || enObrador || enCaja) return;
      if (atenderToque.current?.(id)) return;
      if (id.startsWith('cliente:')) {
        const c = clientesHoy.find((x) => x.n === Number(id.slice(8)));
        if (!c) return;
        if (!c.servido) return atender(c.n);
        sfx.play('toque');
        setAtendiendo(null);
        setHablando(null);
        setAviso(
          c.influencer
            ? `${c.nombre} está montando su vídeo tan a gusto. Mejor no molestar.`
            : c.habitual || c.raro
              ? `${c.nombre} está leyendo tan a gusto. Mejor no molestar.`
              : 'Está leyendo tan a gusto. Mejor no molestar.',
        );
        return;
      }
      setAtendiendo(null);
      if (SITIOS_NUEVOS[id]) verNuevo(`sitio:${id}`);
      if (id === 'pilar') return hablar();
      if (id === 'libros') return abrirLibros('caja', recienReparto.current);
      // Bloque 6b: el tostador, delante de su trampilla
      if (id === 'tostador') {
        setHablando(null);
        setAviso('');
        setError('');
        setPanelLibros(null);
        api.current?.go('tostador').then(() => setTostando(true));
        return;
      }
      // 1.143: el obrador, delante de su mesa (la primera vez, Pilar abre el tabique)
      if (id === 'obrador') {
        if (!obradorDia) return;
        setHablando(null);
        setAviso('');
        setError('');
        setPanelLibros(null);
        setPanelRanking(false);
        setPanelCuaderno(false);
        sfx.play('toque');
        api.current?.go('obrador').then(() => setEnObrador(true));
        return;
      }
      // 1.133: el taller, por la puerta de detrás de la barra (la escena anda hasta ella y entra)
      if (id === 'taller') {
        if (!taller) return;
        setHablando(null);
        setAviso('');
        setError('');
        setPanelLibros(null);
        setEnTaller(true);
        return;
      }
      // La trampilla y la escalera suenan con su recorrido (la escena lo avisa)
      if (id !== 'trampilla' && id !== 'subir') sfx.play(id === 'escaparate' ? 'cristal' : 'toque');
      setHablando(null);
      if (id === 'escaparate' && abierto && (local?.nivel ?? 1) >= ESCAPARATE_NIVEL) {
        setAviso('');
        setError('');
        setEscaparate((local?.escaparate ?? []).map((b) => b.clave));
        api.current?.go(id);
        return;
      }
      setAviso((abierto ? AVISOS_ABIERTO : AVISOS)[id] ?? '');
      api.current?.go(id);
    };
    // Decorar: elegir una pieza, llevarla a una casilla o arrastrarla
    decor.current = (e) => {
      if (!borrador) return;
      if (e.tipo === 'elegir') {
        if (e.uid !== sel) sfx.play('coger');
        return setSel(e.uid);
      }
      const uid = e.tipo === 'arrastre' ? e.uid : sel;
      const it = borrador.items.find((i) => i.uid === uid);
      if (!it) return;
      const movido = { ...it, x: e.x, y: e.y };
      if (cabe(borrador, movido, movido.uid, local?.nivel ?? 1)) {
        // Al arrastrar, un roce por casilla; al llevarlo de un toque, el golpe de dejarlo
        if (movido.x !== it.x || movido.y !== it.y) sfx.play(e.tipo === 'arrastre' ? 'arrastra' : 'soltar');
        setBorrador({ ...borrador, items: borrador.items.map((i) => (i.uid === uid ? movido : i)) });
      } else if (e.tipo !== 'arrastre') sfx.play('noCabe');
    };
  });

  const guardarEscaparate = async () => {
    if (!escaparate || ocupado) return;
    setOcupado(true);
    setError('');
    try {
      const elegidos = leidosEscaparate.filter((b) => escaparate.includes(b.clave));
      const c = await ponerEscaparate(elegidos);
      setLocal(c);
      sfx.play('cristal');
      setEscaparate(null);
      setAviso(elegidos.length ? '¡Qué bonito ha quedado! Los verá todo el que pase por el muelle, también desde la fachada.' : 'El escaparate queda vacío, solo con la lamparita.');
    } catch (e) {
      setError(errorCafe(e));
    } finally {
      setOcupado(false);
    }
  };
  const marcarEscaparate = (clave) =>
    setEscaparate((xs) => (xs.includes(clave) ? xs.filter((k) => k !== clave) : xs.length >= ESCAPARATE_MAX ? xs : [...xs, clave]));

  const inaugurar = async () => {
    if (!nombre || ocupado) return;
    setOcupado(true);
    setError('');
    try {
      const c = await inaugurarCafe(nombre);
      sfx.play('llaves');
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
    setPanelRanking(false);
    setPanelCuaderno(false);
    setAviso('');
    setHablando(null);
    setError('');
    setAtendiendo(n);
    // 1.128 (Francisco, 13-11-2026: «que cuando te salga el cliente al que vas a atender la cámara vaya a por él»): vas hasta él
    // mientras te dice lo que quiere (con movimiento reducido, sin paseo)
    if (ready && !sin3d) api.current?.irACliente?.(n);
  }
  function abrirLibros(hoja, recien = []) {
    setPanelRanking(false);
    setPanelCuaderno(false);
    setAtendiendo(null);
    setAviso('');
    setHablando(null);
    sfx.play('papel');
    setPanelLibros({ hoja, recien });
    if (hoja === 'caja' && porColocar > 0) api.current?.go('libros');
  }
  // Otra jornada de prueba: el servidor la abre si ya está todo el mundo atendido; llegan clientes nuevos
  const otraJornada = async () => {
    if (ocupado) return;
    setOcupado(true);
    setAviso('');
    try {
      const j = await nuevaJornada();
      sfx.play('llaves');
      setAtendiendo(null);
      setJornada(j);
    } catch (e) {
      setError(errorCafe(e));
    } finally {
      setOcupado(false);
    }
  };
  /** 1.145: los hitos nuevos del obrador (al vender en la mesa o en el mostrador): la campanilla y lo que dice Pilar del adorno. */
  const darHitos = (l) => {
    if (!Array.isArray(l) || !l.length) return;
    sfx.play('hitoObrador');
    setAviso(HITOS_OBRADOR.frases[Math.max(...l) - 1] ?? '');
  };
  // 1.130: la receta, el ejemplar de la balda (o null, solo el café) y lo acertado del libro [género, extensión, forma]
  // 1.132: al influencer, con su reloj de arena (`entregarInfluencer`); al despedirle, si era el de la subida, el café sube
  // 1.143: a quien pide comida, tras la bebida, la pieza (`comida`, la receta que le llevas): sus granos se suman a lo ganado
  const servir = async ({ receta, libro, ok, comida = null }) => {
    const c = clienteAtendido;
    const r = c.influencer ? await entregarInfluencer(diaJuego, c.influencer.nivel, receta, libro?.clave ?? null, ok) : await entregarCliente(diaJuego, c.n, receta, libro?.clave ?? null, ok);
    let dado = r.dado;
    if (comida && !c.influencer) {
      try {
        const rc = await servirComida(diaJuego, c.n, comida);
        if (rc.cafe) r.cafe = rc.cafe;
        const receta_ = rc.dado?.receta ?? comida;
        setObradorDia((d) => (d ? { ...d, obrador: rc.obrador ?? d.obrador, piden: d.piden.map((p) => (p.n === c.n ? { ...p, servido: true, receta: receta_ } : p)) } : d));
        dado = {
          ...dado,
          granos: (dado?.granos ?? 0) + (rc.dado?.granos ?? 0),
          comida_granos: rc.dado?.granos ?? 0,
          comida_receta: receta_,
          comida_excentrico: rc.dado?.excentrico === true,
          comida_favorito: rc.dado?.favorito === true,
        };
        // 1.145: con la campanilla del mostrador (el cuarto hito), suena al vender; y los hitos nuevos, con su adorno
        if ((rc.obrador?.hitos ?? 0) >= HITO_CAMPANILLA) sfx.play('campanillaMostrador');
        darHitos(rc.dado?.hitos);
      } catch {
        dado = { ...dado, comida_falla: true };
      }
    }
    // Con el libro que se lleva (si vuelve a su sección, como cualquier otro cliente)
    dados.current[c.n] = r.dado?.llevado ? (libro?.title ?? null) : null;
    if (r.libros) setLibrosCafe(r.libros);
    if (r.cafe) setLocal(r.cafe);
    if (r.dia) setDia(r.dia);
    setGanado((dado?.granos ?? 0) + (r.progreso?.granos ?? 0));
    // El cartel de la subida dice de quién fue el vídeo (si la subida llegó con él)
    const video = c.influencer && r.dado?.influencer ? { nombre: c.influencer.nombre, publica: c.influencer.publica, viral: Boolean(r.dado.influencer.viral) } : null;
    if (hayLogro(r.progreso)) setLogro(video ? { ...r.progreso, video } : r.progreso);
    return dado;
  };

  const nuevos = useMemo(() => (vistos ? nuevosDe(local?.reputacion ?? 0, vistos) : new Set()), [local?.reputacion, vistos]);
  const hayMuebleNuevo = [...nuevos].some((k) => k.startsWith('mueble:'));
  const verNuevo = (claves) => setVistos((v) => (v ? marcarVisto('cafe', v, claves) : v));
  // La primera vez, lo que ya tenías cuenta como visto
  useEffect(() => {
    if (local?.inaugurado && !vistos) setVistos(vistosDe('cafe', local.reputacion ?? 0));
  }, [local?.inaugurado, local?.reputacion, vistos]);
  // Al abrir la tienda se ven sus muebles nuevos: la «!» se queda en ellos mientras sigues en Decorar y ya no vuelve
  useEffect(() => {
    if (!decorando || pestana !== 'tienda' || !vistos) return;
    const ks = [...nuevos].filter((k) => k.startsWith('mueble:'));
    if (!ks.length) return;
    setNuevosTienda((t) => new Set([...(t ?? []), ...ks]));
    verNuevo(ks);
  }, [decorando, pestana, nuevos, vistos]);
  useEffect(() => {
    if (!decorando) setNuevosTienda(null);
  }, [decorando]);
  const empezarDecorar = () => {
    sfx.play('papel');
    setAtendiendo(null);
    setPanelLibros(null);
    setAviso('');
    setHablando(null);
    setError('');
    setSel(null);
    setPlantaDecor((local?.nivel ?? 1) >= BODEGA_NIVEL ? (api.current?.planta?.() ?? 'calle') : 'calle');
    setBorrador({ v: 1, items: local.plano.items.map((i) => ({ ...i })) });
  };
  const cancelarDecorar = () => {
    sfx.play('papel');
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
      sfx.play('guardar');
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
        sfx.play('girar');
        setBorrador({ ...borrador, items: borrador.items.map((i) => (i.uid === sel ? g : i)) });
        return;
      }
    }
    sfx.play('noCabe');
    setError('No hay sitio para girarlo ahí.');
  };
  const quitar = () => {
    if (!selItem) return;
    sfx.play('quitar');
    setBorrador({ ...borrador, items: borrador.items.filter((i) => i.uid !== sel) });
    setSel(null);
  };
  const anadir = (id) => {
    setError('');
    if (borrador.items.length >= maxCosas(local?.nivel ?? 1)) return sfx.play('noCabe'), setError(`Caben ${maxCosas(local?.nivel ?? 1)} cosas como mucho. Quita algo antes.`);
    const nivelD = local?.nivel ?? 1;
    // Desde el nivel 6, en la planta que se está decorando
    const sitio = hueco(borrador, id, undefined, nivelD, nivelD >= BODEGA_NIVEL ? plantaDecor : null);
    if (!sitio) return sfx.play('noCabe'), setError('No queda sitio libre para ese mueble. Quita o mueve algo antes.');
    sfx.play('soltar');
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
      sfx.play('comprar');
      setAviso(`¡${m.nombre}, tuyo! Ya lo tienes en «Del café» para colocarlo.`);
    } catch (e) {
      setError(errorCafe(e));
    } finally {
      setOcupado(false);
    }
  };

  const prog = progresoNivel(local?.nivel ?? 1, local?.reputacion ?? 0);
  // 1.132: con la barra llena, el café está «a punto de subir» hasta que despidas al influencer de la subida
  const infHoy = clientesHoy.find((c) => c.influencer) ?? null;
  const aPuntoDeSubir = abierto && ((local?.espera ?? 0) > 0 || Boolean(infHoy?.influencer.sube && !infHoy.servido));
  const infEspera = pendientes.find((c) => c.influencer) ?? null;
  const titulo = abierto ? `${local.nombre}, tu café-librería.` : 'El café-librería del bajo: el local, vacío y en traspaso.';
  const ultima = hablando === frases.length - 1;
  // El cuadro de diálogo: quién habla (Pilar con su retrato o un aviso con la taza), qué dice y si hay más
  const quienHabla = eligiendo || escaparate != null || !aviso;
  // El retrato de la franja: con su frase, su gesto; mareado tras muchos toques; si no, según el rato sin tocar nada
  const poseFranja = reposoOlmo.mareado ? 'mareado' : fraseOlmo >= 0 && hablando != null ? poseOlmoAlHablar(fraseOlmo) : poseOlmoEnReposo(reposoOlmo.quieto);
  const texto = eligiendo
    ? '«¿Cómo se va a llamar? Lo verán todos los que pasen por el muelle.»'
    : escaparate != null
      ? `«Elige hasta tres de tus leídos para el escaparate: se verán desde la calle.» (${escaparate.length} de ${ESCAPARATE_MAX})`
      : aviso
      ? aviso
      : abierto && hablando == null && dia && pendientes.length
        ? `«${quien.dice.esperando(pendientes.length === 1 ? 'Tienes un cliente esperando' : `Tienes ${pendientes.length} clientes esperando`)}${
            infEspera
              ? pendientes.length === 1
                ? `: ${enFrase(infEspera.nombre)}, que viene a grabar tu café`
                : `, y ${enFrase(infEspera.nombre)} viene a grabar tu café`
              : pendientes.some((c) => c.raro)
                ? pendientes.length === 1
                  ? ', y es muy peculiar'
                  : ', y uno es muy peculiar'
                : ''
          }.${infEspera?.influencer.sube ? ' Cuando le despidas, el café subirá de nivel.' : ''} ${pendientes.length === 1 ? 'Tócalo' : 'Toca uno'} en el local, o «Atender», para ver qué pide.»`
        : abierto && hablando == null && dia && clientesHoy.length
          ? jornada
            ? `«${quien.dice.otraJornada}»`
            : sesiones < 2
            ? `«${quien.dice.leeUnRato}»`
            : `«${quien.dice.atendidos}»`
          : abierto && hablando == null && faltanAsientos
            ? `«${textoAsientos}»`
            : abierto && hablando == null
            ? `«${quien.dice.huele(local.nombre)}»`
            : abierto && quien.frases && fraseOlmo >= 0
              ? `«${quien.frases[fraseOlmo]}»`
              : abierto
              ? `«${quien.dice.pronto}»`
              : `«${hablando == null ? SALUDO : frases[hablando]}»`;
  const sigue = !eligiendo && !abierto && !aviso && hablando != null && !ultima;

  // ── 1.150 · La guía del café en sus menús y botones (cafeGuia.js): la da quien atiende. Cada sitio del café es un capítulo; se
  // abre sola con lo que aún no has visto (después de que Libo presente el café, y solo si Libo «sugiere cosas») y, a petición,
  // al tocar el retrato de la franja, con todo lo que se ve. ──
  const capGuia =
    !abierto || (!ready && !sin3d) || clienteAtendido || enTaller || enObrador || enCaja || tostando || eligiendo || escaparate != null || logro
      ? null
      : decorando
        ? selItem
          ? null
          : 'decorar'
        : panelLibros
          ? 'libros'
          : panelRanking
            ? 'ranking'
            : panelCuaderno
              ? 'cuaderno'
              : hablando == null
                ? 'local'
                : null;
  const [guia, setGuia] = useState(null);
  const ajustesGuia = useRef(state.settings);
  ajustesGuia.current = state.settings;
  const seVe = useCallback((sel) => Boolean(raizCafe.current && anclaVisible(raizCafe.current, sel)), []);
  const abrirGuia = useCallback(
    (capitulo, { todos = false } = {}) => {
      const pasos = pasosDe(capitulo, conLoDeAqui(ajustesGuia.current), seVe, { todos });
      if (!pasos.length) return false;
      // Se marca todo al abrirla: si la cierras («Ahora no», «Saltar»), no vuelve a salir sola; el retrato la repasa
      const patch = marcarVistos(ajustesGuia.current, capitulo, pasos);
      if (patch) actions.setSettings(patch);
      marcarAqui(capitulo, pasos);
      setGuia({ capitulo, pasos, repaso: todos });
      return true;
    },
    [actions, seVe],
  );
  // Si cambias de sitio (entras a atender, abres un menú…), la guía de antes se cierra
  useEffect(() => {
    if (guia && guia.capitulo !== capGuia) setGuia(null);
  }, [guia, capGuia]);
  // Sola: con el café quieto un par de vueltas seguidas (que la escena y los letreros se asienten) y sin Libo hablando
  const modoLibo = liboDe(state.settings).modo;
  // Libo presenta el café primero (en la cuenta o en este dispositivo); la guía viene después
  const liboYaPresento = haVisto(state.settings, 'cafe') || presentadoAqui('cafe') || modoLibo !== 'sugiere';
  useEffect(() => {
    if (!capGuia || guia || modoLibo !== 'sugiere' || !liboYaPresento) return undefined;
    let quieto = 0;
    const t = setInterval(() => {
      const libo = document.querySelector('.libo-guia, .libo-bocadillo');
      const enMarcha = !api.current?.settled?.() && !sin3d;
      quieto = libo || enMarcha ? 0 : quieto + 1;
      if (quieto >= 2 && abrirGuia(capGuia)) clearInterval(t);
    }, 900);
    return () => clearInterval(t);
  }, [capGuia, guia, modoLibo, liboYaPresento, sin3d, abrirGuia]);

  return (
    <div ref={raizCafe} className="cf3" data-guia-abierta={guia ? 'true' : undefined} data-ready={(ready || sin3d) && local !== undefined ? 'true' : undefined} data-abierto={abierto ? 'true' : undefined} data-decorar={decorando ? 'true' : undefined}>
      <h2 className="px-sr" id="ed-title">
        {titulo}
      </h2>
      {sin3d ? (
        // 1.155 · Sin 3D, el café no se dibuja (fuera el bajo isométrico vacío)
        <div className="cf3-iso">
          <SinTresD sala="el café" />
        </div>
      ) : (
        <div className="cf3-stage" ref={host}>
          {!ready && <PantallaCarga mensaje="Abriendo el bajo…" />}
        </div>
      )}
      {!sin3d && (
        <div className="cf3-tags" hidden={decorando}>
          {Object.entries(SITIOS)
            .filter(([id]) => (id !== 'taller' || taller) && (id !== 'obrador' || obradorDia))
            .map(([id, s]) => (
            <button
              key={id}
              type="button"
              className={`cf3-tag${id === 'libros' ? ' cf3-tag--libros' : ''}`}
              data-sitio={id}
              data-off="true"
              data-nuevo={nuevos.has(`sitio:${id}`) ? 'true' : undefined}
              data-listo={id === 'obrador' && obradorHoy && hornadaLista ? 'true' : undefined}
              ref={(el) => (tagEls.current[id] = el)}
              onClick={() => pick.current(id)}
            >
              {id === 'libros'
                ? `${s.nombre} · ${porColocar}`
                : id === 'tostador' && saco
                  ? `${s.nombre} · saco listo`
                  : id === 'taller' && taller?.encargo
                    ? `${s.nombre} · un encargo`
                    : id === 'obrador' && !obradorHoy
                      ? '¿Y esta pared?'
                      : id === 'obrador' && hornadaLista
                        ? `${s.nombre} · ¡listo!`
                        : id === 'pilar'
                          ? quien.nombre
                          : s.nombre}
              {nuevos.has(`sitio:${id}`) && <Nuevo />}
            </button>
          ))}
          {pendientes.map((c) => (
            <button
              key={c.n}
              type="button"
              className={`cf3-tag cf3-tag--cliente${c.raro ? ' cf3-tag--raro' : ''}${c.influencer ? ' cf3-tag--influencer' : ''}${c.habitual || c.influencer || c.raro ? '' : ' cf3-tag--solo'}`}
              data-off="true"
              style={c.raro ? { '--cf3-tema': `rgb(${c.raro.tema.join(' ')})` } : c.influencer ? { '--cf3-tema': `rgb(${c.influencer.tema.join(' ')})` } : undefined}
              aria-label={`Atender a ${c.habitual || c.raro || c.influencer ? c.nombre : 'un cliente'}`}
              ref={(el) => (tagEls.current[`cliente:${c.n}`] = el)}
              onClick={() => pick.current(`cliente:${c.n}`)}
            >
              {c.habitual ? c.nombre : c.influencer ? <span aria-hidden="true">REC</span> : null}
            </button>
          ))}
        </div>
      )}
      {abierto && (
        <div className="cf3-hud" data-decorar={decorando ? 'true' : undefined}>
          <p
            className="cf3-placa"
            data-sube={aPuntoDeSubir ? 'true' : undefined}
            aria-label={`Tu café: ${local.nombre}, nivel ${local.nivel}, ${prog.nombre}. ${aPuntoDeSubir ? '¡A punto de subir de nivel!' : `Reputación ${prog.lleva}${prog.meta ? ` de ${prog.meta}` : ''}.`}`}
          >
            <span className="cf3-placa__insignia" aria-hidden="true">
              <span className="cf3-placa__nv">NV</span>
              {local.nivel}
            </span>
            <span className="cf3-placa__texto" aria-hidden="true">
              <span className="cf3-placa__nombre">{local.nombre}</span>
              <span className="cf3-placa__nivel">{prog.nombre}</span>
              <span className="cf3-xp">
                <span className="cf3-xp__lleno" style={{ width: `${aPuntoDeSubir ? 100 : Math.round(prog.hecho * 100)}%` }} />
                {[1, 2, 3].map((k) => (
                  <span key={k} className="cf3-xp__hito" style={{ left: `${k * 25}%` }} data-hecho={(local.reputacion ?? 0) >= umbralHito(local.nivel, k) ? 'true' : undefined} />
                ))}
              </span>
              <span className="cf3-xp__cifra">{aPuntoDeSubir ? '¡A punto de subir!' : prog.meta ? `${prog.lleva} / ${prog.meta}` : `${prog.lleva}`}</span>
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
            {/* 1.145.1: el horno, mientras hay algo dentro, en todo el café menos en el obrador y Decorar. Horneando, la lumbre
                respira y sube un poco de vaho; con algo listo, la campanilla con su «!» y «¡Listo!» al lado. Se toca para ir al
                horno; con otra cosa entre manos (un cliente, el taller…), Pilar te lo guarda para cuando acabes */}
            {obradorHoy && nHorneando > 0 && !decorando && !enObrador && (
              <div className="cf3-horno" data-listo={hornadaLista ? 'true' : undefined}>
                {hornadaLista && !capaAbierta && (
                  <span className="cf3-horno__listo" aria-hidden="true">
                    ¡Listo!
                  </span>
                )}
                <button
                  type="button"
                  className="cf3-pizarra-btn cf3-horno-btn"
                  data-listo={hornadaLista ? 'true' : undefined}
                  aria-label={
                    hornadaLista
                      ? `El horno: ${yaEsta(listasHorno.map((h) => h.receta)).toLowerCase().replace(/.$/, '')}. Toca para ir a sacarlo.`
                      : `El horno: dentro, ${enElHornoTexto(obradorHoy.horneando.map((h) => h.receta))}. Aún no está.`
                  }
                  onClick={() => {
                    if (capaAbierta || tostando || enTaller || enCaja) {
                      sfx.play('papel');
                      setNotaHorno({
                        texto: hornadaLista ? `${yaEsta(listasHorno.map((h) => h.receta))} Te espera en el horno cuando acabes.` : 'Aún se está haciendo. Ya sonará la campanilla.',
                        n: Date.now(),
                      });
                      return;
                    }
                    if (!hornadaLista) {
                      sfx.play('papel');
                      setNotaHorno({ texto: `Dentro: ${enElHornoTexto(obradorHoy.horneando.map((h) => h.receta))}. Aún se está haciendo; ya sonará la campanilla.`, n: Date.now() });
                      return;
                    }
                    pick.current('obrador');
                  }}
                >
                  <PixelArt icono={HORNO} />
                  {!hornadaLista && (
                    <span className="cf3-horno-btn__vaho" aria-hidden="true">
                      <i />
                      <i />
                    </span>
                  )}
                  {hornadaLista && <span className="cf3-horno-btn__campana" aria-hidden="true" />}
                </button>
              </div>
            )}
            {librosCafe && !decorando && !enTaller && (
              <button
                type="button"
                className="cf3-pizarra-btn cf3-libros-btn"
                aria-label={`Tus libros: ${enBalda(librosCafe)} en la balda${porColocar ? `, ${porColocar} por colocar` : ''}`}
                aria-expanded={Boolean(panelLibros)}
                onClick={() => {
                  if (!panelLibros) return abrirLibros(porColocar ? 'caja' : 'distribuidora');
                  sfx.play('papel');
                  setPanelLibros(null);
                }}
              >
                <PixelArt icono={LIBROS} />
                {porColocar > 0 && <span className="cf3-pizarra-btn__n">{porColocar}</span>}
              </button>
            )}
            {onVisitar && !decorando && !enTaller && (
              <button
                type="button"
                className="cf3-pizarra-btn cf3-ranking-btn"
                aria-label="Los cafés del barrio: ranking y visitas"
                aria-expanded={panelRanking}
                onClick={() => {
                  sfx.play('papel');
                  setPanelLibros(null);
                  setPanelCuaderno(false);
                  setPanelRanking((v) => !v);
                }}
              >
                <PixelArt icono={COPA} />
              </button>
            )}
            {abierto && local.pilar && !decorando && !enTaller && (
              <button
                type="button"
                className="cf3-pizarra-btn cf3-cuaderno-btn"
                aria-label={`El cuaderno de ${quien.nombre}: tareas a cambio de granos`}
                aria-expanded={panelCuaderno}
                onClick={() => {
                  sfx.play('papel');
                  setPanelLibros(null);
                  setPanelRanking(false);
                  setPanelCuaderno((v) => !v);
                }}
              >
                <PixelArt icono={CUADERNO} />
              </button>
            )}
            {plantaEscena === 'bodega' && !decorando && (
              <button type="button" className="cf3-pizarra-btn cf3-subir-btn" aria-label="Subir al café" onClick={() => pick.current('subir')}>
                <PixelArt icono={SUBIR} />
              </button>
            )}
          </div>
        </div>
      )}

      {notaHorno && abierto && !decorando && (
        <p key={notaHorno.n} ref={notaHornoEl} className="cf3-nota-horno" role="status">
          {notaHorno.ding && (
            <span className="cf3-nota-horno__ding" aria-hidden="true">
              ¡Ding!
            </span>
          )}
          {notaHorno.texto}
        </p>
      )}
      {guia && <GuiaCafe key={`${guia.capitulo}-${guia.repaso}`} raiz={raizCafe} pasos={guia.pasos} quien={quien} repaso={guia.repaso} onFin={() => setGuia(null)} />}
      {logro && !clienteAtendido && !enObrador && !enCaja && !decorando && !enTaller && <LogroCafe logro={logro} soundOn={soundOn} onCerrar={cerrarLogro} />}
      {decorando && (local?.nivel ?? 1) >= BODEGA_NIVEL && (
        <div className="cf3-plantas" role="group" aria-label="Qué planta decoras">
          {[
            ['calle', 'El café'],
            ['bodega', 'La bodega'],
          ].map(([id, nombre]) => (
            <button key={id} type="button" className="cf3-pestana" aria-pressed={plantaDecor === id} onClick={() => setPlantaDecor(id)}>
              {nombre}
            </button>
          ))}
        </div>
      )}
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
                <button
                  type="button"
                  className="cf3-btn"
                  onClick={() => {
                    sfx.play('soltar');
                    setSel(null);
                  }}
                >
                  Soltar
                </button>
              </div>
            ) : (
              <div className="cf3-balda__herr">
                <button type="button" className="cf3-btn cf3-btn--suave" onClick={cancelarDecorar} disabled={ocupado} data-atras>
                  Cancelar
                </button>
                <button type="button" className="cf3-btn cf3-btn--verde" onClick={guardar} disabled={ocupado} data-guia="listo">
                  {ocupado ? 'Guardando...' : 'Listo'}
                </button>
              </div>
            )}
          </div>
          {selItem ? (
            <p className="cf3-balda__ayuda">
              Arrástralo o toca una casilla libre para llevarlo allí.
              {(local?.nivel ?? 1) >= BODEGA_NIVEL ? ' Para bajarlo o subirlo, cambia de planta arriba y toca una casilla.' : ''}
            </p>
          ) : (
            <>
              <div className="cf3-balda__pestanas" role="tablist" aria-label="De dónde sacar muebles">
                <button type="button" role="tab" aria-selected={pestana === 'cafe'} className="cf3-pestana" onClick={() => setPestana('cafe')}>
                  Del café
                </button>
                <button type="button" role="tab" aria-selected={pestana === 'casa'} className="cf3-pestana" onClick={() => setPestana('casa')}>
                  De tu casa
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={pestana === 'tienda'}
                  className="cf3-pestana"
                  onClick={() => setPestana('tienda')}
                  data-nuevo={hayMuebleNuevo ? 'true' : undefined}
                >
                  Tienda
                  {hayMuebleNuevo && <Nuevo />}
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
                        aria-label={m.cerrado ? `${m.nombre}: ${m.cerrado}` : `Comprar ${m.nombre} por ${m.precio} granos${m.tienes ? ` (tienes ${m.tienes})` : ''}${nuevosTienda?.has(`mueble:${m.id}`) ? ', nuevo' : ''}`}
                        data-nuevo={nuevosTienda?.has(`mueble:${m.id}`) ? 'true' : undefined}
                      >
                        {nuevosTienda?.has(`mueble:${m.id}`) && <Nuevo />}
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
          tuyos={titulosTuyos}
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
      ) : panelRanking && onVisitar && !enTaller ? (
        <RankingCafes sfx={sfx} onVisitar={onVisitar} onCerrar={() => setPanelRanking(false)} />
      ) : panelCuaderno && local?.pilar && !enTaller ? (
        <CuadernoPilar
          local={local}
          sfx={sfx}
          onCambio={(r) => {
            if (r.libros) setLibrosCafe(r.libros);
            if (r.cafe) setLocal(r.cafe);
          }}
          onCerrar={() => setPanelCuaderno(false)}
        />
      ) : enTaller && taller ? (
        <Taller
          escena={ready && !sin3d ? api.current : null}
          estado={taller}
          dia={diaJuego}
          nombre={local?.nombre ?? null}
          soundOn={soundOn}
          ayudas={state.settings.ayudasCafe ?? 'auto'}
          nivel={nivelLocal}
          onHecho={(r) => {
            if (r.cafe) setLocal(r.cafe);
            if (r.dia) setDia(r.dia);
            if (r.libros) setLibrosCafe(r.libros);
            if (r.taller) setTaller(r.taller);
            setGanado((r.dado?.granos ?? 0) + (r.progreso?.granos ?? 0));
            if (hayLogro(r.progreso)) setLogro(r.progreso);
          }}
          onCerrar={() => setEnTaller(false)}
        />
      ) : enCaja && obradorHoy ? (
        <CajaMostrador
          escena={ready && !sin3d ? api.current : null}
          obrador={obradorHoy}
          dia={diaJuego}
          nivel={nivelLocal}
          soundOn={soundOn}
          ayudas={state.settings.ayudasCafe ?? 'auto'}
          onCobrado={(r) => {
            if (r.cafe) setLocal(r.cafe);
            if (r.obrador) setObradorDia((d) => ({ piden: [], ...d, obrador: r.obrador }));
            if (r.cobrado?.granos > 0) setGanado(r.cobrado.granos);
            if (r.cobrado?.hitos?.length) {
              sfx.play('hitoObrador');
              hitosCaja.current = r.cobrado.hitos;
            }
          }}
          onCerrar={() => {
            setEnCaja(false);
            const l = hitosCaja.current;
            hitosCaja.current = null;
            if (l) setAviso(HITOS_OBRADOR.frases[Math.max(...l) - 1] ?? '');
          }}
        />
      ) : enObrador && obradorDia ? (
        <Obrador
          escena={ready && !sin3d ? api.current : null}
          obrador={obradorDia.obrador}
          nivel={nivelLocal}
          soundOn={soundOn}
          ayudas={state.settings.ayudasCafe ?? 'auto'}
          especialidad={especialidad}
          granos={local?.granos ?? 0}
          dia={diaJuego}
          onObrador={(o) => setObradorDia((d) => ({ piden: [], ...d, obrador: o }))}
          onCafe={(cafe, cobrado) => {
            if (cafe) setLocal(cafe);
            if (cobrado?.granos > 0) setGanado(cobrado.granos);
            darHitos(cobrado?.hitos);
          }}
          onCerrar={() => setEnObrador(false)}
        />
      ) : tostando && local ? (
        <Tostadero
          escena={ready && !sin3d ? api.current : null}
          local={local}
          dia={diaJuego}
          soundOn={soundOn}
          ayudas={state.settings.ayudasCafe ?? 'auto'}
          nivel={nivelLocal}
          onRecogido={(c) => setLocal(c)}
          onCerrar={() => setTostando(false)}
        />
      ) : clienteAtendido ? (
        <Atender
          key={clienteAtendido.n}
          cliente={clienteAtendido}
          balda={deLaBalda}
          dominio={local?.dominio}
          obrador={obradorHoy}
          especialidad={especialidad}
          escena={ready && !sin3d ? api.current : null}
          registrarToque={registrarToque}
          soundOn={soundOn}
          ayudas={state.settings.ayudasCafe ?? 'auto'}
          nivel={local?.nivel ?? 1}
          carta={carta}
          nuevos={nuevos}
          onVisto={verNuevo}
          tazas={tazas}
          onServir={servir}
          onEmpezar={(n) => empezarInfluencer(diaJuego, n)}
          onCerrar={() => setAtendiendo(null)}
        />
      ) : (
        <div
          className={`cf3-franja${eligiendo || escaparate != null ? ' cf3-franja--nombres' : ''}`}
          role="region"
          aria-label={eligiendo ? 'El nombre de tu café' : escaparate != null ? 'El escaparate' : `${quien.nombre}, en el mostrador`}
        >
          {quienHabla && (
            <span className="cf3-quien" aria-hidden="true" data-quien={quien.id}>
              {quien.nombre}
            </span>
          )}
          <div className="cf3-caja">
            {abierto && quienHabla && !eligiendo && escaparate == null ? (
              <button
                type="button"
                className="cf3-retrato cf3-retrato--guia"
                data-quien={quien.id}
                data-guia="retrato"
                aria-label={`${quien.nombre}: que te enseñe los botones del café`}
                onClick={() => {
                  sfx.play(quien.sonido);
                  abrirGuia('local', { todos: true });
                }}
              >
                <PixelArt icono={quien.retrato(poseFranja)} />
                <span className="cf3-retrato__ayuda" aria-hidden="true">
                  ?
                </span>
              </button>
            ) : (
              <span className="cf3-retrato" data-aviso={quienHabla ? undefined : 'true'} data-quien={quienHabla ? quien.id : undefined}>
                <PixelArt icono={quienHabla ? quien.retrato(MOMENTO_OLMO.habla) : TAZA} />
              </span>
            )}
            <p className="cf3-dice" aria-live="polite">
              {quienHabla && <span className="px-sr">{quien.nombre}: </span>}
              {texto}
              {sigue && <span className="cf3-sigue" aria-hidden="true" />}
            </p>
            {escaparate != null ? (
              <>
                {leidosEscaparate.length ? (
                  <div className="cf3-nombres" role="group" aria-label="Tus leídos para el escaparate">
                    {leidosEscaparate.map((b) => (
                      <button
                        key={b.clave}
                        type="button"
                        aria-pressed={escaparate.includes(b.clave)}
                        className="cf3-nombre"
                        disabled={!escaparate.includes(b.clave) && escaparate.length >= ESCAPARATE_MAX}
                        onClick={() => marcarEscaparate(b.clave)}
                      >
                        {b.titulo}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="cf3-error">Aún no tienes libros leídos. Cuando termines uno, podrás ponerlo aquí.</p>
                )}
                {error && (
                  <p className="cf3-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="cf3-botones cf3-botones--fila">
                  <button type="button" className="cf3-btn cf3-btn--suave" onClick={() => setEscaparate(null)} disabled={ocupado} data-atras>
                    Ahora no
                  </button>
                  <button type="button" className="cf3-btn cf3-btn--verde" onClick={guardarEscaparate} disabled={ocupado}>
                    {ocupado ? 'Colocando...' : 'Poner en el escaparate'}
                  </button>
                </div>
              </>
            ) : eligiendo ? (
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
                  <button type="button" className="cf3-btn cf3-btn--suave" onClick={() => setEligiendo(false)} disabled={ocupado} data-atras>
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
                          <button type="button" className="cf3-btn cf3-btn--suave" onClick={empezarDecorar} data-nuevo={hayMuebleNuevo ? 'true' : undefined} data-guia="decorar">
                            Decorar
                            {hayMuebleNuevo && <Nuevo />}
                          </button>
                        )
                      ) : jornada && dia && clientesHoy.length ? (
                        <button type="button" className="cf3-btn cf3-btn--verde" onClick={otraJornada} disabled={ocupado}>
                          {ocupado ? 'Abriendo...' : 'Otra jornada'}
                        </button>
                      ) : (
                        <button type="button" className="cf3-btn cf3-btn--suave" onClick={hablar} data-guia="hablar">
                          Hablar con {quien.nombre}
                        </button>
                      )}
                      {pendientes.length ? (
                        <button type="button" className="cf3-btn cf3-btn--verde" onClick={() => atender(pendientes[0].n)} data-guia="atender">
                          Atender
                        </button>
                      ) : (
                        !sin3d && (
                          <button type="button" className="cf3-btn" onClick={empezarDecorar} data-nuevo={hayMuebleNuevo ? 'true' : undefined} data-guia="decorar">
                            Decorar
                            {hayMuebleNuevo && <Nuevo />}
                          </button>
                        )
                      )}
                    </>
                  )
                ) : hablando == null || aviso ? (
                  <button type="button" className="cf3-btn" onClick={hablar}>
                    Hablar con {quien.nombre}
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
                  <button
                    type="button"
                    className="cf3-btn"
                    onClick={() => {
                      sfx.play('pilar');
                      setHablando((k) => k + 1);
                    }}
                  >
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
