// QA de la 1.56.0 (SPEC §54): vincular un EPUB a TU ejemplar con confirmación, lector con ancla estable, notas con tus
// categorías, «Una pausa junto al mar» con el registro de siempre, otro archivo u otro dispositivo, y que nada se suba ni
// se cargue con la habitación. Sustituye a e2e/v155 (su interfaz ya no existe). Los EPUB se generan aquí: sintéticos pero
// representativos (EPUB 3 con nav y ncx, portada fuera del orden de lectura, poesía, cursivas, notas al pie en el mismo
// documento y en otro, enlaces entre secciones e imágenes). WebKit de Playwright no equivale a Safari en un iPhone.
import { expect, test } from '@playwright/test';
import JSZip from 'jszip';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

async function shot(page, info, name) {
  const dir = join('qa-report', 'screenshots', info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const PARA = 'el mar entraba por la ventana mientras alguien leía en silencio, y las páginas olían a sal y a tarde.';

/** EPUB representativo: `title`/`author` en el OPF, cuatro secciones de lectura y una portada `linear="no"`. */
async function makeEpub({ title = 'Circe', author = 'Madeline Miller', variant = 'a' } = {}) {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  const x = (body, t) => `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${t}</title><link rel="stylesheet" href="../css/estilo.css"/><script>window.parent.document.title='hackeado'</script></head><body>${body}</body></html>`;
  const paras = (n, ch) => Array.from({ length: n }, (_, k) => `<p id="p${ch}-${k + 1}">Párrafo ${k + 1} de la sección ${ch} (${variant}): ${PARA}</p>`).join('');
  zip.file('OEBPS/text/portada.xhtml', x('<p>Portada</p>', 'Portada'));
  zip.file('OEBPS/text/s1.xhtml', x(`<h1>Uno</h1><p><em>Cursiva</em> y <strong>negrita</strong>.<a id="r1" href="#n1" epub:type="noteref">1</a></p>${paras(30, 1)}<aside id="n1" epub:type="footnote"><p>Nota al pie dentro del documento.</p></aside><p><a href="s2.xhtml">Ir a la sección dos</a> · <a href="notas.xhtml#n2">nota 2</a> · <a href="https://example.com">fuera</a></p>`, 'Uno'));
  zip.file('OEBPS/text/s2.xhtml', x(`<h1>Dos</h1><img src="../img/lamina.png" alt="Lámina del mar"/><div class="poema"><p>Verso uno<br/>verso dos</p></div>${paras(40, 2)}`, 'Dos'));
  zip.file('OEBPS/text/s3.xhtml', x(`<h1>Tres</h1><ul><li>Lista</li><li>de cosas</li></ul>${paras(40, 3)}`, 'Tres'));
  zip.file('OEBPS/text/notas.xhtml', x(`<h1>Notas</h1>${paras(6, 4)}<p id="n2">Nota 2 en su propio documento. <a href="s1.xhtml#r1">Volver</a></p>`, 'Notas'));
  zip.file('OEBPS/css/estilo.css', 'body { color: red; transform: rotate(5deg); }');
  zip.file('OEBPS/img/lamina.png', PNG);
  zip.file('OEBPS/nav.xhtml', '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="text/s1.xhtml">I. El despertar</a></li><li><a href="text/s2.xhtml">II. La isla</a></li><li><a href="text/s3.xhtml">III. El telar</a></li><li><a href="text/notas.xhtml">Notas</a></li></ol></nav></body></html>');
  zip.file('OEBPS/toc.ncx', '<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><navMap><navPoint id="a"><navLabel><text>I. El despertar</text></navLabel><content src="text/s1.xhtml"/></navPoint></navMap></ncx>');
  const items = ['portada', 's1', 's2', 's3', 'notas'].map((id) => `<item id="${id}" href="text/${id}.xhtml" media-type="application/xhtml+xml"/>`).join('');
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${title}</dc:title><dc:creator>${author}</dc:creator><dc:identifier>urn:uuid:${variant}</dc:identifier></metadata><manifest>${items}<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="css" href="css/estilo.css" media-type="text/css"/><item id="img" href="img/lamina.png" media-type="image/png"/></manifest><spine toc="ncx"><itemref idref="portada" linear="no"/><itemref idref="s1"/><itemref idref="s2"/><itemref idref="s3"/><itemref idref="notas"/></spine></package>`,
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}

const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')));
const current = async (page) => {
  const s = await stored(page);
  return { st: s, book: s.books.find((b) => b.id === s.settings.currentBookId) };
};
const requested = (page) => page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name).filter((n) => /EpubReader|jszip|epubFile/i.test(n)));

/** Habitación con Circe al 5 % (20 de 420 páginas, por páginas) y un nombre propio para el color amarillo. */
async function load(page) {
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
  await page.goto('/');
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  await page.waitForTimeout(300);
  const seeded = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('bookshelf:v1'));
    const b = st.books.find((x) => x.id === st.settings.currentBookId);
    Object.assign(b, { title: 'Circe', author: 'Madeline Miller', pageCount: 420, currentPage: 20, trackBy: 'pages', status: 'reading', editionType: 'hardcover' });
    st.settings.quoteMeanings = { yellow: { label: 'Mis subrayados' } };
    return JSON.stringify(st);
  });
  await page.addInitScript((v) => {
    if (!sessionStorage.getItem('v156')) {
      localStorage.setItem('bookshelf:v1', v);
      sessionStorage.setItem('v156', '1');
    }
  }, seeded);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.waitForTimeout(400);
}

async function openFicha(page) {
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="book"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.book-sheet')).toBeVisible();
}

const box = (page) => page.locator('.epub-box');
const reader = (page) => page.getByRole('dialog', { name: /^Leer / });
const frame = (page) => page.frameLocator('.epub-reader__frame');
const choose = async (page, buffer, name = 'circe.epub') => page.locator('.epub-box input[type=file]').setInputFiles({ name, mimeType: 'application/epub+zip', buffer });

/** Bloque de texto que queda arriba del lector. */
const topBlock = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('.epub-reader__page');
    const d = document.querySelector('.epub-reader__frame').contentDocument;
    let top = null;
    for (const b of d.querySelectorAll('[data-bs-block]')) {
      if (b.offsetTop > el.scrollTop + 8) break;
      top = b;
    }
    return top?.textContent.slice(0, 40);
  });

async function scrollHalf(page) {
  await expect.poll(() => page.locator('.epub-reader__frame').evaluate((f) => f.offsetHeight)).toBeGreaterThan(1200);
  await page.waitForTimeout(700);
  await page.locator('.epub-reader__page').evaluate((el) => {
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  });
  await page.waitForTimeout(500);
}

test('vincular: confirmación, discrepancia, cancelar sin cambios y vincular sin tocar el ejemplar', async ({ page }, info) => {
  test.skip(!/390x844|1440x900|webkit-390|360x800/.test(info.project.name), '390, 360, escritorio y WebKit');
  const uploads = [];
  page.on('request', (r) => ['POST', 'PUT', 'PATCH'].includes(r.method()) && uploads.push(r.url()));
  await load(page);
  // La habitación no carga ni el lector ni el parser
  expect(await requested(page)).toEqual([]);
  await openFicha(page);
  const { book: before } = await current(page);
  await expect(box(page).getByRole('heading', { name: 'Leer aquí' })).toBeVisible();
  await expect(box(page)).toContainText('Vincula un EPUB a este ejemplar.');
  await expect(box(page)).toContainText('Tu portada y edición se conservarán.');
  await box(page).scrollIntoViewIfNeeded();
  await shot(page, info, 'v156-leer-aqui');
  // Un archivo de otro libro: discrepancia, pide confirmación expresa; cancelar no guarda nada
  await choose(page, await makeEpub({ title: 'Ulises', author: 'James Joyce', variant: 'x' }), 'ulises.epub');
  const sheet = page.getByRole('dialog', { name: 'Vincular EPUB' });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('El archivo parece corresponder a otro libro. Revisa la vinculación.');
  await expect(sheet.getByRole('button', { name: 'Vincular de todos modos' })).toBeVisible();
  await expect(sheet.getByLabel('Tu ejemplar')).toContainText('Circe');
  await expect(sheet.getByLabel('Archivo seleccionado')).toContainText('ulises.epub');
  await sheet.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await page.waitForTimeout(500);
  expect((await current(page)).book.epub).toBeUndefined();
  expect(await page.evaluate(() => new Promise((ok) => { const r = indexedDB.open('bookshelf-files', 1); r.onupgradeneeded = () => r.result.createObjectStore('epubs'); r.onsuccess = () => { const q = r.result.transaction('epubs').objectStore('epubs').count(); q.onsuccess = () => { ok(q.result); r.result.close(); }; }; }))).toBe(0);
  // El archivo de este libro: coincidencia
  await choose(page, await makeEpub());
  await expect(sheet).toContainText('El título y el autor parecen coincidir.');
  await expect(sheet).toContainText('El avance del EPUB se registrará por porcentaje. Tu portada y edición no cambian.');
  await expect(sheet).toContainText('El archivo se guarda en este dispositivo.');
  await shot(page, info, 'v156-vincular');
  // «Elegir otro libro» busca en la biblioteca y vuelve
  await sheet.getByRole('button', { name: 'Elegir otro libro' }).click();
  await expect(sheet.getByRole('heading', { name: 'Elegir otro libro' })).toBeVisible();
  await sheet.getByLabel('Buscar en mi biblioteca').fill('circe');
  await sheet.getByRole('button', { name: /Circe/ }).first().click();
  await sheet.getByRole('button', { name: 'Vincular y leer' }).click();
  await expect(reader(page)).toBeVisible();
  await expect(frame(page).getByRole('heading', { name: 'Uno' })).toBeVisible();
  // El ejemplar no cambia: id, portada, páginas, edición y progreso
  const { book: after } = await current(page);
  expect(after).toMatchObject({ id: before.id, cover: before.cover, pageCount: 420, editionType: 'hardcover', currentPage: 20, trackBy: 'pages' });
  expect(after.epub).toMatchObject({ name: 'circe.epub', title: 'Circe', author: 'Madeline Miller', chapters: 4, anchors: 2 });
  expect(JSON.stringify(after)).not.toContain('Párrafo');
  // Aislamiento: sin scripts ni estilos del archivo
  expect(await page.title()).not.toBe('hackeado');
  await expect(frame(page).locator('body script, body link, body style')).toHaveCount(0);
  await shot(page, info, 'v156-lector');
  expect(uploads.filter((u) => !u.startsWith('http://localhost'))).toEqual([]);
});

test('leer: índice, enlaces, nota con mis categorías, ancla estable y «Una pausa junto al mar»', async ({ page }, info) => {
  test.skip(!/390x844|1440x900|webkit-390/.test(info.project.name), '390, escritorio y WebKit');
  await load(page);
  await openFicha(page);
  await choose(page, await makeEpub());
  await page.getByRole('dialog', { name: 'Vincular EPUB' }).getByRole('button', { name: 'Vincular y leer' }).click();
  const r = reader(page);
  await expect(frame(page).getByRole('heading', { name: 'Uno' })).toBeVisible();
  const logBefore = (await stored(page)).progress.readingLog.length;
  // Índice real (la portada linear="no" no es una sección)
  await r.getByRole('button', { name: 'Índice' }).click();
  const toc = page.getByRole('dialog', { name: 'Índice' });
  await expect(toc.locator('.epub-sheet__list button')).toHaveText(['I. El despertar', 'II. La isla', 'III. El telar', 'Notas']);
  await shot(page, info, 'v156-indice');
  await toc.getByRole('button', { name: 'Volver a la lectura' }).click();
  await expect(r.getByRole('button', { name: 'Índice' })).toBeFocused();
  // Enlace a otra sección y nota al pie en otro documento, con «Volver al texto»
  await frame(page).getByRole('link', { name: 'nota 2' }).click();
  await expect(frame(page).getByRole('heading', { name: 'Notas' })).toBeVisible();
  await expect(r.getByRole('button', { name: 'Volver al texto' })).toBeVisible();
  // El iframe nunca sale de su capítulo (los fragmentos se resuelven en el propio documento)
  expect(await page.locator('.epub-reader__frame').evaluate((f) => f.contentWindow.location.href.startsWith('about:srcdoc'))).toBe(true);
  await r.getByRole('button', { name: 'Volver al texto' }).click();
  await expect(frame(page).getByRole('heading', { name: 'Uno' })).toBeVisible();
  await frame(page).getByRole('link', { name: 'Ir a la sección dos' }).click();
  await expect(frame(page).getByRole('heading', { name: 'Dos' })).toBeVisible();
  await expect(frame(page).locator('a[href^="http"]')).toHaveCount(0);
  // Nota: seleccionar un fragmento → hoja con comentario y mis categorías
  await page.locator('.epub-reader__frame').evaluate((f) => {
    const d = f.contentDocument;
    const range = d.createRange();
    range.selectNodeContents(d.getElementById('p2-3'));
    const s = f.contentWindow.getSelection();
    s.removeAllRanges();
    s.addRange(range);
  });
  await r.getByRole('button', { name: 'Guardar en mi diario' }).click();
  const noteSheet = page.getByRole('dialog', { name: 'Guardar en mi diario' });
  await expect(noteSheet).toContainText('Párrafo 3 de la sección 2');
  await expect(noteSheet.getByRole('radio', { name: 'Mis subrayados' })).toBeVisible();
  await noteSheet.getByLabel('Comentario (opcional)').fill('Me recuerda a casa');
  await noteSheet.getByRole('button', { name: 'Guardar nota' }).click();
  await expect(r.getByText(/Nota guardada en «Mi diario» · Mis subrayados/)).toBeVisible();
  // Bajar a la mitad, cambiar la letra: el mismo bloque sigue arriba
  await scrollHalf(page);
  const blockBefore = await topBlock(page);
  await r.getByRole('button', { name: 'Letra y forma de leer' }).click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Letra más grande' }).click();
  await page.getByRole('radio', { name: 'Nocturno' }).click();
  await page.getByRole('dialog', { name: 'Letra y forma de leer' }).getByRole('button', { name: 'Volver a la lectura' }).click();
  await expect.poll(() => topBlock(page)).toBe(blockBefore);
  await shot(page, info, 'v156-nocturno');
  // Salir: «Una pausa junto al mar», volver sin registrar no añade lectura
  await r.getByRole('button', { name: 'Volver a la ficha' }).click();
  const pause = page.getByRole('dialog', { name: 'Una pausa junto al mar' });
  await expect(pause).toBeVisible();
  await expect(pause).toContainText('Registrado:');
  await expect(pause).toContainText('4,8 %');
  await expect(pause).toContainText(/Posición guardada en este dispositivo|Pendiente de sincronizar|Posición sincronizada/);
  await expect(pause).toContainText('Este libro pasará a registrarse por porcentaje');
  await shot(page, info, 'v156-pausa');
  await pause.getByRole('button', { name: 'Volver sin registrar' }).click();
  await expect(r).toHaveCount(0);
  await page.waitForTimeout(600);
  const mid = await current(page);
  expect(mid.st.progress.readingLog.length).toBe(logBefore);
  expect(mid.book.epubPosition).toMatchObject({ v: 2, hash: mid.book.epub.hash, href: 'OEBPS/text/s2.xhtml' });
  expect(mid.book.epubPosition.block).toBeGreaterThan(5);
  const note = mid.book.quotes.find((q) => q.epub);
  expect(note).toMatchObject({ color: 'yellow', comment: 'Me recuerda a casa', epub: { v: 2, hash: mid.book.epub.hash, href: 'OEBPS/text/s2.xhtml' } });
  // Reabrir en otra orientación: vuelve al mismo bloque
  const vp = page.viewportSize();
  await page.setViewportSize({ width: vp.height, height: vp.width });
  await box(page).getByRole('button', { name: 'Continuar lectura' }).click();
  await expect(frame(page).getByRole('heading', { name: 'Dos' })).toBeVisible();
  await expect.poll(() => topBlock(page)).toBe(blockBefore);
  await page.setViewportSize(vp);
  // Registrar con «Corregir progreso»: valida, usa el registro de siempre y no inventa páginas
  await reader(page).getByRole('button', { name: 'Volver a la ficha' }).click();
  await pause.getByRole('button', { name: 'Corregir progreso' }).click();
  const field = pause.getByLabel('Registrar hasta el (%)');
  await field.fill('abc');
  await expect(pause.getByRole('button', { name: 'Registrar en el calendario' })).toBeDisabled();
  await field.fill('');
  await expect(pause.getByRole('button', { name: 'Registrar en el calendario' })).toBeDisabled();
  await field.fill('130');
  await expect(pause.getByRole('button', { name: 'Registrar en el calendario' })).toBeDisabled();
  await field.fill('30');
  await pause.getByRole('button', { name: 'Registrar en el calendario' }).dblclick();
  await expect(reader(page)).toHaveCount(0);
  await expect.poll(async () => (await stored(page)).progress.readingLog.length).toBe(logBefore + 1);
  await page.waitForTimeout(500);
  const end = await current(page);
  expect(end.st.progress.readingLog.length).toBe(logBefore + 1);
  expect(end.st.progress.readingLog.at(-1)).toMatchObject({ source: 'epub', unit: 'percent' });
  expect(end.book).toMatchObject({ trackBy: 'percent', currentPercent: 30, pageCount: 420, editionType: 'hardcover' });
  // La nota está en Mi diario → Notas con su comentario y su procedencia
  await page.getByRole('tab', { name: 'Diario' }).click();
  await page.getByRole('tab', { name: 'Notas' }).click();
  const card = page.locator('.book-sheet .annotation-card', { hasText: 'Párrafo 3 de la sección 2' });
  await expect(card).toContainText('Me recuerda a casa');
  await expect(card).toContainText('EPUB «circe.epub»');
});

test('otro dispositivo, otro archivo, quitar y terminar: nada se pierde ni se mezcla', async ({ page }, info) => {
  test.skip(!/390x844|webkit-390/.test(info.project.name), '390 y WebKit');
  await load(page);
  await openFicha(page);
  const file = await makeEpub();
  await choose(page, file);
  await page.getByRole('dialog', { name: 'Vincular EPUB' }).getByRole('button', { name: 'Vincular y leer' }).click();
  await reader(page).getByRole('button', { name: 'Siguiente sección' }).click();
  await expect(frame(page).getByRole('heading', { name: 'Dos' })).toBeVisible();
  await scrollHalf(page);
  const block = await topBlock(page);
  await reader(page).getByRole('button', { name: 'Diario' }).click();
  await page.getByRole('button', { name: 'Nota de esta sección' }).click();
  await page.getByLabel('Tu nota').fill('Una idea sobre la isla');
  await page.getByRole('button', { name: 'Guardar nota' }).click();
  await reader(page).getByRole('button', { name: 'Volver a la ficha' }).click();
  await page.getByRole('dialog', { name: 'Una pausa junto al mar' }).getByRole('button', { name: 'Volver sin registrar' }).click();
  await page.waitForTimeout(600);
  // «Otro dispositivo»: sin el archivo ni la posición local, solo lo sincronizado
  await page.evaluate(
    () =>
      new Promise((ok) => {
        Object.keys(localStorage).filter((k) => k.startsWith('bookshelf:epub-pos:')).forEach((k) => localStorage.removeItem(k));
        const req = indexedDB.deleteDatabase('bookshelf-files');
        req.onsuccess = req.onerror = req.onblocked = () => ok();
      }),
  );
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(page.locator('.book-sheet')).toHaveCount(0);
  await page.waitForTimeout(500);
  await openFicha(page);
  await expect(box(page)).toContainText('Selecciona el mismo EPUB para continuar en este dispositivo.');
  await choose(page, file);
  await expect(frame(page).getByRole('heading', { name: 'Dos' })).toBeVisible();
  await expect.poll(() => topBlock(page)).toBe(block);
  await reader(page).getByRole('button', { name: 'Volver a la ficha' }).click();
  await page.getByRole('dialog', { name: 'Una pausa junto al mar' }).getByRole('button', { name: 'Volver sin registrar' }).click();
  // Otro archivo: confirma la sustitución, empieza desde el índice y no hereda anclajes
  await box(page).getByRole('button', { name: 'Más opciones del EPUB' }).click();
  // (cada EPUB generado lleva fechas en el ZIP: se genera una vez y se reutiliza el mismo archivo)
  const fileB = await makeEpub({ variant: 'b' });
  await page.locator('.epub-box input[type=file]').setInputFiles({ name: 'circe-otra.epub', mimeType: 'application/epub+zip', buffer: fileB });
  const sheet = page.getByRole('dialog', { name: 'Vincular EPUB' });
  await expect(sheet).toContainText('Sustituirá a «circe.epub»');
  await sheet.getByRole('button', { name: 'Vincular y leer' }).click();
  await expect(frame(page).getByRole('heading', { name: 'Uno' })).toBeVisible();
  expect(await page.locator('.epub-reader__page').evaluate((el) => el.scrollTop)).toBeLessThan(5);
  await reader(page).getByRole('button', { name: 'Diario' }).click();
  await expect(page.getByRole('dialog', { name: 'Mi diario' })).toContainText('De otro archivo («circe.epub»): no se puede abrir aquí.');
  await page.getByRole('dialog', { name: 'Mi diario' }).getByRole('button', { name: 'Volver a la lectura' }).click();
  await reader(page).getByRole('button', { name: 'Volver a la ficha' }).click();
  // Quitar del dispositivo: el libro, las notas y la vinculación siguen
  await box(page).getByRole('button', { name: 'Más opciones del EPUB' }).click();
  await page.getByRole('menuitem', { name: 'Quitar de este dispositivo' }).click();
  await page.getByRole('button', { name: 'Sí, quitar' }).click();
  await expect(box(page)).toContainText('Selecciona el mismo EPUB para continuar en este dispositivo.');
  // El estado se escribe con un pequeño retraso: se espera a que esté guardado
  await expect.poll(async () => (await current(page)).book.epub.name).toBe('circe-otra.epub');
  const { book } = await current(page);
  expect(book.quotes.filter((q) => q.epub).map((q) => q.text)).toContain('Una idea sobre la isla');
  // Terminar: registrar el 100 % confirmado abre la reseña de siempre
  await choose(page, fileB, 'circe-otra.epub');
  await reader(page).getByRole('button', { name: 'Índice' }).click();
  await page.getByRole('button', { name: 'Notas' }).click();
  await reader(page).getByRole('button', { name: 'Volver a la ficha' }).click();
  const pause = page.getByRole('dialog', { name: 'Una pausa junto al mar' });
  await pause.getByRole('button', { name: 'Corregir progreso' }).click();
  await pause.getByLabel('Registrar hasta el (%)').fill('100');
  await pause.getByRole('button', { name: 'Registrar en el calendario' }).click();
  await expect(page.locator('.review-sheet')).toBeVisible();
});

test('320 px y teclado: sin desbordes y «Guardar nota» a la vista', async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), 'solo un proyecto');
  await page.setViewportSize({ width: 320, height: 640 });
  await load(page);
  await openFicha(page);
  await choose(page, await makeEpub({ title: '', author: '' }));
  const sheet = page.getByRole('dialog', { name: 'Vincular EPUB' });
  await expect(sheet).toContainText('¿Este archivo corresponde a este libro?');
  await expect(sheet).toContainText('El archivo no indica título ni autor.');
  expect(await page.evaluate(() => document.querySelector('.epub-link__sheet').scrollWidth <= document.querySelector('.epub-link__sheet').clientWidth)).toBe(true);
  await shot(page, info, 'v156-vincular-320');
  await sheet.getByRole('button', { name: 'Vincular y leer' }).click();
  await expect(frame(page).getByRole('heading', { name: 'Uno' })).toBeVisible();
  expect(await page.evaluate(() => { const r = document.querySelector('.epub-reader'); return r.scrollWidth <= r.clientWidth && document.querySelector('.epub-reader__foot').scrollWidth <= innerWidth; })).toBe(true);
  await shot(page, info, 'v156-lector-320');
  // Teclado (emulado con un visor bajo): la hoja de nota mantiene «Guardar nota» visible y el texto no se mueve
  await reader(page).getByRole('button', { name: 'Diario' }).click();
  await page.getByRole('button', { name: 'Nota de esta sección' }).click();
  await page.setViewportSize({ width: 320, height: 330 });
  await page.getByLabel('Tu nota').fill('Escrita con el teclado abierto');
  const save = page.getByRole('button', { name: 'Guardar nota' });
  const b = await save.boundingBox();
  expect(b.y + b.height).toBeLessThanOrEqual(330);
  await save.click();
  await expect(page.getByText(/Nota guardada en «Mi diario»/)).toBeVisible();
});
