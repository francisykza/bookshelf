// Parte de e2e/v135.spec.js que probaba la habitación ilustrada (archivada en la 1.157.0). Son fragmentos: los imports, los datos de
// prueba y las demás ayudas siguen en el original (git show 2948485:e2e/v135.spec.js).

test('nombres de la habitación: solo con «Guías», decorativos, y el toque llega a su objeto', async ({ page }, info) => {
  await load(page);
  // 1.39.0 (SPEC §31.2): sin guías la escena queda limpia; la ayuda inicial se muestra y se descarta
  await expect(page.locator('.room-signs')).toHaveCount(0);
  const hint = page.locator('.room-signs-hint');
  await expect(hint).toBeVisible();
  await hint.getByRole('button', { name: 'Entendido' }).click();
  await expect(hint).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('bookshelf:signs-hint-done'))).toBe('true');
  // Con guías: icono + nombre por objeto, sin placas
  // (antes de cargar: al recargar, la app vuelca su estado en «pagehide» y pisaría un cambio hecho a mano)
  await page.addInitScript(() => {
    const st = JSON.parse(localStorage.getItem('bookshelf:v1'));
    if (st) {
      st.settings.showGuides = true;
      localStorage.setItem('bookshelf:v1', JSON.stringify(st));
    }
  });
  await page.reload();
  await esperarInicio(page);
  const signs = page.locator('.room-signs .room-sign');
  await expect(signs).toHaveCount(7);
  await expect(page.locator('.room-signs')).toHaveAttribute('aria-hidden', 'true');
  const meta = await signs.evaluateAll((els) => els.map((el) => ({ pe: getComputedStyle(el).pointerEvents, focusable: el.matches('button, a, [tabindex]'), text: el.textContent, icon: Boolean(el.querySelector('svg')), plate: Boolean(el.querySelector('.room-sign__plate')) })));
  expect(meta.map((s) => s.text)).toEqual(['Colección', 'Mi biblioteca', 'Mi lectura', 'Mi diario', 'Tiempo de lectura', 'Ambiente', 'Mis sagas']);
  meta.forEach((s) => {
    expect(s.pe).toBe('none');
    expect(s.focusable).toBe(false);
    expect(s.icon).toBe(true);
    expect(s.plate).toBe(false);
  });
  await shot(page, info, 'v139-nombres');
  // Ningún nombre visible recibe el toque: lo recibe el objeto de debajo
  const hits = await page.evaluate(() =>
    [...document.querySelectorAll('.room-sign')]
      .map((el) => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return null;
        return { onSign: Boolean(document.elementFromPoint(x, y)?.closest('.room-sign')) };
      })
      .filter(Boolean),
  );
  expect(hits.length).toBeGreaterThan(0);
  expect(hits.filter((h) => h.onSign)).toEqual([]);
});

test('movimiento reducido: las señales no se animan', async ({ page }, info) => {
  test.skip(!info.project.name.includes('reduced'), 'solo en el perfil de movimiento reducido');
  await load(page);
  const anims = await page.locator('.room-sign').evaluateAll((els) => els.map((el) => getComputedStyle(el).animationName));
  expect(anims.every((a) => a === 'none')).toBe(true);
});
