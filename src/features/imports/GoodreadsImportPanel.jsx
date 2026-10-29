// «Traer mis libros de Goodreads» (SPEC §52.3): conseguir el archivo, elegirlo, revisar, importar y ver el resultado.
// El CSV se lee en el dispositivo (worker con PapaParse, cargado solo aquí) y nunca se sube; se guarda por lotes con
// confirmación de escritura y el registro de la importación permite reanudar y deshacer solo sus cambios.
import { ArrowLeft, ArrowRight, Check, ExternalLink, FileUp, Undo2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanelShell } from '../../components/panels/PanelShell';
import { formatRating } from '../../domain/books';
import { useCloud } from '../../state/cloudSync';
import { useLibrary } from '../../state/useLibrary';
import { ImportError, MAX_BYTES, decodeUtf8, parseGoodreadsCsv } from './goodreadsParser';
import { MATCH_TEXT, STATUS_CHOICES, fillLabel, isResolved, planCounts, planImport } from './importPlanner';
import { BATCH_SIZE, createImportRecord, fileFingerprint, importSummary, planValidFor, resumableImport } from './importService';

const PAGE = 25;
const STEPS = ['Conseguir el archivo', 'Elegir CSV', 'Revisar', 'Importar', 'Resultado'];
const STATUS_TEXT = Object.fromEntries(STATUS_CHOICES.map((s) => [s.id, s.label]));
const n = (v) => v.toLocaleString('es-ES');
const plural = (v, one, many) => `${n(v)} ${v === 1 ? one : many}`;

/** Analiza el archivo en un worker; si el navegador no lo permite, en el hilo principal con PapaParse bajo demanda. */
async function analyze(buffer) {
  if (typeof Worker !== 'undefined') {
    try {
      return await new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./csvWorker.js', import.meta.url), { type: 'module' });
        worker.onmessage = (e) => {
          worker.terminate();
          if (e.data.ok) resolve(e.data);
          else reject(new ImportError(e.data.code, e.data.message));
        };
        worker.onerror = (e) => {
          worker.terminate();
          e.preventDefault?.();
          reject(new Error('worker'));
        };
        worker.postMessage(buffer.slice(0));
      });
    } catch (e) {
      if (e instanceof ImportError) throw e;
    }
  }
  const Papa = (await import('papaparse')).default;
  return parseGoodreadsCsv(Papa, decodeUtf8(buffer));
}

