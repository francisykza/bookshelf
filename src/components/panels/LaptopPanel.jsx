// Portátil (SPEC §6): un escritorio de ordenador acogedor (fondo de la bahía, barra de menú
// con reloj, dock de apps y ventana) con Calendario, Estadísticas, Sesiones, Reto anual y Misiones.
import { BarChart3, BatteryMedium, CalendarDays, Check, Clock, Flame, Gift, Mail, Target, Trophy, Wifi, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { dayKey, daysLeftInYear, lastDays, parseDay, shortDay } from '../../domain/dates';
import { useNow } from '../../hooks/useReducedMotion';
import { SEALS_PER_BOX, rankOf } from '../../domain/figures';
import { missionStatus } from '../../domain/missions';
import { EDITIONS, formatRating, hash, isDevice, spineColor } from '../../domain/books';
import { isActive, readingStreak, summarize } from '../../domain/reading';
import { useLibrary } from '../../state/useLibrary';
import { FigureArt, RANK_STARS } from '../figures/FigureArt';
import { useFigureCatalog } from '../figures/figureCatalog';
import { DailyQuote, dailyQuoteReady } from './DailyQuote';
import { cropStyle } from '../shelf/ShelfView';
import { PanelShell } from './PanelShell';
import { SessionsApp } from './ReadingCalendar';
import { DiaryApp } from './DiaryApp';

/** Fondo de pantalla: la bahía de la propia ilustración. */
const WALLPAPER = { x: 500, y: 395, w: 400, h: 330 };

const TABS = [
  // `short`: rótulo de la pestaña inferior del cuaderno (SPEC §32.1)
  { id: 'calendar', label: 'Mi diario', short: 'Calendario', icon: CalendarDays, color: '#e7909f' },
  { id: 'stats', label: 'Estadísticas', short: 'Estadísticas', icon: BarChart3, color: '#d9784d' },
  { id: 'sessions', label: 'Sesiones', short: 'Sesiones', icon: Clock, color: '#86ad55' },
  { id: 'goal', label: 'Reto anual', short: 'Reto', icon: Target, color: '#e2a94f' },
  { id: 'missions', label: 'Misiones y Guardián', short: 'Misiones', icon: Gift, color: '#5b8fc4' },
  { id: 'quote', label: 'Sobre del día', short: 'Citas', icon: Mail, color: '#b3261e' },
];

function useStats(state) {
  return useMemo(() => {
    const { books, progress } = state;
    // Páginas (las correcciones y los porcentajes suman 0) y días con lectura real, que cuentan para la racha
    const byDay = new Map();
    const activeDays = new Set();
    progress.readingLog.forEach((e) => {
      if (e.kind !== 'correction') byDay.set(e.date, (byDay.get(e.date) ?? 0) + (e.pages || 0));
      if (isActive(e)) activeDays.add(e.date);
    });
    const days = lastDays(14).map((date) => ({ date, pages: byDay.get(date) ?? 0, active: activeDays.has(date) }));
    // La misma racha que la pantalla del portátil (sin el tope de 14 días de antes)
    const streak = readingStreak(progress.readingLog);
    const year = String(new Date().getFullYear());
    const readYear = books.filter((b) => b.status === 'read' && b.finishedAt?.startsWith(year));
    const rated = books.filter((b) => b.rating);
    const genres = new Map();
    books.forEach((b) => b.categories.slice(0, 2).forEach((c) => genres.set(c, (genres.get(c) ?? 0) + 1)));
    return {
      days,
      streak,
      totalPages: progress.readingLog.reduce((s, e) => s + (e.kind === 'correction' ? 0 : e.pages || 0), 0),
      weekPages: days.slice(-7).reduce((s, d) => s + d.pages, 0),
      weekPercent: summarize(progress.readingLog.filter((e) => lastDays(7).includes(e.date)), books).percentBooks,
      readYear,
      pagesYear: readYear.reduce((s, b) => s + (b.pageCount || 0), 0),
      avgRating: rated.length ? rated.reduce((s, b) => s + b.rating, 0) / rated.length : 0,
      quotes: books.reduce((s, b) => s + b.quotes.length, 0),
      genres: [...genres.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      pomodoros: progress.pomodoros.length,
    };
  }, [state]);
}

function PagesChart({ days }) {
  const max = Math.max(20, ...days.map((d) => d.pages));
  const [hover, setHover] = useState(null);
  return (
    <figure className="pages-chart">
      <figcaption>Páginas leídas · últimos 14 días</figcaption>
      <div className="pages-chart__plot" onPointerLeave={() => setHover(null)}>
        <span className="pages-chart__grid" style={{ bottom: 'calc(20px + (100% - 20px) * 0.5)' }} data-v={Math.round(max / 2)} />
        <span className="pages-chart__grid" style={{ bottom: 'calc(20px + (100% - 20px))' }} data-v={max} />
        {days.map((d, i) => (
          <button
            key={d.date}
            type="button"
            className="pages-chart__col"
            onPointerEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            aria-label={`${parseDay(d.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}: ${d.pages} páginas`}
          >
            <span className="pages-chart__bar" style={{ height: `${(d.pages / max) * 100}%` }} data-zero={d.pages === 0} />
            <span className="pages-chart__day">{shortDay(d.date)}</span>
            {hover === i && (
              <span className="pages-chart__tip" role="tooltip">
                <strong>{d.pages} págs.</strong>
                {parseDay(d.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </button>
        ))}
      </div>
    </figure>
  );
}

/** Grosor real aproximado de un libro: ~0,067 mm por página más las tapas. */
const bookCm = (b) => (isDevice(b) ? 0.9 : (b.pageCount || 0) * 0.0067 + (EDITIONS[b.editionType]?.cm ?? 0.15));

const TOWER_MARKS = [
  { cm: 9, text: 'más alta que una taza de té' },
  { cm: 25, text: 'más alta que Miel sentada' },
  { cm: 55, text: 'a la altura de la mesilla' },
  { cm: 100, text: 'tan alta como el carillón' },
];

/** Torre física de los libros terminados este año, apilados como en la mesilla, con su altura. */
function BookTower({ books }) {
  const sorted = [...books].sort((a, b) => (a.finishedAt || '').localeCompare(b.finishedAt || ''));
  const cm = sorted.reduce((sum, b) => sum + bookCm(b), 0);
  const pages = sorted.reduce((sum, b) => sum + (b.pageCount || 0), 0);
  const unpaged = sorted.filter((b) => !b.pageCount).length;
  // 6 px por cm, encogiendo la torre si no cabe en la ventana
  const scale = Math.min(6, 220 / Math.max(1, cm));
  const passed = [...TOWER_MARKS].reverse().find((m) => cm >= m.cm);
  const next = TOWER_MARKS.find((m) => cm < m.cm);
  return (
    <figure className="tower">
      <figcaption>
        <strong>Torre de leídos {new Date().getFullYear()}</strong>
        <span>
          {cm.toLocaleString('es-ES', { maximumFractionDigits: 1 })} cm · {pages.toLocaleString('es-ES')} págs.
          {unpaged > 0 && ` (+${unpaged} sin paginación)`} · {sorted.length} libros
        </span>
        <em>{passed ? `¡Ya es ${passed.text}!` : 'Empieza a apilar tus lecturas'}{next ? ` Próxima meta: ${next.text} (${next.cm} cm).` : ''}</em>
      </figcaption>
      <div className="tower__stage">
        <div className="tower__ruler" aria-hidden="true">
          {Array.from({ length: Math.ceil(cm / 5) + 1 }, (_, i) => (
            <span key={i} style={{ bottom: i * 5 * scale }}>
              {i * 5}
            </span>
          ))}
        </div>
        <div className="tower__stack" role="list" aria-label="Libros terminados este año, del primero al último">
          {sorted.length === 0 && <p className="tower__empty">Aún no has terminado ningún libro este año.</p>}
          {[...sorted].reverse().map((b, i) => {
            const h = Math.max(7, bookCm(b) * scale);
            const w = 62 + (hash(b.id) % 26);
            return (
              <div
                key={b.id}
                role="listitem"
                className="tower__book"
                data-edition={b.editionType}
                style={{ height: h, width: `${w}%`, '--spine': spineColor(b), '--shift': `${((hash(b.title) % 9) - 4) * 2}px`, '--tilt': `${((hash(b.author) % 5) - 2) * 0.4}deg`, animationDelay: `${(sorted.length - i) * 70}ms` }}
                title={b.pageCount ? `${b.title} · ${b.pageCount} págs.` : `${b.title} · sin paginación`}
              >
                {h >= 11 && <span>{b.title}</span>}
              </div>
            );
          })}
          <span className="tower__table" aria-hidden="true" />
        </div>
      </div>
    </figure>
  );
}

const MONTHS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Páginas leídas cada mes del año: una sola serie, barras finas y detalle al pasar el ratón. */
function MonthlyPages({ log }) {
  const year = new Date().getFullYear();
  const nowMonth = new Date().getMonth();
  const months = MONTHS.map(() => 0);
  log.forEach((e) => {
    if (e.date.startsWith(String(year)) && e.kind !== 'correction') months[Number(e.date.slice(5, 7)) - 1] += e.pages || 0;
  });
  const max = Math.max(50, ...months);
  const [hover, setHover] = useState(null);
  return (
    <figure className="pages-chart months-chart">
      <figcaption>Páginas por mes · {year}</figcaption>
      <div className="pages-chart__plot months-chart__plot" onPointerLeave={() => setHover(null)}>
        <span className="pages-chart__grid" style={{ bottom: 'calc(20px + (100% - 20px) * 0.5)' }} data-v={Math.round(max / 2)} />
        <span className="pages-chart__grid" style={{ bottom: 'calc(20px + (100% - 20px))' }} data-v={max} />
        {months.map((p, i) => (
          <button
            key={i}
            type="button"
            className="pages-chart__col"
            data-current={i === nowMonth}
            data-future={i > nowMonth}
            onPointerEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            aria-label={`${MONTH_NAMES[i]}: ${p} páginas`}
          >
            <span className="pages-chart__bar" style={{ height: `${(p / max) * 100}%` }} data-zero={p === 0} />
            <span className="pages-chart__day">{MONTHS[i]}</span>
            {hover === i && (
              <span className="pages-chart__tip" role="tooltip">
                <strong>{p.toLocaleString('es-ES')} págs.</strong>
                {MONTH_NAMES[i]}
              </span>
            )}
          </button>
        ))}
      </div>
    </figure>
  );
}

function Ring({ value, max }) {
  const pct = Math.min(1, value / Math.max(1, max));
  const c = 2 * Math.PI * 52;
  return (
    <svg className="goal-ring" viewBox="0 0 120 120" role="img" aria-label={`${value} de ${max} libros`}>
      <circle cx="60" cy="60" r="52" className="goal-ring__track" />
      <circle cx="60" cy="60" r="52" className="goal-ring__fill" style={{ strokeDasharray: c, strokeDashoffset: c * (1 - pct) }} />
      <text x="60" y="58" textAnchor="middle" className="goal-ring__value">
        {value}
      </text>
      <text x="60" y="78" textAnchor="middle" className="goal-ring__label">
        de {max}
      </text>
    </svg>
  );
}

export function LaptopPanel({ onClose, initialTab = 'calendar', selectDay = null, onComplete, onOpenLibrary, onOpenVault, onOpenBook }) {
  const figCatalog = useFigureCatalog();
  const { state, actions } = useLibrary();
  const [tab, setTab] = useState(initialTab);
  const stats = useStats(state);
  const missions = missionStatus(state);
  const { yearGoal } = state.settings;
  const year = new Date().getFullYear();
  const dayOfYear = Math.ceil((Date.now() - new Date(year, 0, 1)) / 86400000);
  const expected = Math.round((yearGoal * dayOfYear) / 365);
  const remaining = Math.max(0, yearGoal - stats.readYear.length);
  const weeksLeft = Math.max(1, daysLeftInYear() / 7);
  const figs = state.progress.figures;
  const guardian = figCatalog.find((f) => f.id === figs.guardian);
  const now = useNow(30000);
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];
  const CurrentIcon = current.icon;
  const today = summarize(
    state.progress.readingLog.filter((e) => e.date === dayKey()),
    state.books,
  );

  return (
    <PanelShell onClose={onClose} label="Portátil: estadísticas de lectura" variant="laptop">
      <div className="laptop" data-app={tab}>
        <button type="button" className="laptop__exit" onClick={onClose} aria-label="Salir del ordenador" title="Salir del ordenador">
          <X aria-hidden="true" />
        </button>
        <div className="laptop__screen">
          <div className="desk" style={cropStyle(WALLPAPER)}>
            <div className="desk__menubar">
              <span className="desk__logo">☕ BookShelf</span>
              <span className="desk__app">{current.label}</span>
              <span className="desk__spacer" />
              <Wifi aria-hidden="true" />
              <BatteryMedium aria-hidden="true" />
              <time>
                {new Date(now).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}{' '}
                {new Date(now).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </time>
            </div>
            <div className="desk__note" aria-hidden="true">
              <b>Hoy</b>
              <span>{today.text ? `${today.text} ♡` : 'Aún sin leer… ¿un capítulo?'}</span>
            </div>
            <section className="window" data-app={tab} aria-label={current.label}>
              <span className="washi washi--window" aria-hidden="true" />
              <span className="brass-clip brass-clip--window" aria-hidden="true" />
              <header className="window__bar">
                <span className="window__lights">
                  <button type="button" onClick={onClose} aria-label="Cerrar el portátil" />
                  <i />
                  <i />
                </span>
                <span className="window__title">
                  <CurrentIcon aria-hidden="true" />
                  {current.label}
                </span>
              </header>
              <div className="window__body" role="tabpanel">
            {tab === 'calendar' && <DiaryApp selectDay={selectDay} onComplete={onComplete} onOpenLibrary={onOpenLibrary} onOpenBook={onOpenBook} onBack={onClose} />}
            {tab === 'sessions' && <SessionsApp />}
            {tab === 'stats' && (
              <>
                <div className="tiles">
                  <div className="tile">
                    <span>Esta semana</span>
                    <strong>{stats.weekPages}</strong>
                    <em>páginas{stats.weekPercent > 0 && ` · y avance por % en ${stats.weekPercent} ${stats.weekPercent === 1 ? 'libro' : 'libros'}`}</em>
                  </div>
                  <div className="tile">
                    <span>Racha</span>
                    <strong>
                      {stats.streak} <Flame aria-hidden="true" className="tile__icon" />
                    </strong>
                    <em>{stats.streak === 1 ? 'día seguido' : 'días seguidos'}</em>
                  </div>
                  <div className="tile">
                    <span>Total registrado</span>
                    <strong>{stats.totalPages.toLocaleString('es-ES')}</strong>
                    <em>páginas</em>
                  </div>
                  <div className="tile">
                    <span>Valoración media</span>
                    <strong>{stats.avgRating ? formatRating(Math.round(stats.avgRating * 100) / 100) : '—'}</strong>
                    <em>{stats.avgRating ? 'estrellas de media' : 'sin valoraciones'}</em>
                  </div>
                </div>
                <PagesChart days={stats.days} />
                <p className="stats-motto">
                  <img src="/assets/bookshelf/notebook/open-book-decoration.webp" alt="" width="360" height="157" aria-hidden="true" />
                  <span>Cada página cuenta.</span>
                </p>
                <div className="mini-cols">
                  <div>
                    <h3>Géneros en tu librería</h3>
                    <ul className="genres">
                      {stats.genres.map(([g, n]) => (
                        <li key={g}>
                          <span>{g}</span>
                          <span className="genres__bar" style={{ '--w': `${(n / stats.genres[0][1]) * 100}%` }} />
                          <b>{n}</b>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3>Más números</h3>
                    <ul className="facts">
                      <li>
                        <b>{stats.quotes}</b> citas subrayadas
                      </li>
                      <li>
                        <b>{stats.pomodoros}</b> sesiones cozy completadas
                      </li>
                      <li>
                        <b>{state.books.filter((b) => b.status === 'want').length}</b> pendientes esperando
                      </li>
                    </ul>
                  </div>
                </div>
              </>
            )}

            {tab === 'goal' && (
              <div className="goal">
                <img className="goal__stack" src="/assets/bookshelf/notebook/book-stack-decoration.webp" alt="" width="320" height="236" aria-hidden="true" />
                <Ring value={stats.readYear.length} max={yearGoal} />
                <div className="goal__text">
                  <h3>Reto {year}</h3>
                  <p>
                    {stats.readYear.length >= yearGoal ? (
                      <>
                        <Trophy aria-hidden="true" className="tile__icon" /> ¡Reto superado! Llevas {stats.readYear.length} libros.
                      </>
                    ) : stats.readYear.length >= expected ? (
                      `Vas al día: a estas alturas tocaban ${expected}. Te faltan ${remaining}.`
                    ) : (
                      `Vas ${expected - stats.readYear.length} por detrás del ritmo. Te faltan ${remaining}: unos ${(remaining / weeksLeft).toFixed(1)} libros por semana.`
                    )}
                  </p>
                  <label className="goal__input">
                    Objetivo de libros
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={yearGoal}
                      onChange={(e) => actions.setSettings({ yearGoal: Math.max(1, Math.min(365, Number(e.target.value) || 1)) })}
                    />
                  </label>
                  <p className="goal__pages">{stats.pagesYear.toLocaleString('es-ES')} páginas terminadas este año</p>
                  <ol className="goal__list">
                    {stats.readYear.map((b) => (
                      <li key={b.id}>
                        <span>{b.title}</span>
                        <em>{new Date(b.finishedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</em>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="goal__extra">
                  <BookTower books={stats.readYear} />
                  <MonthlyPages log={state.progress.readingLog} />
                </div>
              </div>
            )}

            {tab === 'quote' && <DailyQuote />}

            {tab === 'missions' && (
              <div className="missions">
                {/* Tu Guardián de Lectura y las Cajas Sorpresa que te esperan en el Ático */}
                <div className="missions__guardian">
                  {guardian ? (
                    <>
                      {/* La figura real apoyada en la base de la hornacina de madera (decoración detrás) */}
                      <span className="missions__fig missions__fig--niche">
                        <img className="missions__niche" src="/assets/bookshelf/reading-corner/guardian-niche-empty.webp" alt="" width="720" height="462" aria-hidden="true" />
                        <FigureArt fig={guardian} display={figs.owned[guardian.id]?.display} />
                      </span>
                      <b>{guardian.name}</b>
                      <span className="missions__rank">{RANK_STARS(rankOf(guardian.parts.length, figs.owned[guardian.id]))}</span>
                      <span className="missions__seals" aria-label={`${figs.seals} de ${SEALS_PER_BOX} sellos`}>
                        {Array.from({ length: SEALS_PER_BOX }, (_, i) => (
                          <i key={i} data-on={i < figs.seals} />
                        ))}
                      </span>
                    </>
                  ) : (
                    <p>Elige un Guardián de Lectura en el Ático.</p>
                  )}
                  <p>
                    <b>{figs.boxes}</b> {figs.boxes === 1 ? 'Caja Sorpresa' : 'Cajas Sorpresa'} por abrir
                  </p>
                  {onOpenVault && (
                    <button type="button" className="stamp-btn stamp-btn--small" onClick={onOpenVault}>
                      🏆 Abrir el Ático
                    </button>
                  )}
                </div>
                <div className="missions__list">
                  <h3>Misiones de esta semana</h3>
                  <p className="missions__hint">Se reinician cada lunes. Cada misión cumplida te da una Caja Sorpresa para el Ático del Coleccionista.</p>
                  <ul>
                    {missions.map((m) => (
                      <li key={m.id} className="mission" data-done={m.done} data-claimed={m.claimed}>
                        <div>
                          <strong>{m.title}</strong>
                          <span className="mission__bar" style={{ '--p': `${(m.value / m.target) * 100}%` }} />
                          <em>
                            {m.value}/{m.target}
                          </em>
                        </div>
                        {m.claimed ? (
                          <span className="mission__ok">
                            <Check aria-hidden="true" /> Reclamada
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="stamp-btn stamp-btn--small"
                            disabled={!m.done}
                            onClick={() => actions.claimMission(m.id)}
                          >
                            Reclamar Caja Sorpresa
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
              </div>
            </section>
            <nav className="dock" role="tablist" aria-label="Apps del portátil">
              {TABS.map(({ id, label, short, icon: Icon, color }) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} aria-label={label} data-app={id} onClick={() => setTab(id)} title={label} style={{ '--app': color }}>
                  <span className="dock__icon">
                    <Icon aria-hidden="true" />
                    {id === 'quote' && dailyQuoteReady(state) && <i className="dock__badge" aria-label="(sobre por abrir)" />}
                  </span>
                  <span className="dock__label" aria-hidden="true">
                    {short}
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </div>
        <div className="laptop__base" aria-hidden="true" />
      </div>
    </PanelShell>
  );
}
