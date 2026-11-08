// 1.86 · Acabados, con Supabase simulado: el sobre que trae uno se abre con otro brillo y el que no, no; la carta se distingue y
// el mueble llega al piso con su piel. Capturas en qa-report/screenshots-community/<proyecto>/v186-*.png. Las reglas de verdad,
// en src/features/edificio/__tests__/acabados.rls.test.js.
import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { dirOf, openShop } from './sobreShop';

async function abrirUno(shop, page, mock, premio) {
  mock.db.piso_sorteo = [premio];
  await shop.getByRole('button', { name: /^Abrir 1 · 10/ }).click();
  const gacha = page.locator('.gacha');
  await expect(gacha).toBeVisible();
  return gacha;
}

test('un sobre con acabado brilla distinto y la carta se distingue', async ({ page }, info) => {
  const { mock, shop } = await openShop(page);
  const gacha = await abrirUno(shop, page, mock, 'sofa@lacado');
  await expect(gacha).toHaveClass(/gacha--acabado/);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(dirOf(info), 'v186-sobre-cerrado.png') });
  await gacha.getByRole('button', { name: /^Rasgar el sobre/ }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(dirOf(info), 'v186-sobre-abriendo.png') });
  const carta = gacha.locator('.gacha__card.is-acabado');
  await expect(carta).toHaveClass(/is-shown/, { timeout: 5000 });
  await expect(carta).toContainText('Lacado de puerto');
  await expect(gacha.locator('.gacha__tally')).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(dirOf(info), 'v186-carta.png') });
  await expect(gacha.locator('.gacha__mnote')).toContainText('la tienda no lo vende');
  // Colocarlo: llega al piso con su piel, elegido y con su nombre
  await carta.click();
  await gacha.getByRole('button', { name: 'Colocar sofá' }).click();
  await expect(page.locator('.gacha')).toHaveCount(0, { timeout: 10000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: join(dirOf(info), 'v186-piso.png') });
  await page.locator('.ep-chip[data-cat="asientos"]').click();
  await expect(page.locator('.ep-item.is-acabado').first()).toBeAttached();
  await page.locator('.ep-item.is-acabado').first().scrollIntoViewIfNeeded().catch(() => {});
});

test('un sobre sin acabado no enseña ese brillo', async ({ page }) => {
  const { mock, shop } = await openShop(page);
  const gacha = await abrirUno(shop, page, mock, 'sofa');
  await expect(gacha).not.toHaveClass(/gacha--acabado/);
  await gacha.getByRole('button', { name: /^Rasgar el sobre/ }).click();
  await expect(gacha.locator('.gacha__tally')).toBeVisible({ timeout: 8000 });
  await expect(gacha.locator('.gacha__foil')).toHaveCount(0);
});

test('muestra: los cuatro acabados junto al mueble liso', async ({ page }, info) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const { renderThumb } = await import('/src/features/edificio/render.js');
    const { ACABADOS } = await import('/src/features/edificio/acabados.js');
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:#f3e8d2;font:13px Georgia;color:#35261a;padding:10px;overflow:auto';
    const grid = document.createElement('div');
    grid.id = 'muestra';
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(5,70px);gap:4px;text-align:center;align-items:center';
    for (const nombre of ['Liso', ...ACABADOS.map((a) => a.nombre)]) grid.append(Object.assign(document.createElement('b'), { textContent: nombre, style: 'font-size:10px' }));
    for (const id of ['sofa', 'estanteria', 'lampara-pie', 'mesa', 'cama', 'alfombra']) {
      for (const a of [null, ...ACABADOS.map((x) => x.id)]) {
        const c = renderThumb(id, 0, 64, a);
        c.style.cssText = 'width:70px;height:70px;image-rendering:pixelated';
        grid.append(c);
      }
    }
    document.body.append(grid);
  });
  await page.locator('#muestra').screenshot({ path: join(dirOf(info), 'v186-muestra.png') });
});
