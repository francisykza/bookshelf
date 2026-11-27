// Parte de e2e/v128.spec.js que probaba la habitación ilustrada (archivada en la 1.157.0). Son fragmentos: los imports, los datos de
// prueba y las demás ayudas siguen en el original (git show 2948485:e2e/v128.spec.js).

test('temporizador: el indicador sigue al vaso dentro del área visible, sin escala doble', async ({ page }, info) => {
  await load(page);
  await abrirBandeja(page);
  await page.getByRole('button', { name: /Empezar/ }).click();
  await page.getByRole('button', { name: 'Cerrar la bandeja' }).click();
  await expect(page.locator('.panel-veil')).toHaveCount(0);
  const visible = await page.evaluate(() => {
    const r = document.querySelector('[data-panel="MAIN_ROOM"] .hotspot[data-id="tray"]').getBoundingClientRect();
    return r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight;
  });
  const badge = page.locator('.tea-mist[data-placed]');
  if (!visible) {
    // Vaso fuera del encuadre: sin indicador flotando en un borde (el temporizador sigue en marcha)
    await expect(page.locator('.tea-mist')).toHaveCount(0);
    return;
  }
  await expect(badge).toHaveCount(1);
  const measure = () =>
    badge.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const t = el.querySelector('.tea-mist__time');
      return { rect: [r.left, r.top, r.right, r.bottom].map(Math.round), inside: r.left >= 11.5 && r.top >= 11.5 && r.right <= innerWidth - 11.5 && r.bottom <= innerHeight - 11.5, inWorld: Boolean(el.closest('.scene-world')), font: getComputedStyle(t).fontFamily, nums: getComputedStyle(t).fontVariantNumeric, bg: getComputedStyle(el).backgroundColor, time: t.textContent };
    });
  const a = await measure();
  run.data.timer = a;
  expect(a.inside).toBe(true);
  expect(a.inWorld).toBe(false);
  expect(a.font).toMatch(/JetBrains Mono/);
  expect(a.nums).toMatch(/tabular-nums/);
  expect(a.bg).toBe('rgba(0, 0, 0, 0)');
  await shot(page, info, 'v128-temporizador');
  // Cambio de cámara (panorama ida y vuelta): un solo indicador, la misma cuenta, dentro del área visible
  await page.locator('.panorama-nav__btn--prev').click();
  await page.waitForTimeout(950);
  await expect(page.locator('.tea-mist')).toHaveCount(1);
  const b = await measure();
  expect(b.inside).toBe(true);
  expect(b.time).not.toBe('25:00');
});

