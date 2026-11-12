// La sala de lectura del Gran Hotel (1.83, docs/qa/gran-hotel.md §9.5): la versión física del temporizador y de «leer en
// compañía». Te sientas en un sillón, empieza tu sesión y ves a quien lee a la vez, con su personaje y su compañero. El
// reloj es el de la app (useReadingTimer) y la presencia, la del salón (reading_presence), con la misma elección de qué
// compartir. Al acabar la sesión se apuntan las páginas con el formulario de la bandeja. Lo que solo pasa aquí: saludar a
// quien lee contigo, saber con quién has leído y, si terminas un libro, dejar su lomo en la librería común.
// 1.116 (docs/qa/sala-lectura-3d.md, bloque a): la sala es una biblioteca en 3D (`sala3d.js`, se carga al entrar) que se
// recorre andando; tu sillón te espera con tu libro en la mesita y, al sentarte, lo tienes abierto delante; el reloj de pie
// es el del Pomodoro y la librería común son lomos de verdad en sus baldas. Sin WebGL, el dibujo isométrico de siempre.
// 1.117 (bloque b): la cita de lectura con un amigo (`CitaSala`, `useCitaSala`): os sentáis en el sofá para dos, el reloj
// lo pone el servidor y, al acabar, la sala dice cuántos minutos habéis leído juntos.
// 1.118 (bloque c): los gestos cerrados (`gestos.js`) entre quienes leen a la vez y con tu amigo en la cita, y la placa
// del sofá por pareja, sin rachas: se ve en el respaldo y, al terminar un libro leyendo juntos, se puede apuntar en ella.
import { useEffect, useMemo, useRef, useState } from 'react';
import { SessionReport } from '../../../components/panels/PomodoroTray';
import { currentBook, spineColor } from '../../../domain/books';
import { useLibrary } from '../../../state/useLibrary';
import { SeatChoice } from '../../social/components/SeatChoice';
import { seatParticipants, sessionMinutes } from '../../social/connections';
import { useCommunity } from '../../social/hooks/useCommunity';
import { sitDownNow, standUpNow, usePresence } from '../../social/hooks/usePresence';
import { fetchProfiles } from '../../social/services/community';
import { preloadCover } from '../../pisoLab/coverPreload';
import { DEFAULT_AVATAR } from '../actor';
import { misticoOf, misticoSprite } from '../misticos';
import { renderActorThumb } from '../render';
import { dejarLomo, localAvatar, retirarLomo, salaGesto, salaGestosNuevos, salaLibreria, salaPersonajes, saludarEnSala } from '../service';
import { renderSala, SALA_H, SALA_W, SILLONES } from './salaArt';
import { PLAZA_SOFA, SILLONES as SILLONES_3D, repartoSillones } from './salaLayout';
import { CitaSala, FilaGestos, faseCita, nombreCita } from './CitaSala';
import { gestoDe, tiempoJuntos } from './gestos';
import { useCitaSala } from './useCitaSala';
import { SalaLibreria } from './SalaLibreria';
import './sala3d.css';

