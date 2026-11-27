// Parte de e2e/v162-radio.spec.js que probaba la habitación ilustrada (archivada en la 1.157.0). Son fragmentos: los imports, los datos de
// prueba y las demás ayudas siguen en el original (git show 2948485:e2e/v162-radio.spec.js).

test('salón: la radio sobre la mesa, un solo reproductor, sigue al cerrar y recarga en pausa', async ({ page }, info) => {
  test.skip(/844x390|412|reduced/.test(info.project.name), 'tamaños del bloque');
  const log = [];
  page.on('request', (r) => log.push(r.url()));
  await watchAudio(page);
  await toSalon(page);
  // En la mesa, sin tapar la tableta pintada
  const radio = await radioButton(page).boundingBox();
  const tablet = await page.locator('[data-panel="SOCIAL_ROOM"] .social-spot[data-id="tablet"]').boundingBox();
  expect(radio).not.toBeNull();
  expect(radio.y).toBeGreaterThanOrEqual(tablet.y + tablet.height * 0.85);
  // Nada de audio antes de pulsar
  expect(log.filter((u) => u.includes(MP3))).toEqual([]);
  expect(await audios(page)).toEqual([]);
  await openRadio(page);
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).getByRole('radio', { name: /Sintonía de prueba/ })).toBeChecked();
  await expect(panel(page).getByRole('radio', { name: /Sintonía de prueba/ })).toHaveCount(1);
  await expect(panel(page)).toContainText('Pista de demostración');
  await expect(panel(page)).toContainText('Brisa de papel · demo');
  await expect(panel(page).getByRole('button', { name: /Pista (anterior|siguiente)/ })).toHaveCount(0);
  await expect(panel(page).getByRole('status')).toHaveText('Pulsa reproducir para empezar.');
  await page.waitForTimeout(400);
  await shot(page, info, 'v162-radio-panel');
  // Reproducir: la interfaz espera a que suene de verdad
  await panel(page).getByRole('button', { name: 'Reproducir la música' }).click();
  await expect(panel(page).getByRole('status')).toHaveText('Sonando', { timeout: 15000 });
  await expect(panel(page).getByRole('button', { name: 'Pausar la música' })).toBeVisible();
  // Cerrar el panel no para la música; reabrirlo no crea otro reproductor
  await page.keyboard.press('Escape');
  await expect(panel(page)).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(await audios(page)).toEqual([{ paused: false, src: MP3 }]);
  await expect(radioButton(page)).toHaveAccessibleName(/sonando/);
  await openRadio(page);
  await expect(panel(page).getByRole('button', { name: 'Pausar la música' })).toBeVisible();
  await panel(page).getByRole('button', { name: 'Pausar la música' }).click();
  await expect(panel(page).getByRole('status')).toHaveText('En pausa');
  await panel(page).getByRole('button', { name: 'Reproducir la música' }).click();
  await expect(panel(page).getByRole('status')).toHaveText('Sonando', { timeout: 15000 });
  expect((await audios(page)).length).toBe(1);
  // Volúmenes por separado y recordados
  await panel(page).getByRole('slider', { name: 'Música' }).fill('30');
  await panel(page).getByRole('slider', { name: 'Ambiente' }).fill('80');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:radio')))).toEqual({ stationId: 'piloto', musicVolume: 0.3, ambienceVolume: 0.8 });
  // Recargar (el panel sigue abierto: es su sitio en el historial): en pausa hasta que se pulse, nada automático
  await page.reload();
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).getByRole('status')).toHaveText('Pulsa reproducir para empezar.');
  await expect(panel(page).getByRole('slider', { name: 'Música' })).toHaveValue('30');
  expect(await audios(page)).toEqual([]);
});

const radioButton = (page) => page.getByRole('button', { name: /^Radio del rincón/ });
