// «Mi rincón» (SPEC §28.10, §35.3; rehecho en la 1.60, §60, según las maquetas del cuaderno): lo que otras personas
// pueden ver, en dos hojas. La primera, el rincón con su escena, los libros destacados, las figuras expuestas y el
// Guardián; la segunda, «Ambiente y recuerdos» (luz, lectura actual, última y próxima, libros que te representan,
// recuerdos en la mesa y adorno). Un solo formulario y un solo «Guardar mi rincón» para las dos: nada se publica hasta
// pulsarlo. Si el servidor aún no tiene la parte ilustrada (migración 1.35.0), se dice y no se finge que se guarda.
import { ArrowLeft, ArrowRight, BookOpen, Check, CloudRain, Moon, Plus, Search, Sun, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { FigureArt } from '../../../components/figures/FigureArt';
import { useFigureCatalog } from '../../../components/figures/figureCatalog';
import { ADORNMENTS, ADORNMENT_IDS } from '../../../components/primitives';
import { Cover } from '../../../components/shelf/BookItem';
import { currentBook } from '../../../domain/books';
import { normalizeText } from '../../../domain/bookSearch';
import { useLibrary } from '../../../state/useLibrary';
import { cornerSelection } from '../connections';
import { DEDICATION_MAX, MEMORY_IDS, MEMORY_MAX, MEMORY_OBJECTS, PHRASE_MAX, SCENES, SIGNATURE_MAX, cornerExtras, sceneOf } from '../huellas';
import { useCommunity } from '../hooks/useCommunity';
import { fetchCorner, saveCorner } from '../services/connections';
import { fetchAdornments, fetchCornerExtras, saveAdornment, saveCornerExtras } from '../services/huellas';
import { CornerScene } from './CornerScene';

const BOOKS_MAX = 3;
const FIGURES_MAX = 3;
const SCENE_ICON = { dia: Sun, lluvia: CloudRain, noche: Moon };
const byTitle = (a, b) => a.title.localeCompare(b.title, 'es');

/** Lo guardado en el servidor, como formulario. */
function toForm(corner, extras, adornment) {
  return {
    visible: Boolean(corner?.visible),
    books: (corner?.featured_books ?? []).map((b) => b.id),
    figures: corner?.figure_ids ?? [],
    guardian: corner?.guardian_id ?? null,
    showCurrent: Boolean(corner?.show_current),
    scene: sceneOf(extras?.scene),
    lastId: extras?.last_book?.id ?? '',
    nextId: extras?.next_book?.id ?? '',
    signature: (extras?.signature_books ?? []).map((b) => ({ id: b.id, phrase: b.phrase ?? '' })),
    memories: (extras?.memories ?? []).map((m) => ({ id: m.id, object: m.object, bookId: m.book?.id ?? '', dedication: m.dedication ?? '' })),
    adornment: adornment ?? '',
  };
}

export function CornerEditor({ Gate, children = null }) {
  const community = useCommunity({ autoload: true });
  const { state } = useLibrary();
  const catalog = useFigureCatalog();
  const owned = state.progress.figures?.owned ?? {};
  const [form, setForm] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const [page, setPage] = useState('rincon');
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');
  const ready = community.status === 'ready' && community.member;

  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    // La parte ilustrada es opcional: si el servidor aún no la tiene, el rincón de siempre sigue funcionando
    const soft = (p, fallback) => p.catch(() => fallback);
    Promise.all([fetchCorner(community.userId), soft(fetchCornerExtras(community.userId), { unavailable: true }), soft(fetchAdornments([community.userId]), {})])
      .then(([corner, extras, adornments]) => {
        if (!alive) return;
        setUnavailable(Boolean(extras?.unavailable));
        setForm(toForm(corner, extras, adornments[community.userId]));
      })
      .catch((e) => alive && setFailure(e.message));
    return () => {
      alive = false;
    };
  }, [ready, community.userId]);

  const books = useMemo(() => [...state.books].sort(byTitle), [state.books]);
  if (!ready || !form) return <Gate community={community}>{failure ? <p className="social-error">{failure}</p> : <p className="social-note">Abriendo tu rincón…</p>}</Gate>;

  const reading = currentBook(state.books, state.settings);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const toggleIn = (key, id, max) => setForm((f) => ({ ...f, [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : f[key].length < max ? [...f[key], id] : f[key] }));
  const ownedFigures = catalog.filter((f) => owned[f.id]);
  const featured = state.books.filter((b) => form.books.includes(b.id));
  const selection = cornerSelection({ books: featured, figures: form.figures, owned, guardian: form.guardian, showCurrent: form.showCurrent, currentTitle: reading?.title ?? '' });
  const extras = cornerExtras({ books: state.books, ...form });
  // La escena de muestra es la misma que verán los demás (con lo elegido, aunque aún no esté guardado)
  const preview = { ...selection, ...extras, visible: true };
  const previewFigure = [...selection.figure_ids, selection.guardian_id].map((id) => (id ? catalog.find((f) => f.id === id) : null)).find(Boolean) ?? null;

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFailure('');
    setMessage('');
    try {
      await saveCorner(community.userId, { visible: form.visible, ...selection });
      if (!unavailable) {
        await saveCornerExtras(community.userId, extras);
        await saveAdornment(community.userId, form.adornment || null);
      }
      setMessage(form.visible ? 'Tu rincón está a la vista de la comunidad.' : 'Tu rincón está guardado y oculto.');
    } catch (e) {
      setFailure(e.message);
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <>
      {failure && (
        <p className="social-error" role="alert">
          {failure}
        </p>
      )}
      <button type="submit" className="corner-save" disabled={saving}>
        {saving ? 'Guardando…' : 'Guardar mi rincón'}
      </button>
      <p className="corner-status" role="status">
        {message}
      </p>
    </>
  );

  if (page === 'ambiente')
    return (
      <form className="corner-editor" data-page="ambiente" onSubmit={save} noValidate aria-labelledby="corner-ambiente-title">
        <button type="button" className="corner-back" onClick={() => setPage('rincon')}>
          <ArrowLeft aria-hidden="true" /> Volver a mi rincón
        </button>
        <h3 id="corner-ambiente-title" className="corner-title">
          Ambiente y recuerdos
        </h3>
        {unavailable && (
          <p className="social-note" role="status">
            Esta parte del rincón aún no está disponible en el servidor (falta aplicar la migración 1.35.0). Puedes prepararla, pero no se guardará hasta entonces.
          </p>
        )}
        <img className="corner-ambient" src={`${SCENES[form.scene].src}-768.webp`} alt="" width="768" height="512" decoding="async" />
        <fieldset className="corner-box corner-light">
          <legend>Luz de la escena</legend>
          {Object.entries(SCENES).map(([id, s]) => {
            const Icon = SCENE_ICON[id];
            return (
              <label key={id} className="corner-light__option" data-scene={id}>
                <input type="radio" name="corner-scene" checked={form.scene === id} onChange={() => set({ scene: id })} />
                <Icon aria-hidden="true" />
                <span>{s.label}</span>
              </label>
            );
          })}
        </fieldset>
        <label className="corner-check">
          <input type="checkbox" checked={form.showCurrent} disabled={!reading} onChange={(e) => set({ showCurrent: e.target.checked })} />
          <span>
            Mostrar lo que estoy leyendo ahora
            {reading && <small>«{reading.title}»</small>}
          </span>
        </label>
        <BookSelect label="Última lectura" value={form.lastId} options={books.filter((b) => b.status === 'read')} onChange={(lastId) => set({ lastId })} />
        <BookSelect label="Próxima lectura (la eliges tú)" value={form.nextId} options={books.filter((b) => b.status === 'want')} onChange={(nextId) => set({ nextId })} />
        <fieldset className="corner-box corner-signature">
          <legend>Libros que me representan (hasta {SIGNATURE_MAX})</legend>
          {form.signature.map((s, i) => (
            <div key={i} className="corner-row">
              <BookSelect label={`Libro ${i + 1}`} hideLabel value={s.id} options={books} empty="Elige un libro" onChange={(id) => set({ signature: form.signature.map((x, j) => (j === i ? { ...x, id } : x)) })} />
              <input className="social-input" aria-label={`Frase personal del libro ${i + 1} (opcional)`} placeholder="Una frase personal (opcional)" maxLength={PHRASE_MAX} value={s.phrase} onChange={(e) => set({ signature: form.signature.map((x, j) => (j === i ? { ...x, phrase: e.target.value } : x)) })} />
              <button type="button" className="corner-remove" aria-label={`Quitar el libro ${i + 1}`} onClick={() => set({ signature: form.signature.filter((_, j) => j !== i) })}>
                <X aria-hidden="true" />
              </button>
            </div>
          ))}
          {form.signature.length < SIGNATURE_MAX && (
            <button type="button" className="corner-add" onClick={() => set({ signature: [...form.signature, { id: '', phrase: '' }] })}>
              <Plus aria-hidden="true" /> Añadir un libro
            </button>
          )}
        </fieldset>
        <section className="corner-memories" aria-labelledby="corner-memories-title">
          <h4 id="corner-memories-title">Recuerdos en la mesa (hasta {MEMORY_MAX})</h4>
          <p className="corner-hint">Cada recuerdo va unido a un libro de tu biblioteca.</p>
          <div className="corner-memories__grid">
            {MEMORY_IDS.map((id) => {
              const on = form.memories.some((m) => m.object === id);
              const full = !on && form.memories.length >= MEMORY_MAX;
              return (
                <button
                  key={id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  aria-label={MEMORY_OBJECTS[id].name}
                  disabled={full}
                  className="corner-memory"
                  onClick={() => set({ memories: on ? form.memories.filter((m) => m.object !== id) : [...form.memories, { id: `m${Date.now().toString(36)}`, object: id, bookId: '', dedication: '' }] })}
                >
                  <img src={MEMORY_OBJECTS[id].art} alt="" loading="lazy" decoding="async" />
                  <span className="corner-memory__mark" aria-hidden="true">
                    {on && <Check />}
                  </span>
                </button>
              );
            })}
          </div>
          {form.memories.map((m, i) => (
            <div key={m.id} className="corner-row corner-row--memory">
              <b>{MEMORY_OBJECTS[m.object]?.name ?? 'Recuerdo'}</b>
              <BookSelect label={`Libro del recuerdo ${i + 1}`} hideLabel value={m.bookId} options={books} empty="Elige un libro" onChange={(bookId) => set({ memories: form.memories.map((x, j) => (j === i ? { ...x, bookId } : x)) })} />
              <input className="social-input" aria-label={`Dedicatoria del recuerdo ${i + 1} (opcional)`} placeholder="Dedicatoria (opcional)" maxLength={DEDICATION_MAX} value={m.dedication} onChange={(e) => set({ memories: form.memories.map((x, j) => (j === i ? { ...x, dedication: e.target.value } : x)) })} />
            </div>
          ))}
        </section>
        <label className="corner-field">
          <span>Adorno bajo tu avatar (solo estético)</span>
          <select className="social-input" value={form.adornment} onChange={(e) => set({ adornment: e.target.value })}>
            <option value="">Sin adorno</option>
            {ADORNMENT_IDS.map((id) => (
              <option key={id} value={id}>
                {ADORNMENTS[id].name}
              </option>
            ))}
          </select>
        </label>
        {footer}
      </form>
    );

  const guardian = ownedFigures.find((f) => f.id === form.guardian) ?? null;
  return (
    <>
    <form className="corner-editor" data-page="rincon" onSubmit={save} noValidate aria-label="Mi rincón">
      <p className="corner-intro">Elige qué pueden ver otras personas. Tu biblioteca, tus notas y tus avances siguen siendo privados.</p>
      <label className="corner-check corner-check--strong">
        <input type="checkbox" checked={form.visible} onChange={(e) => set({ visible: e.target.checked })} />
        <span>Mostrar mi rincón a la comunidad</span>
      </label>
      <div className="corner-preview">
        <CornerScene corner={preview} figure={previewFigure} ownerAlias={community.profile?.alias ?? ''} />
      </div>
      <section className="corner-section" aria-labelledby="corner-books-title">
        <h4 id="corner-books-title" className="corner-heading">
          Libros destacados · {form.books.length}/{BOOKS_MAX}
        </h4>
        {featured.length > 0 ? (
          <ul className="corner-cards">
            {featured.map((b) => (
              <li key={b.id} className="corner-card">
                <span className="corner-card__cover" aria-hidden="true">
                  <Cover book={b} />
                </span>
                <b>{b.title}</b>
                <small>{b.author}</small>
                <button type="button" role="checkbox" aria-checked="true" className="corner-card__mark" aria-label={`Quitar «${b.title}» de los destacados`} onClick={() => toggleIn('books', b.id, BOOKS_MAX)}>
                  <Check aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="corner-hint">Aún no has destacado ningún libro.</p>
        )}
        <div className="corner-change">
          <button type="button" className="corner-ghost" aria-expanded={picking} onClick={() => setPicking((v) => !v)}>
            {picking ? 'Hecho' : 'Cambiar libros'}
          </button>
        </div>
        {picking && <BookPicker books={books} selected={form.books} max={BOOKS_MAX} onToggle={(id) => toggleIn('books', id, BOOKS_MAX)} />}
      </section>
      <section className="corner-section" aria-labelledby="corner-figures-title">
        <h4 id="corner-figures-title" className="corner-heading">
          Figuras expuestas · {form.figures.filter((id) => owned[id]).length}/{FIGURES_MAX}
        </h4>
        {ownedFigures.length === 0 ? (
          <p className="corner-hint">Aún no tienes figuras desbloqueadas.</p>
        ) : (
          <ul className="corner-cards">
            {ownedFigures.map((f) => {
              const on = form.figures.includes(f.id);
              return (
                <li key={f.id} className="corner-card corner-card--figure">
                  <span className="corner-card__art" aria-hidden="true">
                    <FigureArt fig={f} display="box" />
                  </span>
                  <b>{f.name}</b>
                  <button type="button" role="checkbox" aria-checked={on} disabled={!on && form.figures.length >= FIGURES_MAX} className="corner-card__mark" aria-label={`Exponer «${f.name}»`} onClick={() => toggleIn('figures', f.id, FIGURES_MAX)}>
                    {on && <Check aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {ownedFigures.length > 0 && (
        <section className="corner-section" aria-labelledby="corner-guardian-title">
          <h4 id="corner-guardian-title" className="corner-heading">
            Guardián expuesto
          </h4>
          <div className="corner-guardian">
            <span className="corner-guardian__art" aria-hidden="true">
              {guardian && <FigureArt fig={guardian} display="box" />}
            </span>
            <select className="social-input" aria-label="Guardián expuesto (en el reposabrazos de tu sillón)" value={form.guardian ?? ''} onChange={(e) => set({ guardian: e.target.value || null })}>
              <option value="">Ninguno</option>
              {ownedFigures.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </section>
      )}
      {footer}
      <button type="button" className="corner-more" onClick={() => setPage('ambiente')}>
        <img src="/assets/bookshelf/notebook/botanical-sprig.webp" alt="" width="160" height="249" aria-hidden="true" />
        <span>Personalizar ambiente y recuerdos</span>
        <ArrowRight aria-hidden="true" />
      </button>
    </form>
    {/* Lo que va debajo en la hoja principal (las colecciones, con su propio formulario) */}
    {children}
    </>
  );
}

/** Selector de un libro de la biblioteca con el icono de libro de la maqueta. */
function BookSelect({ label, hideLabel = false, value, options, onChange, empty = 'No mostrar' }) {
  return (
    <label className="corner-field">
      <span className={hideLabel ? 'sr-only-focus' : undefined}>{label}</span>
      <span className="corner-select">
        <BookOpen aria-hidden="true" />
        <select className="social-input" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{empty}</option>
          {options.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

/** Elegir los libros destacados: con búsqueda (las bibliotecas grandes no caben en una lista). */
function BookPicker({ books, selected, max, onToggle }) {
  const [query, setQuery] = useState('');
  const terms = normalizeText(query).split(' ').filter(Boolean);
  const shown = books.filter((b) => selected.includes(b.id) || terms.every((t) => normalizeText(`${b.title} ${b.author}`).includes(t))).slice(0, 40);
  return (
    <fieldset className="corner-box corner-picker">
      <legend>Hasta {max} libros destacados</legend>
      <label className="corner-search">
        <Search aria-hidden="true" />
        <input type="search" className="social-input" placeholder="Buscar en tu biblioteca…" aria-label="Buscar un libro para destacar" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {shown.map((b) => (
        <label key={b.id} className="social-check">
          <input type="checkbox" checked={selected.includes(b.id)} disabled={!selected.includes(b.id) && selected.length >= max} onChange={() => onToggle(b.id)} />
          <span>
            {b.title} <small>· {b.author}</small>
          </span>
        </label>
      ))}
      {!shown.length && <p className="corner-hint">Ningún libro coincide.</p>}
    </fieldset>
  );
}