const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const SALUDO_MS = 15000;
const SALUDO_VISIBLE_MS = 10000;
const lista = (nombres) => (nombres.length < 2 ? nombres.join('') : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`);

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Tu sillón de la sala, recordado en este dispositivo (1.116): el primero en el que te sientas pasa a ser el tuyo
const sillonKey = (uid) => `bookshelf:sala-sillon:${uid ?? 'local'}`;
function leerSillon(uid) {
  try {
    const v = Number(localStorage.getItem(sillonKey(uid)));
    return Number.isInteger(v) && v >= 0 && v < SILLONES_3D.length && localStorage.getItem(sillonKey(uid)) !== null ? v : null;
  } catch {
    return null;
  }
}
function guardarSillon(uid, k) {
  try {
    localStorage.setItem(sillonKey(uid), String(k));
  } catch {
    /* sin almacenamiento: se sienta igual */
  }
}

// Más pequeño que en el muelle: en la sala hay seis sillones y no debe tapar a quien lee
const PAL = 0.7;

/** El compañero de quien lee, vivo en el suelo junto a su sillón. Con movimiento reducido, quieto. */
function Companero({ id, pie }) {
  const host = useRef(null);
  useEffect(() => {
    const sprite = misticoSprite(id);
    const { canvas, ax, ay } = sprite;
    canvas.className = 'gh-lect__pal';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.left = `${((pie.x - ax * PAL) / SALA_W) * 100}%`;
    canvas.style.top = `${((pie.y - ay * PAL) / SALA_H) * 100}%`;
    canvas.style.width = `${((canvas.width * PAL) / SALA_W) * 100}%`;
    host.current.append(canvas);
    if (reducedMotion()) {
      sprite.paint(1.3);
      return () => canvas.remove();
    }
    let raf = 0;
    let last = 0;
    const t0 = performance.now();
    const tick = (now) => {
      if (now - last > 80) {
        last = now;
        sprite.paint((now - t0) / 1000);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      canvas.remove();
    };
  }, [id, pie.x, pie.y]);
  return <span ref={host} className="gh-lect__palhost" />;
}

/** La cara del personaje, para la lista de quien lee. */
function Cara({ avatar }) {
  const src = useMemo(() => renderActorThumb(avatar, { frame: 'head', size: 40 }).toDataURL(), [avatar]);
  return <img className="gh-lect__cara" src={src} alt="" draggable="false" />;
}

export function SalaLectura({ onStreet, timer, askPages = false, onPagesDone = () => {}, onOpenCalendar = () => {} }) {
  const { state, actions } = useLibrary();
  const community = useCommunity({ autoload: true });
  const enabled = community.status === 'ready' && community.member;
  const { rows, me, failure } = usePresence({ enabled, userId: community.userId });
  const [profiles, setProfiles] = useState({});
  const [aspectos, setAspectos] = useState({});
  const [libreria, setLibreria] = useState(null);
  const [oferta, setOferta] = useState(null);
  const [saludados, setSaludados] = useState([]);
  // El último gesto que te ha llegado: { de, gesto }
  const [gesto, setGesto] = useState(null);
  const saludo = gesto?.de ?? null;
  // Si el servidor ya tiene los gestos nuevos (sin su migración, solo «¡Hola!»)
  const [conLista, setConLista] = useState(true);
  const [gestosDe, setGestosDe] = useState(null);
  const [gestosSofa, setGestosSofa] = useState(false);
  const [ofertaPlaca, setOfertaPlaca] = useState(null);
  const [leidoCon, setLeidoCon] = useState([]);
  const pidiendo = useRef(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef(null);
  const book = currentBook(state.books, state.settings);
  const { seated, extra } = seatParticipants(rows, community.userId, SILLONES.length);
  const ids = seated.map((r) => r.user_id).join(',');
  const aspecto = (r) => aspectos[r.user_id]?.personaje ?? (r.user_id === community.userId ? localAvatar(r.user_id) : null) ?? DEFAULT_AVATAR;
  const enSesion = timer.running || timer.remaining < timer.total;
  // La duración de la sesión la eliges tú (Francisco, 11-11-2026): es el mismo ajuste que el Pomodoro de la app
  const minutos = state.settings.focusMinutes;
  const ponerMinutos = (m) => actions.setSettings({ focusMinutes: Math.max(5, Math.min(120, m)) });

  // ── 1.116 · La sala en 3D; sin WebGL, el dibujo isométrico de siempre ──
  const host = useRef(null);
  const api = useRef(null);
  const tagEls = useRef({});
  const pick = useRef(() => {});
  const pickLomo = useRef(() => {});
  const [ready, setReady] = useState(false);
  const [sin3d, setSin3d] = useState(false);
  const [aviso, setAviso] = useState('');
  const [plano, setPlano] = useState(false);
  const [sentado3d, setSentado3d] = useState(null); // el sillón en el que está sentada la cámara
  const [enLibreria, setEnLibreria] = useState(false);
  const [lomoSel, setLomoSel] = useState(null);
  const [mio, setMio] = useState(() => leerSillon(community.userId));
  useEffect(() => setMio(leerSillon(community.userId)), [community.userId]);
  // ── 1.117 · La cita de lectura: tu plaza del sofá (la 6 si invitaste, la 7 si viniste) y la del otro ──
  const cita = useCitaSala(enabled);
  const miCita = cita.mia;
  const [, setTicSofa] = useState(0);
  const fase = faseCita(miCita, cita.ahora());
  const citaViva = miCita?.estado === 'aceptada' && (fase === 'espera' || fase === 'leyendo');
  const miPlaza = miCita?.soy === 'anfitrion' ? PLAZA_SOFA : PLAZA_SOFA + 1;
  const suPlaza = miPlaza === PLAZA_SOFA ? PLAZA_SOFA + 1 : PLAZA_SOFA;
  const enSofa = sentado3d != null && sentado3d >= PLAZA_SOFA;
  const otroAqui = citaViva && fase === 'leyendo' && Boolean(miCita.otro_aqui);
  // En los sillones, quien lee menos quien está en el sofá
  const enSillones = seated.filter((r) => !(enSofa && r.user_id === community.userId) && !(otroAqui && r.user_id === miCita.uid));
  const reparto = repartoSillones(
    enSillones.map((r) => r.user_id),
    community.userId,
    mio,
  );
  const ocupado = (k) => [...reparto.entries()].some(([id, s]) => s === k && id !== community.userId);
  const libreDesde = (k) => {
    for (let n = 0; n < SILLONES_3D.length; n += 1) {
      const s = (k + n) % SILLONES_3D.length;
      if (!ocupado(s)) return s;
    }
    return null;
  };
  // El sillón que se ofrece: el tuyo si está libre; si no, el primero libre
  const ofrecido = mio != null && !ocupado(mio) ? mio : libreDesde(mio ?? 0);
  const room = sin3d ? renderSala(seated.map(aspecto)) : null;

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
  useEffect(() => {
    let alive = true;
    let mounted = null;
    import('./sala3d')
      .then(({ mountSala }) => {
        if (!alive || !host.current) return;
        try {
          mounted = mountSala(host.current, {
            onPick: (id) => pick.current(id),
            onLomo: (id) => pickLomo.current(id),
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
        if (import.meta.env.DEV) window.__sala3d = mounted;
        setReady(true);
      })
      .catch(() => alive && setSin3d(true));
    return () => {
      alive = false;
      mounted?.destroy();
      api.current = null;
      if (import.meta.env.DEV && window.__sala3d === mounted) window.__sala3d = null;
    };
  }, []);
  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(''), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  useEffect(() => {
    if (!enabled || !ids) return undefined;
    let alive = true;
    fetchProfiles(ids.split(',')).then(
      (p) => alive && setProfiles((antes) => ({ ...antes, ...p })),
      () => {},
    );
    salaPersonajes(ids.split(',')).then(
      (a) => alive && setAspectos((antes) => ({ ...antes, ...a })),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [enabled, ids]);

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    salaLibreria().then(
      (l) => alive && setLibreria(l),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [enabled]);
  // El aspecto de tu amigo, para verlo a tu lado en el sofá
  const amigoUid = otroAqui ? miCita.uid : null;
  useEffect(() => {
    if (!amigoUid || aspectos[amigoUid]) return undefined;
    let alive = true;
    salaPersonajes([amigoUid]).then(
      (a) => alive && setAspectos((antes) => ({ ...antes, ...a })),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [amigoUid, aspectos]);
  // Esperando en el sofá a que empiece: la cuenta va al segundo (y, al llegar la hora, arranca el reloj de los dos)
  const esperaSofa = enSofa && fase === 'espera';
  useEffect(() => {
    if (!esperaSofa) return undefined;
    const t = setInterval(() => setTicSofa((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [esperaSofa]);
  // El reloj de la cita es uno para los dos: lo pone el servidor y acaba a la vez aunque llegues tarde
  const arrancada = useRef(null);
  const leyendoSofa = enSofa && fase === 'leyendo';
  useEffect(() => {
    if (!leyendoSofa || arrancada.current === miCita.cita) return;
    arrancada.current = miCita.cita;
    timer.reset();
    timer.startFor(Math.max(1000, miCita.fin - cita.ahora()) / 60000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leyendoSofa, miCita?.cita]);
  // El latido: mientras estás en el sofá con la app a la vista, dentro del reloj de la cita
  useEffect(() => {
    if (!leyendoSofa) return undefined;
    const id = miCita.cita;
    const latir = () => {
      if (!document.hidden) cita.latido(id);
    };
    latir();
    const t = setInterval(latir, 30000);
    document.addEventListener('visibilitychange', latir);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', latir);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leyendoSofa, miCita?.cita]);
  // Con quién has leído: quien ha estado en la sala mientras tú seguías sentado
  const sentado = Boolean(me);
  useEffect(() => {
    if (!sentado || !ids) return;
    const otros = ids.split(',').filter((id) => id !== community.userId);
    setLeidoCon((antes) => (otros.every((id) => antes.includes(id)) ? antes : [...new Set([...antes, ...otros])]));
  }, [sentado, ids, community.userId]);
  // Quien te hace un gesto: se mira mientras estás sentado (con la migración de la sala) o en tu cita con un amigo
  const conSaludos = sentado && Boolean(libreria);
  const conGestos = conSaludos || citaViva;
  useEffect(() => {
    if (!conGestos) return undefined;
    let alive = true;
    const mirar = () =>
      salaGestosNuevos().then(
        (r) => {
          if (!alive) return;
          setConLista(r.gestos);
          if (r.lista.length > 0) setGesto(r.lista[0]);
        },
        () => {},
      );
    mirar();
    const cada = setInterval(mirar, SALUDO_MS);
    // Al volver a la app, se mira enseguida
    const alVolver = () => !document.hidden && mirar();
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      alive = false;
      clearInterval(cada);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [conGestos]);
  useEffect(() => {
    if (!gesto) return undefined;
    const fuera = setTimeout(() => setGesto(null), SALUDO_VISIBLE_MS);
    return () => clearTimeout(fuera);
  }, [gesto]);
  useEffect(() => {
    if (!enSofa) setGestosSofa(false);
  }, [enSofa]);
  useEffect(() => {
    if (askPages) pidiendo.current ??= new Date().toISOString();
  }, [askPages]);

  // ── Lo que ve la sala 3D: quien lee, tu libro, los lomos y el reloj ──
  const amigoSofa = otroAqui ? { user_id: miCita.uid } : null;
  // En el sofá la vista va por detrás: te ves sentada a ti también, con tu libro
  const yoSofa = enSofa ? { user_id: community.userId } : null;
  const lectoresKey = JSON.stringify([
    ...enSillones.map((r) => [r.user_id, reparto.get(r.user_id), aspectos[r.user_id]?.companero ?? null, aspecto(r)]),
    amigoSofa && [suPlaza, aspecto(amigoSofa)],
    yoSofa && [miPlaza, aspecto(yoSofa), book && spineColor(book)],
  ]);
  useEffect(() => {
    if (!ready) return;
    api.current?.lectores([
      ...enSillones.map((r) => ({
        sillon: reparto.get(r.user_id),
        avatar: aspecto(r),
        companero: aspectos[r.user_id]?.companero ?? null,
        yo: r.user_id === community.userId,
        libro: r.user_id === community.userId && book ? spineColor(book) : null,
      })),
      ...(amigoSofa ? [{ sillon: suPlaza, avatar: aspecto(amigoSofa), companero: aspectos[amigoSofa.user_id]?.companero ?? null, yo: false, libro: null }] : []),
      ...(yoSofa ? [{ sillon: miPlaza, avatar: aspecto(yoSofa), companero: aspectos[yoSofa.user_id]?.companero ?? null, yo: true, libro: book ? spineColor(book) : null }] : []),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, lectoresKey]);
  const libroKey = book ? `${book.id}|${book.title}|${book.cover ?? ''}|${spineColor(book)}` : '';
  useEffect(() => {
    if (!ready) return;
    api.current?.tuLibro(book && mio != null ? { sillon: mio, title: book.title, color: spineColor(book), coverLoad: preloadCover(book.cover) } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, libroKey, mio]);
  useEffect(() => {
    if (ready && ofrecido != null) api.current?.sillonTag(ofrecido);
  }, [ready, ofrecido]);
  useEffect(() => {
    if (ready) api.current?.lomos(libreria?.lomos ?? []);
  }, [ready, libreria]);
  const placas = Array.isArray(cita.placas) ? cita.placas : [];
  const placaVista = miCita && (citaViva || fase === 'fin') ? (placas.find((p) => p.uid === miCita.uid) ?? null) : (placas[0] ?? null);
  useEffect(() => {
    if (ready) api.current?.placa(placaVista ? { metal: placaVista.metal } : null);
  }, [ready, placaVista?.metal]); // eslint-disable-line react-hooks/exhaustive-deps
  const relojFrac = timer.total ? Math.round((timer.remaining / timer.total) * 400) / 400 : 1;
  useEffect(() => {
    if (ready) api.current?.reloj({ frac: relojFrac, descanso: timer.phase === 'break', activo: enSesion, running: timer.running });
  }, [ready, relojFrac, timer.phase, enSesion, timer.running]);
  // Si llegas con la sesión en marcha (o ya sentado desde el salón), la sala te sienta en tu sillón
  const sentarAlLlegar = useRef(true);
  useEffect(() => {
    if (!ready || !sentarAlLlegar.current) return;
    sentarAlLlegar.current = false;
    if ((timer.running || me) && ofrecido != null) {
      api.current?.sentarse(ofrecido);
      setSentado3d(ofrecido);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const sentarse = async (choice) => {
    setBusy(true);
    setLeidoCon([]);
    const ok = await sitDownNow(choice);
    setBusy(false);
    if (!ok) return;
    setEligiendo(false);
    if (!timer.running) timer.start();
  };
  const levantarse = async () => {
    setBusy(true);
    if (timer.running) timer.pause();
    if (me) await standUpNow(community.userId);
    setBusy(false);
  };
  const levantarCamara = () => {
    if (sentado3d == null) return;
    setSentado3d(null);
    setEligiendo(false);
    api.current?.sentarse(sentado3d, false);
  };
  // Si acabas de terminar un libro, antes de levantarte puedes dejar su lomo: en el servidor se deja sentado
  const apuntado = () => {
    const desde = pidiendo.current;
    pidiendo.current = null;
    const terminado = desde && state.books.find((b) => b.status === 'read' && b.finishedAt >= desde);
    onPagesDone();
    if (terminado && miCita?.cita && (miCita.juntos ?? 0) > 0 && (fase === 'fin' || fase === 'leyendo') && Array.isArray(cita.placas)) {
      setOfertaPlaca({ cita: miCita.cita, titulo: terminado.title, con: nombreCita(miCita) });
      return;
    }
    trasLibro(terminado?.title);
  };
  const trasLibro = (titulo) => {
    if (titulo && me && libreria) setOferta(titulo);
    else {
      if (me) standUpNow(community.userId);
      levantarCamara();
    }
  };
  const cerrarPlaca = (apuntar) => {
    const o = ofertaPlaca;
    const sigue = () => {
      setOfertaPlaca(null);
      trasLibro(o.titulo);
    };
    if (!apuntar) return sigue();
    setBusy(true);
    return cita
      .apuntarLibro(o.cita, o.titulo)
      .then(
        () => setAviso(`Apuntado en vuestra placa del sofá: «${o.titulo}».`),
        () => setAviso('No se ha podido apuntar en la placa. Inténtalo luego desde la sala.'),
      )
      .finally(() => {
        setBusy(false);
        sigue();
      });
  };
  const cerrarOferta = (lomo) => {
    setOferta(null);
    const fin = () => {
      if (me) standUpNow(community.userId);
      levantarCamara();
    };
    if (!lomo) return fin();
    setBusy(true);
    return dejarLomo(lomo)
      .then(setLibreria, () => {})
      .finally(() => {
        setBusy(false);
        fin();
      });
  };
  const retirar = (id) => retirarLomo(id).then(setLibreria, () => {});
  // «Saludar» es el saludo de siempre (con la migración nueva llega como el gesto «¡Hola!»)
  const saludar = (id) => {
    setSaludados((antes) => [...antes, id]);
    saludarEnSala(id).catch(() => {});
  };
  // Un gesto de la lista cerrada; el servidor dice si ha salido (dentro del cupo, no)
  const hacerGesto = (id, g) =>
    salaGesto(id, g).then((ok) => {
      if (ok !== false && g === 'hola') setSaludados((antes) => (antes.includes(id) ? antes : [...antes, id]));
      return ok;
    });

  // ── Lo que se toca en la sala 3D ──
  const sentarseEn = async (k) => {
    const a = api.current;
    if (!a) return;
    setPlano(false);
    setAviso('');
    if (ocupado(k)) {
      const otro = libreDesde(k);
      setAviso(otro == null ? 'Ahora mismo están todos los sillones ocupados.' : 'Ese sillón está ocupado: hay otro libre.');
      if (otro != null) api.current?.sillonTag(otro);
      return;
    }
    await a.go(`sillon-${k}`);
    if (api.current !== a) return;
    await a.sentarse(k);
    if (api.current !== a) return;
    setSentado3d(k);
    if (mio !== k) {
      guardarSillon(community.userId, k);
      setMio(k);
    }
    // Sentarse es empezar a leer: con la comunidad, primero eliges qué compartir (como siempre)
    if (askPages || oferta) return;
    if (enabled && !me) setEligiendo(true);
    else if (!timer.running) timer.start();
  };
  pick.current = async (id) => {
    const a = api.current;
    if (!a) return;
    setPlano(false);
    if (id.startsWith('sillon-')) return sentarseEn(Number(id.slice(7)));
    if (id === 'sillon') return ofrecido != null && sentarseEn(ofrecido);
    if (id === 'sofa') {
      if (!citaViva) {
        const conPlaca = placaVista ? ` En el respaldo, tu placa con ${placaVista.alias ?? 'tu amigo'}.` : '';
        setAviso(cita.disponible ? `El sofá para dos es para leer con un amigo: invítalo en «Leer con un amigo», aquí debajo.${conPlaca}` : 'El sofá para dos, pronto: para quedar a leer con un amigo.');
        // Con placa, se mira el respaldo, donde está; si no, la chimenea
        return a.go(placaVista ? 'placa' : 'sofa');
      }
      setAviso('');
      await a.go('sofa');
      if (api.current !== a) return undefined;
      await a.sentarse(miPlaza);
      if (api.current !== a) return undefined;
      setEligiendo(false);
      setSentado3d(miPlaza);
      return undefined;
    }
    if (id === 'reloj') {
      setAviso(enSesion ? `${timer.phase === 'focus' ? 'Sesión de lectura' : 'Descanso'}: quedan ${mmss(timer.remaining)}.` : 'El reloj de pie lleva tus sesiones: siéntate en un sillón para empezar.');
      return a.go('reloj');
    }
    if (id === 'libreria') {
      if (!libreria) {
        setAviso(enabled ? 'La librería común aún se está colocando.' : 'La librería común se ve con la comunidad activada.');
        return a.go('libreria');
      }
      await a.go('libreria');
      if (api.current !== a) return;
      await a.anteLibreria(true);
      setEnLibreria(true);
      return undefined;
    }
    if (id === 'entrada') return a.go('entrada');
    return undefined;
  };
  pickLomo.current = (id) => {
    const nuevo = id === lomoSel ? null : id;
    setLomoSel(nuevo);
    api.current?.elegirLomo(nuevo);
  };
  const dejarLibreria = () => {
    setEnLibreria(false);
    setLomoSel(null);
    api.current?.anteLibreria(false);
  };

  const nombre = (r) => (r.user_id === community.userId ? 'Tú' : (profiles[r.user_id]?.alias ?? 'Alguien'));
  const otros = seated.length - (me ? 1 : 0) + extra;
  const hola = seated.findIndex((r) => r.user_id === saludo);
  // Tu amigo en el sofá no está en los sillones: su gesto sale sobre su plaza
  const desdeSofa = Boolean(saludo) && otroAqui && saludo === miCita.uid;
  const holaSillon = desdeSofa ? suPlaza : hola >= 0 ? (reparto.get(saludo) ?? null) : null;
  const gestoVisto = gesto ? gestoDe(gesto.gesto) : null;
  const fraseGesto = gestoVisto ? gestoVisto.frase(profiles[saludo]?.alias ?? (miCita?.uid === saludo ? nombreCita(miCita) : 'Alguien')) : null;
  const placaTexto = placaVista
    ? `${placaVista.alias ?? 'Tu amigo'} y tú · ${tiempoJuntos(placaVista.minutos)} juntos${placaVista.libros.length ? ` · ${placaVista.libros.length === 1 ? '1 libro' : `${placaVista.libros.length} libros`}` : ''}`
    : '';
  const juntos =
    miCita && fase === 'fin' && miCita.juntos > 0 && (askPages || oferta || ofertaPlaca) ? (
      <p className="gh-lect__con">
        Habéis leído juntos {miCita.juntos === 1 ? '1 minuto' : `${miCita.juntos} minutos`}, {nombreCita(miCita)} y tú.
      </p>
    ) : null;
  const compania = (
    <>
      {juntos}
      {leidoCon.length > 0 && (askPages || oferta || ofertaPlaca) ? <p className="gh-lect__con">Has leído con {lista(leidoCon.map((id) => profiles[id]?.alias ?? 'alguien'))}.</p> : null}
    </>
  );
  const lomoElegido = libreria?.lomos.find((l) => l.id === lomoSel) ?? null;
  const en3d = !sin3d;

  // En el sofá con tu amigo, los gestos a mano (se abren debajo de la franja)
  const botonGestos =
    enSofa && citaViva ? (
      <button type="button" className="gh-21btn is-stand" aria-expanded={gestosSofa} onClick={() => setGestosSofa((v) => !v)}>
        Gestos
      </button>
    ) : null;
  // El reloj, la sesión y los botones de siempre: sentado en la sala 3D, encima de la escena; si no, en el panel
  const cabecera = askPages ? (
    <div className="gh-lect__paper">
      {compania}
      <SessionReport book={book} onDone={apuntado} onOpenCalendar={onOpenCalendar} />
    </div>
  ) : ofertaPlaca ? (
    <div className="gh-lect__paper">
      {compania}
      <p className="gh-lect__con">
        Has terminado <em>{ofertaPlaca.titulo}</em> leyendo con {ofertaPlaca.con}. ¿Lo apuntáis en la placa del sofá? Lo verá {ofertaPlaca.con}.
      </p>
      <div className="gh-21__acts">
        <button type="button" className="gh-21btn is-deal" disabled={busy} onClick={() => cerrarPlaca(true)}>
          Apuntarlo en la placa
        </button>
      </div>
      <button type="button" className="gh-21link" disabled={busy} onClick={() => cerrarPlaca(false)}>
        Ahora no
      </button>
    </div>
  ) : oferta ? (
    <div className="gh-lect__paper">
      {compania}
      <p className="gh-lect__con">
        Has terminado <em>{oferta}</em>. ¿Dejas su lomo en la librería de la sala? Lo verá todo el hotel, con tu nombre.
      </p>
      <div className="gh-21__acts">
        <button type="button" className="gh-21btn is-deal" disabled={busy} onClick={() => cerrarOferta(oferta)}>
          Dejar el lomo
        </button>
      </div>
      <button type="button" className="gh-21link" disabled={busy} onClick={() => cerrarOferta(null)}>
        Ahora no
      </button>
    </div>
  ) : esperaSofa ? (
    <>
      <div className="gh-lect__clock">
        <p>Con {nombreCita(miCita)}, en el sofá</p>
        <strong aria-live="off">{mmss(miCita.empieza - cita.ahora())}</strong>
        <p>para empezar los dos ({miCita.minutos} min)</p>
      </div>
      <div className="gh-21__acts">
        {botonGestos}
        <button type="button" className="gh-21btn is-stand" onClick={levantarCamara}>
          Levantarte
        </button>
      </div>
    </>
  ) : (
    <>
      <div className="gh-lect__clock">
        <p>{timer.phase === 'focus' ? (leyendoSofa ? `Leyendo con ${nombreCita(miCita)}` : 'Sesión de lectura') : 'Descanso'}</p>
        <strong aria-live="off">{mmss(timer.remaining)}</strong>
        {book && timer.phase === 'focus' && (
          <p>
            con <em>{book.title}</em>
          </p>
        )}
      </div>
      {!enSesion && timer.phase === 'focus' && !eligiendo && !enSofa && (
        <div className="gh-lect__dura" role="group" aria-label="Duración de la sesión">
          <button type="button" aria-label="Cinco minutos menos" disabled={minutos <= 5} onClick={() => ponerMinutos(minutos - 5)}>
            −
          </button>
          {[15, 25, 45, 60].map((m) => (
            <button type="button" key={m} aria-pressed={minutos === m} onClick={() => ponerMinutos(m)}>
              {m}
            </button>
          ))}
          <button type="button" aria-label="Cinco minutos más" disabled={minutos >= 120} onClick={() => ponerMinutos(minutos + 5)}>
            +
          </button>
          <span aria-hidden="true">min</span>
        </div>
      )}
      {eligiendo ? (
        <div className="gh-lect__paper">
          <SeatChoice onSit={sentarse} busy={busy} titleId="gh-lect-elige" />
          <button type="button" className="gh-21link" onClick={() => setEligiendo(false)}>
            Ahora no
          </button>
        </div>
      ) : (
        <div className="gh-21__acts">
          {botonGestos}
          {timer.running ? (
            <button type="button" className="gh-21btn is-stand" onClick={timer.pause}>
              Pausar
            </button>
          ) : enSesion ? (
            <button type="button" className="gh-21btn is-deal" onClick={timer.start}>
              Seguir leyendo
            </button>
          ) : en3d && sentado3d == null && ready ? (
            <button type="button" className="gh-21btn is-deal" disabled={ofrecido == null} onClick={() => pick.current('sillon')}>
              {mio != null && ofrecido === mio ? 'Ir a tu sillón' : 'Ir a un sillón libre'}
            </button>
          ) : enabled && !me ? (
            <button type="button" className="gh-21btn is-deal" onClick={() => setEligiendo(true)}>
              Sentarte a leer
            </button>
          ) : (
            <button type="button" className="gh-21btn is-deal" onClick={timer.start}>
              Empezar a leer
            </button>
          )}
          {enabled && !me && enSesion && !enSofa && (
            <button type="button" className="gh-21btn is-stand" onClick={() => setEligiendo(true)}>
              Sentarte
            </button>
          )}
          {me && (
            <button type="button" className="gh-21btn is-stand" disabled={busy} onClick={levantarse}>
              Levantarte
            </button>
          )}
        </div>
      )}
    </>
  );
  const arriba = en3d && sentado3d != null;
  const sofaNota = !cita.disponible ? <i>pronto</i> : citaViva ? <i>con {nombreCita(miCita)}</i> : null;

  return (
    <section className="gh-casino gh-lect" ref={root} aria-labelledby="gh-lect-title" data-escape-local="open" data-ready={ready ? 'true' : undefined}>
      <h3 className="px-sr" id="gh-lect-title">
        La sala de lectura
      </h3>
      {en3d ? (
        <div className="sl3">
          <div className="sl3-stage" ref={host}>
            {!ready && <p className="sl3-loading">Entrando en la sala de lectura…</p>}
          </div>
          <div className="sl3-tags">
            <button type="button" className="sl3-tag" ref={(el) => (tagEls.current.sillon = el)} data-off="true" onClick={() => pick.current('sillon')}>
              {mio != null && ofrecido === mio ? 'Tu sillón' : 'Un sillón libre'}
            </button>
            <button type="button" className="sl3-tag" ref={(el) => (tagEls.current.libreria = el)} data-off="true" onClick={() => pick.current('libreria')}>
              La librería de la sala
            </button>
            <button type="button" className="sl3-tag" ref={(el) => (tagEls.current.reloj = el)} data-off="true" onClick={() => pick.current('reloj')}>
              El reloj
            </button>
            <button type="button" className={`sl3-tag${cita.disponible ? '' : ' is-pronto'}`} ref={(el) => (tagEls.current.sofa = el)} data-off="true" onClick={() => pick.current('sofa')}>
              Sofá para dos{sofaNota}
            </button>
            <span className="sl3-placa" aria-hidden="true" ref={(el) => (tagEls.current.placa = el)} data-off="true" data-metal={placaVista?.metal} data-vacio={placaVista ? undefined : 'true'}>
              {placaTexto}
            </span>
            {Array.from({ length: PLAZA_SOFA + 2 }, (_, k) => (
              <span key={k} className="sl3-hola" aria-hidden="true" ref={(el) => (tagEls.current[`cabeza-${k}`] = el)} data-off="true" data-vacio={holaSillon === k ? undefined : 'true'}>
                {gestoVisto?.bocadillo ?? '¡Hola!'}
              </span>
            ))}
          </div>
          {ready && sentado3d == null && !enLibreria && (
            <button type="button" className="sl3-plano" aria-expanded={plano} onClick={() => setPlano((v) => !v)}>
              Plano
            </button>
          )}
          {plano && (
            <nav className="sl3-mapa" aria-label="Plano de la sala">
              <button type="button" disabled={ofrecido == null} onClick={() => pick.current('sillon')}>
                {mio != null ? 'Tu sillón' : 'Un sillón libre'}
              </button>
              <button type="button" onClick={() => pick.current('libreria')}>
                La librería de la sala
              </button>
              <button type="button" onClick={() => pick.current('reloj')}>
                El reloj
              </button>
              <button type="button" onClick={() => pick.current('sofa')}>
                Sofá para dos{sofaNota}
              </button>
              <button type="button" onClick={() => pick.current('entrada')}>
                La entrada
              </button>
            </nav>
          )}
          {arriba && (
            <div className="sl3-sit">
              <button type="button" className="sl3-levantarse" disabled={busy} onClick={levantarCamara}>
                {enSofa ? 'Levantarte del sofá' : 'Levantarte del sillón'}
              </button>
              <div className="sl3-sit__panel gh-21">
                {/* Quien te saluda puede estar a tu lado, fuera de la vista: también se dice aquí (el aviso de verdad va en el panel) */}
                {fraseGesto && (
                  <p className="sl3-sit__hola" aria-hidden="true">
                    {fraseGesto}
                  </p>
                )}
                {cabecera}
                {gestosSofa && botonGestos && !askPages && !oferta && !ofertaPlaca && <FilaGestos para={nombreCita(miCita)} solo={!conLista} compacta onGesto={(g) => hacerGesto(miCita.uid, g)} />}
              </div>
            </div>
          )}
          {enLibreria && (
            <div className="sl3-sit sl3-lib">
              <button type="button" className="sl3-levantarse" onClick={dejarLibreria}>
                Volver
              </button>
              <div className="sl3-lib__nota" role="status">
                {lomoElegido ? (
                  <>
                    <p>
                      <em>{lomoElegido.titulo}</em>, {lomoElegido.mio ? 'lo dejaste tú' : `lo dejó ${lomoElegido.alias ?? 'alguien'}`}.
                    </p>
                    {lomoElegido.mio && (
                      <button
                        type="button"
                        className="gh-21link"
                        onClick={() => {
                          pickLomo.current(lomoSel);
                          retirar(lomoElegido.id);
                        }}
                      >
                        Retirar mi lomo
                      </button>
                    )}
                  </>
                ) : libreria?.lomos.length ? (
                  <p>{libreria.total === 1 ? 'Un libro terminado aquí.' : `${libreria.total} libros terminados aquí.`} Toca un lomo para ver de quién es.</p>
                ) : (
                  <p>Aún está vacía. Quien termine aquí un libro podrá dejar su lomo.</p>
                )}
              </div>
            </div>
          )}
          {aviso && (
            <p className="sl3-aviso" role="status">
              {aviso}
            </p>
          )}
        </div>
      ) : (
        <div className="gh-casino__scene" style={{ aspectRatio: `${SALA_W} / ${SALA_H}` }}>
          <img
            className="gh-casino__art"
            src={room.scene}
            alt={`La sala de lectura, de noche: parqué en espiga, librerías de nogal hasta el techo, una ventana al puerto, una alfombra azul y seis sillones de cuero con su lámpara. ${seated.length === 1 ? 'Hay una persona leyendo' : seated.length ? `Hay ${seated.length} personas leyendo` : 'Están vacíos'}.`}
            draggable="false"
          />
          {seated.map((r, k) => {
            const id = aspectos[r.user_id]?.companero;
            return misticoOf(id)?.legendario ? <Companero key={r.user_id} id={id} pie={room.pies[k]} /> : null;
          })}
          {hola >= 0 && (
            <span className="gh-lect__hola" aria-hidden="true" style={{ left: `${(room.cabezas[hola].x / SALA_W) * 100}%`, top: `${(room.cabezas[hola].y / SALA_H) * 100}%` }}>
              {gestoVisto?.bocadillo ?? '¡Hola!'}
            </span>
          )}
        </div>
      )}

      <div className="gh-21 gh-lect__panel">
        {!arriba && (en3d ? <div className="sl3-sesion">{cabecera}</div> : cabecera)}

        {enabled ? (
          <>
            {cita.disponible && <CitaSala cita={cita} enSofa={enSofa} onSofa={en3d && ready ? () => pick.current('sofa') : undefined} onGesto={hacerGesto} conGestos={conLista} />}
            <h4 className="gh-21__lobbytitle">{otros > 0 ? 'Leyendo ahora' : 'Aún no lee nadie más'}</h4>
            {seated.length > 0 && (
              <ul className="gh-lect__list" aria-label="Quién lee ahora">
                {seated.map((r) => (
                  <li key={r.user_id}>
                    <Cara avatar={aspecto(r)} />
                    <p>
                      <b>{nombre(r)}</b>
                      <span>
                        {r.share_book && r.book_title ? `«${r.book_title}» · ` : ''}
                        {sessionMinutes(r.started_at)}
                      </span>
                    </p>
                    {conSaludos && r.user_id !== community.userId && (
                      <button type="button" className="gh-21link gh-lect__saluda" disabled={saludados.includes(r.user_id)} aria-label={`Saludar a ${nombre(r)}`} onClick={() => saludar(r.user_id)}>
                        {saludados.includes(r.user_id) ? 'Saludado' : r.user_id === saludo ? 'Devolver' : 'Saludar'}
                      </button>
                    )}
                    {conSaludos && conLista && r.user_id !== community.userId && (
                      <button
                        type="button"
                        className="gh-21link gh-lect__gestos"
                        aria-expanded={gestosDe === r.user_id}
                        aria-label={`Más gestos para ${nombre(r)}`}
                        onClick={() => setGestosDe((v) => (v === r.user_id ? null : r.user_id))}
                      >
                        Gestos
                      </button>
                    )}
                    {conSaludos && gestosDe === r.user_id && <FilaGestos para={nombre(r)} compacta onGesto={(g) => hacerGesto(r.user_id, g)} />}
                  </li>
                ))}
              </ul>
            )}
            {extra > 0 && <p className="gh-21__empty">Y {extra} más, en los sillones del fondo.</p>}
            {fraseGesto && (
              <p className="gh-21__note" role="status">
                {fraseGesto}
              </p>
            )}
            {libreria && <SalaLibreria libreria={libreria} onRetirar={retirar} />}
          </>
        ) : (
          <p className="gh-21__note">Puedes leer aquí igual. Para ver a quien lee a la vez, activa la comunidad en tu perfil.</p>
        )}
        {failure && (
          <p className="gh-21__msg" role="status">
            No se ha podido: {failure}
          </p>
        )}
      </div>
    </section>
  );
}
