// Las medidas y los colores del vestíbulo del Gran Hotel, compartidos por el dibujo isométrico (lobbyArt.js) y la recepción
// en 3D (recepcion3d.js): lo que se mueva aquí se mueve en las dos vistas. Mundo de la app: x a lo largo de la pared del
// fondo, y hacia dentro (de la pared del fondo a la entrada), z hacia arriba, en celdas.

/** Ancho (pared del fondo), hondo (pared izquierda), alto de las paredes y grueso del muro. */
export const SW = 11;
export const SD = 8;
export const WH = 4.8;
export const WALL_T = 0.3;
/** Zócalo de nogal, su filete dorado y la separación de las pilastras. */
export const ZOCALO = 1.05;
export const FILETE = 1.13;
export const PILASTRA = 2.2;
export const PILASTRA_W = 0.16;
/** Cornisa dorada, desde el techo. */
export const CORNISA = 0.22;

/** El ascensor, en la pared del fondo. */
export const ASCENSOR = { x0: 6.95, x1: 8.85 };
/** El diván redondo del centro y la lámpara de araña encima. */
export const DIVAN = { x: 4.2, y: 4.4 };
/** La recepción (casillero y mostrador, en la pared del fondo), el tablón y el guardarropa (en la izquierda). */
export const RECEPCION = { x0: 1.1, x1: 4.9, y0: 1.0, y1: 1.65, conserje: [3.0, 0.55] };
export const TABLON = { y0: 1.05, y1: 2.95, z0: 1.45, z1: 2.95 };
export const GUARDARROPA = { y0: 4.3, y1: 6.9 };
/** El carrito de equipajes y la huésped que espera el ascensor. */
export const CARRITO = { x: 9.55, y: 2.2 };
export const HUESPED = { x: 6.15, y: 1.4 };
/** Apliques de pared: en la del fondo (x) y en la izquierda (y), a esta altura. */
export const APLIQUES = { fondo: [5.6, 10.2], izq: [3.75], z: 2.7 };

export const CREAM = [234, 218, 186];
export const GOLD = [236, 190, 96];
export const GOLD_D = [168, 120, 54];
export const WALNUT = [98, 60, 40];
export const WALNUT_L = [138, 88, 56];
export const MARBLE = [232, 226, 212];
export const MARBLE_D = [50, 70, 68];
export const RED = [150, 40, 46];
export const VELVET = [52, 98, 96];
export const DARK = [34, 30, 36];
export const LAMP = [255, 230, 168];
