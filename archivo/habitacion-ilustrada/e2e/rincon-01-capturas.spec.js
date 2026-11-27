// Rincón 01 · capturas del mismo encuadre (antes / después): la habitación con la biblioteca de ejemplo, guías
// apagadas, de día y de noche, a 390 × 844 y a 375 × 667. `RINCON_FASE=antes|despues` elige la carpeta. Emulación de
// Playwright: no equivale a un iPhone físico.
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const FASE = process.env.RINCON_FASE || 'despues';

async function openRoom(page, hora) {
  // Open Library a veces no responde (5-11-2026: sin respuesta en 20 s). Solo en estas capturas, la misma portada por
  // ISBN se pide a Google Books; la app no cambia. Con `RINCON_OL=1` se usa Open Library tal cual.
  if (!process.env.RINCON_OL) {
    await page.route('https://covers.openlibrary.org/**', async (route) => {
      const isbn = /isbn\/(\d+)/.exec(route.request().url())?.[1];
      if (!isbn) return route.fulfill({ status: 404, body: '' });
      const response = await route.fetch({ url: `https://books.google.com/books/content?vid=ISBN${isbn}&printsec=frontcover&img=1&zoom=1` }).catch(() => null);
      return response ? route.fulfill({ response }) : route.fulfill({ status: 404, body: '' });
    });
  }
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  // La hora se elige como lo haría cualquiera, en «Ambiente» (las guías vienen apagadas por defecto)
  await page.getByRole('button', { name: 'Ambiente' }).click();
  await page.getByRole('radio', { name: new RegExp(hora) }).click();
  await page.getByRole('button', { name: 'Cerrar Ambiente' }).click();
  await expect(page.locator('.room-camera')).toHaveAttribute('data-guides', 'false');
  await page.waitForFunction(() => [...document.querySelectorAll('[data-panel="MAIN_ROOM"] img')].every((i) => i.complete));
  // La portada expuesta (después): que llegue o que se rinda, nunca a medio cargar
  await page.waitForFunction(() => [...document.querySelectorAll('[data-panel="MAIN_ROOM"] [data-cover]')].every((el) => el.dataset.cover === 'loaded'), null, { timeout: 25000 }).catch(() => {});
  await page.waitForFunction(() => [...document.querySelectorAll('[data-panel="MAIN_ROOM"] img')].every((i) => i.complete));
  await page.waitForTimeout(900);
}

for (const [hora, name] of [['Mañana', 'dia'], ['Noche', 'noche']]) {
  for (const [w, h] of [[390, 844], [375, 667]]) {
    test(`rincón 01 · ${name} · ${w}×${h}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'chromium-390x844', 'un encuadre fijo');
      await page.setViewportSize({ width: w, height: h });
      await openRoom(page, hora);
      const dir = join('qa-report', 'rincon-01', FASE);
      mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: join(dir, `${name}-${w}x${h}.png`) });
    });
  }
}
