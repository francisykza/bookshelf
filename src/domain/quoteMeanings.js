// Significados de los colores de anotación (SPEC §17.4): el usuario cambia lo que significa cada color, nunca el
// color. IDs estables de `QUOTE_COLORS`; los textos originales vienen del sistema y `settings.quoteMeanings`
// guarda solo los cambiados. Una cita con un color desconocido conserva su texto y se muestra con un respaldo.
import { QUOTE_COLORS } from './books';
import { normalize } from './bookPicker';

export const COLOR_IDS = Object.keys(QUOTE_COLORS);
export const LABEL_MAX = 32;
export const DESCRIPTION_MAX = 120;
export const UNKNOWN = { label: 'Color sin significado', description: '', hex: '#d9cdb5', ink: '#5c4a35' };

/** ID de color de una cita: el propio ID o, si un dato antiguo guardó el hexadecimal, el ID de ese color. */
export function colorIdOf(raw) {
  if (QUOTE_COLORS[raw]) return raw;
  const hex = String(raw ?? '').toLowerCase();
  return COLOR_IDS.find((id) => QUOTE_COLORS[id].hex.toLowerCase() === hex) ?? null;
}

/** Significado vigente de un color (el del usuario o el original) con su tono visual. */
export function meaningOf(meanings, raw) {
  const id = colorIdOf(raw);
  if (!id) return { id: null, ...UNKNOWN };
  const custom = meanings?.[id];
  const base = QUOTE_COLORS[id];
  return {
    id,
    hex: base.hex,
    ink: base.ink,
    label: custom?.label?.trim() || base.label,
    description: custom?.description?.trim() ?? '',
  };
}

/** Borrador del editor: todos los colores con su significado vigente. */
export const draftFrom = (meanings) =>
  Object.fromEntries(
    COLOR_IDS.map((id) => {
      const m = meaningOf(meanings, id);
      return [id, { label: m.label, description: m.description }];
    }),
  );

/** Valores originales del sistema. */
export const originalDraft = () => draftFrom({});

/** Errores por color: etiqueta obligatoria y ≤ 32, descripción ≤ 120, sin etiquetas repetidas. */
export function validateMeanings(draft) {
  const errors = {};
  const seen = new Map();
  for (const id of COLOR_IDS) {
    const label = String(draft[id]?.label ?? '').trim();
    const description = String(draft[id]?.description ?? '').trim();
    const e = {};
    if (!label) e.label = 'Escribe un significado.';
    else if (label.length > LABEL_MAX) e.label = `Como mucho ${LABEL_MAX} caracteres.`;
    else if (seen.has(normalize(label))) e.label = 'Otro color ya tiene este significado.';
    if (description.length > DESCRIPTION_MAX) e.description = `Como mucho ${DESCRIPTION_MAX} caracteres.`;
    if (label) seen.set(normalize(label), id);
    if (Object.keys(e).length) errors[id] = e;
  }
  return errors;
}

/** Lo que se guarda: solo los colores distintos del original (texto plano recortado). */
export function toSettings(draft) {
  const out = {};
  for (const id of COLOR_IDS) {
    const label = String(draft[id]?.label ?? '').trim();
    const description = String(draft[id]?.description ?? '').trim();
    if (label !== QUOTE_COLORS[id].label || description) out[id] = { label, description };
  }
  return out;
}
