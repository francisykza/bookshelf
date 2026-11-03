// El vestíbulo del Gran Hotel por dentro (1.75, SPEC §75; paso A de docs/qa/gran-hotel.md §9). Se entra tocando el
// vestíbulo en la fachada. Cada cosa del dibujo (lobbyArt.js) es una función de la app, sin menús nuevos:
// - la recepción: el conserje da los encargos de la semana, que son las misiones de siempre (se cobran en tickets
//   igual que en el ordenador, una vez por misión y semana, lo decide el servidor);
// - el ascensor: la botonera de latón con una luz por planta es la navegación del hotel; las plantas que aún no abren
//   dicen qué habrá, y la «P» sale a la plaza (1.79: la «Á» sube a la suite de la semana; 1.80: la «S» baja al casino);
// - el tablón «Busco quien lea…» y el guardarropa: dicen qué habrá y «Abre pronto».
// 1.78 (encargo del 3-11-2026: «que los menús no tengan tanto protagonismo»): al entrar no hay nada abierto, solo el
// dibujo con letreros pequeños; lo de cada cosa sale en un papel más compacto al tocarla, y se cierra con «×», tocándola
// otra vez o con Escape (un segundo Escape sale a la plaza).
import { useEffect, useRef, useState } from 'react';
import { missionStatus } from '../../../domain/missions';
import { useLibrary } from '../../../state/useLibrary';
import { MISION_TICKETS } from '../economy';
import { useMissionTickets } from '../useMissionTickets';
import { LOBBY_H, LOBBY_W, renderLobby } from './lobbyArt';

const SPOTS = [
  { id: 'recepcion', nombre: 'Recepción' },
  { id: 'ascensor', nombre: 'Ascensor' },
  { id: 'tablon', nombre: 'Tablón' },
  { id: 'guardarropa', nombre: 'Guardarropa' },
];

// La botonera, de arriba abajo (como en el ascensor). `aqui`: la planta en la que estás; `calle`: sale a la plaza.
const FLOORS = [
  {
    id: 'mirador',
    boton: 'C',
    nombre: 'El mirador de la corona',
    texto: 'El bar de arriba, con las mejores vistas: el ranking del minijuego, las distinciones y tu año de lectura en un calendario de pared.',
  },
  { id: 'suite', boton: 'Á', nombre: 'La suite de la semana', abierta: true, texto: 'Una habitación que empieza vacía cada lunes y decoran entre todos: cada huésped lleva un mueble suyo.' },
  { id: 'terraza', boton: 'T', nombre: 'La terraza', texto: 'Guirnaldas, la radio del rincón sonando para todos y el puerto a tus pies.' },
  { id: 'baile', boton: 'B', nombre: 'El salón de baile', texto: 'La sala grande, para las lecturas conjuntas y las presentaciones de los clubes.' },
  { id: 'suites', boton: '3', nombre: 'Las suites de los clubes', texto: 'Cada club tiene su habitación, decorada entre sus miembros.' },
  { id: 'cafe', boton: '1', nombre: 'El café-biblioteca', texto: 'Mesas junto a quien lee lo mismo y la sala de lectura: te sientas, empieza tu sesión de lectura y ves a quien lee a la vez.' },
  { id: 'lonja', boton: 'E', nombre: 'La Lonja', texto: 'El mercado del entresuelo: un puesto por persona para cambiar muebles o venderlos por tickets.' },
  { id: 'vestibulo', boton: 'V', nombre: 'El vestíbulo', aqui: true },
  { id: 'casino', boton: 'S', nombre: 'El casino del sótano', abierta: true, texto: 'Un casino de los años 20, sin apuestas: una partida de «Las 21 páginas» al día, solo si ese día has leído.' },
  { id: 'plaza', boton: 'P', nombre: 'La plaza del muelle', calle: true },
];

const INFO = {
  tablon: { nombre: 'El tablón «Busco quien lea…»', texto: 'Notas con frases cerradas para encontrar a alguien que lea tu mismo libro, y leerlo a la vez.' },
  guardarropa: { nombre: 'El guardarropa', texto: 'El armario de tu personaje, aquí mismo, y el escaparate con la ropa que se gana en el casino.' },
};

const TICKET_NOTE = {
  loading: 'Un momento, que miro tu casillero…',
  'signed-out': 'Inicia sesión y activa la comunidad para cobrar tus encargos en tickets.',
  'no-community': 'Activa la comunidad en tu perfil para cobrar tus encargos en tickets.',
  soon: 'La caja aún está cerrada: pronto podrás cobrar aquí tus encargos.',
};

