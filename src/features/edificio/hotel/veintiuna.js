// El casino del sótano del Gran Hotel (1.80, docs/qa/gran-hotel.md §9.4): «Las 21 páginas», un veintiuno contra el
// crupier sin apostar. Las cifras son las de piso_casino_reglas en supabase/migrations/20261110120000_hotel_casino.sql
// (una prueba lo comprueba); la partida la reparte y la puntúa el servidor. Aquí, cómo se lee una carta.

/**
 * Manos al día, tope de fichas a la semana y las fichas de cada final (contra el crupier nunca se pierde nada). En la
 * mesa para dos: las fichas de compañía, lo más que se apuesta entre amigos y los garbanzos del día. Desde la 1.82: las
 * mesas de garbanzos de cada día y el cambio (lote de garbanzos por tickets, lo que vuelve y el tope semanal en tickets).
 */
export const CASINO = {
  manos: 3,
  tope: 150,
  veintiuna: 12,
  ganada: 8,
  empate: 4,
  perdida: 2,
  compania: 2,
  apuestaFichas: 10,
  apuestaGarbanzos: 50,
  garbanzosInicio: 100,
  garbanzosDia: 20,
  mesasGarbanzos: 6,
  cambioGarbanzos: 50,
  cambioTickets: 5,
  vueltaGarbanzos: 25,
  topeCambio: 10,
};

const PALOS = ['picas', 'corazones', 'tréboles', 'diamantes'];
const FIGURAS = { 0: 'A', 10: 'J', 11: 'Q', 12: 'K' };

/** Una carta del servidor (0–51) como página: { palo, rojo, signo, nombre }. */
export function carta(c) {
  const v = c % 13;
  const palo = PALOS[Math.floor(c / 13)];
  const signo = FIGURAS[v] ?? String(v + 1);
  const nombre = v === 0 ? `as de ${palo}` : v >= 10 ? `${{ 10: 'jota', 11: 'reina', 12: 'rey' }[v]} de ${palo}` : `${v + 1} de ${palo}`;
  return { palo, rojo: palo === 'corazones' || palo === 'diamantes', signo, nombre };
}

/** Lo que vale una mano (el as, 11 o 1; las figuras, 10), como piso_casino_valor. */
export function valor(cartas) {
  let total = 0;
  let ases = 0;
  for (const c of cartas) {
    const v = c % 13;
    if (v === 0) {
      ases += 1;
      total += 11;
    } else total += Math.min(10, v + 1);
  }
  while (total > 21 && ases > 0) {
    total -= 10;
    ases -= 1;
  }
  return total;
}

/** Las mesas para dos que te esperan: invitaciones por aceptar y manos por jugar. */
export const mesasQueEsperan = (mesas = []) => mesas.filter((m) => (m.estado === 'invitada' && !m.anfitrion) || (m.estado === 'jugando' && m.mia?.estado === 'jugando'));

/** Cómo acabó una mano, para leerlo. */
export const FINAL = {
  veintiuna: '¡Veintiuna servida!',
  ganada: 'Ganas la mano',
  empate: 'Empate',
  perdida: 'Gana el crupier',
};

export const fichasDe = (n) => `${n} ${n === 1 ? 'ficha' : 'fichas'}`;
export const garbanzosDe = (n) => `${n} ${n === 1 ? 'garbanzo' : 'garbanzos'}`;

/**
 * La caja del casino (1.80): lo que se cambia por fichas, de lo más barato a lo más caro. Los mismos precios que
 * piso_casino_caja_precios en el servidor (una prueba lo comprueba). Las prendas son «clave:valor» del aspecto
 * (actor.js); los muebles y el compañero, ids del catálogo (catalog.js, `casino: true`). Lo que no es el sobre se tiene
 * una vez, no sale en sobres y no se recicla ni se regala.
 */
export const CAJA = [
  { id: 'complemento:visera', tipo: 'prenda', precio: 60, nombre: 'Visera verde de crupier', texto: 'La de los crupieres de antes, de celuloide verde.' },
  { id: 'pantalon:9', tipo: 'prenda', precio: 80, nombre: 'Pantalón de raya diplomática', texto: 'Gris marengo con su raya fina.' },
  { id: 'jersey:15', tipo: 'prenda', precio: 100, nombre: 'Chaleco de crupier', texto: 'Granate, con camisa blanca, pajarita y botones dorados.' },
  { id: 'sobre', tipo: 'sobre', precio: 120, nombre: 'Sobre del casino', texto: 'Un sobre de Edición coleccionista: el mismo sorteo, con su místico y su pity.' },
  { id: 'complemento:fedora', tipo: 'prenda', precio: 140, nombre: 'Fedora de ala corta', texto: 'Negra, con cinta granate y una pluma dorada.' },
  { id: 'complemento:reloj-bolsillo', tipo: 'prenda', precio: 180, nombre: 'Reloj de bolsillo dorado', texto: 'Con su cadena hasta el ojal: para saber cuándo plantarse.' },
  { id: 'jersey:16', tipo: 'prenda', precio: 200, nombre: 'Vestido de lentejuelas', texto: 'Frambuesa con lentejuelas doradas: centellea al andar y de noche brilla.', efecto: true },
  { id: 'neon-veintiuna', tipo: 'mueble', precio: 250, nombre: 'Rótulo de neón «21»', texto: 'El del casino, para tu pared: se enciende de noche.', efecto: true },
  { id: 'mesa-tapete', tipo: 'mueble', precio: 300, nombre: 'Mesa de tapete verde', texto: 'Con sus naipes y sus fichas; la baraja se mueve sola.', efecto: true },
  { id: 'alfombra-rombos', tipo: 'mueble', precio: 350, nombre: 'Alfombra de rombos dorados', texto: 'Granate, con ribete y rombos dorados, como la del sótano.' },
  { id: 'gramola', tipo: 'mueble', precio: 400, nombre: 'Gramola', texto: 'De arco de luces que cambian de color, con notas que flotan.', efecto: true },
  { id: 'conejo-chistera', tipo: 'companero', precio: 1500, nombre: 'Conejo de la chistera', texto: 'Legendario: sale de su chistera y baraja un naipe en el aire. Te acompaña.', efecto: true },
];
export const articuloDe = (id) => CAJA.find((a) => a.id === id) ?? null;

/**
 * La lata de los garbanzos (1.82): premios humildes que se cambian por garbanzos, con los precios de
 * piso_casino_lata_precios (una prueba lo comprueba). Como los de la caja: se tienen una vez y no salen en sobres.
 */
export const LATA = [
  { id: 'tarro-garbanzos', precio: 150, nombre: 'Tarro de garbanzos', texto: 'Para que se vea lo ahorrado.' },
  { id: 'baraja-naipes', precio: 300, nombre: 'Baraja de naipes', texto: 'Gastada de tanto repartir.' },
  { id: 'taburete-barra', precio: 600, nombre: 'Taburete de barra', texto: 'El de la barra del sótano.' },
];
