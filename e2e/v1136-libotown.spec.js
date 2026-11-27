// QA de la 1.136.0: el nombre de verdad, Libotown (bloque 1, nombre y textos). Perfil de Playwright con la biblioteca de
// ejemplo de la app (nunca la cuenta de Francisco). Capturas en qa-report/v1136/<proyecto>/. Emulación: no equivale a un móvil real.
import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { abrirBiblioteca, esperarInicio } from './entrada';

const OUT = 'qa-report/v1136';

test.beforeEach(async ({ page }, info) => {
  test.skip(!/^chromium-(360x800|390x844)$/.test(info.project.name), 'móvil vertical, a 360 y a 390');
  mkdirSync(join(OUT, info.project.name), { recursive: true });
  await page.route('https://covers.openlibrary.org/**', (route) => route.fulfill({ status: 404, body: '' }));
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
  });
});

const ruta = (info, nombre) => join(OUT, info.project.name, `${nombre}.png`);

/** Abre la app con un panel ya en el historial (como al recargar con él abierto). */
async function abrirCon(page, panel) {
  await page.addInitScript(
    ([p]) => {
      history.replaceState({ bookshelf: { loc: { view: 'room', panel: p }, depth: 0, parent: null } }, '');
    },
    [panel],
  );
  await page.goto('/');
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
}

test('la pestaña, el manifest y lo que se comparte dicen Libotown; la biblioteca sigue en su clave', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Libotown');
  const meta = await page.evaluate(() =>
    Object.fromEntries([...document.querySelectorAll('meta[name], meta[property]')].map((m) => [m.getAttribute('name') ?? m.getAttribute('property'), m.content])),
  );
  expect(meta['apple-mobile-web-app-title']).toBe('Libotown');
  expect(meta['og:site_name']).toBe('Libotown');
  expect(meta['og:title']).toBe('Libotown');
  expect(meta.description).toMatch(/^Libotown: /);
  const manifest = await page.evaluate(async () => (await fetch('/manifest.webmanifest')).json());
  expect([manifest.name, manifest.short_name]).toEqual(['Libotown', 'Libotown']);
  // Lo interno no cambia: la biblioteca se guarda en la clave de siempre y no aparece ninguna otra
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => /libotown/i.test(k)))).toEqual([]);
  expect(await page.evaluate(() => document.body.innerText)).not.toMatch(/bookshelf/i);
});

test('la barra del ordenador dice Libotown', async ({ page }, info) => {
  await abrirCon(page, { type: 'laptop' });
  await expect(page.locator('.pc__brand')).toHaveText('Libotown');
  await page.waitForTimeout(700);
  await page.screenshot({ path: ruta(info, 'ordenador') });
  await page.locator('.pc__bar').screenshot({ path: ruta(info, 'ordenador-barra') });
});

// Sin captura: sin cuenta, el aviso del piso para iniciar sesión queda dibujado por encima del panel (se comprueba el texto)
test('el sonido en silencio dice Libotown', async ({ page }) => {
  await abrirCon(page, { type: 'pisoLab', id: 'mio', select: 'abrir:sonido' });
  await expect(page.getByText('Libotown está en silencio. Nada suena hasta que tú lo actives.')).toBeVisible({ timeout: 20000 });
});

test('la copia se descarga como libotown-copia y las copias antiguas se siguen importando', async ({ page }, info) => {
  await abrirCon(page, { type: 'account' });
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar copia' }).click()]);
  expect(descarga.suggestedFilename()).toMatch(/^libotown-copia-\d{4}-\d{2}-\d{2}\.json$/);
  const copia = readFileSync(await descarga.path(), 'utf8');
  expect(Array.isArray(JSON.parse(copia).books)).toBe(true);

  // Una copia con el nombre de antes: cuenta el contenido, no el nombre del archivo
  const entrada = page.locator('.account-section input[type="file"]');
  page.once('dialog', (d) => d.accept());
  await entrada.setInputFiles({ name: 'bookshelf-copia-2026-11-01.json', mimeType: 'application/json', buffer: Buffer.from(copia) });
  await expect(page.getByText('Copia importada.')).toBeVisible();

  await entrada.setInputFiles({ name: 'otra-cosa.json', mimeType: 'application/json', buffer: Buffer.from('{"hola": 1}') });
  await expect(page.getByText('Ese archivo no es una copia de Libotown.')).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: ruta(info, 'cuenta-copia') });
});

