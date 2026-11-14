// 1.130 · El libro en la librería del café, con el ratón como el dedo (o con toques, con movimiento reducido): la placa de la
// sección, pasar por los lomos y tirar del que encaja, mirarlo en la tabla, elegir cómo se lo lleva y sus gestos (el papel, las
// solapas y el cordel; la tapa y el marcapáginas; la bolsa, meterlo y el borde) y, siempre, el sello. Común a los specs del café.
import { expect } from '@playwright/test';
import { GESTOS } from '../src/features/edificio/cafe/cafeGestos';
import { FORMAS, extensionDe } from '../src/features/edificio/cafe/cafeLibreria';
import { quieto } from './cafeBarra';

/** Lo que pide el cliente del libro (de la franja): { genero, extension, forma } o null (solo el café). */
export async function pideLibro(cafe) {
  const v = await cafe.locator('.cf3-franja--atender').getAttribute('data-pide-libro');
  if (!v) return null;
  const [genero, extension, forma] = v.split(':');
  return { genero, extension, forma };
}

/** Si el texto de la etiqueta de un lomo («320 págs. · largo») vale para esa extensión ('*', cualquiera). */
const vale = (texto, extension) => extension === '*' || texto.includes(`· ${extension}`) || texto.includes('corto o largo');

/**
 * Del paso de la librería a «Llevárselo». `genero`, `extension` y `forma`: los que se eligen (por defecto, los que pide);
 * `reducido`: con toques y botones; `foto(nombre)`: una captura en cada momento. Devuelve lo elegido.
 */
export async function hacerLibro(page, cafe, { genero = null, extension = null, forma = null, reducido = false, foto = null } = {}) {
  const caja = cafe.locator('.cf3-franja--atender');
  const pide = await pideLibro(cafe);
  const quiere = { genero: genero ?? pide.genero, extension: extension ?? pide.extension, forma: forma ?? pide.forma };
  await expect(caja).toHaveAttribute('data-paso', 'libreria');
  await expect(caja).toHaveAttribute('data-lib', 'estanteria');
  await page.waitForFunction(() => window.__cafe3d.enLibreria());
  // Hasta que las placas terminan de entrar (la última, a los 0,6 s)
  await quieto(page, 750);
  // 1. La estantería por secciones: la placa de latón del género
  const placa = cafe.locator(`.cf3-seccion[data-genero="${quiere.genero}"]`);
  await expect(placa).toBeVisible();
  await foto?.('estanteria');
  await placa.click();
  await expect(caja).toHaveAttribute('data-lib', 'seccion');
  await quieto(page, 300);
  await foto?.('seccion');
  // 2. Los lomos de la sección, de izquierda a derecha en la pantalla
  const lomos = await page.evaluate(() => window.__cafe3d.libreriaLomos().filter((l) => l.front));
  expect(lomos.length).toBeGreaterThan(0);
  const etiqueta = cafe.locator('.cf3-lomo-etiqueta');
  const capa = cafe.locator('.cf3-lib');
  let elegido = null;
  if (reducido) {
    // Con movimiento reducido: tocar un lomo (asoma y dice su título) y «Sacarlo»
    for (const l of lomos) {
      await page.mouse.click(l.x, l.y);
      await expect(etiqueta).toBeVisible();
      if (vale(await etiqueta.textContent(), quiere.extension)) {
        elegido = l;
        break;
      }
    }
    expect(elegido, `un lomo ${quiere.extension}`).toBeTruthy();
    await foto?.('lomo');
    await cafe.getByRole('button', { name: 'Sacarlo', exact: true }).click();
  } else {
    // Pasar el dedo por los lomos (sin soltar): cada uno asoma bajo el dedo
    const m = page.mouse;
    const y = lomos[0].y;
    await m.move(lomos[0].x, y);
    await m.down();
    for (const l of lomos) {
      await m.move(l.x, y, { steps: 4 });
      await expect(etiqueta).toBeVisible();
      if (!elegido && vale(await etiqueta.textContent(), quiere.extension)) {
        elegido = l;
        await foto?.('pasar');
      }
    }
    await m.up();
    expect(elegido, `un lomo ${quiere.extension}`).toBeTruthy();
    // Y tirar de él hacia abajo: sale de la balda
    const e = Math.min((await capa.boundingBox()).width, 600) / 390;
    await m.move(elegido.x, elegido.y);
    await m.down();
    await m.move(elegido.x, elegido.y + 30 * e, { steps: 3 });
    await foto?.('tirar');
    await m.move(elegido.x, elegido.y + 90 * e, { steps: 5 });
    await m.up();
  }
  // 3. La tabla sale y el libro se posa en ella: su ficha
  await expect(caja).toHaveAttribute('data-lib', 'mirar', { timeout: 6000 });
  const ficha = cafe.locator('.cf3-libro');
  await expect(ficha).toBeVisible();
  await quieto(page, 300);
  await foto?.('mirar');
  const titulo = await ficha.locator('.cf3-libro__titulo').textContent();
  await cafe.getByRole('button', { name: 'Este', exact: true }).click();
  // 4. Cómo se lo lleva: tocar su objeto en la tabla (la etiqueta de estraza)
  await expect(caja).toHaveAttribute('data-lib', 'forma');
  await quieto(page, 300);
  const objeto = cafe.locator(`.cf3-objeto[data-forma="${quiere.forma}"]`);
  await expect(objeto).toBeVisible();
  await foto?.('forma');
  await objeto.click();
  await expect(caja).toHaveAttribute('data-lib', 'gesto');
  for (const tipo of FORMAS.find((f) => f.id === quiere.forma).gestos) {
    if (reducido) {
      await expect(caja).toHaveAttribute('data-gesto', tipo);
      await foto?.(`gesto-${tipo}`);
      await cafe.getByRole('button', { name: GESTOS[tipo].atajo, exact: true }).click();
      await expect(caja).not.toHaveAttribute('data-gesto', tipo);
    } else await gestoLibro(page, cafe, tipo, { foto });
  }
  // 5. A la bandeja, con la taza
  await expect(caja).toHaveAttribute('data-lib', 'listo', { timeout: 6000 });
  await quieto(page, 300);
  await foto?.('listo');
  await cafe.getByRole('button', { name: 'Llevárselo', exact: true }).click();
  return { ...quiere, titulo, lomo: elegido };
}

