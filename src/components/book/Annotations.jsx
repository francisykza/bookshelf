// Anotaciones del libro (SPEC §27.7, §28.7). Una sola fuente de datos: `book.quotes` (las citas subrayadas de
// siempre) y el registro de lectura. Cada anotación conserva su id de color y muestra el significado que eligió
// el usuario con marca + etiqueta (nunca solo color). Crear, editar y borrar (con confirmación); el borrador se
// conserva por libro en sessionStorage y «Guardado» solo aparece cuando la escritura en el dispositivo se confirma.
import {
  BookOpen,
  Check,
  Feather,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { playUiSound } from "../../audio/uiSounds";
import { parseDay } from "../../domain/dates";
import { journalDays } from "../../domain/journal";
import { COLOR_IDS, meaningOf } from "../../domain/quoteMeanings";
import { newId } from "../../domain/books";
import { entryText } from "../../domain/reading";
import { useLibrary } from "../../state/useLibrary";
import { AnnotationCard } from "../primitives";
import { QuoteMeaningsEditor } from "./QuoteMeaningsEditor";
import { RatingStars } from "./Rating";

const dateLabel = (key) =>
  key
    ? parseDay(key).toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Sin fecha";

const draftKey = (bookId) => `bookshelf:note-draft:${bookId}`;
function readDraft(bookId) {
  try {
    return JSON.parse(sessionStorage.getItem(draftKey(bookId)) ?? "null");
  } catch {
    return null;
  }
}
function writeDraft(bookId, draft) {
  try {
    if (draft) sessionStorage.setItem(draftKey(bookId), JSON.stringify(draft));
    else sessionStorage.removeItem(draftKey(bookId));
  } catch {
    // sin almacenamiento de sesión: el borrador vive mientras el formulario siga abierto
  }
}

/**
 * Guardado confirmado: tras despachar, espera a que el estado contenga el cambio (`isIn`) y lo vuelca al
 * dispositivo. Devuelve el estado («saving», «saved», «error») y la función que inicia un guardado.
 */
export function useConfirmedSave(isIn) {
  const { actions } = useLibrary();
  const [pending, setPending] = useState(null);
  const [status, setStatus] = useState("idle");
  const onSavedRef = useRef(null);
  useEffect(() => {
    if (!pending) return undefined;
    if (!isIn(pending.check)) return undefined;
    // Tras el efecto del proveedor (que actualiza la copia más reciente del estado) se escribe y se anuncia
    const id = setTimeout(() => {
      const ok = actions.persistNow();
      setStatus(ok ? "saved" : "error");
      if (ok) pending.onSaved?.();
      setPending(null);
    }, 0);
    return () => clearTimeout(id);
  });
  const save = (run, check, onSaved) => {
    setStatus("saving");
    onSavedRef.current = onSaved;
    setPending({ check, onSaved });
    run();
  };
  // El cambio ya está en el estado: reintentar solo vuelve a escribir en el dispositivo (no duplica)
  const retry = () => {
    const ok = actions.persistNow();
    setStatus(ok ? "saved" : "error");
    if (ok) onSavedRef.current?.();
  };
  return { status, setStatus, save, retry };
}

/** Selector compacto de colores: color + etiqueta + marca de selección. */
export function MarkerPicker({ meanings, value, onChange, legendId }) {
  return (
    <div className="marker-picker" role="radiogroup" aria-labelledby={legendId}>
      {COLOR_IDS.map((key) => {
        const m = meaningOf(meanings, key);
        const on = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={m.label}
            className="marker-picker__swatch"
            style={{ "--marker": m.hex, "--marker-ink": m.ink }}
            onClick={() => {
              if (!on) playUiSound("pencil");
              onChange(key);
            }}
            title={m.label}
          >
            {on && <Check aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

/** Formulario de anotación (nueva o edición). No limita la página por el progreso ni suma páginas. */
export function AnnotationForm({
  book,
  meanings,
  initial,
  title = "Nueva anotación",
  submitLabel = "Guardar anotación",
  onSubmit,
  onCancel,
  status,
  onRetry,
  draftable = false,
  autoFocus = false,
  placeholder = "Una frase que quieras guardar…",
}) {
  const uid = useId();
  const saved = draftable ? readDraft(book.id) : null;
  const [text, setText] = useState(initial?.text ?? saved?.text ?? "");
  const [page, setPage] = useState(
    initial ? (initial.page ?? "") : (saved?.page ?? (book.currentPage || "")),
  );
  const [color, setColor] = useState(
    initial?.color ?? saved?.color ?? "yellow",
  );
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const textRef = useRef(null);
  const current = meaningOf(meanings, color);

  useEffect(() => {
    if (autoFocus) textRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);
  // Borrador por libro: se conserva al cambiar de pestaña, cerrar la ficha o recargar la página
  useEffect(() => {
    if (!draftable) return;
    writeDraft(book.id, text.trim() ? { text, page, color } : null);
  }, [draftable, book.id, text, page, color]);

  return (
    <>
      <form
        className="annotation-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          onSubmit(
            {
              text: text.trim(),
              page: Number(page) > 0 ? Math.round(Number(page)) : null,
              color,
            },
            () => {
              // Guardado confirmado: el formulario nuevo se vacía y su borrador se descarta
              if (!initial) {
                setText("");
                if (draftable) writeDraft(book.id, null);
              }
            },
          );
        }}
      >
        <h4 className="annotation-form__title">{title}</h4>
        <textarea
          ref={textRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder={placeholder}
          aria-label={initial ? "Texto de la anotación" : "Nueva anotación"}
        />
        <div className="annotation-form__row">
          <label className="annotation-form__page">
            Pág.
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={page}
              onChange={(e) => setPage(e.target.value)}
              aria-label="Página de referencia"
            />
          </label>
          <span id={`${uid}-legend`} className="sr-only-focus">
            Color de la anotación
          </span>
          <MarkerPicker
            meanings={meanings}
            value={color}
            onChange={setColor}
            legendId={`${uid}-legend`}
          />
        </div>
        <p className="annotation-form__legend">
          <span
            className="annotation-form__swatch"
            style={{ "--marker": current.hex }}
            aria-hidden="true"
          />
          <span>{current.label}</span>
        </p>
        <div className="annotation-form__actions">
          <button
            type="button"
            className="link-btn annotation-form__customize"
            aria-expanded={editing}
            onClick={() => setEditing((v) => !v)}
          >
            Personalizar colores
          </button>
          {onCancel && (
            <button type="button" className="link-btn" onClick={onCancel}>
              Cancelar
            </button>
          )}
          <button
            type="submit"
            className="sheet-btn sheet-btn--primary"
            disabled={!text.trim() || status === "saving"}
          >
            {status === "saving" ? "Guardando…" : submitLabel}
          </button>
        </div>
        {status === "saved" && (
          <p className="annotation-form__status" role="status">
            <Check aria-hidden="true" /> Guardado en este dispositivo
          </p>
        )}
        {status === "error" && (
          <p
            className="annotation-form__status annotation-form__status--error"
            role="alert"
          >
            No se ha podido guardar en este dispositivo. Tu texto sigue aquí.{" "}
            <button type="button" className="link-btn" onClick={onRetry}>
              Reintentar
            </button>
          </p>
        )}
        {notice && (
          <p className="annotation-form__status" role="status">
            {notice}
          </p>
        )}
      </form>
      {/* Fuera del formulario: el editor de colores es otro <form> (no se anidan) */}
      {editing && (
        <QuoteMeaningsEditor
          onClose={(ok) => {
            setEditing(false);
            setNotice(ok ? "Significados guardados." : "");
          }}
        />
      )}
    </>
  );
}

/** Menú de opciones de una anotación (accesible con teclado; Escape lo cierra). */
function OptionsMenu({ label, items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      ref.current?.querySelector("button")?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);
  return (
    <div ref={ref} className="options-menu">
      <button
        type="button"
        className="icon-btn options-menu__toggle"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal aria-hidden="true" />
      </button>
      {open && (
        <ul className="options-menu__list" role="menu">
          {items.map((it) => (
            <li key={it.label} role="none">
              <button
                type="button"
                role="menuitem"
                className={it.danger ? "options-menu__danger" : undefined}
                onClick={() => {
                  setOpen(false);
                  it.onSelect();
                }}
              >
                {it.icon}
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Una anotación como recorte de papel: texto, etiqueta, página, editar y menú. */
export function AnnotationItem({
  quote,
  meanings,
  book,
  onEdit,
  onShow,
  onDelete,
  fresh = false,
  context,
}) {
  const [confirm, setConfirm] = useState(false);
  const m = meaningOf(meanings, quote.color);
  return (
    <AnnotationCard
      as="li"
      hex={m.hex}
      ink={m.ink}
      className="journal-entry quote"
      data-color={quote.color}
      data-new={fresh || undefined}
    >
      {context}
      <blockquote>
        <p>{quote.text}</p>
      </blockquote>
      <footer>
        <span className="quote__tag" title={m.description || undefined}>
          <span className="quote__swatch" aria-hidden="true" />
          {m.label}
        </span>
        {quote.page ? (
          <span className="quote__page">pág. {quote.page}</span>
        ) : null}
        <span className="quote__tools">
          <button
            type="button"
            className="icon-btn"
            onClick={onEdit}
            aria-label="Editar esta anotación"
            title="Editar"
          >
            <Pencil aria-hidden="true" />
          </button>
          <OptionsMenu
            label={`Más opciones de la anotación${book ? ` de ${book.title}` : ""}`}
            items={[
              ...(onShow
                ? [
                    {
                      label: "Ver como carta",
                      icon: <Feather aria-hidden="true" />,
                      onSelect: onShow,
                    },
                  ]
                : []),
              {
                label: "Borrar",
                icon: <Trash2 aria-hidden="true" />,
                danger: true,
                onSelect: () => setConfirm(true),
              },
            ]}
          />
        </span>
      </footer>
      {confirm && (
        <div
          className="confirm-inline annotation-confirm"
          role="alertdialog"
          aria-label="Borrar esta anotación"
        >
          <span>¿Borrar esta anotación? No se puede deshacer.</span>
          <button
            type="button"
            className="link-btn link-btn--danger"
            onClick={onDelete}
          >
            Sí, borrar
          </button>
          <button
            type="button"
            className="link-btn"
            onClick={() => setConfirm(false)}
            autoFocus
          >
            Cancelar
          </button>
        </div>
      )}
    </AnnotationCard>
  );
}

/** Diario del libro: cronología por fecha con registros compactos y anotaciones, y la nueva anotación. */
export function Journal({ book, log, meanings, onShow }) {
  const { actions } = useLibrary();
  const [filter, setFilter] = useState("all");
  const [writing, setWriting] = useState(() => Boolean(readDraft(book.id)));
  const [editId, setEditId] = useState(null);
  const [freshId, setFreshId] = useState(null);
  const days = useMemo(() => journalDays(book, log), [book, log]);
  const hasQuote = (id) => book.quotes.some((q) => q.id === id);
  const sameQuote = ({ id, text, page, color }) =>
    book.quotes.some(
      (q) =>
        q.id === id &&
        q.text === text &&
        (q.page ?? null) === page &&
        q.color === color,
    );
  const adding = useConfirmedSave(hasQuote);
  const editing = useConfirmedSave(sameQuote);

  const counts = book.quotes.reduce((acc, q) => {
    const id = meaningOf(meanings, q.color).id ?? "unknown";
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {});
  const showItem = (item) =>
    filter === "all" ||
    (item.kind === "quote" &&
      (meaningOf(meanings, item.quote.color).id ?? "unknown") === filter);
  const visibleDays = days
    .map((d) => ({ ...d, items: d.items.filter(showItem) }))
    .filter((d) => d.items.length);
  const empty = days.length === 0;
  const formOpen = !empty || writing;

  const add = (quote, done) => {
    const id = newId("q");
    adding.save(
      () => actions.addQuote(book.id, { id, ...quote }),
      id,
      () => {
        done();
        setFreshId(id);
        playUiSound("save");
      },
    );
  };

  return (
    <div className="journal">
      {book.quotes.length > 0 && (
        <div
          className="quote-filter"
          role="radiogroup"
          aria-label="Filtrar anotaciones por categoría"
        >
          <button
            type="button"
            role="radio"
            aria-checked={filter === "all"}
            onClick={() => setFilter("all")}
          >
            Todo · {days.reduce((n, d) => n + d.items.length, 0)}
          </button>
          {[...COLOR_IDS, ...(counts.unknown ? ["unknown"] : [])]
            .filter((id) => counts[id])
            .map((id) => {
              const m = meaningOf(meanings, id === "unknown" ? null : id);
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={filter === id}
                  style={{ "--marker": m.hex }}
                  onClick={() => setFilter(id)}
                >
                  <span className="quote-filter__dot" aria-hidden="true" />
                  {m.label} · {counts[id]}
                </button>
              );
            })}
        </div>
      )}

      {empty ? (
        <div className="journal__empty">
          <p>¿Qué te gustaría recordar de esta historia?</p>
          {!writing && (
            <button
              type="button"
              className="sheet-btn sheet-btn--primary"
              onClick={() => setWriting(true)}
            >
              <Pencil aria-hidden="true" />
              Escribir mi primera anotación
            </button>
          )}
        </div>
      ) : (
        <ol className="journal__days">
          {visibleDays.map((d) => (
            <li key={d.key ?? "sin-fecha"} className="journal-day">
              <h4 className="journal-day__date">{dateLabel(d.key)}</h4>
              <ul className="journal-day__items">
                {d.items.map((item) => {
                  if (item.kind === "session") {
                    return (
                      <li
                        key={item.id}
                        className="journal-entry journal-entry--session"
                      >
                        <BookOpen
                          aria-hidden="true"
                          className="journal-entry__icon"
                        />
                        <span className="journal-entry__kind">Lectura</span>
                        <p>{entryText(item.entry)}</p>
                      </li>
                    );
                  }
                  if (item.kind === "review") {
                    return (
                      <li
                        key="review"
                        className="journal-entry journal-entry--review"
                      >
                        <span className="journal-entry__kind">
                          Reseña al terminar
                        </span>
                        {book.rating > 0 && <RatingStars value={book.rating} />}
                        <p>{book.review}</p>
                      </li>
                    );
                  }
                  const q = item.quote;
                  if (editId === q.id) {
                    return (
                      <li
                        key={q.id}
                        className="journal-entry journal-entry--editing"
                      >
                        <AnnotationForm
                          book={book}
                          meanings={meanings}
                          initial={q}
                          title="Editar anotación"
                          submitLabel="Guardar cambios"
                          autoFocus
                          status={editing.status}
                          onRetry={editing.retry}
                          onCancel={() => {
                            setEditId(null);
                            editing.setStatus("idle");
                          }}
                          onSubmit={(patch) =>
                            editing.save(
                              () => actions.updateQuote(book.id, q.id, patch),
                              { id: q.id, ...patch },
                              () => {
                                setEditId(null);
                                playUiSound("save");
                              },
                            )
                          }
                        />
                      </li>
                    );
                  }
                  return (
                    <AnnotationItem
                      key={q.id}
                      quote={q}
                      book={book}
                      meanings={meanings}
                      fresh={q.id === freshId}
                      onEdit={() => {
                        editing.setStatus("idle");
                        setEditId(q.id);
                      }}
                      onShow={onShow ? () => onShow(q) : null}
                      onDelete={() => actions.removeQuote(book.id, q.id)}
                    />
                  );
                })}
              </ul>
            </li>
          ))}
          {!visibleDays.length && (
            <li className="journal__none">
              No hay anotaciones con esta categoría.
            </li>
          )}
        </ol>
      )}

      {formOpen && (
        <AnnotationForm
          book={book}
          meanings={meanings}
          draftable
          autoFocus={empty && writing}
          status={adding.status}
          onRetry={adding.retry}
          onSubmit={add}
        />
      )}
    </div>
  );
}
