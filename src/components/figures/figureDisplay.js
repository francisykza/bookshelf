// Cómo se expone una figura (SPEC §11.7, 1.17.0): la ruta «desprecintada» solo existe con un asset propio con
// transparencia real; sin él se ve la caja, pero la preferencia guardada no se toca.

/** ¿Se puede exponer desprecintada? Solo con un asset propio con transparencia real. */
export const canUnbox = (fig) => Boolean(fig?.unboxedAvailable && fig.unboxedImage);

/** Cómo se ve de verdad: la preferencia guardada se respeta, pero sin asset transparente se ve la caja. */
export const shownDisplay = (fig, display) => (display === 'unboxed' && canUnbox(fig) ? 'unboxed' : 'box');
