// Libo (docs/qa/libo.md, bloque 1): en la habitación ilustrada (la experiencia anterior), la puerta-ventana baja al edificio
// del puerto (Francisco, 20-11-2026); la tablet del salón sigue igual. Perfil de prueba sin nube. Emulación.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

test.use({ video: 'on' });

test('la puerta-ventana lleva al edificio del puerto y Atrás vuelve a la habitación', async ({ page }, info) => {
  test.skip(!/^chromium-(360x800|390x844)$|^webkit-390x844$/.test(info.project.name), 'móvil vertical');
  const dir = join('qa-report', 'libo', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.route('https://covers.openlibrary.org/**', (route) => route.fulfill({ status: 404, body: '' }));
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await page.goto('/?inicio=anterior');
  const ventana = page.locator('.hotspot[data-id="puerto"]');
  await expect(ventana).toBeVisible({ timeout: 30000 });
  await expect(ventana).toHaveAttribute('aria-label', /bajar al edificio del puerto/);
  await page.waitForTimeout(800);
  // Se toca en el cristal de abajo, lejos del astro (que sigue abriendo el atlas)
  const caja = await ventana.boundingBox();
  await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height * 0.7);
  await expect(page.getByText('Inicia sesión en «Tu cuenta» para tener un piso en el edificio.')).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: join(dir, '10-ventana-edificio.png') });
  await page.goBack();
  await expect(ventana).toBeVisible({ timeout: 15000 });
});