test('la imagen de la reseña firma como Libotown', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-390x844', 'la imagen es la misma en todos los tamaños');
  await page.goto('/');
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  await page.waitForTimeout(300);
  const sembrado = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('bookshelf:v1'));
    const book = st.books.find((b) => b.id === st.settings.currentBookId);
    st.settings.owner = 'Marina';
    Object.assign(book, {
      title: 'La casa de los faros apagados',
      author: 'Inés Valcárcel',
      cover: '',
      status: 'read',
      rating: 4.25,
      finishedAt: '2026-10-16T10:00:00.000Z',
      review: 'Me ha sorprendido cómo una historia tan tranquila consigue quedarse contigo durante días.',
    });
    return JSON.stringify(st);
  });
  await page.addInitScript((v) => {
    if (!sessionStorage.getItem('v1136')) {
      localStorage.setItem('bookshelf:v1', v);
      sessionStorage.setItem('v1136', '1');
    }
  }, sembrado);
  await page.reload();
  await esperarInicio(page);
  await page.waitForTimeout(400);
  await abrirBiblioteca(page);
  await expect(page.locator('.library[data-open="true"]')).toBeVisible();
  await page.waitForTimeout(500);
  await page.getByRole('searchbox', { name: 'Buscar en mi biblioteca' }).fill('faros apagados');
  await page.waitForTimeout(400);
  await page
    .locator('.library')
    .getByRole('button', { name: /La casa de los faros apagados/ })
    .first()
    .click();
  await expect(page.locator('.book-sheet')).toBeVisible();
  await page.getByRole('tab', { name: 'Diario' }).click();
  await page.getByRole('tablist', { name: 'Secciones del diario' }).getByRole('tab', { name: 'Reseña' }).click();
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: 'Crear imagen de la reseña' }).click();
  await page.waitForFunction(() => document.querySelector('.rx__vista img')?.naturalWidth > 0);
  const base = await page
    .locator('.rx__vista img')
    .first()
    .evaluate(async (i) => {
      const u = new Uint8Array(await (await (await fetch(i.src)).blob()).arrayBuffer());
      let s = '';
      for (let k = 0; k < u.length; k += 8192) s += String.fromCharCode(...u.subarray(k, k + 8192));
      return btoa(s);
    });
  writeFileSync(ruta(info, 'resena-imagen'), Buffer.from(base, 'base64'));
});

// ── Bloque 2: el gato de Libotown (iconos generados con scripts/libotown-iconos.mjs) ──

test('iconos: el favicon, los del manifest (también maskable) y el del iPhone, con su tamaño y el marrón del logo', async ({ page, request }) => {
  await page.goto('/');
  // Se miden desde Node (sharp), no con fetch en la página: al arrancar, la app corta las descargas en vuelo
  const medir = async (src) => {
    const r = await request.get(src);
    const datos = await r.body();
    const img = sharp(datos);
    const { width, height } = await img.metadata();
    const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const k = (1 * info.width + 1) * info.channels;
    return { src, ok: r.ok(), w: width, h: height, esquina: [...data.subarray(k, k + 4)], datos };
  };
  const head = await page.evaluate(() => ({
    tema: document.querySelector('meta[name="theme-color"]').content,
    apple: document.querySelector('link[rel="apple-touch-icon"]').getAttribute('href'),
    favicons: [...document.querySelectorAll('link[rel="icon"]')].map((l) => l.getAttribute('href')),
  }));
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect([manifest.background_color, manifest.theme_color, head.tema]).toEqual(['#351c0e', '#351c0e', '#351c0e']);
  expect(manifest.icons.map((i) => `${i.sizes} ${i.purpose}`)).toEqual(['192x192 any', '512x512 any', '192x192 maskable', '512x512 maskable']);
  for (const i of manifest.icons) {
    const m = await medir(i.src);
    expect(m.ok, i.src).toBe(true);
    expect(`${m.w}x${m.h}`, i.src).toBe(i.sizes);
    // A sangre: la esquina es el marrón del logo, sin transparencia
    expect(m.esquina, i.src).toEqual([53, 28, 14, 255]);
  }
  const apple = await medir(head.apple);
  expect([apple.ok, apple.w, apple.h, apple.esquina[3]]).toEqual([true, 180, 180, 255]);
  expect(head.favicons).toEqual(['/favicon.ico', '/icons/libotown.svg']);
  const svg = await request.get('/icons/libotown.svg');
  expect(svg.ok()).toBe(true);
  expect(await svg.text()).toMatch(/viewBox="0 0 64 64"/);
  const ico = await (await request.get('/favicon.ico')).body();
  expect([...ico.subarray(0, 6)]).toEqual([0, 0, 1, 0, 3, 0]);
  expect([ico[6], ico[22], ico[38]]).toEqual([16, 32, 48]);
});

