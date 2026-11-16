// 1.142 (§142): el cuaderno de Pilar (Francisco, 16-11-2026: «añadirle tareas a pilar a cambio de monedas para que pueda
// facilitar tareas o añadir funciones que recompensen al jugador a la larga»). Mejoras para siempre: se pagan una vez con
// granos, tienen grados y nunca caducan. Tras verlo («que los beneficios de los encargos sean mucho más atractivos»), cifras
// «Generosos». Son las de `20261224120000_cafe_pilar.sql`; aquí, solo para enseñarlas (el servidor cobra y lo cuenta todo).

/** Las tareas del cuaderno, cada una con sus grados ({ precio, nivel, efecto, corto }) y lo que se cuenta de lo que ha dado. */
export const TAREAS = [
  {
    id: 'caja',
    nombre: 'Colocar la caja',
    nota: 'Cada mañana, tras el reparto, Pilar sube a la balda lo que espera en las cajas.',
    dado: (d) => (d.colocados > 0 ? `${d.colocados} ${d.colocados === 1 ? 'libro colocado' : 'libros colocados'}${d.pedidos > 0 ? ` · ${d.pedidos} pedidos de más` : ''}` : null),
    grados: [
      { precio: 60, nivel: 1, efecto: 'Pilar coloca las cajas ella sola', corto: 'Coloca' },
      { precio: 300, nivel: 4, efecto: 'Además pide 3 libros más en cada reparto', corto: '+3 libros' },
    ],
  },
  {
    id: 'hucha',
    nombre: 'La hucha de propinas',
    nota: 'Mientras no estás, va guardando propinas, hasta 7 días. Se recoge al entrar.',
    dado: (d) => (d.hucha > 0 ? `${d.hucha} granos de propinas` : null),
    grados: [
      { precio: 120, nivel: 2, efecto: '8 granos al día', corto: '8/día', dia: 8 },
      { precio: 250, nivel: 2, efecto: '15 granos al día', corto: '15/día', dia: 15 },
      { precio: 450, nivel: 2, efecto: '25 granos al día', corto: '25/día', dia: 25 },
    ],
  },
  {
    id: 'pizarra',
    nombre: 'La pizarra de la acera',
    nota: 'Pilar escribe la carta del día en la acera y se para más gente. Desde el día siguiente.',
    dado: (d) => (d.clientes > 0 ? `${d.clientes} ${d.clientes === 1 ? 'cliente más' : 'clientes más'}` : null),
    grados: [
      { precio: 150, nivel: 3, efecto: '1 cliente más al día', corto: '+1' },
      { precio: 350, nivel: 3, efecto: '2 clientes más al día', corto: '+2' },
      { precio: 700, nivel: 5, efecto: '3 clientes más al día', corto: '+3' },
    ],
  },
];
/** Cuántos grados hay en total (para la barra del cuaderno). */
export const GRADOS_TOTAL = TAREAS.reduce((n, t) => n + t.grados.length, 0);

/** Lo de Pilar que llega del servidor, comprobado (o null, sin la migración). */
export function pilarDe(x) {
  if (!x || typeof x !== 'object') return null;
  const entre = (v, a, b) => Math.min(b, Math.max(a, Number.isInteger(v) ? v : 0));
  const d = x.dado && typeof x.dado === 'object' ? x.dado : {};
  return {
    caja: x.caja === true ? 1 : entre(x.caja, 0, 2),
    hucha: entre(x.hucha, 0, 3),
    pizarra: entre(x.pizarra, 0, 3),
    huchaDia: entre(x.hucha_dia, 0, 100),
    huchaLista: entre(x.hucha_lista, 0, 10000),
    dado: { hucha: entre(d.hucha, 0, 1e9), colocados: entre(d.colocados, 0, 1e9), clientes: entre(d.clientes, 0, 1e9), pedidos: entre(d.pedidos, 0, 1e9) },
  };
}

/** El grado que tienes de una tarea (0, sin encargar). */
export const gradoDe = (pilar, id) => pilar?.[id] ?? 0;
/** Cuántos grados llevas encargados entre todas las tareas. */
export const gradosHechos = (pilar) => TAREAS.reduce((n, t) => n + gradoDe(pilar, t.id), 0);

/**
 * Cómo está una tarea para ti: el grado, el actual, el siguiente (con su precio, nivel y efecto) y, si no se puede encargar,
 * por qué (`falta`: 'hecho', 'nivel' o 'granos'). Con la hucha, en cuántos días se paga sola la mejora (`seaPagaEn`).
 */
export function estadoTarea(t, { pilar, nivel = 1, granos = 0 } = {}) {
  const grado = gradoDe(pilar, t.id);
  const siguiente = t.grados[grado] ?? null;
  const falta = !siguiente ? 'hecho' : nivel < siguiente.nivel ? 'nivel' : granos < siguiente.precio ? 'granos' : null;
  const actual = grado > 0 ? t.grados[grado - 1] : null;
  const extra = siguiente?.dia ? siguiente.dia - (actual?.dia ?? 0) : 0;
  return { grado, siguiente, actual, falta, seaPagaEn: extra > 0 ? Math.ceil(siguiente.precio / extra) : null };
}
