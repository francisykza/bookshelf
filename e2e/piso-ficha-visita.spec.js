// Piloto del piso: registrar una lectura desde la ficha con el teclado abierto, que lo guardado siga tras recargar, y el
// recorrido piso propio → edificio → piso de la vecina → edificio sin tocar nada del propietario.
// Biblioteca de prueba de 50 libros en el perfil de Playwright. Emulación: el teclado se simula (Android encoge la ventana;
// en el iPhone solo encoge la parte visible), no es un teclado ni un móvil reales.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'qa-report/piso-ficha-visita';
const KB = 336;
const MINE = /Entrar en tu piso/;
const NEIGHBOUR = /Llamar y entrar en el piso de Vecina de prueba/;

test.beforeEach(async ({ page }, info) => {
  test.skip(!/(chromium|webkit)-390x844$/.test(info.project.name), 'móvil vertical');
  mkdirSync(OUT, { recursive: true });
  await page.route('https://covers.openlibrary.org/**', (route) => route.fulfill({ status: 404, body: '' }));
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await page.goto('/?piloto=piso&biblioteca=50');
});

async function enter(page, re = MINE) {
  await page.getByRole('button', { name: re }).click();
  await page.waitForFunction(() => window.__pisoLab?.()?.debug().windows.length > 0, null, { timeout: 30000 });
}
const stored = (page) =>
  page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('bookshelf:v1'));
    const b = s.books.find((x) => x.id === 'lab-0');
    return { pagina: b.currentPage, sesiones: s.progress.readingLog.filter((e) => e.bookId === 'lab-0').length };
  });

// Cada control del formulario, dentro de la parte visible y sin nada encima, tras llevarlo a la vista desplazando la ficha
const reachable = (page) =>
  page.evaluate(() => {
    const bottom = window.visualViewport.height + window.visualViewport.offsetTop;
    const form = document.querySelector('.book-sheet .reading-form');
    const parts = {
      campo: form.querySelector('.reading-form__input input'),
      resumen: form.querySelector('.reading-form__preview'),
      guardar: [...form.querySelectorAll('button')].find((b) => /Guardar lectura/.test(b.textContent)),
      cancelar: [...form.querySelectorAll('button')].find((b) => /Cancelar/.test(b.textContent)),
    };
    const out = {};
    for (const [name, el] of Object.entries(parts)) {
      el.scrollIntoView({ block: 'nearest' });
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      out[name] = r.top >= 0 && r.bottom <= bottom && Boolean(hit) && (hit === el || el.contains(hit));
    }
    return out;
  });
const ALL = { campo: true, resumen: true, guardar: true, cancelar: true };

for (const keyboard of ['cerrado', 'android', 'iphone']) {
  test(`ficha: registrar con el teclado ${keyboard} y seguir guardado tras recargar`, async ({ page }, info) => {
    await enter(page);
    await page.getByRole('button', { name: 'Ver la balda' }).click();
    await page.waitForFunction(() => window.__pisoLab().debug().zoomed);
    await page.getByRole('button', { name: /Buscar en toda la biblioteca/ }).click();
    const title = await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.find((b) => b.id === 'lab-0').title);
    await page.getByRole('searchbox', { name: /Buscar por título/ }).fill(title);
    await page.locator('.plab-row__open').first().click();
    const sheet = page.locator('.book-sheet');
    await sheet.getByRole('button', { name: 'Registrar lectura' }).click();
    const input = sheet.locator('.reading-form__input input');
    await input.focus();
    if (keyboard === 'android') await page.setViewportSize({ width: 390, height: 844 - KB });
    if (keyboard === 'iphone') {
      await page.evaluate((kb) => {
        const vv = window.visualViewport;
        Object.defineProperty(vv, 'height', { configurable: true, get: () => window.innerHeight - kb });
        vv.dispatchEvent(new Event('resize'));
        const k = document.createElement('div');
        k.style.cssText = `position:fixed;left:0;right:0;bottom:0;height:${kb}px;background:rgba(40,40,48,.92);z-index:2147483647;pointer-events:none`;
        document.body.append(k);
      }, KB);
    }
    await page.waitForTimeout(400);
    // El campo con el foco queda a la vista sin tocar nada
    const box = await input.boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(844 - (keyboard === 'cerrado' ? 0 : KB));
    expect(await reachable(page)).toEqual(ALL);

    const before = await stored(page);
    // «He leído» (el modo de entrada): páginas leídas en esta sesión
    await input.fill('5');
    await page.screenshot({ path: `${OUT}/ficha-${keyboard}-${info.project.name}.png` });
    await sheet.getByRole('button', { name: /Guardar lectura/ }).click();
    await expect.poll(() => stored(page)).toEqual({ pagina: before.pagina + 5, sesiones: before.sesiones + 1 });
    // Al recargar, la app vuelve a donde estaba (el historial) con lo leído del almacenamiento
    await page.reload();
    await page.waitForFunction(() => document.querySelector('.plab-room, .book-sheet') && typeof window.__pisoLab === 'function', null, { timeout: 30000 });
    await page.waitForTimeout(500);
    expect(await stored(page)).toEqual({ pagina: before.pagina + 5, sesiones: before.sesiones + 1 });
  });
}

test('recorrido: tu piso → edificio → piso de la vecina → edificio, y de visita no se toca nada', async ({ page }, info) => {
  await enter(page);
  await expect(page.getByRole('button', { name: 'Decorar' })).toBeVisible();
  await page.getByRole('button', { name: 'Al portal' }).click();
  await expect(page.getByRole('button', { name: NEIGHBOUR })).toBeVisible();

  const keys = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
  const before = await keys();
  await enter(page, NEIGHBOUR);
  // De visita: ni registrar ni decorar ni buscar en la biblioteca del propietario
  await expect(page.locator('.plab-primary')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Decorar' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver la balda' }).click();
  await expect(page.getByRole('button', { name: 'Volver a la sala' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Buscar en toda la biblioteca/ })).toHaveCount(0);
  // El nombre del piso, entero con un toque aunque no quepa
  const name = page.locator('.plab-title__btn');
  await expect(name).toHaveAttribute('aria-expanded', 'false');
  await name.click();
  await expect(name).toHaveAttribute('aria-expanded', 'true');
  expect(await name.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: `${OUT}/vecina-${info.project.name}.png` });
  await page.getByRole('button', { name: 'Volver a la sala' }).click();
  await page.getByRole('button', { name: 'Al portal' }).click();
  await expect(page.getByRole('button', { name: MINE })).toBeVisible();
  expect(await keys()).toEqual(before);
});
