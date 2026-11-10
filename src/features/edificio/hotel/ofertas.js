// Ofertas del Almacén del Puerto (1.100, §100). Las elige el servidor (`piso_almacen_ofertas_de`): cada día 4 muebles con
// −20 % y cada semana uno con −50 %. Aquí solo se leen y se calcula el precio igual que él (descuento redondeado a la baja).

/** Precio de una unidad con la oferta: el de siempre menos el porcentaje, redondeando el descuento a la baja. */
export const precioOferta = (precio, pct = 0) => (Number.isInteger(precio) ? precio - Math.floor((precio * (Number.isInteger(pct) && pct > 0 ? pct : 0)) / 100) : precio);

/** Las ofertas del estado de la caja como un Map id → { id, pct, tipo }; lo que no tenga forma de oferta se ignora. */
export function mapaOfertas(lista) {
  const m = new Map();
  if (!Array.isArray(lista)) return m;
  for (const o of lista) {
    if (!o || typeof o.id !== 'string' || !Number.isInteger(o.pct) || o.pct <= 0 || o.pct >= 100) continue;
    if (!m.has(o.id)) m.set(o.id, { id: o.id, pct: o.pct, tipo: o.tipo === 'semana' ? 'semana' : 'dia' });
  }
  return m;
}

export const ROTULO_OFERTA = { dia: 'Oferta del día', semana: 'Oferta de la semana' };
