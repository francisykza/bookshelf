// 1.157 · Entrada común de las pruebas (docs/qa/borrar-habitacion-ilustrada.md): sin la habitación ilustrada, al edificio del
// puerto se baja desde tu piso (o desde la pantalla de quien no tiene cuenta o piso) con «Al edificio», en vez de por la tablet
// del salón. Abre el mismo panel que abría la tablet ({ type: 'edificio' }). Lo que se abría tocando la habitación (la cuenta de
// la esquina, el libro de la cama, la estantería) se abre aquí por la navegación de la app, con el mismo panel de siempre.
import { expect } from '@playwright/test';

/** Va al inicio y espera a tu piso o a la pantalla de entrada (las dos tienen «Al edificio»). */
export async function inicio(page, url = '/') {
  await page.goto(url);
  await esperarInicio(page);
}

/**
 * Espera a que la app esté lista tras page.goto o page.reload: tu piso (o la pantalla de entrada) con «Al edificio» o,
 * si la prueba arranca (o se recarga) con un panel o la biblioteca ya abiertos en el historial, eso.
 */
export async function esperarInicio(page) {
  const casa = page.getByRole('button', { name: 'Al edificio', exact: true });
  await expect(casa.or(page.locator('.panel-veil')).or(page.locator('.library[data-open="true"]')).first()).toBeVisible({ timeout: 30000 });
}

/** De vuelta en tu piso sin nada encima (antes, «ningún panel abierto»: ahora tu piso es el único). */
export async function enInicio(page) {
  await expect(page.getByRole('button', { name: 'Al edificio', exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.panel-veil')).toHaveCount(1);
}

/** Desde el inicio (ya cargado con page.goto), baja al portal del edificio y lo devuelve. */
export async function alEdificio(page) {
  await page.getByRole('button', { name: 'Al edificio', exact: true }).click({ timeout: 30000 });
  const portal = page.getByRole('dialog', { name: 'El edificio del puerto' });
  await expect(portal).toBeVisible({ timeout: 30000 });
  return portal;
}

/**
 * Abre un destino de la app como lo haría su botón: una entrada nueva en el historial (Atrás vuelve a donde estabas) y el
 * mismo `popstate` que escucha la navegación (src/domain/navigation.js). `panel`: { type, id?, tab?, … } o null.
 */
export async function abrir(page, panel, view = 'room') {
  await page.evaluate(
    ([p, v]) => {
      const antes = history.state?.bookshelf?.loc ?? { view: 'room', panel: null };
      const state = { bookshelf: { loc: { view: v, panel: p }, depth: (history.state?.bookshelf?.depth ?? 0) + 1, parent: antes } };
      history.pushState(state, '');
      dispatchEvent(new PopStateEvent('popstate', { state }));
    },
    [panel, view],
  );
}

/** «Tu cuenta y copias» (antes, en la esquina de la habitación). */
export const abrirCuenta = (page) => abrir(page, { type: 'account' });

/** Mi biblioteca (antes, tocando la estantería de la habitación). */
export async function abrirBiblioteca(page) {
  await abrir(page, null, 'shelf');
  await expect(page.locator('.library[data-open="true"]')).toBeVisible({ timeout: 15000 });
}

/** El libro que estás leyendo: el elegido o, si no, el primero en «Leyendo». */
async function idLibroActual(page) {
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  const id = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('bookshelf:v1') ?? 'null');
    if (!st) return null;
    return (st.books.find((b) => b.id === st.settings?.currentBookId) ?? st.books.find((b) => b.status === 'reading'))?.id ?? null;
  });
  expect(id, 'hay un libro en lectura').toBeTruthy();
  return id;
}

/** La ficha del libro que estás leyendo (antes, el libro de la cama). */
export async function abrirLibroActual(page) {
  await abrir(page, { type: 'book', id: await idLibroActual(page) });
  await expect(page.locator('.book-sheet')).toBeVisible({ timeout: 15000 });
}

/** El registro de lectura del libro que estás leyendo (antes, «Registrar lectura de…» en el libro de la cama). */
export async function abrirRegistro(page) {
  await abrir(page, { type: 'log', id: await idLibroActual(page) });
  await expect(page.locator('.panel--log')).toBeVisible({ timeout: 15000 });
}

/** El ordenador en su pantalla de hoy (antes, el portátil de la habitación). */
export const abrirOrdenador = (page) => abrir(page, { type: 'laptop', select: 'today' });

/** La bandeja del temporizador (antes, la bandeja de la habitación). */
export const abrirBandeja = (page) => abrir(page, { type: 'tray' });