test('pantalla de carga: el logo desde el primer instante, antes de que llegue la app', async ({ page }, info) => {
  // Sin el código de la app: lo que se ve mientras se descarga
  await page.route('**/src/main.jsx', (route) => route.abort());
  await page.goto('/');
  const logo = page.locator('.arranque img');
  await page.waitForFunction(() => document.querySelector('.arranque img')?.complete && document.querySelector('.arranque img').naturalWidth > 0);
  await page.screenshot({ path: ruta(info, 'carga-1-antes-de-la-app') });
  const caja = await logo.boundingBox();
  const vp = page.viewportSize();
  expect(Math.abs(caja.x + caja.width / 2 - vp.width / 2)).toBeLessThan(1);
  expect(Math.abs(caja.y + caja.height / 2 - vp.height / 2)).toBeLessThan(1);
  expect(Math.round(caja.width)).toBe(Math.round(Math.min(vp.width * 0.8, 420)));
});

test('«Abriendo tu piso…»: el mismo logo en el mismo sitio y el aviso debajo de las letras', async ({ page }, info) => {
  // El piso tarda a propósito, para ver lo que hay mientras llega
  let soltar;
  const espera = new Promise((r) => (soltar = r));
  await page.route('**/src/features/pisoLab/PisoLabPanel.jsx*', async (route) => {
    await espera;
    await route.continue();
  });
  await page.goto('/?inicio=habitacion');
  // 1.138: la del arranque (.home-boot) o, ya con el piso descargándose, la pantalla de carga común: son la misma escena
  const aviso = page.locator('.home-boot, .pantalla-carga');
  await expect(aviso).toHaveText('Abriendo tu piso…');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: ruta(info, 'carga-2-abriendo-tu-piso') });
  const texto = await aviso.evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const t = r.getBoundingClientRect();
    return { top: t.top, bottom: t.bottom };
  });
  const vp = page.viewportSize();
  const alto = (Math.min(vp.width * 0.8, 420) * 2) / 3;
  const finLetras = vp.height / 2 + alto * 0.31;
  expect(texto.top).toBeGreaterThan(finLetras);
  expect(texto.top).toBeLessThan(finLetras + 40);
  soltar();
  await expect(page.locator('.plab-room')).toBeVisible({ timeout: 30000 });
});

