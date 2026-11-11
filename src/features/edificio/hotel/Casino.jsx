// El casino del sótano del Gran Hotel (1.80; paso C de docs/qa/gran-hotel.md §9.4, decisiones de Francisco del
// 2-11-2026). «Las 21 páginas»: un veintiuno contra el crupier con cartas-página, tres manos al día y SIN APOSTAR: cada
// mano da fichas (8 si ganas, 12 con veintiuna servida, 4 si empatas y 2 si pierdes; nunca se pierde nada), con un
// tope de 150 a la semana. Desde la 1.81 abre todos los días, leas o no (Francisco, 4-11-2026).
// Reparte y puntúa el servidor (supabase/migrations/20261110120000_hotel_casino.sql): aquí solo se ven tus cartas y la
// vista del crupier. Sin falsos «casi», sin cuentas atrás y sin «otra más»: al acabar la mano, el resultado y ya.
// Encargo de Francisco (3-11-2026, «que tenga más presencia, acorde a los colores de la sala y más videojuego»): arriba,
// la sala con el crupier que habla en un bocadillo; debajo, la mesa de juego de cerca, como en un videojuego: tapete
// verde con marco de latón y nogal, el marcador (fichas, garbanzos, semana y las tres manos como fichas de colores),
// cartas grandes que se reparten deslizándose, el total de cada uno en cifras de píxel, un cartel con el resultado y
// botones gruesos. Con movimiento reducido, sin animaciones; los sonidos, breves y solo con el sonido de la app activado.
// Tres pestañas: a solas, la mesa para dos (MesaParaDos.jsx), con un amigo y el mismo crupier, en diferido, y la caja
// (CajaCasino.jsx), donde las fichas se cambian por premios; la ventanilla de la sala también la abre.
import { useEffect, useRef, useState } from 'react';
import { dayKey } from '../../../domain/dates';
import { useCommunity } from '../../social/hooks/useCommunity';
import { canjearChisteras, elegirChistera, escucharMesas, girarRuleta, jugarCasino, loadCasino, loadChisteras, loadRuleta, loadVitrina, repartirCasino, salaPersonajes, verChisteras } from '../service';
import { ARMARIOS, PREMIOS_VITRINA, premioVitrina } from './vitrina';
import { DEFAULT_AVATAR } from '../actor';
import { createShopSfx } from '../shopAudio';
import { Carta, Huecos, PixelNum, Total } from './cartas21';
import { useCountUp } from './useCountUp';
import { CASINO, carta, fichasDe, FINAL, mesasQueEsperan } from './veintiuna';
import { CASINO_H, CASINO_W, renderCasino } from './casinoArt';
import { CajaCasino } from './CajaCasino';
import { MesaParaDos } from './MesaParaDos';
import { SITIOS } from './casinoLayout';
import { CASILLA_RARA, premioNombre } from './ruleta';
import { CHISTERAS_JUEGO, PREMIOS_CHISTERAS, SITIO, SITIO_CORTO, cambioDicho } from './chisteras';
import { catalogItem } from '../catalog';
import './casino3d.css';

/** 1.107 · Lo que aún no se juega en la sala (los bloques siguientes), dicho tal cual. Desde la 1.111, todo se juega. */
const PRONTO = {};
/** 1.111 · El nombre corto de cada armario de la vitrina, para sus pestañas. */
const ARMARIO_CORTO = ['La caja', 'Ruleta y lata', 'Chisteras y copas'];

const NOTE = {
  loading: 'Un momento, que bajamos al sótano…',
  'signed-out': 'Inicia sesión y activa la comunidad para bajar al casino.',
  'no-community': 'Activa la comunidad en tu perfil para bajar al casino.',
  soon: 'El casino aún está cerrado: abre muy pronto.',
};

// Lo que dice el crupier (frases cerradas; nunca empuja a jugar otra)
const DICE = {
  nueva: '¿Repartimos? Hoy tienes tres manos.',
  sigue: 'Cuando quieras, reparto la siguiente.',
  jugando: '¿Otra carta o te plantas?',
  veintiuna: '¡Veintiuna servida! Bien jugado.',
  ganada: 'Bien jugado: la mano es tuya.',
  empate: 'Empate. A partes iguales.',
  perdida: 'Esta vez, la casa. Las fichas son tuyas igual.',
  hecho: 'Por hoy cerramos la mesa. Mañana, más.',
  pareja: 'Mesa para dos: el mismo mazo y el mismo crupier para los dos.',
  caja: 'La caja está abierta: elige con calma, los precios no cambian.',
};

const CARTEL = { veintiuna: '¡Veintiuna!', ganada: '¡Ganas la mano!', empate: 'Empate', perdida: 'Gana la casa' };

/** Lo que dice cada ficha del marcador de manos. */
function manoDice(m, k, mesas) {
  if (!m) return `Mano ${k + 1}: por jugar`;
  const con = m.mesa ? ` con ${mesas.find((x) => x.id === m.mesa)?.amigo?.alias ?? 'un amigo'}` : '';
  if (m.estado === 'jugando') return `Mano ${k + 1}${con}: en juego`;
  if (m.estado === 'esperando') return `Mano ${k + 1}${con}: esperando`;
  return `Mano ${k + 1}${con}: ${FINAL[m.estado].toLowerCase()}, +${m.fichas}`;
}

const MIRAR_MS = 15000;

