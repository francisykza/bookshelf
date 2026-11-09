// «Mi tablón»: el mismo panel desde el mueble y desde el ordenador. Una composición se organiza libremente; cada gesto se guarda al
// terminar, con borrador local y revisión: si otra sesión ha cambiado el mapa, no se sobrescribe sin preguntar.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLibrary } from '../../state/useLibrary';
import { useCommunity } from '../social/hooks/useCommunity';
import { blockUser, reportContent } from '../social/services/community';
import { FIRMAS } from '../edificio/catalog';
import { Lienzo } from './Lienzo';
import { BoardFrame, DetailSheet, Sheet } from './parts';
import { PortIcon } from '../../ui/PortIcon';
import { Papers } from './TablonVisita';
import * as api from './service';
import { addEdge, boundsOf, bottomZ, emptyDoc, itemSummary, KIND_NAMES, MAX_LABEL, MAX_NOTE, MAX_TITLE, newItem, normalizeAngle, patchEdge, patchItem, PINS, removeEdge, removeItem, resized, safeCover, sortedItems, STICKERS, THREAD_NAMES, THREADS, topZ, uid } from './model';
import './tablon.css';

const STATUS = { saved: 'Guardado', saving: 'Guardando…', error: 'Error al guardar', conflict: 'Conflicto', local: 'Guardado aquí' };
const HISTORY = 50;