/** Un gesto del libro con el ratón, sobre su objeto (donde está la pista). Espera a que pase al siguiente. */
export async function gestoLibro(page, cafe, tipo, { foto = null } = {}) {
  const caja = cafe.locator('.cf3-franja--atender');
  const zona = cafe.locator('.cf3-lib[data-activo="true"]');
  await expect(caja).toHaveAttribute('data-gesto', tipo);
  await quieto(page, 150);
  await expect(zona.locator('.cf3-gesto__pista')).toBeVisible();
  const p = await zona.locator('.cf3-gesto__pista').boundingBox();
  const e = Math.min((await zona.boundingBox()).width, 600) / 390;
  const c = { x: p.x + p.width / 2, y: p.y + p.height / 2 };
  const m = page.mouse;
  const a = async (x, y, steps = 4) => m.move(x, y, { steps });
  const medio = async () => foto?.(`gesto-${tipo}`);
  if (tipo === 'papel' || tipo === 'marca' || tipo === 'meter') {
    // Hacia abajo: desenrollar el papel (y se rasga), el marcapáginas entre las hojas, el libro en la bolsa
    const largo = { papel: 150, marca: 85, meter: 95 }[tipo] * e;
    await m.move(c.x, c.y - 20 * e);
    await m.down();
    await a(c.x, c.y - 20 * e + largo * 0.5, 6);
    await medio();
    await a(c.x, c.y - 20 * e + largo, 6);
    await m.up();
  } else if (tipo === 'doblar') {
    // Dos pasadas de lado: una solapa y la otra, sin soltar
    await m.move(c.x - 40 * e, c.y);
    await m.down();
    await a(c.x + 35 * e, c.y, 6);
    await medio();
    await a(c.x - 50 * e, c.y, 6);
    await m.up();
  } else if (tipo === 'cordel') {
    // Una vuelta y media alrededor del libro
    const r = 50 * e;
    await m.move(c.x + r, c.y);
    await m.down();
    for (let k = 1; k <= 64; k += 1) {
      const ang = (k * Math.PI) / 18;
      await m.move(c.x + Math.cos(ang) * r, c.y + Math.sin(ang) * r * 0.8);
      if (k === 22) await medio();
    }
    await m.up();
  } else if (tipo === 'abrir' || tipo === 'pliegue') {
    // La tapa, hacia la izquierda; el borde de la bolsa, hacia la derecha
    const s = tipo === 'abrir' ? -1 : 1;
    await m.move(c.x - s * 30 * e, c.y);
    await m.down();
    await a(c.x + s * 15 * e, c.y, 5);
    await medio();
    await a(c.x + s * 70 * e, c.y, 5);
    await m.up();
  } else if (tipo === 'bolsa') {
    // Un toque: se abre de un soplido
    await m.click(c.x, c.y);
    await medio();
  } else if (tipo === 'sello') {
    // Apretar y mantener hasta que quede marcado
    await m.move(c.x, c.y);
    await m.down();
    await page.waitForTimeout(450);
    await medio();
    await page.waitForTimeout(1300);
    await m.up();
  }
  await expect(caja).not.toHaveAttribute('data-gesto', tipo, { timeout: 5000 });
}

/** Si el libro de esas páginas vale para esa extensión (sin páginas, para las dos). */
export const encajaEn = (paginas, extension) => {
  const x = extensionDe(paginas);
  return x == null || x === extension;
};
