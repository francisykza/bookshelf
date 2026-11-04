// QA de la 1.85.0: la reseña como imagen para TikTok. Datos inventados; guarda los PNG en qa-report/screenshots/<proyecto>/.
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SALTO = String.fromCharCode(10);
const CORTA = 'Me ha sorprendido cómo una historia tan tranquila consigue quedarse contigo durante días. Los personajes respiran, el ritmo es pausado y el final me dejó mirando la pared un buen rato.';
const LARGA = Array.from(
  { length: 7 },
  (_, k) =>
    `Párrafo ${k + 1}. Empecé este libro sin esperar demasiado y acabé subrayando media novela: la voz de la narradora tiene algo de confidencia, de carta que no estaba escrita para ti, y cada capítulo cierra con una imagen que obliga a parar un momento antes de seguir leyendo. No todo funciona igual de bien, pero lo que funciona se queda.`,
).join(SALTO + SALTO);

async function load(page, texto) {
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await page.goto('/');
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  await page.waitForTimeout(300);
  const seeded = await page.evaluate((review) => {
    const st = JSON.parse(localStorage.getItem('bookshelf:v1'));
    const book = st.books.find((b) => b.id === st.settings.currentBookId);
    st.settings.owner = 'Marina';
    Object.assign(book, {
      title: 'La casa de los faros apagados',
      author: 'Inés Valcárcel',
      cover: '',
      status: 'read',
      rating: 4.25,
      pageCount: 412,
      categories: ['Novela'],
      editionType: 'hardcover',
      startedAt: '2026-10-02T10:00:00.000Z',
      finishedAt: '2026-10-16T10:00:00.000Z',
      quotes: [{ id: 'c1', text: 'Hay casas que solo se encienden cuando alguien las recuerda.', page: 88, createdAt: '2026-10-05T10:00:00.000Z' }],
      review,
    });
    return JSON.stringify(st);
  }, texto);
  await page.addInitScript((v) => {
    if (!sessionStorage.getItem('v185')) {
      localStorage.setItem('bookshelf:v1', v);
      sessionStorage.setItem('v185', '1');
    }
  }, seeded);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.waitForTimeout(400);
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="shelf"]').evaluate((el) => el.click());
  await expect(page.locator('.library[data-open="true"]')).toBeVisible();
  await page.waitForTimeout(500);
  await page.getByRole('searchbox', { name: 'Buscar en mi biblioteca' }).fill('faros apagados');
  await page.waitForTimeout(400);
  await page.locator('.library').getByRole('button', { name: /La casa de los faros apagados/ }).first().click();
  await expect(page.locator('.book-sheet')).toBeVisible();
  await page.getByRole('tab', { name: 'Diario' }).click();
  await page.getByRole('tablist', { name: 'Secciones del diario' }).getByRole('tab', { name: 'Reseña' }).click();
  await page.waitForTimeout(250);
}

async function guardarPng(page, info, nombre) {
  const dir = join('qa-report', 'screenshots', info.project.name);
  mkdirSync(dir, { recursive: true });
  const datos = await page.locator('.rx__vista img').evaluateAll((imgs) =>
    Promise.all(
      imgs.map(async (i) => {
        const b = await (await fetch(i.src)).blob();
        const u = new Uint8Array(await b.arrayBuffer());
        let s = '';
        for (let k = 0; k < u.length; k += 8192) s += String.fromCharCode(...u.subarray(k, k + 8192));
        return { base: btoa(s), w: i.naturalWidth, h: i.naturalHeight };
      }),
    ),
  );
  datos.forEach((d, k) => writeFileSync(join(dir, `${nombre}-${k + 1}.png`), Buffer.from(d.base, 'base64')));
  return datos;
}

const abrir = async (page) => {
  await page.getByRole('button', { name: 'Crear imagen de la reseña' }).click();
  await expect(page.locator('.rx__vista img').first()).toBeVisible();
};

test('reseña corta: una imagen de 1080×1920, papeles, formato y cita', async ({ page }, info) => {
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await load(page, CORTA);
  await abrir(page);
  await expect(page.locator('.rx__vista img')).toHaveCount(1);
  await page.waitForFunction(() => document.querySelector('.rx__vista img')?.naturalWidth > 0);
  let [d] = await guardarPng(page, info, 'v185-cuaderno');
  expect([d.w, d.h]).toEqual([1080, 1920]);
  await page.screenshot({ path: join('qa-report', 'screenshots', info.project.name, 'v185-hoja.png') });

  const cambio = async (accion) => {
    const antes = await page.locator('.rx__vista img').first().getAttribute('src');
    await accion();
    await expect.poll(() => page.locator('.rx__vista img').first().getAttribute('src')).not.toBe(antes);
    await page.waitForFunction(() => document.querySelector('.rx__vista img')?.naturalWidth > 0);
  };
  await cambio(() => page.getByRole('button', { name: 'Noche', exact: true }).click());
  await guardarPng(page, info, 'v185-noche');
  await cambio(() => page.getByRole('button', { name: 'Terracota', exact: true }).click());
  await cambio(() => page.getByLabel('Añadir una cita').check());
  await guardarPng(page, info, 'v185-terracota-cita');
  await cambio(() => page.getByRole('button', { name: 'Publicación', exact: true }).click());
  [d] = await guardarPng(page, info, 'v185-post');
  expect([d.w, d.h]).toEqual([1080, 1350]);

  // Escape cierra solo la hoja de la imagen, no la ficha
  await page.keyboard.press('Escape');
  await expect(page.locator('.rx')).toHaveCount(0);
  await expect(page.locator('.book-sheet')).toBeVisible();
  expect(errores).toEqual([]);
});

test('reseña larga: sigue en varias imágenes', async ({ page }, info) => {
  await load(page, LARGA);
  await abrir(page);
  const total = await page.locator('.rx__vista img').count();
  expect(total).toBeGreaterThan(1);
  await expect(page.locator('.rx')).toContainText(`ocupa ${total} imágenes`);
  await guardarPng(page, info, 'v185-larga');
});

test('sin texto no se ofrece la imagen', async ({ page }) => {
  await load(page, '');
  await expect(page.locator('.diary-sheet__field')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crear imagen de la reseña' })).toHaveCount(0);
});