function ItemEditor({ item, isNew, ask, onDirty, onSave, onDelete, onClose, onAnswer }) {
  const [draft, setDraft] = useState(item);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const dirty = isNew ? Boolean(draft.body.trim()) : JSON.stringify(draft) !== JSON.stringify(item);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  const canSave = draft.kind !== 'note' || draft.body.trim();
  const save = () => canSave && onSave(draft);
  const field = (name, label, key, min, max, apply) => (
    <label className="tb-field tb-field--num" key={key}>
      <span>{label}</span>
      <input type="number" inputMode="decimal" min={min} max={max} value={Math.round(draft[key] * 10) / 10} onChange={(e) => e.target.value !== '' && Number.isFinite(Number(e.target.value)) && (apply ? apply(Number(e.target.value)) : set({ [key]: Number(e.target.value) }))} />
    </label>
  );
  return (
    <Sheet
      title={isNew ? 'Nueva nota' : `Editar · ${KIND_NAMES[item.kind]}`}
      onClose={onClose}
      footer={
        <>
          {!isNew && <button type="button" className="tb-btn tb-btn--danger" onClick={() => onDelete(item.id)}>Borrar</button>}
          <button type="button" className="tb-btn tb-btn--main" disabled={!canSave} onClick={save}>Guardar</button>
        </>
      }
    >
      <div className="tb-form">
        {draft.kind === 'note' ? (
          <label className="tb-field">
            <span>Texto</span>
            <textarea autoFocus value={draft.body} maxLength={MAX_NOTE} rows={5} onChange={(e) => set({ body: e.target.value })} />
            <small aria-live="polite">{draft.body.length} / {MAX_NOTE}</small>
          </label>
        ) : (
          <div className="tb-field">
            <span>{draft.kind === 'received' ? 'Texto firmado (no se puede cambiar)' : 'Texto'}</span>
            <p className="tb-readonly">{draft.retirada ? 'Nota retirada' : draft.body}</p>
          </div>
        )}
        <Papers value={draft.paper} onChange={(paper) => set({ paper })} />
        <label className="tb-field">
          <span>Chincheta</span>
          <select value={draft.pin} onChange={(e) => set({ pin: e.target.value })}>
            {Object.entries(PINS).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
        </label>
        <label className="tb-field">
          <span>Adorno</span>
          <select value={draft.sticker ?? ''} onChange={(e) => set({ sticker: e.target.value || null })}>
            <option value="">Ninguno</option>
            {Object.entries(STICKERS).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
        </label>
        {draft.kind !== 'received' && <label className="tb-check"><input type="checkbox" checked={draft.spoiler} onChange={(e) => set({ spoiler: e.target.checked })} /> Contiene spoiler</label>}
        <fieldset className="tb-grid">
          <legend>Posición exacta</legend>
          {field('x', 'X', 'x', -50000, 50000)}
          {field('y', 'Y', 'y', -50000, 50000)}
          {field('w', 'Ancho', 'width', 80, 900, (v) => set(resized(draft, v, draft.height)))}
          {field('h', 'Alto', 'height', 60, 900, (v) => set(resized(draft, draft.width, v)))}
          {field('a', 'Ángulo', 'rotation', -180, 180, (v) => set({ rotation: normalizeAngle(v) }))}
        </fieldset>
      </div>
      {ask && (
        <Sheet title="Hay cambios sin guardar" onClose={() => onAnswer('keep')}>
          <div className="tb-choices">
            <button type="button" className="tb-btn tb-btn--main" disabled={!canSave} onClick={() => (onAnswer('keep'), save())}>Guardar</button>
            <button type="button" className="tb-btn tb-btn--danger" onClick={() => onAnswer('discard')}>Descartar</button>
            <button type="button" className="tb-btn" onClick={() => onAnswer('keep')}>Seguir editando</button>
          </div>
        </Sheet>
      )}
    </Sheet>
  );
}

function AddSheet({ books, onNote, onBook, onQuote, onClose }) {
  const [tab, setTab] = useState('menu');
  const [q, setQ] = useState('');
  const [copy, setCopy] = useState(null);
  const text = q.trim().toLowerCase();
  // Acotado: nunca se monta la biblioteca entera
  const shownBooks = useMemo(() => books.filter((b) => !text || `${b.title} ${b.author}`.toLowerCase().includes(text)).slice(0, 30), [books, text]);
  const quotes = useMemo(() => {
    const out = [];
    for (const b of books) for (const c of b.quotes ?? []) if (!text || `${c.text} ${b.title}`.toLowerCase().includes(text)) out.push({ book: b, quote: c });
    return out.slice(0, 30);
  }, [books, text]);
  if (copy)
    return (
      <Sheet title="Copiar esta cita" onClose={() => setCopy(null)}>
        <blockquote className="tb-readonly">{copy.quote.text}</blockquote>
        <p className="tb-note">Se hará una copia en el tablón. Si cambias la cita en tu Diario, esta copia no cambiará, y si publicas la composición otras personas podrán leerla.</p>
        <button type="button" className="tb-btn tb-btn--main" onClick={() => onQuote(copy)}>Copiar al tablón</button>
      </Sheet>
    );
  return (
    <Sheet title="Añadir" onClose={onClose}>
      {tab === 'menu' ? (
        <div className="tb-choices">
          <button type="button" className="tb-btn" onClick={onNote}>Nota</button>
          <button type="button" className="tb-btn" onClick={() => setTab('book')}>Libro de mi biblioteca</button>
          <button type="button" className="tb-btn" onClick={() => setTab('quote')}>Cita de mi Diario</button>
        </div>
      ) : (
        <>
          <label className="tb-field"><span>Buscar</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <ul className="tb-list">
            {tab === 'book'
              ? shownBooks.map((b) => <li key={b.id}><button type="button" onClick={() => onBook(b)}><b>{b.title}</b><small>{b.author}</small></button></li>)
              : quotes.map((c) => <li key={c.quote.id}><button type="button" onClick={() => setCopy(c)}><span>{c.quote.text}</span><small>{c.book.title}</small></button></li>)}
          </ul>
          {tab === 'quote' && !quotes.length && <p className="tb-note">No hay citas en tu Diario que coincidan.</p>}
        </>
      )}
    </Sheet>
  );
}

function Received({ board, onOpen, onPlace, onArchive, onBlock, onReport, onClose }) {
  return (
    <Sheet title={`Recibidas · ${board.recibidas.length}`} onClose={onClose}>
      {!board.recibidas.length && <p className="tb-note">Aún no has recibido ningún post-it.</p>}
      <ul className="tb-received">
        {board.recibidas.map((n) => (
          <li key={n.id} data-unread={!n.read_at && !n.withdrawn_at ? 'si' : undefined}>
            <button type="button" className="tb-received__open" onClick={() => onOpen(n)}>
              {!n.read_at && !n.withdrawn_at && <img src="/assets/puerto/tablon/unread.svg" alt="Sin leer" width="20" height="20" />}
              <b>{n.alias}</b>
              <span>{n.withdrawn_at ? 'Nota retirada' : n.spoiler ? 'Contiene spoiler' : n.body}</span>
            </button>
            <div className="tb-received__do">
              {!n.withdrawn_at && <button type="button" className="tb-btn" onClick={() => onPlace(n)}>Colocar en mapa</button>}
              <button type="button" className="tb-btn" onClick={() => onArchive(n)}>Archivar</button>
              <button type="button" className="tb-btn" onClick={() => onBlock(n)}>Bloquear</button>
              <button type="button" className="tb-btn" onClick={() => onReport(n)}>Denunciar</button>
            </div>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function SentNotes({ onClose }) {
  const [notes, setNotes] = useState(null);
  const [error, setError] = useState('');
  const load = () => api.sentNotes().then(setNotes, (e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  const run = (p) => p.then(load, (e) => setError(e.message));
  return (
    <Sheet title="Post-its enviados" onClose={onClose}>
      {error && <p className="tb-note" role="alert">{error}</p>}
      {notes && !notes.length && <p className="tb-note">Aún no has enviado ninguno.</p>}
      <ul className="tb-received">
        {notes?.map((n) => (
          <li key={n.id}>
            <p><b>Para {n.alias}</b> {n.withdrawn_at ? 'Retirado' : n.body}</p>
            {!n.withdrawn_at && (
              <div className="tb-received__do">
                <button type="button" className="tb-btn" onClick={() => run(api.setNotePermission(n.id, !n.author_allows_public))}>{n.author_allows_public ? 'Quitar permiso público' : 'Permitir en público'}</button>
                <button type="button" className="tb-btn tb-btn--danger" onClick={() => run(api.withdrawNote(n.id))}>Retirar</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function OldGuestbook({ userId, onClose }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    api.oldGuestbook(userId).then(setRows, () => setRows([]));
  }, [userId]);
  return (
    <Sheet title="Libro de visitas antiguo" onClose={onClose}>
      <p className="tb-note">Solo lo ves tú.</p>
      <ul className="tb-received">
        {rows?.map((v) => <li key={`${v.de}${v.dia}`}><p><b>{v.alias ?? 'Un vecino'}</b> «{FIRMAS.find((f) => f.id === v.frase)?.texto ?? v.frase}»</p></li>)}
      </ul>
      {rows && !rows.length && <p className="tb-note">No hay firmas.</p>}
    </Sheet>
  );
}

function PublishSheet({ title, doc, ready, result, busy, onConfirm, onRemove, onClose }) {
  const map = useRef(null);
  const faltan = result?.faltan ?? [];
  return (
    <Sheet title="Publicar composición" onClose={onClose} footer={<button type="button" className="tb-btn tb-btn--main" disabled={!ready || busy} onClick={onConfirm}>{busy ? 'Publicando…' : 'Publicar esta composición'}</button>}>
      <p className="tb-note">Así verán «{title}» tus visitas. Se publica entera; lo que cambies después no se verá hasta que vuelvas a publicar.</p>
      <div className="tb-preview"><Lienzo ref={map} doc={doc} mode="ver" readOnly label="Vista previa" /></div>
      {!ready && <p className="tb-note" role="status">Esperando a que se guarden los últimos cambios…</p>}
      {faltan.length > 0 && (
        <div role="alert">
          <p className="tb-note">No se puede publicar: {faltan.length === 1 ? 'esta nota no tiene' : 'estas notas no tienen'} permiso de quien la{faltan.length === 1 ? '' : 's'} escribió. Retíralas del mapa o pide permiso.</p>
          <ul className="tb-received">
            {faltan.map((f) => <li key={f.item_id}><p><b>{f.alias}</b> {f.retirada ? 'La ha retirado' : 'No ha dado permiso'}</p><button type="button" className="tb-btn" onClick={() => onRemove(f.item_id)}>Retirar del mapa</button></li>)}
          </ul>
        </div>
      )}
      {result?.conflicto && <p className="tb-note" role="alert">El mapa ha cambiado. Revísalo y vuelve a publicar.</p>}
    </Sheet>
  );
}

export default function TablonPanel({ designing, routeEditing, onDesign, onRoute, onClose, onChanged }) {
  const { state } = useLibrary();
  const { userId } = useCommunity();
  const [board, setBoard] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [doc, setDoc] = useState(emptyDoc);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('saved');
  const [mode, setMode] = useState('organizar');
  const [selected, setSelected] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [from, setFrom] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [editor, setEditor] = useState(null);
  const [ask, setAsk] = useState(false);
  const [list, setList] = useState(false);
  const [notice, setNotice] = useState('');
  const [hist, setHist] = useState({ past: 0, future: 0 });
  const [publishing, setPublishing] = useState(null);
  const map = useRef(null);
  const meta = useRef({ id: null, revision: 0, local: false });
  const docRef = useRef(doc);
  docRef.current = doc;
  const titleRef = useRef(title);
  titleRef.current = title;
  const past = useRef([]);
  const future = useRef([]);
  const dirtyEditor = useRef(false);
  const saver = useRef({ running: false, again: false, timer: 0, pending: false });
  const announced = useRef(false);

  const show = useCallback((d) => {
    meta.current = { id: d.actual.id, revision: d.actual.revision, local: d.local };
    setBoard(d);
    setTitle(d.actual.title);
    return d;
  }, []);

  const load = useCallback(
    async (comp = null) => {
      setLoadError('');
      try {
        const d = show(await api.loadBoard(userId, comp));
        const draft = api.readDraft(userId);
        past.current = [];
        future.current = [];
        setHist({ past: 0, future: 0 });
        if (draft && draft.compId === d.actual.id) {
          setDoc(draft.doc);
          setTitle(draft.title);
          if (draft.revision === d.actual.revision) schedule();
          else setStatus('conflict');
        } else {
          setDoc(d.actual.doc);
          setStatus(d.local ? 'local' : 'saved');
        }
        requestAnimationFrame(() => map.current?.fit());
        if (d.avisos.length) {
          setNotice(d.avisos.map((a) => `${a.alias} ha retirado ${a.retirada ? 'su nota' : 'el permiso para exponer su nota'}.`).join(' '));
          api.clearNotices().catch(() => {});
        } else if (d.sinLeer && !announced.current) {
          announced.current = true;
          setNotice(d.sinLeer === 1 ? 'Tienes un post-it nuevo en Recibidas.' : `Tienes ${d.sinLeer} post-its nuevos en Recibidas.`);
        }
      } catch (e) {
        setLoadError(e.message);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, show],
  );
  useEffect(() => {
    load();
    return () => {
      clearTimeout(saver.current.timer);
      if (saver.current.pending) flush();
      onChanged?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  async function flush() {
    const s = saver.current;
    clearTimeout(s.timer);
    if (s.running) {
      s.again = true;
      return;
    }
    s.running = true;
    s.pending = false;
    const snapshot = docRef.current;
    const t = titleRef.current;
    setStatus('saving');
    try {
      const r = await api.saveBoard(userId, meta.current.local, meta.current.id, meta.current.revision, t, snapshot, boundsOf(snapshot.items));
      if (r?.conflicto) {
        setStatus('conflict');
      } else {
        meta.current.revision = r.revision;
        if (!s.again && docRef.current === snapshot) {
          api.clearDraft(userId);
          setStatus(meta.current.local ? 'local' : 'saved');
        }
      }
    } catch {
      setStatus('error');
      s.pending = true;
    } finally {
      s.running = false;
      if (s.again) {
        s.again = false;
        flush();
      }
    }
  }
  function schedule() {
    const s = saver.current;
    s.pending = true;
    clearTimeout(s.timer);
    s.timer = setTimeout(flush, 250);
  }

  const commit = (next, { history = true } = {}) => {
    if (history) {
      past.current = [...past.current.slice(-HISTORY + 1), docRef.current];
      future.current = [];
      setHist({ past: past.current.length, future: 0 });
    }
    docRef.current = next;
    setDoc(next);
    api.writeDraft(userId, { compId: meta.current.id, revision: meta.current.revision, title: titleRef.current, doc: next });
    setStatus('saving');
    schedule();
  };
  const step = (fromStack, toStack) => {
    if (!fromStack.current.length) return;
    toStack.current = [...toStack.current, docRef.current];
    const d = fromStack.current[fromStack.current.length - 1];
    fromStack.current = fromStack.current.slice(0, -1);
    setHist({ past: past.current.length, future: future.current.length });
    setSelected(null);
    setSelectedEdge(null);
    commit(d, { history: false });
  };
  const undo = () => step(past, future);
  const redo = () => step(future, past);

  const closeEditor = () => {
    setEditor(null);
    setAsk(false);
    dirtyEditor.current = false;
    if (routeEditing) onRoute(false);
  };
  const openEditor = (item, isNew = false) => {
    setSheet(null);
    setEditor({ item, isNew });
    onRoute(true);
  };
  // El Atrás del sistema respeta el borrador: si hay cambios, se pregunta y la ruta vuelve a abrirse
  useEffect(() => {
    if (routeEditing && !editor) onRoute(false);
    else if (!routeEditing && editor) {
      if (dirtyEditor.current) {
        setAsk(true);
        onRoute(true);
      } else setEditor(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeEditing]);
  const onDirty = useCallback((v) => {
    dirtyEditor.current = v;
  }, []);

  const saveItem = (draft) => {
    const exists = docRef.current.items.some((i) => i.id === draft.id);
    commit(exists ? patchItem(docRef.current, draft.id, draft) : { ...docRef.current, items: [...docRef.current.items, draft] });
    closeEditor();
    setSelected(draft.id);
  };
  const deleteItem = (id) => {
    commit(removeItem(docRef.current, id));
    setSelected(null);
    setNotice('Tarjeta borrada. Puedes deshacerlo.');
  };
  const center = () => map.current?.center() ?? { x: 800, y: 500 };
  const add = (kind, extra) => {
    const item = newItem(kind, center(), docRef.current.items, extra);
    commit({ ...docRef.current, items: [...docRef.current.items, item] });
    setSheet(null);
    setMode('organizar');
    setSelected(item.id);
  };

  const tapItem = (id) => {
    if (mode === 'organizar') {
      setSelectedEdge(null);
      setSelected(id);
    } else if (mode === 'conectar') {
      if (!from) setFrom(id);
      else if (from !== id) {
        const before = docRef.current;
        const next = addEdge(before, from, id);
        if (next !== before) commit(next);
        setFrom(null);
      } else setFrom(null);
    }
  };
  const tapEdge = (id) => {
    if (mode === 'organizar') {
      setSelected(null);
      setSelectedEdge(id);
    }
  };
  const tapEmpty = () => {
    setSelected(null);
    setSelectedEdge(null);
  };
  const changeMode = (m) => {
    setMode(m);
    setSelected(null);
    setSelectedEdge(null);
    setFrom(null);
  };
  useEffect(() => {
    if (mode !== 'conectar') return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape' || sheet || editor) return;
      e.stopPropagation();
      changeMode('organizar');
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sheet, editor]);

  const selectedItem = doc.items.find((i) => i.id === selected) ?? null;
  const edge = doc.edges.find((e) => e.id === selectedEdge) ?? null;
  const unread = board?.recibidas.filter((n) => !n.read_at && !n.withdrawn_at).length ?? 0;
  const local = board?.local;
  const guard = (p) => p.catch((e) => setNotice(e.message));

  const openNote = (n) => {
    setSheet({ type: 'detail', back: 'received', item: { kind: 'received', body: n.body, paper: n.style, spoiler: n.spoiler, retirada: Boolean(n.withdrawn_at), firma: n.alias } });
    if (!n.read_at && !n.withdrawn_at) {
      guard(
        api.markRead(n.id).then(() => {
          setBoard((b) => ({ ...b, recibidas: b.recibidas.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)) }));
          onChanged?.();
        }),
      );
    }
  };
  const placeNote = (n) => {
    if (docRef.current.items.some((i) => i.received_note_id === n.id)) {
      setNotice('Esa nota ya está en este mapa.');
      setSheet(null);
      return;
    }
    add('received', { body: n.body, paper: n.style, spoiler: n.spoiler, firma: n.alias, received_note_id: n.id });
    if (!designing) onDesign();
  };
  const dropNote = (n) => setBoard((b) => ({ ...b, recibidas: b.recibidas.filter((x) => x.id !== n.id) }));
  const switchComposition = (id) => {
    if (saver.current.pending) flush();
    api.clearDraft(userId);
    changeMode('organizar');
    load(id);
  };
  const newComposition = async (name) => {
    const id = uid();
    await api.createComposition(id, name);
    switchComposition(id);
  };
  const reload = () => {
    api.clearDraft(userId);
    saver.current.pending = false;
    load(meta.current.id);
  };
  const keepMine = async () => {
    const d = await api.loadBoard(userId, meta.current.id);
    meta.current.revision = d.actual.revision;
    flush();
  };
  const doPublish = async () => {
    setPublishing((p) => ({ ...p, busy: true, result: null }));
    try {
      const result = await api.publish(meta.current.id, meta.current.revision);
      if (result.publicada) {
        setPublishing(null);
        setNotice('Composición publicada.');
        await load(meta.current.id);
        onChanged?.();
      } else setPublishing((p) => ({ ...p, busy: false, result }));
    } catch (e) {
      setPublishing((p) => ({ ...p, busy: false, result: null }));
      setNotice(e.message);
    }
  };

  if (loadError)
    return (
      <div className="tb-app">
        <div className="tb-empty tb-empty--error" role="alert">
          <p>No se ha podido abrir el tablón: {loadError}</p>
          <button type="button" className="tb-btn" onClick={() => load()}>Reintentar</button>
          <button type="button" className="tb-btn" onClick={onClose}>Volver</button>
        </div>
      </div>
    );
  if (!board) return <div className="tb-app"><p className="tb-empty--error" role="status">Abriendo el tablón…</p></div>;
  const covered = sheet || editor || publishing ? true : undefined;
  const isPublic = board.tablero.publica === meta.current.id;
  const items = sortedItems(doc.items);
  const tool = (name, icon, run, extra = {}) => (
    <button type="button" className="tb-tool" onClick={run} {...extra}>
      <PortIcon name={icon} />
      <span>{name}</span>
    </button>
  );
  const sheets = (
    <>
      {sheet?.type === 'menu' && (
        <Sheet title="Menú del tablón" onClose={() => setSheet(null)}>
          <div className="tb-choices">
            <button type="button" className="tb-btn" onClick={() => (setList((v) => !v), setSheet(null))}>{list ? 'Ver como mapa' : 'Ver como lista'}</button>
            <button type="button" className="tb-btn" onClick={() => setSheet({ type: 'name', mode: 'rename' })}>Cambiar el título</button>
            {!local && <button type="button" className="tb-btn" onClick={() => setSheet({ type: 'name', mode: 'new' })}>Nueva composición</button>}
            {!local && <button type="button" className="tb-btn" disabled={board.tablero.activa === meta.current.id} onClick={() => guard(api.setBoardOptions({ activa: meta.current.id }).then(() => load(meta.current.id))).then(() => (setSheet(null), onChanged?.()))}>{board.tablero.activa === meta.current.id ? 'Es la que se ve en el mueble' : 'Mostrar en el mueble'}</button>}
            {!local && <button type="button" className="tb-btn" onClick={() => (setSheet(null), setPublishing({ busy: false, result: null }))}>{isPublic ? 'Volver a publicar' : 'Publicar…'}</button>}
            {!local && board.tablero.publica && <button type="button" className="tb-btn" onClick={() => guard(api.unpublish().then(() => load(meta.current.id))).then(() => (setSheet(null), onChanged?.()))}>Dejar de publicar</button>}
            {!local && <button type="button" className="tb-btn" aria-pressed={board.tablero.acepta} onClick={() => guard(api.setBoardOptions({ acepta: !board.tablero.acepta }).then(() => load(meta.current.id))).then(() => setSheet(null))}>{board.tablero.acepta ? 'Cerrar la recepción de post-its' : 'Abrir la recepción de post-its'}</button>}
            {!local && <button type="button" className="tb-btn" onClick={() => setSheet({ type: 'sent' })}>Post-its enviados</button>}
            {!local && <button type="button" className="tb-btn" onClick={() => setSheet({ type: 'old' })}>Libro de visitas antiguo</button>}
            {!local && board.composiciones.length > 1 && <button type="button" className="tb-btn tb-btn--danger" onClick={() => setSheet({ type: 'delete' })}>Eliminar esta composición</button>}
            {local && <p className="tb-note">Este tablón se guarda solo en este dispositivo. Publicar y recibir post-its necesitan tu cuenta conectada.</p>}
          </div>
        </Sheet>
      )}
      {sheet?.type === 'name' && <NameSheet initial={sheet.mode === 'rename' ? title : ''} title={sheet.mode === 'rename' ? 'Título de la composición' : 'Nueva composición'} onClose={() => setSheet(null)} onSave={(name) => {
        setSheet(null);
        if (sheet.mode === 'new') guard(newComposition(name));
        else {
          titleRef.current = name;
          setTitle(name);
          commit(docRef.current, { history: false });
        }
      }} />}
      {sheet?.type === 'delete' && (
        <Sheet title="Eliminar composición" onClose={() => setSheet(null)}>
          <p className="tb-note">Se borrará «{title}» con sus tarjetas y conexiones.</p>
          <button type="button" className="tb-btn tb-btn--danger" onClick={() => guard(api.deleteComposition(meta.current.id).then(() => (api.clearDraft(userId), load()))).then(() => setSheet(null))}>Eliminar</button>
        </Sheet>
      )}
      {sheet?.type === 'detail' && <DetailSheet item={sheet.item} onClose={() => setSheet(sheet.back ? { type: sheet.back } : null)} />}
      {sheet?.type === 'add' && <AddSheet books={state.books} onClose={() => setSheet(null)} onNote={() => openEditor(newItem('note', center(), docRef.current.items), true)} onBook={(b) => add('book', { body: b.title, caption: b.author || null, cover: safeCover(b.cover), source_ref: String(b.id).slice(0, 120) })} onQuote={({ book, quote }) => add('quote', { body: quote.text.slice(0, 1200), caption: book.title.slice(0, 160), source_ref: String(quote.id).slice(0, 120) })} />}
      {sheet?.type === 'received' && <Received board={board} onClose={() => setSheet(null)} onOpen={openNote} onPlace={placeNote} onArchive={(n) => guard(api.archiveNote(n.id).then(() => (dropNote(n), onChanged?.())))} onBlock={(n) => setSheet({ type: 'block', note: n })} onReport={(n) => setSheet({ type: 'report', note: n })} />}
      {sheet?.type === 'block' && (
        <Sheet title={`Bloquear a ${sheet.note.alias}`} onClose={() => setSheet({ type: 'received' })}>
          <p className="tb-note">No podrá dejarte más post-its ni visitar tu piso.</p>
          <button type="button" className="tb-btn tb-btn--danger" onClick={() => guard(blockUser(sheet.note.sender_id).then(() => setNotice(`Has bloqueado a ${sheet.note.alias}.`))).then(() => setSheet(null))}>Bloquear</button>
        </Sheet>
      )}
      {sheet?.type === 'report' && <ReportSheet note={sheet.note} onClose={() => setSheet({ type: 'received' })} onSend={(reason) => guard(reportContent('tablon_nota', sheet.note.id, reason).then(() => setNotice('Denuncia enviada.'))).then(() => setSheet(null))} />}
      {sheet?.type === 'sent' && <SentNotes onClose={() => setSheet(null)} />}
      {sheet?.type === 'old' && <OldGuestbook userId={userId} onClose={() => setSheet(null)} />}
      {publishing && <PublishSheet title={title} doc={doc} ready={status === 'saved'} busy={publishing.busy} result={publishing.result} onClose={() => setPublishing(null)} onConfirm={doPublish} onRemove={(id) => (commit(removeItem(docRef.current, id)), setPublishing((p) => ({ ...p, result: null })))} />}
      {editor && <ItemEditor item={editor.item} isNew={editor.isNew} ask={ask} onDirty={onDirty} onSave={saveItem} onDelete={(id) => (deleteItem(id), closeEditor())} onClose={() => (dirtyEditor.current ? setAsk(true) : closeEditor())} onAnswer={(a) => (a === 'discard' ? closeEditor() : setAsk(false))} />}
    </>
  );
  // Lo primero al tocar el mueble: mirar. Diseñar es un gesto aparte
  if (!designing)
    return (
      <div className="tb-app" data-view="mirar">
        <div className="tb-look" inert={covered}>
          <div className="tb-look__top">
            <button type="button" className="tb-ghost" onClick={onClose}>
              <PortIcon name="flecha" back /> Volver
            </button>
            {!local && unread > 0 && (
              <button type="button" className="tb-envelope" aria-label={`Recibidas, ${unread}`} onClick={() => setSheet({ type: 'received' })}>
                <b aria-hidden="true">{unread}</b>
              </button>
            )}
          </div>
          <BoardFrame title={title}>
            <Lienzo ref={map} doc={doc} mode="ver" readOnly label={`Composición ${title}`} onTapItem={(id) => setSheet({ type: 'detail', item: docRef.current.items.find((i) => i.id === id) })} />
            {!doc.items.length && <p className="tb-hint">Todavía no hay nada clavado</p>}
          </BoardFrame>
          <div className="tb-look__foot">
            <span />
            <button type="button" className="tb-ghost" onClick={onDesign}>
              <PortIcon name="lapiz" /> Diseñar
            </button>
          </div>
        </div>
        {sheets}
      </div>
    );
  return (
    <div className="tb-app" data-status={status} data-view="disenar">
      <div className="tb-rail" inert={covered}>
        <button type="button" className="tb-ghost" onClick={onClose}>
          <PortIcon name="flecha" back /> Volver
        </button>
        {board.composiciones.length > 1 ? (
          <select className="tb-select" aria-label="Composición" value={meta.current.id} onChange={(e) => switchComposition(e.target.value)}>
            {board.composiciones.map((c) => <option key={c.id} value={c.id}>{c.id === meta.current.id ? title : c.title}</option>)}
          </select>
        ) : (
          <h2 className="tb-title">{title}</h2>
        )}
        <span className="tb-stamp tb-status" role="status">{STATUS[status]}</span>
        {!local && (
          <button type="button" className="tb-envelope" style={{ width: 44, height: 34 }} aria-label={`Recibidas, ${unread}`} onClick={() => setSheet({ type: 'received' })}>
            {unread > 0 && <b aria-hidden="true">{unread}</b>}
          </button>
        )}
        <button type="button" className="tb-ghost" aria-label="Menú" aria-haspopup="dialog" onClick={() => setSheet({ type: 'menu' })}>
          <PortIcon name="menu" />
        </button>
      </div>
      {(status === 'error' || status === 'conflict' || notice) && (
        <div className="tb-alerts" inert={covered}>
          {status === 'error' && <p role="alert">Sigue en este dispositivo. <button type="button" onClick={flush}>Reintentar</button></p>}
          {status === 'conflict' && <p role="alert">Otra sesión ha cambiado este mapa. Tu versión sigue aquí. <button type="button" onClick={reload}>Cargar la otra</button> <button type="button" onClick={keepMine}>Mantener la mía</button></p>}
          {notice && <p role="status">{notice} <button type="button" onClick={() => setNotice('')}>Vale</button></p>}
        </div>
      )}
      <div className="tb-stage" inert={covered}>
        {list ? (
          <ul className="tb-list tb-list--all" aria-label="Tarjetas en lista">
            {items.map((i) => <li key={i.id}><button type="button" onClick={() => openEditor(i)}><b>{KIND_NAMES[i.kind]}</b><span>{itemSummary(i)}</span></button></li>)}
            {!items.length && <li><p className="tb-note">Aún no hay tarjetas.</p></li>}
          </ul>
        ) : (
          <Lienzo ref={map} doc={doc} mode={mode} selected={selected} selectedEdge={selectedEdge} connectFrom={from} label={`Composición ${title}`} onTapItem={tapItem} onTapEdge={tapEdge} onTapEmpty={tapEmpty} onChange={(id, patch) => commit(patchItem(docRef.current, id, patch))} />
        )}
        {!list && !doc.items.length && <p className="tb-hint">Añade una nota para empezar</p>}
      </div>
      <div inert={covered}>
        {selectedItem && mode === 'organizar' && (
          <div className="tb-strip" role="group" aria-label="Tarjeta elegida">
            <button type="button" className="tb-link" onClick={() => openEditor(selectedItem)}>Editar</button>
            <button type="button" className="tb-link" onClick={() => commit(patchItem(docRef.current, selectedItem.id, { z: topZ(docRef.current.items) }))}>Delante</button>
            <button type="button" className="tb-link" onClick={() => commit(patchItem(docRef.current, selectedItem.id, { z: bottomZ(docRef.current.items) }))}>Detrás</button>
            <button type="button" className="tb-link tb-link--danger" onClick={() => deleteItem(selectedItem.id)}>Borrar</button>
          </div>
        )}
        {edge && mode === 'organizar' && (
          <div className="tb-strip" role="group" aria-label="Hilo elegido">
            {Object.entries(THREADS).map(([id, c]) => <button key={id} type="button" className="tb-dot" style={{ background: c }} aria-label={THREAD_NAMES[id]} aria-pressed={edge.color === id} onClick={() => commit(patchEdge(docRef.current, edge.id, { color: id }))} />)}
            <input aria-label="Etiqueta del hilo" placeholder="Etiqueta" maxLength={MAX_LABEL} defaultValue={edge.label ?? ''} key={edge.id} onBlur={(e) => (e.target.value.trim() || null) !== edge.label && commit(patchEdge(docRef.current, edge.id, { label: e.target.value.trim() || null }))} />
            <button type="button" className="tb-link tb-link--danger" onClick={() => (commit(removeEdge(docRef.current, edge.id)), setSelectedEdge(null))}>Borrar</button>
          </div>
        )}
        {mode === 'conectar' && (
          <div className="tb-strip" role="status">
            <span>{from ? 'Ahora la de destino' : 'Toca la nota de origen'}</span>
            <button type="button" className="tb-link" onClick={() => changeMode('organizar')}>Cancelar</button>
          </div>
        )}
        <div className="tb-tray">
          {tool('Añadir', 'mas', () => setSheet({ type: 'add' }))}
          {tool('Conectar', 'hilo', () => changeMode(mode === 'conectar' ? 'organizar' : 'conectar'), { 'aria-pressed': mode === 'conectar', disabled: doc.items.length < 2 })}
          {tool('Deshacer', 'deshacer', undo, { disabled: !hist.past })}
          {tool('Rehacer', 'rehacer', redo, { disabled: !hist.future })}
          {tool('Alejar', 'menos', () => map.current.zoomBy(0.8), { disabled: list })}
          {tool('Acercar', 'mas', () => map.current.zoomBy(1.25), { disabled: list })}
          {tool('Encajar', 'encajar', () => map.current.fit(), { disabled: list })}
        </div>
      </div>
      {sheets}
    </div>
  );
}

function NameSheet({ initial, title, onSave, onClose }) {
  const [v, setV] = useState(initial);
  return (
    <Sheet title={title} onClose={onClose}>
      <form className="tb-form" onSubmit={(e) => (e.preventDefault(), v.trim() && onSave(v.trim()))}>
        <label className="tb-field"><span>Título</span><input autoFocus value={v} maxLength={MAX_TITLE} onChange={(e) => setV(e.target.value)} /></label>
        <button type="submit" className="tb-btn tb-btn--main" disabled={!v.trim()}>Guardar</button>
      </form>
    </Sheet>
  );
}

function ReportSheet({ note, onSend, onClose }) {
  const [v, setV] = useState('');
  return (
    <Sheet title="Denunciar este post-it" onClose={onClose}>
      <form className="tb-form" onSubmit={(e) => (e.preventDefault(), v.trim() && onSend(v.trim()))}>
        <p className="tb-readonly">{note.body}</p>
        <label className="tb-field"><span>Motivo</span><textarea value={v} maxLength={500} rows={3} onChange={(e) => setV(e.target.value)} /></label>
        <button type="submit" className="tb-btn tb-btn--main" disabled={!v.trim()}>Enviar denuncia</button>
      </form>
    </Sheet>
  );
}
