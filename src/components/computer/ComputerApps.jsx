// Apps del ordenador (SPEC §34): Estadísticas, Reto anual y Misiones y Guardián, recompuestas según la maqueta
// `docs/design/references/ordenador-seis-apps-maqueta.png`. Las fórmulas, la torre de leídos y las misiones son las
// de siempre (antes en LaptopPanel); aquí cambia solo la composición.
import { BookOpen, Check, Flame, Gift, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { daysLeftInYear, lastDays, parseDay } from '../../domain/dates';
import { EDITIONS, formatRating, hash, isDevice, spineColor } from '../../domain/books';
import { SEALS_PER_BOX, rankOf } from '../../domain/figures';
import { missionStatus } from '../../domain/missions';
import { isActive, readingStreak, summarize } from '../../domain/reading';
import { useLibrary } from '../../state/useLibrary';
import { FigureArt, RANK_STARS } from '../figures/FigureArt';
import { useFigureCatalog } from '../figures/figureCatalog';
import { Cover } from '../shelf/BookItem';

export function useStats(state) {
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

/** Gráfico de barras con eje: una serie, detalle al pasar el ratón o con el foco. */
function BarChart({ title, items, label, tick }) {
  const max = Math.max(1, ...items.map((d) => d.value));
  const top = max <= 20 ? 20 : Math.ceil(max / 10) * 10;
  const [hover, setHover] = useState(null);
  return (
    <figure className="pc-chart">
      <figcaption className="pc-section-title">{title}</figcaption>
      <div className="pc-chart__frame">
        <span className="pc-chart__axis" aria-hidden="true">
          <span>{top.toLocaleString('es-ES')}</span>
          <span>{Math.round(top / 2).toLocaleString('es-ES')}</span>
          <span>0</span>
        </span>
        <div className="pc-chart__plot" onPointerLeave={() => setHover(null)}>
          {items.map((d, i) => (
            <button
              key={d.key}
              type="button"
              className="pc-chart__col"
              data-current={d.current || undefined}
              data-future={d.future || undefined}
              onPointerEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={label(d)}
            >
              <span className="pc-chart__bar" style={{ height: `${(d.value / top) * 100}%` }} data-zero={d.value === 0 || undefined} />
              <span className="pc-chart__tick" aria-hidden="true">
                {tick(d, i)}
              </span>
              {hover === i && (
                <span className="pc-chart__tip" role="tooltip">
                  <strong>{d.value.toLocaleString('es-ES')} págs.</strong>
                  {d.name}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </figure>
  );
}

export function StatsApp() {
  const { state } = useLibrary();
  const stats = useStats(state);
  const fmt = (d) => parseDay(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const totalGenres = stats.genres[0]?.[1] ?? 1;
  return (
    <div className="pc-stats">
      <div className="pc-tiles">
        <div className="pc-tile">
          <BookOpen className="pc-tile__icon" aria-hidden="true" />
          <span className="pc-tile__value">{stats.weekPages.toLocaleString('es-ES')}</span>
          <span className="pc-tile__label">
            Páginas · últimos 7 días{stats.weekPercent > 0 && ` · avance por % en ${stats.weekPercent} ${stats.weekPercent === 1 ? 'libro' : 'libros'}`}
          </span>
        </div>
        <div className="pc-tile">
          <Flame className="pc-tile__icon" aria-hidden="true" />
          <span className="pc-tile__value">{stats.streak}</span>
          <span className="pc-tile__label">{stats.streak === 1 ? 'Día seguido' : 'Días seguidos'}</span>
        </div>
        <div className="pc-tile">
          <BookOpen className="pc-tile__icon" aria-hidden="true" />
          <span className="pc-tile__value">{stats.totalPages.toLocaleString('es-ES')}</span>
          <span className="pc-tile__label">Páginas registradas</span>
        </div>
        <div className="pc-tile">
          <Star className="pc-tile__icon pc-tile__icon--star" aria-hidden="true" />
          <span className="pc-tile__value">{stats.avgRating ? formatRating(Math.round(stats.avgRating * 100) / 100) : '—'}</span>
          <span className="pc-tile__label">{stats.avgRating ? 'Valoración media' : 'Sin valoraciones'}</span>
        </div>
      </div>

      <section className="pc-card">
        <BarChart
          title="Páginas leídas · últimos 14 días"
          items={stats.days.map((d, i) => ({ key: d.date, value: d.pages, name: fmt(d.date), current: i === stats.days.length - 1 }))}
          label={(d) => `${parseDay(d.key).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}: ${d.value} páginas`}
          tick={(d, i) => ((stats.days.length - 1 - i) % 4 === 0 ? d.name : '')}
        />
      </section>

      <section className="pc-card pc-genres">
        <div className="pc-genres__list">
          <h3 className="pc-section-title">Géneros en tu librería</h3>
          {stats.genres.length === 0 ? (
            <p className="pc-muted">Aún no hay géneros en tus libros.</p>
          ) : (
            <ul>
              {stats.genres.map(([g, n]) => (
                <li key={g}>
                  <span className="pc-genres__name">{g}</span>
                  <span className="pc-genres__bar" style={{ '--w': `${(n / totalGenres) * 100}%` }} aria-hidden="true" />
                  <b>{n}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
        <img className="pc-genres__art" src="/assets/computer/olive-books.webp" alt="" width="360" height="329" aria-hidden="true" />
      </section>

      <section className="pc-card">
        <h3 className="pc-section-title">Más números</h3>
        <ul className="pc-facts">
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
      </section>
    </div>
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

function Ring({ value, max }) {
  const pct = Math.min(1, value / Math.max(1, max));
  const c = 2 * Math.PI * 52;
  return (
    <div className="pc-ring" role="img" aria-label={`${value} de ${max} libros`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="52" className="pc-ring__track" />
        <circle cx="60" cy="60" r="52" className="pc-ring__fill" style={{ strokeDasharray: c, strokeDashoffset: c * (1 - pct) }} />
      </svg>
      <span className="pc-ring__text" aria-hidden="true">
        <b>{value}</b>
        <span>de {max}</span>
        <small>libros</small>
      </span>
    </div>
  );
}

const stars = (r) => {
  const n = Math.round(r);
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
};

export function GoalApp() {
  const { state, actions } = useLibrary();
  const stats = useStats(state);
  const { yearGoal } = state.settings;
  const [editing, setEditing] = useState(false);
  const year = new Date().getFullYear();
  const dayOfYear = Math.ceil((Date.now() - new Date(year, 0, 1)) / 86400000);
  const expected = Math.round((yearGoal * dayOfYear) / 365);
  const done = stats.readYear.length;
  const remaining = Math.max(0, yearGoal - done);
  const weeksLeft = Math.max(1, daysLeftInYear() / 7);
  const nowMonth = new Date().getMonth();
  const months = MONTHS.map(() => 0);
  state.progress.readingLog.forEach((e) => {
    if (e.date.startsWith(String(year)) && e.kind !== 'correction') months[Number(e.date.slice(5, 7)) - 1] += e.pages || 0;
  });
  const finished = [...stats.readYear].sort((a, b) => (b.finishedAt || '').localeCompare(a.finishedAt || ''));

  return (
    <div className="pc-goal">
      <section className="pc-goal__hero">
        <Ring value={done} max={yearGoal} />
        <div className="pc-goal__text">
          <h3>{done >= yearGoal ? '¡Reto superado!' : done >= expected ? 'Vas al día.' : 'Cada libro cuenta.'}</h3>
          <p>
            {done >= yearGoal
              ? `Llevas ${done} libros este año.`
              : done >= expected
                ? `A estas alturas tocaban ${expected}. Te faltan ${remaining}.`
                : `Vas ${expected - done} por detrás del ritmo. Te faltan ${remaining}: unos ${(remaining / weeksLeft).toFixed(1)} libros por semana.`}
          </p>
          {editing ? (
            <label className="pc-goal__input">
              <span>Objetivo de libros</span>
              <input
                type="number"
                min="1"
                max="365"
                value={yearGoal}
                autoFocus
                onChange={(e) => actions.setSettings({ yearGoal: Math.max(1, Math.min(365, Number(e.target.value) || 1)) })}
                onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
              />
              <button type="button" className="pc-btn pc-btn--ghost" onClick={() => setEditing(false)}>
                Listo
              </button>
            </label>
          ) : (
            <button type="button" className="pc-btn pc-btn--ghost" onClick={() => setEditing(true)}>
              Editar objetivo
            </button>
          )}
        </div>
      </section>
      <p className="pc-goal__pages">{stats.pagesYear.toLocaleString('es-ES')} páginas terminadas este año</p>

      <section className="pc-card">
        <h3 className="pc-section-title">Tu torre de lecturas</h3>
        <BookTower books={stats.readYear} />
      </section>

      <section className="pc-card">
        <h3 className="pc-section-title">Libros completados ({done})</h3>
        {finished.length === 0 ? (
          <p className="pc-muted">Aún no has terminado ningún libro este año.</p>
        ) : (
          <ol className="pc-finished">
            {finished.map((b) => (
              <li key={b.id}>
                <span className="pc-finished__cover">
                  <Cover book={b} />
                </span>
                <span className="pc-finished__text">
                  <b>{b.title}</b>
                  <span>{b.author}</span>
                </span>
                {b.rating ? (
                  <span className="pc-finished__stars" role="img" aria-label={`${formatRating(b.rating)} estrellas`}>
                    {stars(b.rating)}
                  </span>
                ) : null}
                <time className="pc-finished__date">{new Date(b.finishedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</time>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="pc-card">
        <BarChart
          title={`Páginas por mes · ${year}`}
          items={months.map((p, i) => ({ key: String(i), value: p, name: MONTH_NAMES[i], current: i === nowMonth, future: i > nowMonth }))}
          label={(d) => `${d.name}: ${d.value} páginas`}
          tick={(d, i) => MONTHS[i]}
        />
      </section>
    </div>
  );
}

export function MissionsApp({ onOpenVault }) {
  const { state, actions } = useLibrary();
  const figCatalog = useFigureCatalog();
  const missions = missionStatus(state);
  const figs = state.progress.figures;
  const guardian = figCatalog.find((f) => f.id === figs.guardian);
  return (
    <div className="pc-missions">
      <section className="pc-guardian">
        {figs.boxes > 0 && (
          <span className="pc-guardian__boxes">
            <Gift aria-hidden="true" /> {figs.boxes} {figs.boxes === 1 ? 'caja por abrir' : 'cajas por abrir'}
          </span>
        )}
        {guardian ? (
          <>
            <span className="pc-guardian__fig">
              <FigureArt fig={guardian} display={figs.owned[guardian.id]?.display} />
            </span>
            <b className="pc-guardian__name">{guardian.name}</b>
            <span className="pc-guardian__rank">{RANK_STARS(rankOf(guardian.parts.length, figs.owned[guardian.id]))}</span>
            <span className="pc-guardian__seals" role="img" aria-label={`${figs.seals} de ${SEALS_PER_BOX} sellos`}>
              {Array.from({ length: SEALS_PER_BOX }, (_, i) => (
                <i key={i} data-on={i < figs.seals || undefined} />
              ))}
            </span>
          </>
        ) : (
          <p className="pc-muted">Elige un Guardián de Lectura en el Ático.</p>
        )}
        {figs.boxes === 0 && <p className="pc-muted">0 Cajas Sorpresa por abrir</p>}
        {onOpenVault && (
          <button type="button" className="pc-btn pc-btn--primary" onClick={onOpenVault}>
            Abrir el Ático
          </button>
        )}
      </section>

      <section>
        <h3 className="pc-section-title">Misiones de esta semana</h3>
        <p className="pc-muted pc-missions__hint">Se reinician cada lunes. Cada misión cumplida te da una Caja Sorpresa para el Ático del Coleccionista.</p>
        <ul className="pc-mission-list">
          {missions.map((m) => (
            <li key={m.id} className="pc-mission" data-done={m.done || undefined} data-claimed={m.claimed || undefined}>
              <div className="pc-mission__text">
                <strong>{m.title}</strong>
                <span className="pc-mission__progress">
                  <span className="pc-mission__bar" style={{ '--p': `${(m.value / m.target) * 100}%` }} aria-hidden="true" />
                  <em>
                    {m.value} / {m.target}
                  </em>
                </span>
              </div>
              {m.claimed ? (
                <span className="pc-mission__ok">
                  <Check aria-hidden="true" /> Reclamada
                </span>
              ) : (
                <button type="button" className="pc-btn pc-btn--primary pc-btn--small" disabled={!m.done} onClick={() => actions.claimMission(m.id)}>
                  <Gift aria-hidden="true" /> Reclamar
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