export function GoodreadsImportPanel({ onClose }) {
  const { state, actions } = useLibrary();
  const cloud = useCloud();
  const userId = cloud.user?.id ?? null;
  const [phase, setPhase] = useState('start');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [plan, setPlan] = useState(null);
  const [page, setPage] = useState(0);
  const [activeId, setActiveId] = useState(null);
  const [persisted, setPersisted] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  const record = (state.imports ?? []).find((r) => r.id === activeId) ?? null;
  // Una importación de esta cuenta que se quedó a medias (fallo, cierre o recarga): se ofrece continuar
  const unfinished = useMemo(() => resumableImport(state.imports, userId), [state.imports, userId]);

  // Cambiar de cuenta invalida la revisión (el plan se hizo contra otra biblioteca)
  useEffect(() => {
    if (plan && !planValidFor(plan, userId)) {
      setPlan(null);
      setPhase('start');
      setNotice('Has cambiado de cuenta: vuelve a elegir el archivo para revisarlo contra esta biblioteca.');
    }
  }, [userId, plan]);

  // Motor de lotes: cada cambio del registro confirma en el dispositivo el lote anterior y lanza el siguiente
  useEffect(() => {
    if (!record || phase !== 'running') return undefined;
    const t = setTimeout(() => {
      if (!actions.persistNow()) {
        actions.importStatus(record.id, 'paused', 'storage');
        setPhase('paused');
        return;
      }
      if (record.status !== 'running') return;
      const next = record.ops.filter((o) => o.s === 'pending').slice(0, BATCH_SIZE).map((o) => o.key);
      if (next.length) actions.importBatch(record.id, next);
      else actions.importStatus(record.id, 'done');
    }, 16);
    return () => clearTimeout(t);
  }, [record, phase, actions]);
  // Fin: el resultado solo se enseña cuando la última escritura está confirmada
  useEffect(() => {
    if (phase === 'running' && record?.status === 'done') {
      if (actions.persistNow()) {
        setPersisted(true);
        setPhase('result');
      } else setPhase('paused');
    }
  }, [phase, record, actions]);

  const toTop = () => scrollRef.current?.scrollTo({ top: 0 });

  const choose = async (file) => {
    setError('');
    setNotice('');
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError(`El archivo pesa ${(file.size / 1048576).toFixed(1).replace('.', ',')} MiB y el máximo es 20 MiB. Exporta de nuevo o divide el archivo.`);
      return;
    }
    setPhase('reading');
    try {
      const buffer = await file.arrayBuffer();
      const [parsed, fileHash] = await Promise.all([analyze(buffer), fileFingerprint(buffer).catch(() => null)]);
      const items = planImport(parsed.records, state.books);
      if (!items.some((it) => it.match.kind !== 'invalid')) throw new ImportError('empty', 'El archivo no tiene ningún libro con título.');
      const before = fileHash && (state.imports ?? []).find((r) => r.fileHash === fileHash && r.userId === userId && r.status !== 'undone');
      if (before) setNotice(`Ya importaste este mismo archivo el ${new Date(before.createdAt).toLocaleDateString('es-ES')}: lo que ya está se omite.`);
      setPlan({ items, fileHash, fileName: file.name, userId });
      setPage(0);
      setPhase('review');
      toTop();
    } catch (e) {
      setPhase('start');
      setError(e instanceof ImportError ? e.message : 'No hemos podido leer el archivo. Comprueba que es la exportación CSV de Goodreads.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const setItem = (line, patch) => setPlan((p) => ({ ...p, items: p.items.map((it) => (it.line === line ? { ...it, ...patch } : it)) }));

  const start = () => {
    const rec = createImportRecord({ items: plan.items, userId, fileHash: plan.fileHash, fileName: plan.fileName });
    actions.importStart(rec);
    setActiveId(rec.id);
    setPersisted(false);
    setPhase('running');
    toTop();
  };
  const resume = (id) => {
    actions.importStatus(id, 'running');
    setActiveId(id);
    setPersisted(false);
    setPhase('running');
  };
  const cancel = () => {
    actions.importStatus(record.id, 'cancelled');
    setPhase('paused');
  };
  const undo = () => {
    actions.importUndo(record.id);
    setConfirmUndo(false);
    setTimeout(() => actions.persistNow(), 0);
  };

  const counts = plan ? planCounts(plan.items) : null;
  const summary = record ? importSummary(record) : null;
  const step = phase === 'start' || phase === 'reading' ? (plan ? 2 : 1) : phase === 'review' ? 2 : phase === 'result' ? 4 : 3;

  return (
    <PanelShell onClose={onClose} label="Traer mis libros de Goodreads" variant="import">
      <div className="gr-import">
        <header className="gr-import__head">
          <div>
            <h2>Traer mis libros de Goodreads</h2>
            <p>Tu biblioteca también puede sentirse en casa aquí.</p>
          </div>
          <button type="button" className="gr-icon-btn" onClick={onClose} aria-label="Cerrar">
            <X aria-hidden="true" />
          </button>
        </header>
        <ol className="gr-steps" aria-label="Pasos">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? 'step' : undefined} data-done={i < step || undefined}>
              <span className="gr-mono">{i + 1}</span> {s}
            </li>
          ))}
        </ol>

        <div ref={scrollRef} className="gr-import__scroll">
          {notice && (
            <p className="gr-note" role="status">
              {notice}
            </p>
          )}

          {(phase === 'start' || phase === 'reading') && (
            <>
              {unfinished && (
                <section className="gr-card">
                  <h3>Tienes una importación sin terminar</h3>
                  <p>
                    {plural(importSummary(unfinished).added + importSummary(unfinished).filled, 'libro guardado', 'libros guardados')} y{' '}
                    {plural(importSummary(unfinished).pending + importSummary(unfinished).failed, 'pendiente', 'pendientes')} de «{unfinished.fileName}».
                  </p>
                  <button type="button" className="gr-btn gr-btn--primary" onClick={() => resume(unfinished.id)}>
                    Continuar la importación
                  </button>
                </section>
              )}
              <section className="gr-card">
                <h3>1 · Consigue el archivo</h3>
                <p>En la web de Goodreads, abre My Books → Import and export → Export Library. Descarga el archivo y selecciónalo aquí.</p>
                <a className="gr-link" href="https://www.goodreads.com/review/import" target="_blank" rel="noopener noreferrer">
                  Abrir Import and export en Goodreads <ExternalLink aria-hidden="true" />
                </a>
                <p className="gr-small">Importamos una copia de tu biblioteca. Los cambios posteriores en Goodreads no se sincronizan automáticamente.</p>
                <p className="gr-small">No necesitamos tu contraseña ni acceso a tu cuenta de Goodreads: el archivo se lee en este dispositivo y no se sube.</p>
              </section>
              <section
                className="gr-card gr-drop"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (phase !== 'reading') choose(e.dataTransfer.files?.[0]);
                }}
              >
                <h3>2 · Elige el CSV</h3>
                <input ref={inputRef} id="gr-file" className="gr-file" type="file" accept=".csv,text/csv" onChange={(e) => choose(e.target.files?.[0])} disabled={phase === 'reading'} />
                <label htmlFor="gr-file" className="gr-btn gr-btn--primary" data-disabled={phase === 'reading' || undefined}>
                  <FileUp aria-hidden="true" />
                  {phase === 'reading' ? 'Leyendo el archivo…' : 'Elegir archivo CSV'}
                </label>
                <p className="gr-small">También puedes soltarlo aquí. Máximo 20 MiB y 10.000 libros.</p>
                {error && (
                  <p className="gr-error" role="alert">
                    {error}
                  </p>
                )}
              </section>
            </>
          )}

          {phase === 'review' && plan && (
            <section aria-labelledby="gr-review-title">
              <h3 id="gr-review-title" className="gr-title">
                3 · Revisa antes de importar
              </h3>
              <p className="gr-lead">
                Encontramos {plural(counts.total, 'libro', 'libros')}. {counts.present === 1 ? '1 ya estaba' : `${n(counts.present)} ya estaban`} en tu biblioteca.
              </p>
              <dl className="gr-counts">
                <div>
                  <dt>Nuevos</dt>
                  <dd className="gr-mono">{n(counts.fresh)}</dd>
                </div>
                <div>
                  <dt>Ya presentes</dt>
                  <dd className="gr-mono">{n(counts.present)}</dd>
                </div>
                <div>
                  <dt>Posibles coincidencias</dt>
                  <dd className="gr-mono">{n(counts.possible)}</dd>
                </div>
                <div>
                  <dt>Necesitan revisión</dt>
                  <dd className="gr-mono">{n(counts.review)}</dd>
                </div>
                <div>
                  <dt>Filas no válidas</dt>
                  <dd className="gr-mono">{n(counts.invalid)}</dd>
                </div>
              </dl>
              {plan.items.some((it) => it.status === 'reading') && <p className="gr-small">Las lecturas en curso llegan sin página actual: el archivo de Goodreads no la incluye.</p>}
              {plan.items.some((it) => it.record.shelves?.length) && <p className="gr-small">Tus estanterías personalizadas se guardan con cada libro, pero aquí no son filtros.</p>}
              <ReviewList items={plan.items.slice(page * PAGE, page * PAGE + PAGE)} onChange={setItem} />
              <nav className="gr-pager" aria-label="Páginas de la revisión">
                <button type="button" className="gr-btn" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
                  <ArrowLeft aria-hidden="true" /> Anteriores
                </button>
                <span className="gr-mono">
                  {n(page * PAGE + 1)}–{n(Math.min(plan.items.length, page * PAGE + PAGE))} de {n(plan.items.length)}
                </span>
                <button type="button" className="gr-btn" onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * PAGE >= plan.items.length}>
                  Siguientes <ArrowRight aria-hidden="true" />
                </button>
              </nav>
              <div className="gr-actions">
                {counts.undecided > 0 && <p className="gr-small">{plural(counts.undecided, 'fila sin decidir no se importará', 'filas sin decidir no se importarán')}. Puedes importar el resto ahora.</p>}
                <button type="button" className="gr-btn gr-btn--primary" onClick={start} disabled={!counts.toAdd && !counts.toFill}>
                  Importar {plural(counts.toAdd, 'libro', 'libros')}
                  {counts.toFill ? ` y completar ${n(counts.toFill)}` : ''}
                </button>
                <button
                  type="button"
                  className="gr-btn"
                  onClick={() => {
                    setPlan(null);
                    setPhase('start');
                  }}
                >
                  Elegir otro archivo
                </button>
              </div>
            </section>
          )}

          {(phase === 'running' || phase === 'paused') && summary && (
            <section className="gr-card" aria-live="polite">
              <h3>4 · Importando</h3>
              <p className="gr-lead">
                <span className="gr-mono">{n(summary.added + summary.filled)}</span> guardados · <span className="gr-mono">{n(summary.pending)}</span> pendientes
                {summary.failed ? (
                  <>
                    {' '}
                    · <span className="gr-mono">{n(summary.failed)}</span> con error
                  </>
                ) : null}
              </p>
              <progress max={record.ops.length || 1} value={summary.added + summary.filled + summary.skipped - record.skipped.length} />
              {phase === 'running' ? (
                <button type="button" className="gr-btn" onClick={cancel}>
                  Detener
                </button>
              ) : (
                <>
                  <p className="gr-note" role={record.error ? 'alert' : 'status'}>
                    {record.error === 'storage'
                      ? 'No se ha podido guardar en este dispositivo. Lo que ya está guardado se queda; puedes reintentar lo pendiente.'
                      : `Importación detenida. Se guardaron ${plural(summary.added + summary.filled, 'libro', 'libros')}; no se ha deshecho nada.`}
                  </p>
                  <button type="button" className="gr-btn gr-btn--primary" onClick={() => resume(record.id)} disabled={!summary.pending && !summary.failed}>
                    Reintentar lo pendiente
                  </button>
                  <button type="button" className="gr-btn" onClick={() => setPhase('result')}>
                    Ver lo guardado
                  </button>
                </>
              )}
            </section>
          )}

          {phase === 'result' && summary && (
            <section aria-labelledby="gr-result-title">
              <h3 id="gr-result-title" className="gr-title">
                {record.status === 'undone' ? 'Importación deshecha' : persisted ? '5 · Ya están en tu biblioteca' : '5 · Resultado'}
              </h3>
              <dl className="gr-counts">
                <div>
                  <dt>Añadidos</dt>
                  <dd className="gr-mono">{n(summary.added)}</dd>
                </div>
                <div>
                  <dt>Completados</dt>
                  <dd className="gr-mono">{n(summary.filled)}</dd>
                </div>
                <div>
                  <dt>Omitidos o no importados</dt>
                  <dd className="gr-mono">{n(summary.issues.length)}</dd>
                </div>
                {record.status === 'undone' && (
                  <div>
                    <dt>Deshechos</dt>
                    <dd className="gr-mono">{n(summary.undone)}</dd>
                  </div>
                )}
              </dl>
              <div className="gr-actions">
                <button type="button" className="gr-btn gr-btn--primary" onClick={onClose}>
                  <Check aria-hidden="true" /> Ver mis libros
                </button>
                <button type="button" className="gr-btn" aria-expanded={showIssues} onClick={() => setShowIssues((v) => !v)} disabled={!summary.issues.length && !record.conflicts?.length}>
                  Revisar incidencias
                </button>
              </div>
              {showIssues && (
                <ul className="gr-issues">
                  {[...summary.issues, ...(record.conflicts ?? [])].map((it, i) => (
                    <li key={`${it.line}-${i}`}>
                      <span className="gr-mono">Fila {it.line}</span> <b>{it.title}</b> — {it.reason}
                    </li>
                  ))}
                </ul>
              )}
              {record.status !== 'undone' &&
                summary.added + summary.filled > 0 &&
                (confirmUndo ? (
                  <div className="gr-card gr-undo" role="alertdialog" aria-label="Deshacer la importación">
                    <p>Quitaremos los libros de esta importación que no hayas cambiado y devolveremos los datos completados. Lo que hayas tocado después se queda.</p>
                    <button type="button" className="gr-btn gr-btn--danger" onClick={undo}>
                      Sí, deshacer
                    </button>
                    <button type="button" className="gr-btn" onClick={() => setConfirmUndo(false)}>
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button type="button" className="gr-link gr-link--btn" onClick={() => setConfirmUndo(true)}>
                    <Undo2 aria-hidden="true" /> Deshacer esta importación
                  </button>
                ))}
            </section>
          )}
        </div>
      </div>
    </PanelShell>
  );
}

