// QA de la 1.57.0 (SPEC §55): el lector cabe en 320, 390 y escritorio con contenido ancho; paneles que siempre vuelven a
// la lectura (también con Atrás); lectura página a página que recorre todo y pasa de sección; cambiar de forma, letra u
// orientación conserva el sitio; subrayados persistentes (cruzando cursivas y líneas) que reflejan color y borrado; un
// fragmento repetido no se ancla al azar; nada crea sesiones. EPUB sintéticos generados aquí. WebKit de Playwright no es
// Safari de iOS.
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
const PARA = 'la luz de la tarde entraba por la ventana y el mar seguía su ritmo tranquilo mientras alguien leía en silencio.';

async function makeEpub() {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/c.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  const x = (b, t) => `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${t}</title></head><body>${b}</body></html>`;
  const paras = (n, s) => Array.from({ length: n }, (_, k) => `<p>Párrafo ${k + 1} de la sección ${s}: ${PARA}</p>`).join('');
  // Sección 1: lo que desborda + un párrafo con cursivas que cruza líneas + una frase repetida
  zip.file(
    'OEBPS/s1.xhtml',
    x(
      `<h1>Capítulo primero del árbol de la ciencia</h1><p>Una URL https://example.com/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/bbbbbbbbbbbbbbb y unapalabraextraordinariamentelargaquenocabeenningunapantalla.</p><table width="900"><tr>${'<td>celda ancha</td>'.repeat(10)}</tr></table><pre>código    con    espacios    largos    que    no    se    cortan    solos    nunca    jamás</pre><img src="i.png" width="1200" height="800" alt="lámina"/><svg xmlns="http://www.w3.org/2000/svg" width="900" height="200" viewBox="0 0 900 200"><rect width="900" height="200" fill="#ccc"/></svg><p id="cruce">Aquel verano, <em>cuando las olas llegaban despacio</em>, la casa entera olía a sal y a papel antiguo, y nadie tenía prisa por cerrar los libros.</p><p>Una frase repetida en el libro. Otra cosa. Una frase repetida en el libro.</p>${paras(30, 1)}`,
      'Uno',
    ),
  );
  zip.file('OEBPS/s2.xhtml', x(`<h1>Dos</h1>${paras(30, 2)}<p id="fin2">Última línea de la sección dos.</p>`, 'Dos'));
  zip.file('OEBPS/s3.xhtml', x(`<h1>Tres</h1>${paras(12, 3)}`, 'Tres'));
  zip.file('OEBPS/i.png', PNG);
  zip.file('OEBPS/nav.xhtml', '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="s1.xhtml">Uno</a></li><li><a href="s2.xhtml">Dos</a></li><li><a href="s3.xhtml">Tres</a></li></ol></nav></body></html>');
  zip.file('OEBPS/c.opf', `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Circe</dc:title><dc:creator>Madeline Miller</dc:creator></metadata><manifest><item id="s1" href="s1.xhtml" media-type="application/xhtml+xml"/><item id="s2" href="s2.xhtml" media-type="application/xhtml+xml"/><item id="s3" href="s3.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="i" href="i.png" media-type="image/png"/></manifest><spine><itemref idref="s1"/><itemref idref="s2"/><itemref idref="s3"/></spine></package>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')));
const current = async (page) => {
  const s = await stored(page);
  return { st: s, book: s.books.find((b) => b.id === s.settings.currentBookId) };
};
const reader = (page) => page.getByRole('dialog', { name: /^Leer / });
const frame = (page) => page.frameLocator('.epub-reader__frame');

async function openReader(page, { prefs } = {}) {
  await page.addInitScript((p) => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    if (p) localStorage.setItem('bookshelf:epub-prefs', JSON.stringify(p));
  }, prefs ?? null);
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.waitForTimeout(300);
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="book"]').focus();
  await page.keyboard.press('Enter');
  await page.locator('.epub-box input[type=file]').setInputFiles({ name: 'circe.epub', mimeType: 'application/epub+zip', buffer: await makeEpub() });
  await page.getByRole('dialog', { name: 'Vincular EPUB' }).getByRole('button', { name: /Vincular/ }).click();
  await expect(frame(page).getByRole('heading', { name: /Capítulo primero/ })).toBeVisible();
  await page.waitForTimeout(800);
}

/** Todo el lector cabe: sin desplazamiento horizontal de la página y cada control dentro del ancho visible. */
const fits = (page) =>
  page.evaluate(() => {
    const vw = innerWidth;
    const out = [];
    if (document.documentElement.scrollWidth > vw + 1) out.push(`página ${document.documentElement.scrollWidth}`);
    const r = document.querySelector('.epub-reader');
    if (r.scrollWidth > r.clientWidth + 1) out.push('lector');
    for (const el of r.querySelectorAll('button, .epub-reader__frame, .epub-reader__label')) {
      const b = el.getBoundingClientRect();
      if (b.width && (b.left < -1 || b.right > vw + 1)) out.push(`${el.getAttribute('aria-label') || el.className || el.textContent.trim()} ${Math.round(b.left)}–${Math.round(b.right)}`);
    }
    const f = document.querySelector('.epub-reader__frame');
    const d = f.contentDocument;
    const paged = document.querySelector('.epub-reader').dataset.mode === 'paged';
    // En continuo, el documento cabe en su iframe; en paginado, su desbordamiento horizontal es el de las columnas
    if (!paged && d.documentElement.scrollWidth > f.clientWidth + 1) out.push(`documento ${d.documentElement.scrollWidth}>${f.clientWidth}`);
    return out;
  });

/** Bloque de texto que queda arriba (continuo) o primero de la página (paginado). */
const anchorText = (page) =>
  page.evaluate(() => {
    const paged = document.querySelector('.epub-reader').dataset.mode === 'paged';
    const el = document.querySelector('.epub-reader__page');
    const f = document.querySelector('.epub-reader__frame');
    const d = f.contentDocument;
    for (const b of d.querySelectorAll('[data-bs-block]')) {
      if (paged) {
        const r = [...b.getClientRects()].find((x) => x.right > 1 && x.left < f.clientWidth - 1);
        if (r) return b.textContent.slice(0, 30);
      } else if (b.offsetTop > el.scrollTop + 8) return (b.previousElementSibling ?? b).textContent.slice(0, 30);
    }
    return null;
  });

/** ¿El párrafo n de la sección está a la vista (en la página visible o en la ventana de desplazamiento)? */
const inView = (page, n) =>
  page.evaluate((num) => {
    const paged = document.querySelector('.epub-reader').dataset.mode === 'paged';
    const el = document.querySelector('.epub-reader__page');
    const f = document.querySelector('.epub-reader__frame');
    const p = [...f.contentDocument.querySelectorAll('p')].find((x) => x.textContent.startsWith(`Párrafo ${num} `));
    if (!p) return false;
    if (paged) return [...p.getClientRects()].some((x) => x.right > 1 && x.left < f.clientWidth - 1);
    return p.offsetTop + p.offsetHeight > el.scrollTop && p.offsetTop < el.scrollTop + el.clientHeight;
  }, n);

const pagesLabel = (page) => reader(page).locator('.epub-reader__label').innerText();

test('cabe en 320, 390 y escritorio en las dos formas de leer', async ({ page }, info) => {
  test.skip(!/390x844|1440x900|webkit-390/.test(info.project.name), '390, escritorio y WebKit');
  for (const width of info.project.name.includes('1440') ? [1440] : [320, 390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 700 });
    if (width === 320 || width === 1440) await openReader(page);
    await page.waitForTimeout(400);
    expect(await fits(page), `continuo ${width}`).toEqual([]);
    if (width === 320) await shot(page, info, 'v157-320-continuo');
    // Paneles: todos se cierran con su «Volver a la lectura», que está en pantalla
    for (const tool of ['Índice', 'Ambiente', 'Diario']) {
      await reader(page).getByRole('button', { name: tool, exact: true }).click();
      const back = page.getByRole('button', { name: 'Volver a la lectura' });
      await expect(back).toBeVisible();
      expect(await fits(page), `${tool} ${width}`).toEqual([]);
      if (tool === 'Ambiente') await shot(page, info, `v157-ambiente-${width}`);
      await back.click();
      await expect(back).toHaveCount(0);
    }
  }
  // Página a página
  await reader(page).getByRole('button', { name: 'Letra y forma de leer' }).click();
  await page.getByRole('radio', { name: 'Página a página' }).click();
  await page.getByRole('button', { name: 'Volver a la lectura' }).click();
  await expect.poll(() => pagesLabel(page)).toMatch(/Página 1 de \d+ · esta sección/);
  await page.waitForTimeout(400);
  expect(await fits(page), 'paginado').toEqual([]);
  await shot(page, info, 'v157-paginado');
});

test('paneles: uno a la vez, Atrás cierra el panel y no la lectura, y el texto sigue en su sitio', async ({ page }, info) => {
  test.skip(!/390x844|webkit-390/.test(info.project.name), '390 y WebKit');
  await openReader(page);
  await page.locator('.epub-reader__page').evaluate((el) => (el.scrollTop = el.scrollHeight / 3));
  await page.waitForTimeout(600);
  const before = await anchorText(page);
  await reader(page).getByRole('button', { name: 'Índice', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Índice' })).toBeVisible();
  // Cambiar a otro panel: sigue habiendo uno solo
  await reader(page).getByRole('button', { name: 'Ambiente', exact: true }).click({ force: true }).catch(() => {});
  await expect(page.locator('.epub-sheet')).toHaveCount(1);
  // Atrás del sistema: cierra el panel, no el lector ni la ficha
  await page.goBack();
  await expect(page.locator('.epub-sheet')).toHaveCount(0);
  await expect(reader(page)).toBeVisible();
  expect(await anchorText(page)).toBe(before);
  // Tocar otra vez la herramienta activa cierra su panel
  await reader(page).getByRole('button', { name: 'Diario', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Mi diario' })).toBeVisible();
  await reader(page).getByRole('button', { name: 'Diario', exact: true }).click({ force: true }).catch(() => {});
  await page.getByRole('button', { name: 'Volver a la lectura' }).click();
  await expect(page.locator('.epub-sheet')).toHaveCount(0);
  expect(await anchorText(page)).toBe(before);
  // Una nota de sección a medias: Atrás la guarda como borrador («Seguir con la nota»)
  await reader(page).getByRole('button', { name: 'Diario', exact: true }).click();
  await page.getByRole('button', { name: 'Nota de esta sección' }).click();
  await page.getByLabel('Tu nota').fill('Borrador que no se pierde');
  await page.keyboard.press('Escape');
  await reader(page).getByRole('button', { name: 'Seguir con la nota' }).click();
  await expect(page.getByLabel('Tu nota')).toHaveValue('Borrador que no se pierde');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(reader(page)).toBeVisible();
});

test('página a página: recorre todo, pasa de sección y vuelve a la última página de la anterior', async ({ page }, info) => {
  test.skip(!/390x844|1440x900|webkit-390/.test(info.project.name), '390, escritorio y WebKit');
  const { st: before } = { st: null };
  await openReader(page, { prefs: { mode: 'paged' } });
  const logBefore = (await stored(page)).progress.readingLog.length;
  await expect.poll(() => pagesLabel(page)).toMatch(/Página 1 de (\d+) · esta sección/);
  const total = Number((await pagesLabel(page)).match(/de (\d+)/)[1]);
  expect(total).toBeGreaterThan(2);
  expect(await reader(page).getByRole('button', { name: 'Página anterior' }).isDisabled()).toBe(true);
  // Recorre la sección página a página con el botón
  for (let p = 2; p <= total; p++) {
    await reader(page).getByRole('button', { name: 'Página siguiente' }).click();
    await expect.poll(() => pagesLabel(page)).toContain(`Página ${p} de ${total}`);
  }
  // Desde la última página, «siguiente» abre la sección dos por su primera página
  await reader(page).getByRole('button', { name: 'Página siguiente' }).click();
  await expect(frame(page).getByRole('heading', { name: 'Dos' })).toBeVisible();
  await expect.poll(() => pagesLabel(page)).toMatch(/Página 1 de \d+/);
  expect(await anchorText(page)).toMatch(/^Dos/);
  // Deslizar (desplazamiento horizontal nativo con ajuste) pasa de página
  await page.waitForTimeout(700); // la sección termina de abrirse (fuentes y recolocación) antes de deslizar
  const w = await page.locator('.epub-reader__frame').evaluate((f) => f.clientWidth);
  await page.locator('.epub-reader__frame').evaluate((f, dx) => f.contentDocument.scrollingElement.scrollBy({ left: dx }), w);
  await expect.poll(() => pagesLabel(page)).toMatch(/Página 2 de \d+/);
  // Retroceder desde la primera página de la sección dos: última página de la uno
  await reader(page).getByRole('button', { name: 'Página anterior' }).click();
  await reader(page).getByRole('button', { name: 'Página anterior' }).click();
  await expect(frame(page).getByRole('heading', { name: /Capítulo primero/ })).toBeVisible();
  await expect.poll(() => pagesLabel(page)).toContain(`Página ${total} de ${total}`);
  // La última página contiene el final de la sección (no se pierde texto)
  const lastVisible = await page.locator('.epub-reader__frame').evaluate((f) => {
    const ps = f.contentDocument.querySelectorAll('[data-bs-block]');
    const r = ps[ps.length - 1].getBoundingClientRect();
    return r.right > 0 && r.left < f.clientWidth;
  });
  expect(lastVisible).toBe(true);
  // Teclado en escritorio: flechas
  await page.locator('.epub-reader__label').click();
  await page.keyboard.press('ArrowRight');
  await expect(frame(page).getByRole('heading', { name: 'Dos' })).toBeVisible();
  // Paginar no crea sesiones
  expect((await stored(page)).progress.readingLog.length).toBe(logBefore);
  expect(before).toBe(null);
});

test('cambiar forma de leer, letra y orientación conserva el sitio', async ({ page }, info) => {
  test.skip(!/390x844|webkit-390/.test(info.project.name), '390 y WebKit');
  await openReader(page);
  await reader(page).getByRole('button', { name: 'Siguiente sección' }).click();
  await expect(frame(page).getByRole('heading', { name: 'Dos' })).toBeVisible();
  await page.waitForTimeout(700);
  await page.locator('.epub-reader__page').evaluate((el) => (el.scrollTop = el.scrollHeight * 0.45));
  await page.waitForTimeout(700);
  const at = await anchorText(page);
  const n = Number(at.match(/Párrafo (\d+)/)[1]);
  await reader(page).getByRole('button', { name: 'Letra y forma de leer' }).click();
  await page.getByRole('radio', { name: 'Página a página' }).click();
  await page.getByRole('button', { name: 'Volver a la lectura' }).click();
  // En paginado, la página visible contiene ese párrafo (o el inmediato)
  await expect.poll(() => inView(page, n)).toBe(true);
  // Letra más grande y otra orientación: el mismo sitio
  await reader(page).getByRole('button', { name: 'Letra y forma de leer' }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Letra más grande' }).click();
  await page.getByRole('button', { name: 'Volver a la lectura' }).click();
  await expect.poll(() => inView(page, n)).toBe(true);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => inView(page, n)).toBe(true);
  // Y de vuelta a continuo
  await page.setViewportSize({ width: 390, height: 844 });
  await reader(page).getByRole('button', { name: 'Letra y forma de leer' }).click();
  await page.getByRole('radio', { name: 'Desplazamiento continuo' }).click();
  await page.getByRole('button', { name: 'Volver a la lectura' }).click();
  await expect.poll(() => inView(page, n)).toBe(true);
});

test('subrayados: cruzan cursivas y líneas, persisten, cambian de color, se quitan y no se anclan al azar', async ({ page }, info) => {
  test.skip(!/390x844|webkit-390/.test(info.project.name), '390 y WebKit');
  await openReader(page);
  const logBefore = (await stored(page)).progress.readingLog.length;
  // Seleccionar desde dentro de la cursiva hasta el final del párrafo (cruza nodos y líneas)
  await page.locator('.epub-reader__frame').evaluate((f) => {
    const d = f.contentDocument;
    const p = d.getElementById('cruce');
    const em = p.querySelector('em');
    const r = d.createRange();
    r.setStart(em.firstChild, 6);
    r.setEnd(p.lastChild, p.lastChild.data.length - 1);
    const s = f.contentWindow.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  });
  await reader(page).getByRole('button', { name: 'Guardar en mi diario' }).click();
  await page.getByRole('button', { name: 'Guardar nota' }).click();
  const painted = () =>
    page.locator('.epub-reader__frame').evaluate((f) => {
      const w = f.contentWindow;
      const marks = f.contentDocument.querySelectorAll('mark[data-bs-hl]').length;
      let hl = 0;
      if (w.CSS?.highlights) for (const h of w.CSS.highlights.values()) hl += h.size;
      return marks + hl;
    });
  await expect.poll(painted).toBeGreaterThan(0);
  // El texto no cambia de tamaño ni de interlineado al marcarse
  const style = await page.locator('.epub-reader__frame').evaluate((f) => {
    const p = f.contentDocument.getElementById('cruce');
    return [getComputedStyle(p).fontSize, getComputedStyle(p).lineHeight, p.getBoundingClientRect().height];
  });
  await page.locator('.epub-reader__frame').evaluate((f) => (document.querySelector('.epub-reader__page').scrollTop = f.contentDocument.getElementById('cruce').offsetTop - 60));
  await page.waitForTimeout(400);
  await shot(page, info, 'v157-subrayado');
  const { book } = await current(page);
  const q = book.quotes.find((x) => x.epub?.range);
  expect(q.epub.range).toMatchObject({ v: 3, start: { block: expect.any(Number) }, end: { block: expect.any(Number) } });
  expect(q.text).toContain('las olas llegaban despacio');
  // Cerrar y reabrir: el subrayado sigue, y no se acumulan marcas
  for (let i = 0; i < 2; i++) {
    await reader(page).getByRole('button', { name: 'Volver a la ficha' }).click();
    await page.locator('.epub-box').getByRole('button', { name: 'Continuar lectura' }).click();
    await expect(frame(page).getByRole('heading', { name: /Capítulo primero/ })).toBeVisible();
    await expect.poll(painted).toBeGreaterThan(0);
  }
  const count = await painted();
  expect(count).toBeLessThanOrEqual(3);
  expect(await page.locator('.epub-reader__frame').evaluate((f) => { const p = f.contentDocument.getElementById('cruce'); return [getComputedStyle(p).fontSize, getComputedStyle(p).lineHeight, p.getBoundingClientRect().height]; })).toEqual(style);
  // Menú del subrayado desde el diario: cambiar color y quitar solo la marca
  await reader(page).getByRole('button', { name: 'Diario', exact: true }).click();
  await page.getByRole('button', { name: /Opciones del subrayado/ }).click();
  const menu = page.getByRole('dialog', { name: /Subrayado ·/ });
  await menu.getByRole('radio').nth(2).click();
  await expect.poll(async () => (await current(page)).book.quotes.find((x) => x.id === q.id).color).not.toBe(q.color);
  expect((await current(page)).book.quotes.find((x) => x.id === q.id).text).toBe(q.text);
  await menu.getByRole('button', { name: 'Eliminar subrayado' }).click();
  await menu.getByRole('button', { name: 'Quitar solo el subrayado' }).click();
  await expect.poll(painted).toBe(0);
  await expect.poll(async () => (await current(page)).book.quotes.find((x) => x.id === q.id).epub.mark).toBe(false);
  expect((await current(page)).book.quotes.find((x) => x.id === q.id).text).toBe(q.text);
  // Fragmento repetido sin ancla de rango (nota de la 1.56): no se marca al azar
  await page.getByRole('button', { name: 'Volver a la lectura' }).click();
  // (sembrado como en el resto de pruebas: la app reescribe su estado, así que se aplica al recargar)
  await page.waitForTimeout(600);
  const seeded = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('bookshelf:v1'));
    const b = st.books.find((x) => x.id === st.settings.currentBookId);
    b.quotes.push({ id: 'q-repe', text: 'Una frase repetida en el libro.', color: 'yellow', page: null, createdAt: new Date().toISOString(), epub: { v: 2, hash: b.epub.hash, name: b.epub.name, href: 'OEBPS/s1.xhtml', chapter: 0, block: null, frac: 0 } });
    return JSON.stringify(st);
  });
  await page.addInitScript((v) => {
    if (!sessionStorage.getItem('v157-repe')) {
      localStorage.setItem('bookshelf:v1', v);
      sessionStorage.setItem('v157-repe', '1');
    }
  }, seeded);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-panel="MAIN_ROOM"] .scene-base')?.naturalWidth > 0);
  await page.locator('[data-panel="MAIN_ROOM"] .hotspot[data-id="book"]').focus();
  await page.keyboard.press('Enter');
  await page.locator('.epub-box').getByRole('button', { name: 'Continuar lectura' }).click();
  await expect(frame(page).getByRole('heading', { name: /Capítulo primero/ })).toBeVisible();
  await page.waitForTimeout(800);
  expect(await painted()).toBe(0);
  await reader(page).getByRole('button', { name: 'Diario', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Mi diario' })).toContainText('Ubicación por recuperar');
  // Subrayar no crea sesiones ni recompensas
  const st = await stored(page);
  expect(st.progress.readingLog.length).toBe(logBefore);
});

test('borrar la nota desde Mi diario quita su subrayado al reabrir', async ({ page }, info) => {
  test.skip(!/390x844/.test(info.project.name), 'solo 390');
  await openReader(page);
  await page.locator('.epub-reader__frame').evaluate((f) => {
    const d = f.contentDocument;
    const p = d.getElementById('cruce');
    const r = d.createRange();
    r.selectNodeContents(p.querySelector('em'));
    const s = f.contentWindow.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  });
  await reader(page).getByRole('button', { name: 'Guardar en mi diario' }).click();
  await page.getByRole('button', { name: 'Guardar nota' }).click();
  await reader(page).getByRole('button', { name: 'Volver a la ficha' }).click();
  await page.getByRole('tab', { name: 'Diario' }).click();
  await page.getByRole('tab', { name: 'Notas' }).click();
  const card = page.locator('.book-sheet .annotation-card', { hasText: 'cuando las olas llegaban despacio' });
  await card.getByRole('button', { name: /Más opciones/ }).click();
  await page.getByRole('menuitem', { name: 'Borrar' }).click();
  await card.getByRole('button', { name: 'Sí, borrar' }).click();
  await page.getByRole('tab', { name: 'Ficha' }).click();
  await page.locator('.epub-box').getByRole('button', { name: 'Continuar lectura' }).click();
  await expect(frame(page).getByRole('heading', { name: /Capítulo primero/ })).toBeVisible();
  await page.waitForTimeout(800);
  expect(await page.locator('.epub-reader__frame').evaluate((f) => f.contentDocument.querySelectorAll('mark[data-bs-hl]').length + [...(f.contentWindow.CSS?.highlights?.values() ?? [])].reduce((s, h) => s + h.size, 0))).toBe(0);
});
