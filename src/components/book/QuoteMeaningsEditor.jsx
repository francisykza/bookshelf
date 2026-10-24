// Editor de significados de los colores de anotación (SPEC §17.4): compacto, dentro del diario. El usuario
// cambia lo que significa cada color (nunca el color); Guardar escribe todos los significados de una vez,
// Cancelar descarta el borrador y Restaurar vuelve a los textos originales sin tocar las citas.
import { useId, useState } from 'react';
import { playUiSound } from '../../audio/uiSounds';
import { QUOTE_COLORS } from '../../domain/books';
import { COLOR_IDS, DESCRIPTION_MAX, LABEL_MAX, draftFrom, originalDraft, toSettings, validateMeanings } from '../../domain/quoteMeanings';
import { useLibrary } from '../../state/useLibrary';

export function QuoteMeaningsEditor({ onClose }) {
  const { state, actions } = useLibrary();
  const uid = useId();
  const [draft, setDraft] = useState(() => draftFrom(state.settings.quoteMeanings));
  const [tried, setTried] = useState(false);
  const [failure, setFailure] = useState('');
  const errors = validateMeanings(draft);
  const invalid = Object.keys(errors).length > 0;
  const set = (id, field, value) => setDraft((d) => ({ ...d, [id]: { ...d[id], [field]: value } }));

  const save = (event) => {
    event.preventDefault();
    setTried(true);
    if (invalid) return;
    actions.setSettings({ quoteMeanings: toSettings(draft) });
    // La escritura se confirma antes del sello; si falla, el borrador sigue aquí
    setTimeout(() => {
      if (!actions.persistNow()) {
        setFailure('No se han podido guardar en este dispositivo. Tus cambios siguen aquí.');
        return;
      }
      playUiSound('save');
      onClose(true);
    }, 0);
  };

  return (
    <form className="meanings-editor" onSubmit={save} noValidate aria-labelledby={`${uid}-title`}>
      <h4 id={`${uid}-title`}>Personalizar colores</h4>
      <p className="meanings-editor__note">Estos significados se aplican a tus anotaciones de todos los libros.</p>
      <ul className="meanings-editor__rows">
        {COLOR_IDS.map((id) => {
          const e = tried ? errors[id] : null;
          return (
            <li key={id} className="meanings-editor__row">
              <span className="meanings-editor__swatch" style={{ '--marker': QUOTE_COLORS[id].hex }} aria-hidden="true" />
              <div className="meanings-editor__fields">
                <label htmlFor={`${uid}-${id}-l`}>Significado ({QUOTE_COLORS[id].label.toLowerCase()} de origen)</label>
                <input
                  id={`${uid}-${id}-l`}
                  value={draft[id].label}
                  maxLength={LABEL_MAX + 8}
                  onChange={(ev) => set(id, 'label', ev.target.value)}
                  aria-invalid={e?.label ? true : undefined}
                  aria-describedby={e?.label ? `${uid}-${id}-le` : undefined}
                />
                {e?.label && (
                  <small id={`${uid}-${id}-le`} className="reading-form__error">
                    {e.label}
                  </small>
                )}
                <label htmlFor={`${uid}-${id}-d`}>Descripción (opcional)</label>
                <input
                  id={`${uid}-${id}-d`}
                  value={draft[id].description}
                  maxLength={DESCRIPTION_MAX + 8}
                  onChange={(ev) => set(id, 'description', ev.target.value)}
                  aria-invalid={e?.description ? true : undefined}
                />
                {e?.description && <small className="reading-form__error">{e.description}</small>}
              </div>
            </li>
          );
        })}
      </ul>
      {failure && (
        <p className="reading-form__error" role="alert">
          {failure}
        </p>
      )}
      <div className="meanings-editor__actions">
        <button type="submit" className="stamp-btn stamp-btn--small">
          Guardar
        </button>
        <button type="button" className="link-btn" onClick={() => onClose(false)}>
          Cancelar
        </button>
        <button type="button" className="link-btn" onClick={() => setDraft(originalDraft())}>
          Restaurar valores originales
        </button>
      </div>
    </form>
  );
}