/** Lista de revisión (una página): libro, estado, puntuación, coincidencia y acción. */
function ReviewList({ items, onChange }) {
  return (
    <ol className="gr-list">
      {items.map((it) => {
        const r = it.record;
        const invalid = it.match.kind === 'invalid';
        const canFill = Boolean(it.match.bookId) && Object.keys(it.fill).length > 0;
        const resolved = isResolved(it);
        return (
          <li key={it.line} className="gr-row" data-kind={it.match.kind} data-resolved={resolved || undefined}>
            <p className="gr-row__book">
              <b>{r.title || `Fila ${it.line} sin título`}</b>
              <span>{r.author || 'Sin autor en el archivo'}</span>
            </p>
            <p className="gr-row__meta">
              <span>{MATCH_TEXT[it.match.kind]}{it.match.bookTitle && it.match.kind === 'title' ? `: «${it.match.bookTitle}»` : ''}</span>
              <span>{r.rating != null ? `${formatRating(r.rating)} de 5` : 'Sin puntuación'}</span>
            </p>
            {!invalid && (
              <div className="gr-row__controls">
                <label>
                  <span>Estado</span>
                  <select
                    value={it.status ?? ''}
                    onChange={(e) => {
                      const status = e.target.value || null;
                      onChange(it.line, { status, ...(it.match.kind === 'new' && it.action === 'decide' && status ? { action: 'add' } : null) });
                    }}
                  >
                    <option value="">Estado por revisar</option>
                    {STATUS_CHOICES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Acción</span>
                  <select value={it.action} onChange={(e) => onChange(it.line, { action: e.target.value })}>
                    {it.action === 'decide' && <option value="decide">Decidir…</option>}
                    <option value="add">Añadir</option>
                    <option value="skip">Omitir</option>
                    {canFill && <option value="fill">Completar datos vacíos</option>}
                  </select>
                </label>
              </div>
            )}
            {r.suggestAbandon && it.status !== 'abandoned' && !invalid && (
              <button type="button" className="gr-link gr-link--btn" onClick={() => onChange(it.line, { status: 'abandoned', ...(it.action === 'decide' && it.match.kind === 'new' ? { action: 'add' } : null) })}>
                En Goodreads parece «no terminado»: ¿marcarlo como {STATUS_TEXT.abandoned}?
              </button>
            )}
            {it.action === 'fill' && canFill && (
              <p className="gr-small">
                Completará: {Object.entries(it.fill).map(([k, v]) => `${fillLabel(k)}${k === 'review' ? '' : ` (${k === 'finishedAt' ? v.slice(0, 10) : k === 'rating' ? formatRating(v) : v})`}`).join(', ')}. Lo que ya tenías no cambia.
              </p>
            )}
            {it.action === 'add' && !it.status && <p className="gr-small">Elige un estado para poder añadirlo.</p>}
            {(invalid || r.issues?.length > 0) && (
              <ul className="gr-row__issues">
                {invalid && <li>{it.reason}</li>}
                {r.issues?.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