// Simulación (solo capturas): un móvil no deja fotografiar su pantalla de inicio desde aquí. Se pintan los iconos reales
// como los recorta cada sistema (Android, círculo del maskable; iPhone, esquinas redondeadas) y la pestaña con el favicon real.
test('simulación del icono instalado y de la pestaña', async ({ page }, info) => {
  await page.goto('/manifest.webmanifest');
  const movil = (titulo, icono, forma) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    body{margin:0;height:100vh;font:13px system-ui,sans-serif;color:#fff;background:linear-gradient(160deg,#5b7083,#24323d 70%)}
    .aviso{position:absolute;top:10px;left:0;right:0;text-align:center;font-size:11px;opacity:.75}
    .rejilla{position:absolute;top:60px;left:18px;right:18px;display:grid;grid-template-columns:repeat(4,1fr);row-gap:26px;justify-items:center}
    .app{display:grid;justify-items:center;gap:6px;width:72px}
    .app span{text-shadow:0 1px 2px #0008}
    .hueco{width:60px;height:60px;border-radius:${forma};background:#ffffff26}
    .app img{width:60px;height:60px;border-radius:${forma};box-shadow:0 2px 6px #0006}
    .grande{position:absolute;top:230px;left:0;right:0;display:grid;justify-items:center;gap:8px;font-size:11px;opacity:.9}
    .grande img{width:144px;height:144px;border-radius:${forma};box-shadow:0 4px 14px #0007}
  </style><div class="aviso">Simulación · ${titulo}</div><div class="rejilla">
    <div class="app"><div class="hueco"></div></div><div class="app"><div class="hueco"></div></div>
    <div class="app"><img src="${icono}" alt=""><span>Libotown</span></div><div class="app"><div class="hueco"></div></div>
    <div class="app"><div class="hueco"></div></div><div class="app"><div class="hueco"></div></div>
    <div class="app"><div class="hueco"></div></div><div class="app"><div class="hueco"></div></div></div>
    <div class="grande"><img src="${icono}" alt=""><span>El mismo icono, ampliado</span></div>`;
  await page.setContent(movil('Android: el icono «maskable», recortado en círculo', '/icons/libotown-maskable-192.png', '50%'));
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  await page.screenshot({ path: ruta(info, 'instalado-android'), clip: { x: 0, y: 0, width: page.viewportSize().width, height: 420 } });
  await page.setContent(movil('iPhone: el icono de 180 px con las esquinas del sistema', '/icons/libotown-apple-180.png', '22.5%'));
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  await page.screenshot({ path: ruta(info, 'instalado-iphone'), clip: { x: 0, y: 0, width: page.viewportSize().width, height: 420 } });

  await page.setContent(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    body{margin:0;padding:12px;font:13px system-ui,sans-serif;background:#f4f1ec;color:#222}
    p{margin:14px 0 6px;font-size:11px;color:#555}
    .barra{display:flex;gap:2px;padding:8px 8px 0;border-radius:8px 8px 0 0}
    .clara{background:#dfe3e8}.oscura{background:#202124}
    .tab{display:flex;align-items:center;gap:8px;height:34px;padding:0 12px;width:140px;border-radius:8px 8px 0 0;font-size:12px}
    .clara .activa{background:#fff;color:#1f1f1f}.oscura .activa{background:#35363a;color:#e8eaed}
    .clara .otra{color:#444}.oscura .otra{color:#9aa0a6}
    .tab img{width:16px;height:16px}.tab .x{margin-left:auto;opacity:.6}
    .gris{width:16px;height:16px;border-radius:50%;background:#9aa0a6}
    .tallas{display:flex;align-items:end;gap:12px}
    canvas{image-rendering:pixelated;width:64px;height:64px;background:#fff;border:1px solid #ccc}
    .oscuro canvas{background:#202124}
  </style>
  <p>Simulación · la pestaña con el favicon y el título reales, en un navegador claro y en uno oscuro</p>
  <div class="barra clara"><div class="tab activa"><img src="/icons/libotown.svg" alt=""><span>Libotown</span><span class="x">×</span></div><div class="tab otra"><span class="gris"></span><span>Nueva pestaña</span></div></div>
  <div class="barra oscura"><div class="tab activa"><img src="/icons/libotown.svg" alt=""><span>Libotown</span><span class="x">×</span></div><div class="tab otra"><span class="gris"></span><span>Nueva pestaña</span></div></div>
  <p>El favicon a 16 y 32 px reales, ampliado cuatro y dos veces</p>
  <div class="tallas"><canvas data-t="16"></canvas><canvas data-t="32"></canvas><div class="oscuro"><canvas data-t="16"></canvas></div><div class="oscuro"><canvas data-t="32"></canvas></div></div>`);
  await page.evaluate(async () => {
    const img = new Image();
    img.src = '/icons/libotown.svg';
    await img.decode();
    for (const c of document.querySelectorAll('canvas')) {
      const t = Number(c.dataset.t);
      c.width = t;
      c.height = t;
      c.getContext('2d').drawImage(img, 0, 0, t, t);
    }
  });
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  await page.screenshot({ path: ruta(info, 'pestana'), clip: { x: 0, y: 0, width: page.viewportSize().width, height: 280 } });
});

// ── Bloque 3: el dominio libotown.es (SPEC §136.6) ──

// La app de este ordenador servida como si fuera una dirección de producción: Playwright contesta cada petición a esa
// dirección con lo que da el servidor local. Nada sale a internet ni toca la dirección de verdad (tampoco el WebSocket).
async function servirComo(page, baseURL, host) {
  const patron = host.replaceAll('.', '[.]');
  await page.routeWebSocket(new RegExp(`^wss?://${patron}`), (ws) => ws.close());
  await page.route(new RegExp(`^https?://${patron}/`), async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: new URL(url.pathname + url.search, baseURL).toString() });
    await route.fulfill({ response });
  });
}

const cortan = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test('la dirección de antes avisa de la mudanza a libotown.es, con los pasos, y «Ahora no» lo esconde', async ({ page, baseURL }, info) => {
  await servirComo(page, baseURL, 'bookshelf-wine-iota.vercel.app');
  await page.goto('https://bookshelf-wine-iota.vercel.app/');
  const etiqueta = page.locator('.aviso-dir__etiqueta');
  await expect(etiqueta).toBeVisible({ timeout: 30000 });
  await expect(etiqueta).toContainText('Nos mudamos a');
  await expect(etiqueta).toContainText('libotown.es');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: ruta(info, 'direccion-1-aviso') });
  const vp = page.viewportSize();
  const caja = await etiqueta.boundingBox();
  expect(caja.x + caja.width).toBeLessThanOrEqual(vp.width);
  expect(caja.height).toBeGreaterThanOrEqual(48);
  // No tapa el botón de arriba del piso
  const atras = page.locator('.plab-bar .px-btn').first();
  if (await atras.count()) expect(cortan(caja, await atras.boundingBox())).toBe(false);

  await etiqueta.click();
  const nota = page.locator('.aviso-dir__nota');
  await expect(nota).toBeVisible();
  await expect(etiqueta).toHaveAttribute('aria-expanded', 'true');
  await expect(nota).toContainText('«Usar estos»');
  await expect(nota).toContainText('EPUB');
  const ir = nota.getByRole('link', { name: 'Ir a libotown.es' });
  await expect(ir).toHaveAttribute('href', 'https://libotown.es/');
  await expect(ir).toHaveAttribute('target', '_blank');
  await page.waitForTimeout(300);
  await page.screenshot({ path: ruta(info, 'direccion-2-pasos') });
  const n = await nota.boundingBox();
  expect(n.x).toBeGreaterThanOrEqual(0);
  expect(n.x + n.width).toBeLessThanOrEqual(vp.width);
  expect(n.y + n.height).toBeLessThanOrEqual(vp.height);

  await nota.getByRole('button', { name: 'Ahora no' }).click();
  await expect(page.locator('.aviso-dir')).toHaveCount(0);
  expect(Number(await page.evaluate(() => localStorage.getItem('bookshelf:aviso-direccion')))).toBeGreaterThan(0);
  await page.reload();
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  await page.waitForTimeout(1500);
  await expect(page.locator('.aviso-dir')).toHaveCount(0);
});