test('escena recompuesta (1.30.0): capas sobre el fondo limpio, decorativas, con movimiento solo en las validadas', async ({ page }, info) => {
  await load(page);
  await expect(page.locator('.scene-refresh-base')).toHaveCount(1, { timeout: 15000 });
  const reduced = info.project.name.includes('reduced');
  const state = () =>
    page.evaluate(() => {
      const root = document.querySelector('.room-refresh');
      const layers = [...root.querySelectorAll('.room-refresh__layer')];
      const moving = layers.filter((l) => l.dataset.motion);
      return {
        layers: layers.map((l) => l.dataset.id),
        moving: moving.map((l) => l.dataset.id),
        breeze: document.querySelectorAll('.breeze').length,
        hidden: root.getAttribute('aria-hidden'),
        pe: [getComputedStyle(root).pointerEvents, ...layers.map((l) => getComputedStyle(l).pointerEvents)],
        filter: layers.map((l) => getComputedStyle(l).filter),
        anim: moving.map((l) => getComputedStyle(l).animationName),
        play: moving.map((l) => getComputedStyle(l).animationPlayState),
        staticAnim: layers.filter((l) => !l.dataset.motion).map((l) => getComputedStyle(l).animationName),
        crops: [document.querySelector('.room-shelf-lips image')?.getAttribute('href'), document.querySelector('.laptop-foreground')?.getAttribute('src')],
      };
    });
  const s = await state();
  run.data.refresh = s;
  expect(s.layers).toEqual(['cortina-alta', 'cortina-caida', 'enredadera-poste', 'hiedra-izquierda', 'hiedra-derecha']);
  // Nunca dos representaciones de la vegetación a la vez
  expect(s.breeze).toBe(0);
  expect(s.hidden).toBe('true');
  expect(s.pe.every((v) => v === 'none')).toBe(true);
  expect(s.filter.every((v) => v === 'none')).toBe(true);
  // La cortina de arriba y la enredadera con su poste rígido no se mueven
  expect(s.moving).toEqual(['cortina-caida', 'hiedra-izquierda', 'hiedra-derecha']);
  expect(s.staticAnim.every((v) => v === 'none')).toBe(true);
  // Los recortes copian la misma pintura que se ve (fondo limpio), no la ilustración anterior
  expect(s.crops[0]).toMatch(/escena\/fondo-limpio\.webp$/);
  expect(s.crops[1]).toMatch(/escena\/portatil-primer-plano\.webp$/);
  if (reduced) {
    expect(s.anim.every((v) => v === 'none')).toBe(true);
    return;
  }
  expect(s.play.every((v) => v === 'running')).toBe(true);
  // Panel delante → en pausa
  await abrirOrdenador(page);
  await expect(page.locator('.panel-veil')).toHaveCount(1);
  expect((await state()).play.every((v) => v === 'paused')).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('.panel-veil')).toHaveCount(0);
  // Otra habitación → en pausa
  expect((await state()).play.every((v) => v === 'paused')).toBe(true);
});

test('escena recompuesta: si falla un recurso se queda la ilustración original, entera, con sus hojas SVG', async ({ page }) => {
  await page.route('**/room-refresh/escena/cortina-caida.webp', (route) => route.abort());
  await load(page);
  await page.waitForTimeout(1500);
  await expect(page.locator('.scene-refresh-base')).toHaveCount(0);
  await expect(page.locator('.room-refresh')).toHaveCount(0);
  await expect(page.locator('.breeze')).toHaveCount(1);
  expect(await page.locator('.room-shelf-lips image').getAttribute('href')).toMatch(/cozy-book-room\.jpg$/);
  expect(await page.locator('.laptop-foreground').getAttribute('src')).toMatch(/laptop-foreground\.png$/);
});

test('mar vivo (1.33.0): el agua ondula dentro de la máscara, no intercepta toques y se detiene con un panel', async ({ page }, info) => {
  await load(page);
  await expect(page.locator('.scene-refresh-base')).toHaveCount(1, { timeout: 15000 });
  const reduced = info.project.name.includes('reduced');
  const ripple = page.locator('[data-panel="MAIN_ROOM"] .sea-ripple');
  if (reduced) {
    // Movimiento reducido: composición estática (sin canvas)
    await expect(ripple).toHaveCount(0);
    return;
  }
  await expect(ripple).toHaveCount(1);
  expect(await ripple.evaluate((el) => [getComputedStyle(el).pointerEvents, el.closest('.bay') !== null])).toEqual(['none', true]);
  // Dos lecturas del canvas separadas en el tiempo: cambia mientras anima y no cambia con un panel delante
  const pixels = () => ripple.evaluate((c) => Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data.filter((_, i) => i % 97 === 0)));
  const changed = (x, y) => x.reduce((n, v, i) => n + (v !== y[i] ? 1 : 0), 0);
  await page.waitForTimeout(800);
  const a = await pixels();
  await page.waitForTimeout(900);
  expect(changed(a, await pixels())).toBeGreaterThan(0);
  await abrirOrdenador(page);
  await expect(page.locator('.panel-veil')).toHaveCount(1);
  await page.waitForTimeout(300);
  const p1 = await pixels();
  await page.waitForTimeout(900);
  expect(changed(p1, await pixels())).toBe(0);
});
