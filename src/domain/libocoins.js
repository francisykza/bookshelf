// Libocoins (Francisco, 27-11-2026; docs/qa/libocoins.md): así se llaman los tickets en todo lo que se ve. Por dentro
// (servidor, código y Supabase) siguen siendo `tickets`, sin migración. Sin dependencias: lo usan la economía y los servicios.

export const MONEDA = Object.freeze({ una: 'Libocoin', varias: 'Libocoins' });

/** «1 Libocoin», «5 Libocoins». */
export const libocoinsText = (n) => `${n} ${n === 1 ? MONEDA.una : MONEDA.varias}`;

/** Los mensajes del servidor aún dicen «tickets»: se leen con el nombre de la moneda. */
export const conLibocoins = (texto) =>
  String(texto ?? '')
    .replace(/\b[Tt]ickets\b/g, MONEDA.varias)
    .replace(/\b[Tt]icket\b/g, MONEDA.una);