export function Casino({ onStreet, soundOn = false }) {
  const community = useCommunity({ autoload: true });
  const member = community.status === 'ready' && community.member;
  const [data, setData] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [modo, setModo] = useState('solo');
  // Cuántas cartas había antes de la última jugada (las nuevas entran deslizándose) y si la mano acaba de terminar
  const [antes, setAntes] = useState({ tuyas: Infinity, crupier: Infinity });
  const [recien, setRecien] = useState(false);
  const [sfx] = useState(() => createShopSfx({ muted: !soundOn }));
  useEffect(() => sfx.setMuted(!soundOn), [sfx, soundOn]);
  useEffect(() => () => sfx.destroy(), [sfx]);
  const root = useRef(null);
  const dia = dayKey();

  useEffect(() => {
    if (!member) return undefined;
    let alive = true;
    loadCasino(dia).then(
      (d) => {
        if (!alive) return;
        setData(d);
        // Si te espera una mesa, se entra directo a ella
        if (mesasQueEsperan(d?.mesas).length) setModo('pareja');
      },
      () => alive && setData(null),
    );
    return () => {
      alive = false;
    };
  }, [member, dia]);
  // Se mira cada poco si hay invitación o si el amigo ha jugado, y al momento con su toque o al volver a la app (lo que
  // llega tras una jugada tuya manda)
  const jugada = useRef(0);
  const guardar = (d) => {
    jugada.current += 1;
    setData(d);
  };
  useEffect(() => {
    if (!member) return undefined;
    const mirar = () => {
      if (document.hidden) return;
      const antes = jugada.current;
      loadCasino(dia).then(
        (d) => d && antes === jugada.current && setData(d),
        () => {},
      );
    };
    const t = setInterval(mirar, MIRAR_MS);
    const fuera = escucharMesas(mirar);
    document.addEventListener('visibilitychange', mirar);
    return () => {
      clearInterval(t);
      fuera();
      document.removeEventListener('visibilitychange', mirar);
    };
  }, [member, dia]);
  useEffect(() => {
    root.current?.scrollIntoView({ block: 'start' });
  }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onStreet();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onStreet]);

  // ── 1.107 · La sala en 3D (casino3d.js, se carga al entrar); sin WebGL, el dibujo isométrico de siempre ──
  const host = useRef(null);
  const api = useRef(null);
  const tagEls = useRef({});
  const mesaRef = useRef(null);
  const elegir = useRef(() => {});
  const [ready, setReady] = useState(false);
  const [sin3d, setSin3d] = useState(false);
  const [aviso, setAviso] = useState('');
  const [plano, setPlano] = useState(false);
  // 1.108 · Sentado a la mesa 3D; la mesa para dos que se está viendo y el personaje de cada amigo
  const [sentado, setSentado] = useState(false);
  const [vista, setVista] = useState(null);
  const [personajes, setPersonajes] = useState({});
  // 1.109 · Delante de la ruleta; la ruleta de la semana (undefined: cargando; null: sin la migración); girando; lo que tocó
  const [enRuleta, setEnRuleta] = useState(false);
  const [ruleta, setRuleta] = useState(undefined);
  const [girando, setGirando] = useState(false);
  const [tocado, setTocado] = useState(null);
  const [ruletaMsg, setRuletaMsg] = useState('');
  // 1.110 · Delante de las chisteras; la partida de hoy (undefined: cargando; null: sin la migración); en qué va la ronda
  // ('quieta', 'mirando', 'elegir', 'enseñando' o 'vista'), lo que salió en la última y lo que se dice a quien no ve la mesa
  const [enChisteras, setEnChisteras] = useState(false);
  const [chis, setChis] = useState(undefined);
  const [fase, setFase] = useState('quieta');
  const [ultima, setUltima] = useState(null);
  const [chisMsg, setChisMsg] = useState('');
  const [chisDice, setChisDice] = useState('');
  const elegirSitio = useRef(() => {});
  // 1.112 · Los sellos de las chisteras: si se ven sus premios, el mueble elegido para el acabado y lo que se dice al cambiar
  const [sellosAbiertos, setSellosAbiertos] = useState(false);
  const [paraAcabado, setParaAcabado] = useState('');
  const [sellosMsg, setSellosMsg] = useState('');
  const [cambiando, setCambiando] = useState(false);
  // 1.111 · Delante de la vitrina: la tuya (undefined: cargando; null: sin la migración), la de un amigo que se está viendo,
  // el armario y el premio que se mira de cerca
  const [enVitrina, setEnVitrina] = useState(false);
  const [vitrinaMia, setVitrinaMia] = useState(undefined);
  const [deAmigo, setDeAmigo] = useState(null);
  const [armario, setArmario] = useState(0);
  const [premioSel, setPremioSel] = useState(null);
  const [vitMsg, setVitMsg] = useState('');
  const elegirPremioRef = useRef(() => {});
  useEffect(() => {
    let alive = true;
    let mounted = null;
    import('./casino3d')
      .then(({ mountCasino }) => {
        if (!alive || !host.current) return;
        try {
          mounted = mountCasino(host.current, {
            onPick: (id) => elegir.current(id),
            onChistera: (k) => elegirSitio.current(k),
            onPremio: (id) => elegirPremioRef.current(id),
            onLost: () => alive && setSin3d(true),
            onFrame: (tags) => {
              const w = host.current?.clientWidth ?? 0;
              for (const [id, t] of Object.entries(tags)) {
                const el = tagEls.current[id];
                if (!el) continue;
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
        if (import.meta.env.DEV) window.__casino3d = mounted;
        setReady(true);
      })
      .catch(() => alive && setSin3d(true));
    return () => {
      alive = false;
      mounted?.destroy();
      api.current = null;
      if (import.meta.env.DEV && window.__casino3d === mounted) window.__casino3d = null;
    };
  }, []);
  useEffect(() => {
    // Lo que solo informa se va solo; lo que lleva botón se queda hasta que se toca otra cosa
    if (!aviso || aviso.boton) return undefined;
    const t = setTimeout(() => setAviso(''), 7000);
    return () => clearTimeout(t);
  }, [aviso]);

  let status = 'loading';
  if (['signed-out', 'off'].includes(community.status)) status = 'signed-out';
  else if (['unavailable', 'error'].includes(community.status)) status = 'soon';
  else if (community.status === 'ready' && !community.member) status = 'no-community';
  else if (member && data === null) status = 'soon';
  else if (member && data) status = 'ready';

  const abierta = status === 'ready';
  const room = sin3d ? renderCasino({ apagada: !abierta }) : null;
  // A solas: la última mano que no es de una mesa para dos
  const solo = (d) => d?.manos.filter((m) => !m.mesa).at(-1) ?? null;
  const mano = solo(data);
  const enJuego = Boolean(mano && mano.estado === 'jugando');
  const fichas = useCountUp(data?.fichas ?? 0);
  const garbanzos = useCountUp(data?.garbanzos ?? 0);
  // Lo que te espera en la mesa para dos: invitaciones y manos por jugar
  const teEsperan = mesasQueEsperan(data?.mesas);

  const run = async (fn) => {
    setBusy(true);
    setMsg('');
    setRecien(false);
    setAntes(enJuego ? { tuyas: mano.tuyas.length, crupier: mano.crupier.length } : { tuyas: 0, crupier: 0 });
    try {
      const next = await fn();
      guardar(next);
      sfx.play('deal');
      const ult = solo(next);
      if (ult && ult.estado !== 'jugando') {
        setRecien(true);
        setTimeout(() => sfx.play(`mano-${ult.estado}`), 180);
        if (ult.fichas > 0) setTimeout(() => sfx.play('chips'), 520);
        setMsg(`${FINAL[ult.estado]}: +${fichasDe(ult.fichas)}.`);
      }
    } catch (e) {
      setMsg(`No se ha podido: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };
  // 1.109 · La ruleta de la semana: se carga al llegar; la rueda, quieta donde se paró esta semana
  useEffect(() => {
    if (!member) return undefined;
    let alive = true;
    loadRuleta(dia).then(
      (r) => alive && setRuleta(r),
      () => alive && setRuleta(null),
    );
    return () => {
      alive = false;
    };
  }, [member, dia]);
  const ruedaPuesta = useRef(false);
  useEffect(() => {
    if (!ready || !ruleta || ruedaPuesta.current) return;
    ruedaPuesta.current = true;
    if (ruleta.giro) api.current?.ruedaEn(ruleta.giro.casilla);
  }, [ready, ruleta]);
  // Girar: el servidor decide y da el premio; la rueda gira hasta esa casilla y, cuando se para, se dice lo que tocó
  const girar = async () => {
    if (girando || !ruleta || ruleta.giro) return;
    setGirando(true);
    setRuletaMsg('');
    setTocado(null);
    sfx.play('flip');
    try {
      const r = await girarRuleta(dia);
      const g = r.giro;
      await api.current?.girar(g.casilla, Math.random() - 0.5);
      setRuleta(r);
      const c = r.casillas[g.casilla];
      setTocado({ ...g, nombre: premioNombre(c), tipo: c.tipo });
      sfx.play(g.casilla === CASILLA_RARA ? 'reveal-mistico' : c.tipo === 'fichas' || c.tipo === 'garbanzos' || g.repetido ? 'chips' : 'reveal-raro');
      loadCasino(dia).then((d) => d && guardar(d), () => {});
    } catch (e) {
      setRuletaMsg(`No se ha podido girar: ${e.message}`);
    } finally {
      setGirando(false);
    }
  };
  // 1.110 · Las chisteras: la partida de hoy se carga al llegar
  useEffect(() => {
    if (!member) return undefined;
    let alive = true;
    loadChisteras(dia).then(
      (c) => alive && setChis(c),
      () => alive && setChis(null),
    );
    return () => {
      alive = false;
    };
  }, [member, dia]);
  // Mirar la ronda: el servidor la baraja (otra vez, si ya se había mirado) y la mesa la enseña; después, a elegir
  const verRonda = async () => {
    if (!chis || fase === 'mirando' || fase === 'enseñando') return;
    setChisMsg('');
    setUltima(null);
    setFase('mirando');
    setChisDice('El conejo se mete en una chistera. Síguelo.');
    sfx.play('tap');
    try {
      const v = await verChisteras(dia);
      setChis(v);
      await api.current?.chisterasRonda(v.inicio, v.cambios, v.ronda, (k) => {
        sfx.play('flip');
        setChisDice(cambioDicho(k));
      });
      setFase('elegir');
      setChisDice('¿Dónde está el conejo?');
    } catch (e) {
      setFase('quieta');
      setChisDice('');
      setChisMsg(`No se ha podido: ${e.message}`);
    }
  };
  const elegirChis = async (k) => {
    if (fase !== 'elegir') return;
    setFase('enseñando');
    api.current?.chisterasElegible(false);
    sfx.play('tap');
    try {
      const r = await elegirChistera(dia, k);
      await api.current?.chisterasRevelar(k, r.conejo);
      setChis(r);
      setUltima(r);
      setFase('vista');
      setChisDice(r.acierto ? '¡Ahí estaba el conejo!' : `El conejo estaba en ${SITIO[r.conejo]}.`);
      sfx.play(r.acierto ? 'reveal-raro' : 'tap');
      if (r.estado === 'hecha') {
        if (r.fichas > 0) setTimeout(() => sfx.play('chips'), 420);
        loadCasino(dia).then((d) => d && guardar(d), () => {});
      }
    } catch (e) {
      setFase('elegir');
      api.current?.chisterasElegible(true);
      setChisMsg(`No se ha podido: ${e.message}`);
    }
  };
  useEffect(() => {
    elegirSitio.current = elegirChis;
  });
  // 1.111 · La vitrina: la tuya se carga al llegar y otra vez cuando ganas algo (fichas, giro o partida)
  useEffect(() => {
    if (!member) return undefined;
    let alive = true;
    loadVitrina().then(
      (v) => alive && setVitrinaMia(v),
      () => alive && setVitrinaMia(null),
    );
    return () => {
      alive = false;
    };
  }, [member, data?.fichas, data?.garbanzos, chis?.estado, chis?.tienda?.sellos, ruleta?.giro?.casilla]);
  const vitrinaVista = deAmigo ?? vitrinaMia ?? null;
  useEffect(() => {
    if (ready) api.current?.vitrina(vitrinaVista);
  }, [ready, vitrinaVista]);
  const elegirPremio = (id) => {
    setPremioSel(id);
    api.current?.elegirPremio(id);
    sfx.play('tap');
  };
  useEffect(() => {
    elegirPremioRef.current = elegirPremio;
  });
  const cambiarArmario = (k) => {
    setArmario(k);
    setPremioSel(null);
    api.current?.armario(k);
    sfx.play('tap');
  };
  const verAmigo = async (amigo) => {
    setVitMsg('');
    setPremioSel(null);
    api.current?.elegirPremio(null);
    if (!amigo) {
      setDeAmigo(null);
      return;
    }
    try {
      setDeAmigo(await loadVitrina(amigo.uid));
    } catch (e) {
      setVitMsg(`No se ha podido: ${e.message}`);
    }
  };
  const dejarVitrina = () => {
    setEnVitrina(false);
    setPremioSel(null);
    setDeAmigo(null);
    return api.current?.anteVitrina(false) ?? Promise.resolve();
  };
  const cambiarSellos = async (p) => {
    if (cambiando) return;
    setCambiando(true);
    setSellosMsg('');
    try {
      const r = await canjearChisteras(dia, p.id, p.tipo === 'acabado' ? paraAcabado : null);
      setChis(r);
      setSellosMsg(p.tipo === 'acabado' ? `Hecho: tu ${catalogItem(paraAcabado)?.nombre ?? 'mueble'} ya tiene «${p.nombre}».` : `¡${p.nombre}, tuyo! ${p.tipo === 'prenda' ? 'Ya está en tu armario.' : 'Ya está en tu inventario.'}`);
      setParaAcabado('');
    } catch (e) {
      setSellosMsg(`No se ha podido: ${e.message}`);
    } finally {
      setCambiando(false);
    }
  };
  const dejarChisteras = () => {
    if (fase === 'mirando' || fase === 'enseñando') return Promise.resolve();
    setSellosAbiertos(false);
    setSellosMsg('');
    setEnChisteras(false);
    // Una ronda a medio mirar se vuelve a barajar al volver (el servidor no la da por jugada)
    if (fase !== 'vista') setFase('quieta');
    setChisDice('');
    return api.current?.anteChisteras(false) ?? Promise.resolve();
  };
  const repartir = () => run(() => repartirCasino(dia));
  const jugar = (accion) => run(() => jugarCasino(dia, accion));
  const cambiar = (m) => {
    sfx.play('tap');
    // En la caja no se está sentado a la mesa
    if (m === 'caja') {
      setSentado(false);
      setEnRuleta(false);
      setEnChisteras(false);
      setEnVitrina(false);
      api.current?.sentarse(false);
    }
    setModo(m);
    setMsg('');
    setRecien(false);
    setAntes({ tuyas: Infinity, crupier: Infinity });
  };

  let dice = null;
  if (status === 'ready') {
    if (modo === 'caja') dice = DICE.caja;
    else if (enJuego) dice = DICE.jugando;
    else if (mano && recien) dice = DICE[mano.estado];
    else if (teEsperan.length) dice = `${teEsperan[0].amigo?.alias ?? 'Alguien'} te espera en la mesa para dos.`;
    else if (modo === 'pareja') dice = DICE.pareja;
    else if (data.quedan === 0) dice = DICE.hecho;
    else dice = data.manos.length ? DICE.sigue : DICE.nueva;
  }
  const place = (p) => ({ left: `${p.left * 100}%`, top: `${p.top * 100}%` });
  const semana = data ? Math.min(data.semana, data.tope) : 0;
  // 1.108 · La mano, sobre el paño de la mesa 3D: a solas, la tuya; en la mesa para dos, la que tienes abierta, con tu
  // amigo sentado al lado (sus cartas, boca abajo hasta que se resuelve). Las fichas de hoy, apiladas a tu lado.
  const hoyFichas = (data?.manos ?? []).reduce((a, m) => a + (m.fichas || 0), 0);
  const amigoUid = modo === 'pareja' ? vista?.amigo?.uid : null;
  // 1.109 · Tu compañero: si es el mapache crupier, te sigue por la sala (en volúmenes, casino3d.js)
  const yo = member ? community.userId : null;
  useEffect(() => {
    if (!yo || !ready) return;
    let alive = true;
    salaPersonajes([yo]).then(
      (r) => alive && api.current?.setCompanero(r[yo]?.companero ?? null),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [yo, ready]);
  useEffect(() => {
    if (!amigoUid || personajes[amigoUid] !== undefined) return;
    salaPersonajes([amigoUid]).then(
      (r) => setPersonajes((p) => ({ ...p, [amigoUid]: r[amigoUid]?.personaje ?? null })),
      () => setPersonajes((p) => ({ ...p, [amigoUid]: null })),
    );
  }, [amigoUid, personajes]);
  useEffect(() => {
    const a = api.current;
    if (!a || !ready) return;
    if (modo === 'pareja' && vista?.mia) {
      const juego = vista.estado === 'jugando';
      const suya = vista.suya ?? { estado: 'jugando', cartas: 2 };
      a.mano({
        id: `mesa-${vista.id}`,
        crupier: vista.crupier,
        tapada: juego,
        tuyas: vista.mia.tuyas,
        suyas: juego ? Array.from({ length: suya.cartas ?? 2 }, () => null) : (suya.tuyas ?? []),
        fichas: hoyFichas,
        amigo: personajes[vista.amigo?.uid] ?? DEFAULT_AVATAR,
      });
    } else if (mano) a.mano({ id: `solo-${mano.mano}`, crupier: mano.crupier, tapada: enJuego, tuyas: mano.tuyas, fichas: hoyFichas });
    else a.mano({ fichas: hoyFichas });
  }, [ready, modo, vista, mano, enJuego, hoyFichas, personajes]);
  // Lo que dice el crupier cambia sin que se mueva nada: un fotograma para colocarlo
  useEffect(() => {
    api.current?.invalidate();
  }, [dice, ready]);
  // Quien te espera en la mesa para dos se dice al momento, estés donde estés de la sala (el crupier solo habla de cerca)
  const avisadas = useRef(new Set());
  const espera = teEsperan.find((m) => !avisadas.current.has(m.id));
  useEffect(() => {
    if (!espera) return;
    avisadas.current.add(espera.id);
    setAviso({ texto: `${espera.amigo?.alias ?? 'Alguien'} te espera en la mesa para dos.`, boton: 'Ir a la mesa' });
  }, [espera]);

  // Tocar un sitio de la sala: se va andando y, al llegar, la mesa o la caja abren su panel; lo que aún no se juega lo dice
  // (la sala no se desplaza sola: el aviso lleva su botón para bajar al panel)
  const verMesa = () => {
    setAviso('');
    mesaRef.current?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  const levantarse = () => {
    setSentado(false);
    return api.current?.sentarse(false) ?? Promise.resolve();
  };
  const dejarRuleta = () => {
    if (girando) return Promise.resolve();
    setEnRuleta(false);
    setTocado(null);
    return api.current?.anteRuleta(false) ?? Promise.resolve();
  };
  useEffect(() => {
    elegir.current = (id) => {
      setAviso('');
      setPlano(false);
      sfx.play('tap');
      if (girando || fase === 'mirando' || fase === 'enseñando') return;
      const antes =
        sentado && id !== 'mesa'
          ? levantarse()
          : enRuleta && id !== 'ruleta'
            ? dejarRuleta()
            : enChisteras && id !== 'chisteras'
              ? dejarChisteras()
              : enVitrina && id !== 'vitrina'
                ? dejarVitrina()
                : Promise.resolve();
      antes
        .then(() => ((id === 'mesa' && sentado) || (id === 'ruleta' && enRuleta) || (id === 'chisteras' && enChisteras) || (id === 'vitrina' && enVitrina) ? null : api.current?.go(id)))
        .then(() => {
          if (id === 'mesa') {
            if (status !== 'ready') return;
            // Al llegar a la mesa, uno se sienta: el juego está en el propio paño
            if (modo === 'caja') cambiar('solo');
            setSentado(true);
            api.current?.sentarse(true);
          } else if (id === 'ruleta') {
            if (status !== 'ready') return;
            // La ruleta se gira a solas: delante de la rueda, con lo que puede tocar a la vista
            if (modo !== 'solo') cambiar('solo');
            setEnRuleta(true);
            api.current?.anteRuleta(true);
          } else if (id === 'chisteras') {
            if (status !== 'ready') return;
            // Las chisteras se juegan a solas, de pie delante de la mesa
            if (modo !== 'solo') cambiar('solo');
            setEnChisteras(true);
            api.current?.anteChisteras(true);
          } else if (id === 'vitrina') {
            if (status !== 'ready') return;
            // Se mira de pie, delante de los armarios; se empieza por el de la caja
            setEnVitrina(true);
            setPremioSel(null);
            api.current?.anteVitrina(true, armario);
          } else if (id === 'caja') {
            if (status !== 'ready') return;
            cambiar('caja');
            setAviso({ texto: 'La ventanilla está abierta: elige con calma, los precios no cambian.', boton: 'Ver la caja' });
          } else if (PRONTO[id]) setAviso({ texto: PRONTO[id] });
        });
    };
  });
  return (
    <section className="gh-casino" ref={root} aria-labelledby="gh-casino-title" data-escape-local="open" data-ready={ready ? 'true' : undefined}>
      <h3 className="px-sr" id="gh-casino-title">
        El casino del sótano
      </h3>
      {!sin3d && (
        <div className={abierta ? 'cs3' : 'cs3 is-off'}>
          <div className="cs3-stage" ref={host}>
            {!ready && <p className="cs3-loading">Bajando la escalera del sótano…</p>}
          </div>
          <div className="cs3-tags">
            {Object.entries(SITIOS).map(([id, s]) => (
              <button key={id} type="button" className={s.pronto ? 'cs3-tag is-pronto' : 'cs3-tag'} ref={(el) => (tagEls.current[id] = el)} data-off="true" onClick={() => elegir.current(id)}>
                {s.nombre}
                {s.pronto && <i>pronto</i>}
              </button>
            ))}
            <p className="cs3-dice" ref={(el) => (tagEls.current.dice = el)} data-off="true" data-vacio={dice ? undefined : 'true'}>
              {dice && (
                <>
                  <span className="px-sr">El crupier dice: </span>
                  {dice}
                </>
              )}
            </p>
          </div>
          {ready && !sentado && !enRuleta && !enChisteras && !enVitrina && (
            <button type="button" className="cs3-plano" aria-expanded={plano} onClick={() => setPlano((v) => !v)}>
              Plano
            </button>
          )}
          {plano && (
            <nav className="cs3-mapa" aria-label="Plano de la sala">
              {Object.entries(SITIOS).map(([id, s]) => (
                <button key={id} type="button" onClick={() => elegir.current(id)}>
                  {s.nombre}
                  {s.pronto && <i>pronto</i>}
                </button>
              ))}
            </nav>
          )}
          {sentado && abierta && (
            <div className="cs3-sit">
              <button type="button" className="cs3-levantarse" onClick={levantarse}>
                Levantarse
              </button>
              {modo === 'pareja' ? (
                <p className="cs3-sit__nota">
                  <span>{vista ? `Mesa para dos con ${vista.amigo?.alias ?? 'tu amigo'}` : 'Mesa para dos: elige con quién jugar.'}</span>
                  <button type="button" onClick={verMesa}>
                    {vista ? 'Jugar la mano' : 'Ver las mesas'}
                  </button>
                </p>
              ) : (
                <>
                  <div className="cs3-marcador" aria-hidden="true">
                    <p className="cs3-total">
                      <span>Crupier</span>
                      <PixelNum value={mano?.suyo ?? '?'} />
                    </p>
                    <p className="cs3-total is-tu">
                      <span>Tú</span>
                      <PixelNum value={mano?.tu ?? '?'} />
                    </p>
                  </div>
                  {mano && (
                    <>
                      <ul className="px-sr" aria-label={`Cartas del crupier${mano.suyo != null ? `: ${mano.suyo}` : ''}`}>
                        {mano.crupier.map((c, k) => (
                          <li key={k}>{carta(c).nombre}</li>
                        ))}
                        {enJuego && <li>Carta tapada</li>}
                      </ul>
                      <ul className="px-sr" aria-label={`Tus cartas: ${mano.tu}`}>
                        {mano.tuyas.map((c, k) => (
                          <li key={k}>{carta(c).nombre}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  {mano && recien && mano.estado !== 'jugando' && (
                    <p className={`gh-21__banner cs3-cartel is-${mano.estado}`}>
                      <b>{CARTEL[mano.estado]}</b>
                      <span>
                        <PixelNum value={`+${mano.fichas}`} label={`más ${fichasDe(mano.fichas)}`} />
                        <i aria-hidden="true" />
                      </span>
                    </p>
                  )}
                  <div className="cs3-acts">
                    {enJuego ? (
                      <>
                        <button type="button" className="gh-21btn is-hit" disabled={busy} onClick={() => jugar('pedir')}>
                          Pedir carta
                        </button>
                        <button type="button" className="gh-21btn is-stand" disabled={busy} onClick={() => jugar('plantarse')}>
                          Plantarse
                        </button>
                      </>
                    ) : data.quedan > 0 ? (
                      <button type="button" className="gh-21btn is-deal" disabled={busy} onClick={repartir}>
                        {`Repartir la mano ${CASINO.manos - data.quedan + 1} de ${CASINO.manos}`}
                      </button>
                    ) : (
                      <p className="gh-21__done">Hoy ya has jugado tus tres manos: el crupier vuelve a barajar mañana.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          {enRuleta && abierta && (
            <div className="cs3-sit cs3-rul">
              <button type="button" className="cs3-levantarse" disabled={girando} onClick={dejarRuleta}>
                Volver a la sala
              </button>
              {ruleta && (
                <section className="cs3-prob" aria-labelledby="cs3-prob-t">
                  <h4 id="cs3-prob-t">Lo que puede tocar</h4>
                  <ol>
                    {ruleta.casillas.map((c, k) => (
                      <li key={c.id} className={[k === CASILLA_RARA && 'is-rara', tocado?.casilla === k && 'is-tocado'].filter(Boolean).join(' ') || undefined}>
                        <span>
                          {premioNombre(c)}
                          {c.tienes && (
                            <i>
                              {" "}
                              ✓<span className="px-sr">, ya es tuyo</span>
                            </i>
                          )}
                        </span>
                        <b>{c.peso} %</b>
                      </li>
                    ))}
                  </ol>
                  <p>Si sale algo que ya tienes, te llevas {ruleta.repetido} fichas.</p>
                </section>
              )}
              {tocado && (
                <p className={`gh-21__banner cs3-cartel cs3-tocado${tocado.casilla === CASILLA_RARA ? ' is-rara' : ''}`}>
                  <b>{tocado.repetido ? 'Ya lo tenías' : '¡Te toca!'}</b>
                  <span>{tocado.repetido ? `${tocado.nombre}: te llevas ${tocado.fichas} fichas` : tocado.nombre}</span>
                </p>
              )}
              <div className="cs3-acts">
                {ruleta === undefined ? (
                  <p className="gh-21__done">Un momento…</p>
                ) : ruleta === null ? (
                  <p className="gh-21__done">La ruleta aún no gira: falta prepararla en el servidor.</p>
                ) : ruleta.giro && !girando ? (
                  <p className="gh-21__done">
                    {tocado ? 'Es tuyo: ya está en tu inventario.' : `Esta semana te tocó: ${premioNombre(ruleta.casillas[ruleta.giro.casilla])}.`} La ruleta vuelve a girar el lunes.
                  </p>
                ) : (
                  <button type="button" className="gh-21btn is-deal" disabled={girando} onClick={girar}>
                    {girando ? 'Girando…' : 'Girar la ruleta'}
                  </button>
                )}
                {ruletaMsg && <p className="gh-21__done">{ruletaMsg}</p>}
              </div>
              <p className="px-sr" role="status">
                {girando ? 'La ruleta está girando.' : tocado ? `La ruleta se ha parado: ${tocado.repetido ? `${tocado.nombre}, que ya tenías: ${tocado.fichas} fichas` : tocado.nombre}.` : ''}
              </p>
            </div>
          )}
          {enVitrina && abierta && (() => {
            const p = premioSel ? premioVitrina(premioSel) : null;
            const v = vitrinaVista;
            const tiene = (x) => Boolean(v) && (x.tipo === 'pila' || v.tienes.includes(x.id) || v.hitos.includes(x.id));
            const cuenta = PREMIOS_VITRINA.filter((x) => x.tipo !== 'pila');
            const ganados = cuenta.filter(tiene).length;
            const quien = deAmigo ? deAmigo.alias ?? 'Tu amigo' : null;
            return (
              <div className="cs3-sit cs3-vit">
                <button type="button" className="cs3-levantarse" onClick={dejarVitrina}>
                  Volver a la sala
                </button>
                <p className="cs3-vit__cuenta">
                  {quien ? `La vitrina de ${quien}` : 'Tu vitrina'}
                  <b>{v ? `${ganados} de ${cuenta.length}` : '—'}</b>
                </p>
                <div className="cs3-vit__armarios" role="group" aria-label="Armarios de la vitrina">
                  {ARMARIO_CORTO.map((n, k) => (
                    <button key={k} type="button" aria-pressed={armario === k} onClick={() => cambiarArmario(k)}>
                      {n}
                    </button>
                  ))}
                </div>
                <nav className="px-sr" aria-label={`Premios de ${ARMARIOS[armario].nombre.toLowerCase()}`}>
                  {ARMARIOS[armario].baldas.flat().map((x) => (
                    <button key={x.id} type="button" onClick={() => elegirPremio(x.id)}>
                      {`${x.nombre}: ${tiene(x) ? 'expuesto' : 'tapado'}`}
                    </button>
                  ))}
                </nav>
                <div className="cs3-vit__abajo">
                  {p ? (
                    <section className={`cs3-vit__ficha${tiene(p) ? ' is-tuyo' : ''}`} aria-live="polite">
                      <h4>{p.nombre}</h4>
                      <p>
                        {p.id === 'fichas'
                          ? `${v?.fichas ?? 0} fichas${quien ? '' : ' ahora mismo'}.`
                          : p.id === 'garbanzos'
                            ? `${v?.garbanzos ?? 0} garbanzos${quien ? '' : ' ahora mismo'}.`
                            : tiene(p)
                              ? quien
                                ? `Lo tiene ${quien}.`
                                : p.tipo === 'copa'
                                  ? 'Logrado: solo de adorno, para la vitrina.'
                                  : p.tipo === 'acabado'
                                    ? 'Es tuyo: lo luce un mueble de tu inventario.'
                                    : 'Es tuyo: expuesto aquí y en tu inventario.'
                              : `${quien ? 'Aún no lo tiene.' : 'Aún no.'} ${p.como}`}
                      </p>
                      <button type="button" onClick={() => elegirPremio(null)}>
                        Cerrar
                      </button>
                    </section>
                  ) : (
                    <p className="cs3-vit__nota">
                      {vitrinaMia === null
                        ? 'La vitrina aún no está lista: falta prepararla en el servidor.'
                        : vitrinaMia === undefined
                          ? 'Un momento…'
                          : 'Toca un premio para verlo de cerca. Lo que falta está bajo su paño.'}
                    </p>
                  )}
                  {vitrinaMia && (data.amigos?.length > 0 || deAmigo) && (
                    <div className="cs3-vit__amigos" role="group" aria-label="Ver la vitrina de un amigo">
                      {deAmigo ? (
                        <button type="button" onClick={() => verAmigo(null)}>
                          Volver a la mía
                        </button>
                      ) : (
                        data.amigos.slice(0, 3).map((a) => (
                          <button key={a.uid} type="button" onClick={() => verAmigo(a)}>
                            {`Ver la de ${a.alias}`}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  {vitMsg && <p className="cs3-vit__nota">{vitMsg}</p>}
                </div>
              </div>
            );
          })()}
          {enChisteras && abierta && (
            <div className="cs3-sit cs3-chis">
              <button type="button" className="cs3-levantarse" disabled={fase === 'mirando' || fase === 'enseñando'} onClick={dejarChisteras}>
                Volver a la sala
              </button>
              {chis && (
                <div className="cs3-chis__marcador">
                  <p>
                    {chis.estado === 'hecha' ? 'Partida de hoy' : `Ronda ${chis.ronda} de ${CHISTERAS_JUEGO.rondas}`}
                  </p>
                  <ol aria-label="Rondas de hoy">
                    {Array.from({ length: CHISTERAS_JUEGO.rondas }, (_, k) => {
                      const r = chis.rondas[k];
                      return (
                        <li key={k} className={r ? (r.acierto ? 'is-bien' : 'is-mal') : undefined}>
                          <span className="px-sr">{r ? `Ronda ${k + 1}: ${r.acierto ? 'acertada' : 'fallada'}` : `Ronda ${k + 1}: por jugar`}</span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
              {fase === 'vista' && ultima && (
                <p className={`gh-21__banner cs3-cartel cs3-chis__cartel ${ultima.acierto ? 'is-ganada' : 'is-empate'}`}>
                  <b>{ultima.estado === 'hecha' ? (ultima.aciertos === CHISTERAS_JUEGO.rondas ? '¡Partida perfecta!' : `${ultima.aciertos} de ${CHISTERAS_JUEGO.rondas}`) : ultima.acierto ? '¡Ahí estaba!' : 'Esta vez, no'}</b>
                  <span>
                    {ultima.estado === 'hecha' ? (
                      <PixelNum value={`+${ultima.fichas}`} label={`más ${fichasDe(ultima.fichas)}`} />
                    ) : ultima.acierto ? (
                      'Bien seguido.'
                    ) : (
                      `Estaba en ${SITIO[ultima.conejo]}.`
                    )}
                  </span>
                </p>
              )}
              <div className="cs3-acts">
                {chis === undefined ? (
                  <p className="gh-21__done">Un momento…</p>
                ) : chis === null ? (
                  <p className="gh-21__done">Las chisteras aún no se juegan: falta prepararlas en el servidor.</p>
                ) : fase === 'elegir' ? (
                  <div className="cs3-chis__elige" role="group" aria-label="¿Dónde está el conejo?">
                    {SITIO_CORTO.map((n, k) => (
                      <button key={k} type="button" className="gh-21btn is-deal" onClick={() => elegirChis(k)}>
                        {n}
                      </button>
                    ))}
                  </div>
                ) : fase === 'mirando' || fase === 'enseñando' ? (
                  <p className="gh-21__done">{fase === 'mirando' ? 'Sigue al conejo…' : 'A ver…'}</p>
                ) : chis.estado === 'hecha' ? (
                  <p className="gh-21__done">
                    {`Hoy: ${chis.aciertos} de ${CHISTERAS_JUEGO.rondas}, +${fichasDe(chis.fichas)}.`} Mañana, más chisteras.
                    {chis.perfectas > 0 && ` Partidas perfectas: ${chis.perfectas}.`}
                  </p>
                ) : (
                  <button type="button" className="gh-21btn is-deal" onClick={verRonda}>
                    {chis.estado ? `Ronda ${chis.ronda} de ${CHISTERAS_JUEGO.rondas}` : 'Empezar'}
                  </button>
                )}
                {chisMsg && <p className="gh-21__done">{chisMsg}</p>}
              </div>
              {chis?.tienda && (fase === 'quieta' || fase === 'vista') && !sellosAbiertos && (
                <button type="button" className="cs3-chis__sellosbtn" onClick={() => setSellosAbiertos(true)}>
                  {`Premios · ${chis.tienda.sellos} ${chis.tienda.sellos === 1 ? 'sello' : 'sellos'}`}
                </button>
              )}
              {chis?.tienda && sellosAbiertos && (
                <section className="cs3-chis__sellos" aria-label="Premios de las chisteras">
                  <h4>{`Tus sellos: ${chis.tienda.sellos}`}</h4>
                  <p>Cada partida perfecta (tres de tres) es un sello. Se cambian aquí, cada premio una vez. Nunca con dinero ni tickets.</p>
                  <ul>
                    {PREMIOS_CHISTERAS.map((p) => {
                      const tienes = chis.tienda.premios.find((x) => x.id === p.id)?.tienes;
                      const falta = p.sellos - chis.tienda.sellos;
                      const sinMueble = p.tipo === 'acabado' && !chis.tienda.acabables.length;
                      return (
                        <li key={p.id} className={tienes ? 'is-tuyo' : undefined}>
                          <div>
                            <b>{p.nombre}</b>
                            <small>{p.texto}</small>
                            {p.tipo === 'acabado' && !tienes && falta <= 0 && (
                              sinMueble ? (
                                <small>Necesitas una copia lisa guardada de un mueble que admita acabado.</small>
                              ) : (
                                <label>
                                  <span className="px-sr">Mueble para el acabado</span>
                                  <select value={paraAcabado} onChange={(e) => setParaAcabado(e.target.value)}>
                                    <option value="">Elige un mueble…</option>
                                    {chis.tienda.acabables.map((id) => (
                                      <option key={id} value={id}>
                                        {catalogItem(id)?.nombre ?? id}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              )
                            )}
                          </div>
                          {tienes ? (
                            <span className="cs3-chis__tuyo">Es tuyo</span>
                          ) : (
                            <button
                              type="button"
                              disabled={falta > 0 || cambiando || (p.tipo === 'acabado' && !paraAcabado)}
                              aria-label={falta > 0 ? `${p.nombre}: te faltan ${falta} sellos` : `Cambiar ${p.sellos} sellos por ${p.nombre}`}
                              onClick={() => cambiarSellos(p)}
                            >
                              {`${p.sellos} sellos`}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {sellosMsg && <p className="cs3-chis__sellosmsg" role="status">{sellosMsg}</p>}
                  <button type="button" className="cs3-chis__cerrar" onClick={() => { setSellosAbiertos(false); setSellosMsg(''); }}>
                    Cerrar
                  </button>
                </section>
              )}
              {chis && !chis.estado && fase === 'quieta' && !sellosAbiertos && (
                <p className="cs3-chis__reglas">
                  Tres rondas, cada una más rápida. Aciertas 0, 1, 2 o 3: {CHISTERAS_JUEGO.premios.join(', ')} fichas (dentro del tope de {chis.tope} a la semana).
                </p>
              )}
              <p className="px-sr" role="status" aria-live="polite">
                {chisDice}
              </p>
            </div>
          )}
          <div className="cs3-avisos" role="status">
            {aviso && (
              <p className="cs3-aviso">
                <span>{aviso.texto}</span>
                {aviso.boton && (
                  <button type="button" onClick={verMesa}>
                    {aviso.boton}
                  </button>
                )}
              </p>
            )}
          </div>
        </div>
      )}
      {sin3d && (
      <div className={abierta ? 'gh-casino__scene' : 'gh-casino__scene is-off'} style={{ aspectRatio: `${CASINO_W} / ${CASINO_H}` }}>
        <img
          className="gh-casino__art"
          src={room.scene}
          alt={
            abierta
              ? 'El casino del sótano, de noche: moqueta roja con rombos dorados, papel pintado verde, una lámpara de flecos sobre la mesa de tapete verde, el crupier con chaleco, pajarita y visera, un rótulo de neón «21» y la ventanilla de la caja con su reja.'
              : 'El casino del sótano, en penumbra: la mesa de tapete verde y el crupier, con las luces apagadas.'
          }
          draggable="false"
        />
        {modo === 'caja' && <img className="gh-casino__outline" src={room.outlines.caja} alt="" aria-hidden="true" draggable="false" />}
        {dice && (
          <p className="gh-casino__say" style={place(room.at.cabeza)} key={dice}>
            <span className="px-sr">El crupier dice: </span>
            {dice}
          </p>
        )}
        {status === 'ready' && (
          <button type="button" className="gh-spot is-caja" style={place(room.at.caja)} aria-pressed={modo === 'caja'} onClick={() => cambiar(modo === 'caja' ? 'solo' : 'caja')}>
            Caja
          </button>
        )}
      </div>
      )}

      {/* La mesa de juego, de cerca */}
      <div className={abierta ? 'gh-21' : 'gh-21 is-off'} ref={mesaRef}>
        {status !== 'ready' ? (
          <p className="gh-21__note">{NOTE[status]}</p>
        ) : (
          <>
            <div className="gh-21__hud">
              <div className="gh-21__purse">
                <p className="gh-21__chips">
                  <i aria-hidden="true" />
                  <PixelNum value={fichas} label={`${data.fichas} fichas`} />
                  <span aria-hidden="true">fichas</span>
                </p>
                <p className="gh-21__chips is-beans">
                  <i aria-hidden="true" />
                  <PixelNum value={garbanzos} label={`${data.garbanzos} garbanzos`} />
                  <span aria-hidden="true">garbanzos</span>
                </p>
              </div>
              <div className="gh-21__week">
                <span>
                  Semana {semana}/{data.tope}
                </span>
                <span className="gh-21__bar" role="progressbar" aria-label="Fichas de esta semana" aria-valuemin={0} aria-valuemax={data.tope} aria-valuenow={semana}>
                  <span style={{ width: `${(semana / data.tope) * 100}%` }} />
                </span>
              </div>
              <ol className="gh-21__hands" aria-label="Tus manos de hoy">
                {Array.from({ length: CASINO.manos }, (_, k) => {
                  const m = data.manos[k];
                  return (
                    <li key={k} className={m ? `is-${m.estado}${m.mesa ? ' is-pair' : ''}` : ''}>
                      <span className="px-sr">{manoDice(m, k, data.mesas)}</span>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="gh-21__modes" role="group" aria-label="Cómo jugar">
              <button type="button" aria-pressed={modo === 'solo'} onClick={() => cambiar('solo')}>
                A solas
              </button>
              <button type="button" aria-pressed={modo === 'pareja'} onClick={() => cambiar('pareja')}>
                Con un amigo
                {teEsperan.length > 0 && (
                  <b className="gh-21__badge" aria-label={`${teEsperan.length} te ${teEsperan.length === 1 ? 'espera' : 'esperan'}`}>
                    {teEsperan.length}
                  </b>
                )}
              </button>
              <button type="button" aria-pressed={modo === 'caja'} onClick={() => cambiar('caja')}>
                La caja
              </button>
            </div>

            {modo === 'caja' ? (
              <CajaCasino data={data} dia={dia} onData={guardar} sfx={sfx} />
            ) : modo === 'pareja' ? (
              <MesaParaDos data={data} dia={dia} onData={guardar} sfx={sfx} onVista={setVista} />
            ) : !sin3d ? (
              <>
                {!sentado && (
                  <div className="gh-21__sit">
                    <p>La partida se juega en la mesa de la sala, sentado frente al crupier.</p>
                    <button type="button" className="gh-21btn is-deal" onClick={() => elegir.current('mesa')}>
                      Sentarse a la mesa
                    </button>
                  </div>
                )}
                <p className="gh-21__msg" role="status" aria-live="polite">
                  {msg}
                </p>
              </>
            ) : (
              <>
                <div className="gh-21__felt">
                  <div className="gh-21__row is-crupier">
                    <Total who="Crupier" value={mano ? mano.suyo : null} />
                    {mano ? (
                      <ul className="gh-21__cards" aria-label={`Cartas del crupier${mano.suyo != null ? `: ${mano.suyo}` : ''}`}>
                        {mano.crupier.map((c, k) => (
                          <Carta key={`${mano.mano}-c${k}`} c={c} k={k} nueva={k >= antes.crupier} />
                        ))}
                        {enJuego && <Carta tapada k={1} nueva={antes.crupier === 0} />}
                      </ul>
                    ) : (
                      <Huecos />
                    )}
                  </div>

                  <div className="gh-21__middle">
                    {mano && recien && mano.estado !== 'jugando' ? (
                      <p className={`gh-21__banner is-${mano.estado}`}>
                        <b>{CARTEL[mano.estado]}</b>
                        <span>
                          <PixelNum value={`+${mano.fichas}`} label={`más ${fichasDe(mano.fichas)}`} />
                          <i aria-hidden="true" />
                        </span>
                      </p>
                    ) : (
                      <svg className="gh-21__motto" viewBox="0 0 300 40" aria-hidden="true">
                        <path id="gh-21-arc" d="M 20 6 Q 150 46 280 6" fill="none" />
                        <text>
                          <textPath href="#gh-21-arc" startOffset="50%" textAnchor="middle">
                            LAS 21 PÁGINAS
                          </textPath>
                        </text>
                      </svg>
                    )}
                  </div>

                  <div className="gh-21__row is-tuyas">
                    {mano ? (
                      <ul className="gh-21__cards" aria-label={`Tus cartas: ${mano.tu}`}>
                        {mano.tuyas.map((c, k) => (
                          <Carta key={`${mano.mano}-t${k}`} c={c} k={k} nueva={k >= antes.tuyas} />
                        ))}
                      </ul>
                    ) : (
                      <Huecos />
                    )}
                    <Total who="Tú" value={mano ? mano.tu : null} />
                  </div>
                </div>

                <div className="gh-21__acts">
                  {enJuego ? (
                    <>
                      <button type="button" className="gh-21btn is-hit" disabled={busy} onClick={() => jugar('pedir')}>
                        Pedir carta
                      </button>
                      <button type="button" className="gh-21btn is-stand" disabled={busy} onClick={() => jugar('plantarse')}>
                        Plantarse
                      </button>
                    </>
                  ) : data.quedan > 0 ? (
                    <button type="button" className="gh-21btn is-deal" disabled={busy} onClick={repartir}>
                      {`Repartir la mano ${CASINO.manos - data.quedan + 1} de ${CASINO.manos}`}
                    </button>
                  ) : (
                    <p className="gh-21__done">Hoy ya has jugado tus tres manos: el crupier vuelve a barajar mañana.</p>
                  )}
                </div>
                <p className="gh-21__msg" role="status" aria-live="polite">
                  {msg}
                </p>
              </>
            )}
            <details className="gh-21__rules">
              <summary>Cómo se juega</summary>
              <p>
                Pide cartas para acercarte a 21 sin pasarte (el as vale 1 u 11; las figuras, 10) y plántate cuando quieras. El crupier pide hasta llegar a 17. Contra el crupier no se apuesta nada:
                ganar da {CASINO.ganada} fichas, una veintiuna servida {CASINO.veintiuna}, empatar {CASINO.empate} y perder {CASINO.perdida}. Como mucho, {CASINO.tope} fichas a la semana.
              </p>
              <p>
                Con un amigo (os seguís los dos) jugáis contra el mismo crupier y el mismo mazo, cada uno cuando quiera; esas manos son de tus tres del día y dan {CASINO.compania} fichas más de
                compañía. Entre los dos podéis apostar, una mesa al día, hasta {CASINO.apuestaFichas} fichas y {CASINO.apuestaGarbanzos} garbanzos: se lo lleva quien acabe más cerca de 21 sin
                pasarse, y si empatáis se devuelve.
              </p>
              <p>
                Después podéis seguir con mesas de garbanzos, hasta {CASINO.mesasGarbanzos} al día: no gastan manos ni dan fichas. Los garbanzos no se compran: {CASINO.garbanzosInicio} al empezar y{' '}
                {CASINO.garbanzosDia} más cada día que juegas. Se gastan en la lata de la caja.
              </p>
            </details>
          </>
        )}
      </div>
    </section>
  );
}
