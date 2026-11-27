// Parte de e2e/ia1.spec.js que probaba la habitación ilustrada (archivada en la 1.157.0). Son fragmentos: los imports, los datos de
// prueba y las demás ayudas siguen en el original (git show 2948485:e2e/ia1.spec.js).

test('el ambiente sigue al libro actual y se puede desactivar', async ({ page }) => {
  await page.goto('/');
  await esperarInicio(page);
  // Circe (Fantasía, Mitología) es la lectura actual de la biblioteca de ejemplo
  await expect(page.locator('.tod')).toHaveAttribute('data-vibe', 'fantasy');
  expect(await page.locator('.tod').evaluate((el) => el.style.getPropertyValue('--vibe-light'))).toBe('#E7BD79');
  // Preferencia manual: desactivado, sin tono
  // 1.47: la cuenta tiene su propio acceso en la esquina
  await page.getByRole('button', { name: 'Tu cuenta y copias' }).click();
  await page.getByLabel(/Teñir la luz de la habitación/).uncheck();
  await page.keyboard.press('Escape');
  await expect(page.locator('.tod')).not.toHaveAttribute('data-vibe', /.+/);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1') ?? '{}').settings?.bookVibe)).toBe(false);
});