/** Los encargos de la semana (las misiones de siempre), contados por el conserje. */
function Encargos() {
  const { state, actions } = useLibrary();
  const missions = missionStatus(state);
  const t = useMissionTickets();
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const cobrar = async (m) => {
    setBusy(m.id);
    setMsg('');
    try {
      await t.cobrar(m.id);
      if (!m.claimed) actions.claimMission(m.id);
      setMsg(`Aquí tienes: ${MISION_TICKETS} tickets por «${m.title}».`);
    } catch (e) {
      setMsg(`No se ha podido cobrar: ${e.message}`);
    } finally {
      setBusy('');
    }
  };
  const done = missions.filter((m) => m.done).length;
  return (
    <>
      <p className="gh-say">
        Buenas noches. {done === missions.length ? 'Esta semana lo has hecho todo: ¡enhorabuena!' : 'Tus encargos de esta semana; cada uno vale ' + MISION_TICKETS + ' tickets.'}
      </p>
      <p className="gh-wallet">
        {t.status === 'ready' ? (
          <>
            En tu casillero: <b>{t.tickets}</b> tickets
          </>
        ) : (
          TICKET_NOTE[t.status]
        )}
      </p>
      <ul className="gh-tasks">
        {missions.map((m) => {
          const cobrada = t.cobrada(m.id);
          return (
            <li key={m.id} className="gh-task" data-done={m.done || undefined}>
              <span className="gh-task__text">
                <strong>{m.title}</strong>
                <span className="gh-task__bar" style={{ '--p': `${(m.value / m.target) * 100}%` }} aria-hidden="true" />
                <small>
                  {m.value} / {m.target}
                </small>
              </span>
              {cobrada ? (
                <span className="gh-task__ok">Cobrado</span>
              ) : t.status === 'ready' ? (
                <button type="button" className="px-btn gh-task__btn" disabled={!m.done || Boolean(busy)} onClick={() => cobrar(m)}>
                  {busy === m.id ? 'Cobrando…' : `Cobrar ${MISION_TICKETS}`}
                </button>
              ) : m.done ? (
                <span className="gh-task__ok">Hecho</span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="gh-say gh-say--small" role="status" aria-live="polite">
        {msg}
      </p>
    </>
  );
}

// La esfera de plantas, en píxeles (como la del dibujo): de izquierda (sótano) a derecha (corona), con la aguja roja
const DIAL = ['casino', 'vestibulo', 'lonja', 'cafe', 'suites', 'baile', 'terraza', 'suite', 'mirador'];
const DIAL_W = 41;
const DIAL_H = 23;
// Las marcas, sin llegar a la base de la esfera (si no, la aguja del sótano y la de la corona quedarían tapadas)
const DIAL_EDGE = 0.32;
const DIAL_STEP = (Math.PI - 2 * DIAL_EDGE) / (DIAL.length - 1);
const dialAngle = (id) => Math.PI - DIAL_EDGE - Math.max(0, DIAL.indexOf(id)) * DIAL_STEP;

function drawDial(canvas, ang) {
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(DIAL_W, DIAL_H);
  const put = (x, y, hex) => {
    const i = (y * DIAL_W + x) * 4;
    img.data[i] = parseInt(hex.slice(1, 3), 16);
    img.data[i + 1] = parseInt(hex.slice(3, 5), 16);
    img.data[i + 2] = parseInt(hex.slice(5, 7), 16);
    img.data[i + 3] = 255;
  };
  const cx = 20;
  const cy = 20;
  for (let y = 0; y < DIAL_H; y += 1)
    for (let x = 0; x < DIAL_W; x += 1) {
      const dx = x - cx;
      const dy = cy - y;
      const d = Math.hypot(dx, dy);
      if (y > cy + 1 || d > 19.6) continue;
      if (y > cy - 1) put(x, y, y === cy + 1 ? '#3b2618' : '#8a5a14');
      else if (d > 18.6) put(x, y, '#3b2618');
      else if (d > 16.4) put(x, y, dx < 0 && dy > 6 ? '#f0c35a' : dx > 4 ? '#8a5a14' : '#c98a1c');
      else {
        const a = Math.atan2(dy, dx);
        const k = Math.max(0, Math.min(DIAL.length - 1, Math.round((a - DIAL_EDGE) / DIAL_STEP)));
        // Una marca por planta en el borde, la aguja y su eje
        if (d > 12.5 && Math.abs(a - DIAL_EDGE - k * DIAL_STEP) * d < 0.7) put(x, y, '#3b2618');
        else if (d < 2.2) put(x, y, '#3b2618');
        else if (d < 14 && Math.abs(Math.sin(a - ang)) * d < 0.9 && Math.cos(a - ang) > 0) put(x, y, '#a8434c');
        else put(x, y, d > 15.4 ? '#e3cfa6' : '#fbf3df');
      }
    }
  ctx.putImageData(img, 0, 0);
}

/** La botonera de latón del ascensor, con la esfera de plantas encima (en el pixel art de la habitación). */
function Ascensor({ onStreet, onFloor }) {
  const [floor, setFloor] = useState(null);
  const dial = useRef(null);
  const shown = useRef(dialAngle('vestibulo'));
  const f = FLOORS.find((x) => x.id === floor);
  // La aguja va hasta la planta pulsada (de golpe con movimiento reducido)
  useEffect(() => {
    const to = dialAngle(floor ?? 'vestibulo');
    const from = shown.current;
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now) => {
      const k = still ? 1 : Math.min(1, (now - t0) / 450);
      shown.current = from + (to - from) * (1 - (1 - k) ** 3);
      if (dial.current) drawDial(dial.current, shown.current);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    tick(t0);
    return () => cancelAnimationFrame(raf);
  }, [floor]);
  return (
    <div className="gh-lift">
      <div className="gh-lift__box">
        <canvas className="gh-lift__dial" ref={dial} width={DIAL_W} height={DIAL_H} aria-hidden="true" />
        <p className="gh-lift__readout" aria-hidden="true">
          {f ? f.nombre : 'El vestíbulo'}
        </p>
        <ul className="gh-lift__panel" aria-label="Botonera del ascensor">
          {FLOORS.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                className="gh-lift__btn"
                aria-pressed={x.aqui || floor === x.id}
                aria-current={x.aqui ? 'location' : undefined}
                onClick={() => (x.calle ? onStreet() : x.abierta ? onFloor(x.id) : setFloor(x.aqui ? null : x.id))}
              >
                <span className="gh-lift__lamp" aria-hidden="true">
                  {x.boton}
                </span>
                <span className="gh-lift__name">{x.nombre}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="gh-lift__note" role="status" aria-live="polite">
        {f ? (
          <>
            <h4>{f.nombre}</h4>
            <p>{f.texto}</p>
            <span className="gh-card__soon">Abre pronto</span>
          </>
        ) : (
          <p>Estás en el vestíbulo. Pulsa una planta para ver qué hay en ella, o la «P» para salir a la plaza.</p>
        )}
      </div>
    </div>
  );
}

export function Vestibulo({ onStreet, onFloor = () => {} }) {
  const lobby = renderLobby();
  const root = useRef(null);
  const [spot, setSpot] = useState(null);
  const spotRef = useRef(null);
  useEffect(() => {
    spotRef.current = spot;
  }, [spot]);
  const desk = useRef(null);
  useEffect(() => {
    root.current?.scrollIntoView({ block: 'start' });
  }, []);
  // Escape cierra el papel abierto; sin papel, sale a la plaza (no cierra el hotel: PanelShell respeta data-escape-local)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (spotRef.current) setSpot(null);
      else onStreet();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onStreet]);
  // Tocar lo que ya está abierto lo cierra
  const choose = (id) => setSpot((cur) => (cur === id ? null : id));
  useEffect(() => {
    if (spot) desk.current?.scrollIntoView({ block: 'nearest' });
  }, [spot]);
  const onScene = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const hit = lobby.hit((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    if (hit) choose(hit);
  };
  const info = INFO[spot];
  return (
    <section className="gh-lobby" ref={root} aria-labelledby="gh-lobby-title" data-escape-local="open">
      <h3 className="px-sr" id="gh-lobby-title">
        El vestíbulo
      </h3>
      <div className="gh-lobby__scene" style={{ aspectRatio: `${LOBBY_W} / ${LOBBY_H}` }} onClick={onScene}>
        <img
          className="gh-lobby__art"
          src={lobby.scene}
          alt="El vestíbulo del Gran Hotel de noche: suelo de mármol en damero, la recepción con el conserje y el casillero de llaves, el ascensor de latón con su esfera, el tablón de corcho, el guardarropa con los abrigos, un diván redondo con una palmera bajo la lámpara de araña y una huésped esperando el ascensor."
          draggable="false"
        />
        {spot && <img className="gh-lobby__outline" src={lobby.outlines[spot]} alt="" aria-hidden="true" draggable="false" />}
        <div className="gh-lobby__spots" role="tablist" aria-label="El vestíbulo">
          {SPOTS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={`gh-tab-${s.id}`}
              aria-controls="gh-lobby-panel"
              aria-selected={spot === s.id}
              className={`gh-spot is-${s.id}`}
              style={{ left: `${lobby.tags[s.id].left * 100}%`, top: `${lobby.tags[s.id].top * 100}%` }}
              onClick={(e) => (e.stopPropagation(), choose(s.id))}
            >
              {s.nombre}
            </button>
          ))}
        </div>
      </div>
      {!spot && <p className="gh-lobby__hint">Toca la recepción, el ascensor, el tablón o el guardarropa.</p>}
      <div ref={desk} className={spot === 'ascensor' ? 'gh-desk gh-desk--lift' : 'gh-desk'} role="tabpanel" id="gh-lobby-panel" aria-labelledby={spot ? `gh-tab-${spot}` : undefined} hidden={!spot}>
        {spot && (
          <button type="button" className="gh-desk__close" aria-label="Cerrar" onClick={() => setSpot(null)}>
            ×
          </button>
        )}
        {spot === 'recepcion' && <Encargos />}
        {spot === 'ascensor' && <Ascensor onStreet={onStreet} onFloor={onFloor} />}
        {info && (
          <>
            <h4>{info.nombre}</h4>
            <p>{info.texto}</p>
            <span className="gh-card__soon">Abre pronto</span>
          </>
        )}
      </div>
    </section>
  );
}
