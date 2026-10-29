// QA de la 1.55.0 (SPEC §53): EPUB local leído en la app. El archivo se guarda en el dispositivo y no se sube; la posición
// y las notas viajan en el libro; el lector y JSZip solo se cargan al pulsar «Leer»; límites de tamaño e imágenes.
// Los EPUB de prueba se generan aquí (sintéticos, sin datos personales).
import { expect, test } from '@playwright/test';
import JSZip from 'jszip';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/** EPUB 3 mínimo con `chapters` capítulos (y `images` imágenes en el primero). */
async function makeEpub({ chapters = 3, images = 0 } = {}) {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  const items = [];
  const refs = [];
  const nav = [];
  for (let i = 1; i <= chapters; i++) {
    const imgs = i === 1 ? Array.from({ length: images }, (_, k) => `<img src="../img/i${k}.png" alt="Lámina ${k}"/>`).join('') : '';
    const paras = Array.from({ length: 40 }, (_, k) => `<p>Párrafo ${k + 1} del capítulo ${i}: el mar entraba por la ventana mientras alguien leía en silencio.</p>`).join('');
    zip.file(`OEBPS/text/c${i}.xhtml`, `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>C${i}</title><script>window.parent.document.title='hackeado'</script></head><body><h1>Capítulo ${i}</h1>${imgs}${paras}${i < chapters ? `<p><a href="c${i + 1}.xhtml">Ir al siguiente</a> · <a href="https://example.com">fuera</a></p>` : ''}</body></html>`);
    items.push(`<item id="c${i}" href="text/c${i}.xhtml" media-type="application/xhtml+xml"/>`);
    refs.push(`<itemref idref="c${i}"/>`);
    nav.push(`<li><a href="text/c${i}.xhtml">Capítulo ${i} · Título de prueba</a></li>`);
  }
  for (let k = 0; k < images; k++) {
    zip.file(`OEBPS/img/i${k}.png`, PNG);
    items.push(`<item id="i${k}" href="img/i${k}.png" media-type="image/png"/>`);
  }
  zip.file('OEBPS/nav.xhtml', `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol>${nav.join('')}</ol></nav></body></html>`);
  items.push('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>');
  zip.file('OEBPS/content.opf', `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Libro de prueba</dc:title><dc:creator>Autora Sintética</dc:creator></metadata><manifest>${items.join('')}</manifest><spine>${refs.join('')}</spine></package>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')));

async function openFicha(page) {
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.waitForTimeout(400);
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="book"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.book-sheet')).toBeVisible();
}

const requested = (page) => page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name).filter((n) => /EpubReader|jszip|epubFile/i.test(n)));

test('EPUB: añadir, leer, notas, posición sincronizada y registrar con la operación normal', async ({ page }, info) => {
  test.skip(!/390x844|1440x900|webkit-390/.test(info.project.name), '390, escritorio y WebKit');
  const uploads = [];
  page.on('request', (r) => {
    if (['POST', 'PUT', 'PATCH'].includes(r.method())) uploads.push(r.url());
  });
  await openFicha(page);
  // Nada del lector se ha cargado todavía
  expect(await requested(page)).toEqual([]);
  const box = page.locator('.epub-box');
  await expect(box.getByRole('heading', { name: 'Libro digital' })).toBeVisible();
  await box.locator('input[type=file]').setInputFiles({ name: 'prueba.epub', mimeType: 'application/epub+zip', buffer: await makeEpub() });
  await expect(box.getByRole('button', { name: 'Leer' })).toBeVisible();
  await box.scrollIntoViewIfNeeded();
  await shot(page, info, 'v155-ficha');
  // Elegir el archivo carga JSZip para comprobarlo, pero no el lector
  expect((await requested(page)).some((n) => /EpubReader/.test(n))).toBe(false);
  await expect.poll(async () => { const s = await stored(page); return Boolean(s.books.find((b) => b.id === s.settings.currentBookId).epub); }).toBe(true);
  const st0 = await stored(page);
  const id = st0.settings.currentBookId;
  const book0 = st0.books.find((b) => b.id === id);
  // Con la cuenta solo viajan los metadatos: nada del contenido en el estado sincronizado
  expect(book0.epub).toMatchObject({ name: 'prueba.epub', chapters: 3, lite: false });
  expect(book0.epub.hash).toMatch(/^[0-9a-f]{64}$/);
  expect(JSON.stringify(book0)).not.toContain('Párrafo');
  const logBefore = st0.progress.readingLog.length;

  await box.getByRole('button', { name: 'Leer' }).click();
  const reader = page.getByRole('dialog', { name: /^Leer / });
  await expect(reader).toBeVisible();
  expect((await requested(page)).some((n) => /EpubReader/.test(n))).toBe(true);
  const frame = page.frameLocator('.epub-reader__frame');
  await expect(frame.getByRole('heading', { name: 'Capítulo 1' })).toBeVisible();
  // El EPUB no ejecuta scripts y los enlaces externos no llevan a ninguna parte
  expect(await page.title()).not.toBe('hackeado');
  await expect(frame.locator('script')).toHaveCount(0);
  await expect(reader.getByText('Capítulo 1 · Título de prueba')).toBeVisible();
  await shot(page, info, 'v155-lector');
  // Nota: seleccionar un fragmento y guardarlo
  await page.locator('.epub-reader__frame').evaluate((f) => {
    const d = f.contentDocument;
    const p = d.querySelectorAll('p')[2];
    const r = d.createRange();
    r.selectNodeContents(p);
    const s = f.contentWindow.getSelection();
    s.removeAllRanges();
    s.addRange(r);
    // Como al soltar el dedo tras seleccionar
    d.dispatchEvent(new Event('pointerup'));
  });
  await reader.getByRole('button', { name: 'Guardar como nota' }).click();
  await expect(reader.getByText(/Nota guardada en «Mi diario»/)).toBeVisible();
  // Los enlaces del libro nunca navegan el iframe por sí mismos (ni los internos ni los externos)
  await expect(frame.locator('a[href]')).toHaveCount(0);
  // Capítulo siguiente y bajar hasta la mitad
  await reader.getByRole('button', { name: 'Siguiente' }).click();
  await expect(frame.getByRole('heading', { name: 'Capítulo 2' })).toBeVisible();
  await expect.poll(() => page.locator('.epub-reader__frame').evaluate((f) => f.offsetHeight)).toBeGreaterThan(1500);
  // El capítulo termina de abrirse (medida y posición inicial) antes de desplazarse
  await page.waitForTimeout(800);
  await page.locator('.epub-reader__page').evaluate((el) => {
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  });
  // La cabecera ya refleja la posición (capítulo 2, por la mitad)
  await expect.poll(async () => parseFloat((await reader.locator('.epub-reader__pct').innerText()).replace(',', '.'))).toBeGreaterThan(45);
  await reader.getByRole('button', { name: 'Cerrar el lector' }).click();
  // Al cerrar se ofrece registrar; no se registra nada sin pedirlo
  const ask = page.getByRole('alertdialog', { name: 'Registrar lo leído' });
  await expect(ask).toBeVisible();
  await page.waitForTimeout(800);
  const mid = await stored(page);
  const bookMid = mid.books.find((b) => b.id === id);
  expect(mid.progress.readingLog.length).toBe(logBefore);
  expect(bookMid.epubPosition).toMatchObject({ chapter: 1, href: 'OEBPS/text/c2.xhtml' });
  expect(bookMid.epubPosition.frac).toBeGreaterThan(0.3);
  const note = bookMid.quotes.find((q) => q.epub);
  expect(note).toMatchObject({ text: expect.stringContaining('Párrafo 3 del capítulo 1'), color: 'yellow', epub: { chapter: 0, href: 'OEBPS/text/c1.xhtml' } });
  await shot(page, info, 'v155-registrar');
  await ask.getByRole('button', { name: /Registrar hasta el/ }).click();
  await expect(reader).toHaveCount(0);
  await expect.poll(async () => (await stored(page)).progress.readingLog.length).toBe(logBefore + 1);
  const end = await stored(page);
  expect(end.progress.readingLog.at(-1)).toMatchObject({ bookId: id, source: 'epub' });
  // La nota aparece en Mi diario → Notas
  await page.getByRole('tab', { name: 'Diario' }).click();
  await page.getByRole('tab', { name: 'Notas' }).click();
  await expect(page.locator('.book-sheet .annotation-card', { hasText: 'Párrafo 3 del capítulo 1' })).toBeVisible();
  // Reabrir: vuelve al capítulo 2
  await page.getByRole('tab', { name: 'Ficha' }).click();
  await box.getByRole('button', { name: 'Leer' }).click();
  await expect(page.frameLocator('.epub-reader__frame').getByRole('heading', { name: 'Capítulo 2' })).toBeVisible();
  // El archivo nunca se ha enviado a ninguna parte
  expect(uploads.filter((u) => !u.startsWith('http://localhost'))).toEqual([]);
});

test('EPUB: otro dispositivo, archivos demasiado grandes, no válidos y con muchas imágenes', async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), 'solo 390');
  await openFicha(page);
  const box = page.locator('.epub-box');
  const input = box.locator('input[type=file]');
  // Demasiado grande: se explica y no se guarda nada
  const big = join('qa-report', 'enorme.epub');
  mkdirSync('qa-report', { recursive: true });
  writeFileSync(big, Buffer.alloc(61 * 1024 * 1024));
  await input.setInputFiles(big);
  await expect(box.getByRole('alert')).toContainText('máximo es 60,0 MiB');
  // No es un EPUB
  await input.setInputFiles({ name: 'falso.epub', mimeType: 'application/epub+zip', buffer: Buffer.from('no soy un zip') });
  await expect(box.getByRole('alert')).toContainText('No es un EPUB válido');
  // Con DRM: se explica en lugar de mostrar texto cifrado
  const drm = new JSZip();
  await drm.loadAsync(await makeEpub({ chapters: 1 }));
  drm.file('META-INF/encryption.xml', '<?xml version="1.0"?><encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#"><enc:EncryptedData><enc:EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes128-cbc"/><enc:CipherData><enc:CipherReference URI="OEBPS/text/c1.xhtml"/></enc:CipherData></enc:EncryptedData></encryption>');
  await input.setInputFiles({ name: 'drm.epub', mimeType: 'application/epub+zip', buffer: await drm.generateAsync({ type: 'nodebuffer' }) });
  await expect(box.getByRole('alert')).toContainText('DRM');
  let st = await stored(page);
  expect(st.books.find((b) => b.id === st.settings.currentBookId).epub).toBeUndefined();
  // Muchas imágenes: modo ligero (30 por capítulo, el resto como texto)
  await input.setInputFiles({ name: 'ilustrado.epub', mimeType: 'application/epub+zip', buffer: await makeEpub({ chapters: 1, images: 320 }) });
  await expect(box.getByRole('status')).toContainText('modo ligero');
  await box.getByRole('button', { name: 'Leer' }).click();
  const frame = page.frameLocator('.epub-reader__frame');
  await expect(frame.getByRole('heading', { name: 'Capítulo 1' })).toBeVisible();
  await expect(frame.locator('img')).toHaveCount(30);
  await expect(frame.locator('.epub-alt')).toHaveCount(290);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /^Leer / })).toHaveCount(0);
  // La ficha sigue abierta: Escape solo cerró el lector
  await expect(page.locator('.book-sheet')).toBeVisible();
  // Otro dispositivo: los metadatos están, el archivo no → se pide el mismo archivo
  await page.evaluate(() => new Promise((ok) => {
    const req = indexedDB.deleteDatabase('bookshelf-files');
    req.onsuccess = req.onerror = req.onblocked = () => ok();
  }));
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(page.locator('.book-sheet')).toHaveCount(0);
  await page.waitForTimeout(500);
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="book"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.epub-box')).toContainText('en otro dispositivo');
  st = await stored(page);
  expect(st.books.find((b) => b.id === st.settings.currentBookId).epub.name).toBe('ilustrado.epub');
});
