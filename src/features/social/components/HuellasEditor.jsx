// Editor del rincón ilustrado y de las colecciones (SPEC §28.10). Todo es elección y publicación voluntarias:
// nada se expone hasta pulsar «Guardar». Sin IA ni emociones adjudicadas: la dedicatoria la escribe la persona.
// Si el servidor aún no tiene la migración 1.35.0, se explica y no se finge que se ha guardado.
import { useEffect, useState } from 'react';
import { ADORNMENTS, ADORNMENT_IDS } from '../../../components/primitives';
import { useLibrary } from '../../../state/useLibrary';
import { COLLECTION_MAX, DEDICATION_MAX, MEMORY_IDS, MEMORY_MAX, MEMORY_OBJECTS, PHRASE_MAX, SCENES, SIGNATURE_MAX, collectionPayload, cornerExtras } from '../huellas';
import { useCommunity } from '../hooks/useCommunity';
import { deleteCollection, fetchAdornments, fetchCollections, fetchCornerExtras, saveAdornment, saveCollection, saveCornerExtras } from '../services/huellas';

const byTitle = (a, b) => a.title.localeCompare(b.title, 'es');

export function HuellasEditor() {
  const community = useCommunity({ autoload: true });
  const { state } = useLibrary();
  const [form, setForm] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const [status, setStatus] = useState('');
  const [failure, setFailure] = useState('');
  const [saving, setSaving] = useState(false);
  const ready = community.status === 'ready' && community.member;
  const books = [...state.books].sort(byTitle);

  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    Promise.all([fetchCornerExtras(community.userId), fetchAdornments([community.userId])])
      .then(([x, adornments]) => {
        if (!alive) return;
        setUnavailable(Boolean(x?.unavailable));
        setForm({
          scene: x?.scene ?? 'dia',
          lastId: x?.last_book?.id ?? '',
          nextId: x?.next_book?.id ?? '',
          signature: (x?.signature_books ?? []).map((b) => ({ id: b.id, phrase: b.phrase ?? '' })),
          memories: (x?.memories ?? []).map((m) => ({ id: m.id, object: m.object, bookId: m.book?.id ?? '', dedication: m.dedication ?? '' })),
          adornment: adornments[community.userId] ?? '',
        });
      })
      .catch((e) => alive && setFailure(e.message));
    return () => {
      alive = false;
    };
  }, [ready, community.userId]);

  if (!ready || !form) return null;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setSig = (i, patch) => set({ signature: form.signature.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const setMem = (i, patch) => set({ memories: form.memories.map((m, j) => (j === i ? { ...m, ...patch } : m)) });

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFailure('');
    setStatus('');
    try {
      await saveCornerExtras(community.userId, cornerExtras({ books: state.books, ...form }));
      await saveAdornment(community.userId, form.adornment || null);
      setStatus('Tu rincón ilustrado se ha guardado.');
    } catch (e) {
      setFailure(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="profile-form huellas-editor" onSubmit={save} noValidate aria-labelledby="huellas-title">
      <h4 id="huellas-title">Rincón ilustrado</h4>
      {unavailable && (
        <p className="social-note" role="status">
          Esta parte del rincón aún no está disponible en el servidor (falta aplicar la migración 1.35.0). Puedes prepararla, pero no se guardará hasta entonces.
        </p>
      )}
      <fieldset className="corner-pick">
        <legend>Luz de la escena</legend>
        <div className="huellas-row">
          {Object.entries(SCENES).map(([id, s]) => (
            <label key={id} className="social-check">
              <input type="radio" name="huellas-scene" checked={form.scene === id} onChange={() => set({ scene: id })} />
              <span>{s.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        <span>Última lectura</span>
        <select className="social-input" value={form.lastId} onChange={(e) => set({ lastId: e.target.value })}>
          <option value="">No mostrar</option>
          {books
            .filter((b) => b.status === 'read')
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
        </select>
      </label>
      <label>
        <span>Próxima lectura (la eliges tú)</span>
        <select className="social-input" value={form.nextId} onChange={(e) => set({ nextId: e.target.value })}>
          <option value="">No mostrar</option>
          {books
            .filter((b) => b.status === 'want')
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
        </select>
      </label>
      <fieldset className="corner-pick">
        <legend>Libros que me representan (hasta {SIGNATURE_MAX})</legend>
        {form.signature.map((s, i) => (
          <div key={i} className="huellas-item">
            <select className="social-input" aria-label={`Libro ${i + 1}`} value={s.id} onChange={(e) => setSig(i, { id: e.target.value })}>
              <option value="">Elige un libro</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
            <input className="social-input" aria-label={`Frase personal del libro ${i + 1} (opcional)`} placeholder="Una frase personal (opcional)" maxLength={PHRASE_MAX} value={s.phrase} onChange={(e) => setSig(i, { phrase: e.target.value })} />
            <button type="button" className="social-btn" onClick={() => set({ signature: form.signature.filter((_, j) => j !== i) })}>
              Quitar
            </button>
          </div>
        ))}
        {form.signature.length < SIGNATURE_MAX && (
          <button type="button" className="social-btn" onClick={() => set({ signature: [...form.signature, { id: '', phrase: '' }] })}>
            Añadir un libro
          </button>
        )}
      </fieldset>
      <fieldset className="corner-pick">
        <legend>Recuerdos en la mesa (hasta {MEMORY_MAX})</legend>
        <p className="social-note">Cada recuerdo va unido a un libro de tu biblioteca. La dedicatoria es tuya y opcional.</p>
        {form.memories.map((m, i) => (
          <div key={i} className="huellas-item">
            <select className="social-input" aria-label={`Objeto del recuerdo ${i + 1}`} value={m.object} onChange={(e) => setMem(i, { object: e.target.value })}>
              {MEMORY_IDS.map((id) => (
                <option key={id} value={id}>
                  {MEMORY_OBJECTS[id].name}
                </option>
              ))}
            </select>
            <select className="social-input" aria-label={`Libro del recuerdo ${i + 1}`} value={m.bookId} onChange={(e) => setMem(i, { bookId: e.target.value })}>
              <option value="">Elige un libro</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
            <input className="social-input" aria-label={`Dedicatoria del recuerdo ${i + 1} (opcional)`} placeholder="Dedicatoria (opcional)" maxLength={DEDICATION_MAX} value={m.dedication} onChange={(e) => setMem(i, { dedication: e.target.value })} />
            <button type="button" className="social-btn" onClick={() => set({ memories: form.memories.filter((_, j) => j !== i) })}>
              Quitar
            </button>
          </div>
        ))}
        {form.memories.length < MEMORY_MAX && (
          <button type="button" className="social-btn" onClick={() => set({ memories: [...form.memories, { id: `m${Date.now().toString(36)}`, object: 'farol', bookId: '', dedication: '' }] })}>
            Añadir un recuerdo
          </button>
        )}
      </fieldset>
      <label>
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
      {failure && (
        <p className="social-error" role="alert">
          {failure}
        </p>
      )}
      <div className="social-actions">
        <button type="submit" className="social-btn social-btn--primary" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar mi rincón ilustrado'}
        </button>
        <span role="status">{status}</span>
      </div>
    </form>
  );
}

const EMPTY = { id: null, title: '', dedication: '', items: [], visible: false };

export function CollectionsEditor() {
  const community = useCommunity({ autoload: true });
  const { state } = useLibrary();
  const [list, setList] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const [form, setForm] = useState(null);
  const [tried, setTried] = useState(false);
  const [failure, setFailure] = useState('');
  const [status, setStatus] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const ready = community.status === 'ready' && community.member;
  const books = [...state.books].sort(byTitle);

  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    fetchCollections(community.userId)
      .then((r) => {
        if (!alive) return;
        setUnavailable(r.unavailable);
        setList(r.items);
      })
      .catch((e) => alive && setFailure(e.message));
    return () => {
      alive = false;
    };
  }, [ready, community.userId]);

  if (!ready || !list) return null;
  const { errors, payload } = form ? collectionPayload({ ...form, books: state.books }) : { errors: {}, payload: null };
  const toggleBook = (id) => setForm((f) => ({ ...f, items: f.items.some((i) => i.id === id) ? f.items.filter((i) => i.id !== id) : f.items.length < COLLECTION_MAX ? [...f.items, { id, phrase: '' }] : f.items }));

  const submit = async (event) => {
    event.preventDefault();
    setTried(true);
    if (Object.keys(errors).length) return;
    setFailure('');
    try {
      const saved = await saveCollection(form.id, payload);
      setList((l) => [saved, ...l.filter((c) => c.id !== saved.id)]);
      setForm(null);
      setTried(false);
      setStatus(`Colección «${saved.title}» guardada${saved.visible ? ' y visible en tu rincón' : ' (privada)'}.`);
    } catch (e) {
      setFailure(e.message);
    }
  };

  return (
    <section className="profile-form huellas-editor" aria-labelledby="collections-title">
      <h4 id="collections-title">Mis colecciones</h4>
      {unavailable && <p className="social-note">Las colecciones aún no están disponibles en el servidor (falta aplicar la migración 1.35.0).</p>}
      {list.length === 0 && !form && !unavailable && <p className="social-note">Aún no has creado colecciones.</p>}
      <ul className="huellas-collections">
        {list.map((c) => (
          <li key={c.id}>
            <span>
              <b>{c.title}</b> <small>· {c.books.length} libros · {c.visible ? 'visible' : 'privada'}</small>
            </span>
            <span className="social-actions">
              <button type="button" className="social-btn" onClick={() => setForm({ id: c.id, title: c.title, dedication: c.dedication ?? '', items: c.books.map((b) => ({ id: b.id, phrase: b.phrase ?? '' })), visible: c.visible })}>
                Editar
              </button>
              {confirmId === c.id ? (
                <>
                  <button
                    type="button"
                    className="social-btn social-btn--primary"
                    onClick={async () => {
                      try {
                        await deleteCollection(c.id);
                        setList((l) => l.filter((x) => x.id !== c.id));
                        setStatus('Colección borrada.');
                      } catch (e) {
                        setFailure(e.message);
                      }
                      setConfirmId(null);
                    }}
                  >
                    Sí, borrar
                  </button>
                  <button type="button" className="social-btn" onClick={() => setConfirmId(null)}>
                    Cancelar
                  </button>
                </>
              ) : (
                <button type="button" className="social-btn" onClick={() => setConfirmId(c.id)}>
                  Borrar
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {!form && !unavailable && (
        <button type="button" className="social-btn" onClick={() => setForm(EMPTY)}>
          Crear una colección
        </button>
      )}
      {form && (
        <form onSubmit={submit} noValidate className="huellas-collection-form">
          <label>
            <span>Título</span>
            <input className="social-input" value={form.title} maxLength={80} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} aria-invalid={tried && errors.title ? 'true' : undefined} />
          </label>
          {tried && errors.title && <p className="social-error">{errors.title}</p>}
          <label>
            <span>Dedicatoria (opcional)</span>
            <textarea className="social-input" rows={2} maxLength={300} value={form.dedication} onChange={(e) => setForm((f) => ({ ...f, dedication: e.target.value }))} />
          </label>
          <fieldset className="corner-pick">
            <legend>Libros (hasta {COLLECTION_MAX}; las tres primeras portadas protagonizan la colección)</legend>
            {tried && errors.books && <p className="social-error">{errors.books}</p>}
            {books.slice(0, 80).map((b) => {
              const item = form.items.find((i) => i.id === b.id);
              return (
                <div key={b.id} className="huellas-item">
                  <label className="social-check">
                    <input type="checkbox" checked={Boolean(item)} disabled={!item && form.items.length >= COLLECTION_MAX} onChange={() => toggleBook(b.id)} />
                    <span>
                      {b.title} <small>· {b.author}</small>
                    </span>
                  </label>
                  {item && <input className="social-input" aria-label={`Frase para ${b.title} (opcional)`} placeholder="Frase (opcional)" maxLength={PHRASE_MAX} value={item.phrase} onChange={(e) => setForm((f) => ({ ...f, items: f.items.map((i) => (i.id === b.id ? { ...i, phrase: e.target.value } : i)) }))} />}
                </div>
              );
            })}
          </fieldset>
          <label className="social-check">
            <input type="checkbox" checked={form.visible} onChange={(e) => setForm((f) => ({ ...f, visible: e.target.checked }))} />
            <span>Mostrarla en mi rincón</span>
          </label>
          <div className="social-actions">
            <button type="submit" className="social-btn social-btn--primary">
              Guardar colección
            </button>
            <button
              type="button"
              className="social-btn"
              onClick={() => {
                setForm(null);
                setTried(false);
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      {failure && (
        <p className="social-error" role="alert">
          {failure}
        </p>
      )}
      <p role="status" className="social-note">
        {status}
      </p>
    </section>
  );
}
