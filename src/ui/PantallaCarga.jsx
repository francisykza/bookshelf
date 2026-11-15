// 1.138 (SPEC §138): todas las pantallas de carga son la de Libotown (§136.5): el logo sobre el marrón de la marca, en el mismo
// sitio y tamaño que la del arranque (index.html y `.home-boot`). Lo único que cambia es el mensaje, que dice adónde vas
// (Francisco, 15-11-2026). Va a `document.body` para cubrir toda la pantalla aunque la sala esté dentro de un panel que se mueve.
import { useLayoutEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

// Cuántas hay montadas: con una delante, el fondo de arranque de la app (`.home-boot`) no repite su mensaje
let montadas = 0;
const oyentes = new Set();
const avisar = () => oyentes.forEach((f) => f());
const suscribir = (f) => {
  oyentes.add(f);
  return () => oyentes.delete(f);
};

/** true mientras se ve alguna pantalla de carga. */
export function useHayPantallaCarga() {
  return useSyncExternalStore(suscribir, () => montadas > 0);
}

/** La pantalla de carga de Libotown con `mensaje` (p. ej. «Abriendo el bajo…») debajo de las letras. */
export function PantallaCarga({ mensaje }) {
  useLayoutEffect(() => {
    montadas += 1;
    avisar();
    return () => {
      montadas -= 1;
      avisar();
    };
  }, []);
  return createPortal(
    <p className="pantalla-carga" role="status">
      {mensaje}
    </p>,
    document.body,
  );
}