test('en el piso 3D, el aviso va arriba a la derecha, a la altura de su botón', async ({ page, baseURL }, info) => {
  await servirComo(page, baseURL, 'bookshelf-wine-iota.vercel.app');
  await page.goto('https://bookshelf-wine-iota.vercel.app/?inicio=habitacion');
  const etiqueta = page.locator('.aviso-dir--piso .aviso-dir__etiqueta');
  await expect(etiqueta).toBeVisible({ timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: ruta(info, 'direccion-0-piso') });
  const caja = await etiqueta.boundingBox();
  expect(caja.x + caja.width).toBeLessThanOrEqual(page.viewportSize().width);
  for (const b of await page.locator('.plab-room button').all()) if (await b.isVisible()) expect(cortan(caja, await b.boundingBox())).toBe(false);
});

test('en libotown.es no hay aviso y nunca se cargan datos de demostración', async ({ page, baseURL }) => {
  // Control: en este ordenador, la misma dirección sí siembra la biblioteca de prueba
  await page.goto('/?piloto=piso&biblioteca=50');
  await page.waitForFunction(() => localStorage.getItem('bookshelf:lab:biblioteca') === '50');
  await expect(page.locator('.aviso-dir')).toHaveCount(0);

  await servirComo(page, baseURL, 'libotown.es');
  await page.goto('https://libotown.es/?piloto=piso&biblioteca=50');
  await page.waitForFunction(() => localStorage.getItem('bookshelf:v1'));
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => localStorage.getItem('bookshelf:lab:biblioteca'))).toBeNull();
  await expect(page.locator('.aviso-dir')).toHaveCount(0);
  expect(new URL(page.url()).hostname).toBe('libotown.es');
});

test('al compartir, la dirección y la imagen son las de libotown.es', async ({ page, request }) => {
  await page.goto('/');
  const head = await page.evaluate(() => ({
    canonical: document.querySelector('link[rel="canonical"]')?.href,
    meta: Object.fromEntries([...document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]')].map((m) => [m.getAttribute('property') ?? m.getAttribute('name'), m.content])),
  }));
  expect(head.canonical).toBe('https://libotown.es/');
  expect(head.meta['og:url']).toBe('https://libotown.es/');
  expect(head.meta['og:image']).toBe('https://libotown.es/icons/libotown-compartir.jpg');
  expect([head.meta['og:image:width'], head.meta['og:image:height'], head.meta['twitter:card']]).toEqual(['1200', '630', 'summary_large_image']);
  // La imagen existe aquí con ese tamaño (en libotown.es, cuando el dominio apunte a Vercel)
  const img = await request.get('/icons/libotown-compartir.jpg');
  expect(img.ok()).toBe(true);
  const { width, height, format } = await sharp(await img.body()).metadata();
  expect([width, height, format]).toEqual([1200, 630, 'jpeg']);
});
