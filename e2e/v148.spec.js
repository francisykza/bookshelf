// QA de la 1.48.0 (SPEC §46): cabecera de la biblioteca sin solapes, cinco filtros sin desplazamiento horizontal,
// habitación sin título visible, cascos visibles, carteles orientados y selector de lectura del registro.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { abrirBiblioteca, abrirRegistro, esperarInicio } from './entrada';

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')));
const portrait = (page) => page.viewportSize().width < page.viewportSize().height;
const rect = (page, sel) => page.locator(sel).first().evaluate((el) => el.getBoundingClientRect().toJSON());
const overlap = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;

async function load(page) {
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await page.goto('/');
  await esperarInicio(page);
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  await page.waitForTimeout(300);
}

test('biblioteca: volver, buscador y cinco filtros sin solaparse ni desplazarse en horizontal', async ({ page }, info) => {
  await load(page);
  await abrirBiblioteca(page);
  await expect(page.locator('.library[data-open="true"]')).toBeVisible();
  await page.waitForTimeout(500);
  const back = await rect(page, '.lib-head--147 .lib-hero__back');
  const search = await rect(page, '.lib-head--147 .shelf-search');
  const tools = await rect(page, '.lib-head--147 .lib-tools-icon');
  expect(overlap(back, search)).toBe(false);
  expect(back.bottom).toBeLessThanOrEqual(search.top + 0.5);
  expect(overlap(back, tools)).toBe(false);
  // Sin desplazamientos heredados (en un móvil real `top: env(safe-area-inset-top)` lo metía en el buscador)
  const offs = await page.locator('.lib-head--147 .lib-hero__back').evaluate((el) => {
    const cs = getComputedStyle(el);
    return [cs.top, cs.left, cs.transform];
  });
  expect(['auto', '0px']).toContain(offs[0]);
  expect(['auto', '0px']).toContain(offs[1]);
  expect(offs[2]).toBe('none');
  // Herramientas: icono sin placa con superficie de 44 px
  expect(tools.width).toBeGreaterThanOrEqual(44);
  expect(tools.height).toBeGreaterThanOrEqual(44);
  expect(await page.locator('.lib-tools-icon').evaluate((el) => getComputedStyle(el).borderImageSource)).toBe('none');
  // Los cinco filtros dentro de la pantalla, con su nombre entero y sin desplazamiento horizontal
  const f = await page.evaluate(() => {
    const row = document.querySelector('.lib-cloths__row');
    return {
      scroll: row.scrollWidth - row.clientWidth,
      page: document.documentElement.scrollWidth - innerWidth,
      tabs: [...row.querySelectorAll('.lib-cloth')].map((t) => {
        const r = t.getBoundingClientRect();
        const label = t.querySelector('span');
        return { text: label.textContent, inside: r.left >= 0 && r.right <= innerWidth, cut: label.scrollWidth > label.clientWidth + 1, h: r.height };
      }),
    };
  });
  expect(f.scroll).toBeLessThanOrEqual(0);
  expect(f.page).toBeLessThanOrEqual(0);
  expect(f.tabs.map((t) => t.text)).toEqual(['Todos', 'Leyendo', 'Pendientes', 'Leídos', 'Abandonados']);
  for (const t of f.tabs) {
    expect(t.inside, t.text).toBe(true);
    expect(t.cut, t.text).toBe(false);
    expect(t.h, t.text).toBeGreaterThanOrEqual(40);
  }
  // La primera balda empieza pronto
  const shelf = await rect(page, '.library .lib-shelf');
  if (portrait(page)) expect(shelf.top).toBeLessThan(page.viewportSize().height * 0.34);
  await shot(page, info, 'v148-biblioteca');
});

test('registro: selector de lectura, borradores por libro y guardado solo en el elegido', async ({ page }, info) => {
  await load(page);
  const before = await stored(page);
  const circe = before.books.find((b) => b.title === 'Circe');
  const other = before.books.find((b) => b.status === 'reading' && b.id !== circe.id && b.pageCount && b.pageCount !== circe.pageCount && b.trackBy !== 'percent');
  expect(other).toBeTruthy();
  await abrirRegistro(page);
  const trigger = page.locator('.log-pick__trigger');
  await expect(trigger).toContainText('Circe');
  await expect(trigger).toContainText(`${circe.pageCount}`);
  // Un borrador en Circe
  const form = (id) => page.locator(`.panel--log .reading-form`).locator('visible=true');
  await page.getByRole('radio', { name: 'He leído' }).click();
  await form().locator('input[inputmode]').fill('10');
  await expect(form().locator('.reading-form__preview')).toContainText('Registrarás 10 páginas');
  // Cambiar a otra lectura con otro total: progreso, total y vista previa propios, sin arrastrar el valor
  await trigger.click();
  const list = page.getByRole('listbox', { name: 'Lecturas' });
  await expect(list.getByRole('option').first()).toBeVisible();
  await expect(list.getByRole('option', { name: /Circe/ })).toHaveAttribute('aria-selected', 'true');
  await shot(page, info, 'v148-selector');
  await list.getByRole('option', { name: new RegExp(other.title.slice(0, 12)) }).click();
  await expect(trigger).toContainText(other.title.slice(0, 12));
  await expect(trigger).toContainText(`${other.pageCount}`);
  await expect(form().locator('input[inputmode]')).toHaveValue('');
  await form().getByRole('radio', { name: 'He leído' }).click();
  await form().locator('input[inputmode]').fill('5');
  await expect(form().locator('.reading-form__preview')).toContainText(`Pasarás de la página ${other.currentPage} a la ${other.currentPage + 5}`);
  // Volver a Circe: su borrador sigue ahí
  await trigger.click();
  await list.getByRole('option', { name: /Circe/ }).click();
  await expect(form().locator('input[inputmode]')).toHaveValue('10');
  // Guardar el otro libro: solo cambia ese
  await trigger.click();
  await list.getByRole('option', { name: new RegExp(other.title.slice(0, 12)) }).click();
  await form().getByRole('button', { name: 'Guardar lectura' }).click();
  // Había un borrador en Circe: guardar cierra la vista igualmente (el guardado no es «cerrar sin guardar»)
  await expect(page.locator('.panel--log')).toHaveCount(0);
  const after = await stored(page);
  expect(after.books.find((b) => b.id === other.id).currentPage).toBe(other.currentPage + 5);
  expect(after.books.find((b) => b.id === circe.id).currentPage).toBe(circe.currentPage);
  expect(after.settings.currentBookId ?? null).toBe(before.settings.currentBookId ?? null);
  expect(after.progress.readingLog.length).toBe(before.progress.readingLog.length + 1);
});

test('registro: «Elegir otro libro» muestra el resto sin saturar la lista inicial', async ({ page }) => {
  await load(page);
  await abrirRegistro(page);
  await page.locator('.log-pick__trigger').click();
  const list = page.getByRole('listbox', { name: 'Lecturas' });
  const s = await stored(page);
  const reading = s.books.filter((b) => b.status === 'reading').length;
  await expect(list.getByRole('option')).toHaveCount(reading);
  await page.getByRole('button', { name: 'Elegir otro libro' }).click();
  await expect(list.getByRole('option')).toHaveCount(reading + s.books.filter((b) => b.status === 'want' || b.status === 'abandoned').length);
  await page.keyboard.press('Escape');
  await expect(list).toHaveCount(0);
  await expect(page.locator('.panel--log')).toBeVisible();
});
