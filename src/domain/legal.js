// Páginas legales de libotown.es y lo que hay que escribir para borrar la cuenta (Play Store, docs/qa/play-store.md §2).
// Son páginas estáticas de `public/legal/` (las lee la ficha de la tienda sin abrir la app).
export const LEGAL = Object.freeze({
  privacidad: '/legal/privacidad.html',
  normas: '/legal/normas.html',
  avisoLegal: '/legal/aviso-legal.html',
  borrarCuenta: '/legal/borrar-cuenta.html',
});

/** La palabra que hay que escribir para borrar la cuenta (la misma que comprueba `cuenta_borrar` en el servidor) */
export const PALABRA_BORRAR = 'BORRAR';

/** Cómo se ve lo que dejó una cuenta borrada (Francisco, 20-11-2026: queda, pero sin saber de quién era) */
export const LECTOR_ANONIMO = 'Lector anónimo';

/** Edad mínima para crear una cuenta (Francisco, 20-11-2026) */
export const EDAD_MINIMA = 16;
