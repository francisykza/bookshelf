// Editor de las colecciones (SPEC §28.10; el del rincón ilustrado está en CornerEditor.jsx desde la 1.60). Todo es elección y publicación voluntarias:
// nada se expone hasta pulsar «Guardar». Sin IA ni emociones adjudicadas: la dedicatoria la escribe la persona.
// Si el servidor aún no tiene la migración 1.35.0, se explica y no se finge que se ha guardado.
import { useEffect, useState } from 'react';
import { useLibrary } from '../../../state/useLibrary';
import { COLLECTION_MAX, PHRASE_MAX, collectionPayload } from '../huellas';
import { useCommunity } from '../hooks/useCommunity';
import { deleteCollection, fetchCollections, saveCollection } from '../services/huellas';

const byTitle = (a, b) => a.title.localeCompare(b.title, 'es');

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
