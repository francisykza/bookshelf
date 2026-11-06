// Piloto con bibliotecas de 0, 50, 1.000 y 5.000 libros, sobre la versión compilada. Mide la entrada al piso, el giro, la
// búsqueda, las portadas pedidas y lo que hay montado, y compara en un perfil de CPU qué crece con la colección. Perfil propio
// de Playwright y datos sintéticos. EMULACIÓN: Chromium móvil a 390 × 844, CPU ×4 y WebGL por software; la limitación de CPU no
// afecta a la GPU, así que el giro no dice nada de un móvil real.
// Uso: npm run build && node scripts/piso-lab-grande.mjs [salida.json]
import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const PORT = 5198;
const PROFILE_PORT = 5199;
const OUT = process.argv[2] ?? 'qa-report/piso-lab/grande.json';
const SIZES = [0, 50, 1000, 5000];
const RUNS = 3;
const CPU = 4;
const QUERY = 'cartografa de sal';

const median = (list) => {
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};
const serve = (dir, port) => spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort', '--outDir', dir], { shell: true, stdio: 'ignore' });

async function waitServer(base) {
  for (let i = 0; i < 120; i += 1) {
    try {
      if ((await fetch(`${base}/`)).ok) return;
    } catch {
      // aún arrancando
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No arrancó ${base}`);
}

async function newPage(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-ES', serviceWorkers: 'block' });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const asked = { covers: 0, images: 0, external: 0, all: 0 };
  page.on('request', (r) => {
    asked.all += 1;
    if (r.url().includes('/lab/covers/')) asked.covers += 1;
    if (r.resourceType() === 'image') asked.images += 1;
    if (!r.url().startsWith(base)) asked.external += 1;
  });
  await context.route(/^https?:\/\//, (route) => (route.request().url().startsWith(base) ? route.continue() : route.abort()));
  await page.addInitScript(() => {
    window.__long = [];
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__long.push(Math.round(entry.duration));
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      // sin tareas largas
    }
  });
  return { context, page, cdp, asked };
}

const door = (page) => page.getByRole('button', { name: /Entrar en tu piso/ });

async function measureEntry(browser, base, size) {
  const { context, page, asked } = await newPage(browser, base);
  const t0 = Date.now();
  await page.goto(`${base}/?piloto=piso&biblioteca=${size}`);
  await door(page).waitFor({ timeout: 60000 });
  const portalMs = Date.now() - t0;
  // La app ya está tranquila: lo que venga ahora es de entrar
  await page.waitForTimeout(1500);
  const before = { ...asked };
  await page.evaluate(() => (window.__long.length = 0));
  await door(page).click();
  await page.waitForFunction(() => window.__pisoLabEntrada != null, null, { timeout: 60000 });
  const entryMs = await page.evaluate(() => window.__pisoLabEntrada);
  const longTasks = await page.evaluate(() => window.__long);
  const result = { portalMs, entryMs, longTasksMs: longTasks.reduce((s, v) => s + v, 0), longest: Math.max(0, ...longTasks), coversBeforeDoor: before.covers, coversEntering: asked.covers - before.covers, imagesBeforeDoor: before.images, imagesEntering: asked.images - before.images, external: asked.external };
  await context.close();
  return result;
}

async function measureInside(browser, base, size) {
  const { context, page, cdp, asked } = await newPage(browser, base);
  await page.goto(`${base}/?piloto=piso&biblioteca=${size}`);
  await door(page).click();
  await page.waitForFunction(() => window.__pisoLab?.()?.debug().exterior.renders > 0, null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  const out = { size };
  const debug = await page.evaluate(() => window.__pisoLab().debug());
  out.room = { books: debug.shelf.books.length + (debug.shelf.books.includes(debug.book?.id) ? 0 : debug.book ? 1 : 0), memory: debug.memory, calls: debug.calls };
  out.yaw = await page.evaluate(() => window.__pisoLab().measureYaw(5000));

  // Almacenamiento: lo que ocupa y lo que cuesta volverlo a escribir, con la CPU frenada
  await page.waitForTimeout(400);
  out.storage = await page.evaluate(() => {
    const raw = localStorage.getItem('bookshelf:v1');
    const t0 = performance.now();
    const state = JSON.parse(raw);
    const t1 = performance.now();
    const text = JSON.stringify(state);
    const t2 = performance.now();
    return { chars: raw.length, parseMs: Math.round(t1 - t0), stringifyMs: Math.round(t2 - t1), writable: text.length === raw.length };
  });

  // Recargar ya dentro: de la página en blanco a ver el piso
  const reloadAt = Date.now();
  await page.reload();
  await page.waitForFunction(() => window.__pisoLab?.()?.debug().exterior.renders > 0, null, { timeout: 60000 });
  out.reloadInsideMs = Date.now() - reloadAt;
  out.bookCount = await page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.length);
  if (!size) {
    await context.close();
    return out;
  }

  // Toda la biblioteca
  await page.getByRole('button', { name: 'Ver la balda' }).click();
  await page.waitForFunction(() => window.__pisoLab().debug().zoomed);
  await page.getByRole('button', { name: /Buscar en toda la biblioteca/ }).click();
  await page.locator('.plab-library__count').waitFor();
  await page.waitForTimeout(800);
  const coversAtOpen = asked.covers;
  await page.evaluate(() => {
    const track = { rows: 0, images: 0 };
    window.__track = track;
    const tick = () => {
      track.rows = Math.max(track.rows, document.querySelectorAll('.plab-row').length);
      track.images = Math.max(track.images, document.querySelectorAll('.plab-library img').length);
      if (window.__track === track) requestAnimationFrame(tick);
    };
    tick();
    const count = document.querySelector('.plab-library__count');
    window.__lastChange = 0;
    new MutationObserver(() => (window.__lastChange = performance.now())).observe(count, { subtree: true, childList: true, characterData: true });
    document.addEventListener('keydown', () => (window.__keyAt = performance.now()), true);
  });

  // Tecla a tecla: de pulsar a ver el recuento nuevo
  const input = page.getByRole('searchbox', { name: /Buscar por título/ });
  await input.focus();
  const keys = [];
  for (const char of QUERY) {
    await page.evaluate(() => (window.__long.length = 0));
    await page.keyboard.type(char);
    await page.waitForTimeout(400);
    const [change, at, long] = await page.evaluate(() => [window.__lastChange, window.__keyAt, Math.max(0, ...window.__long)]);
    keys.push({ char, ms: change > at ? Math.round(change - at) : null, longest: long });
  }
  const timed = keys.map((k) => k.ms).filter((v) => v != null);
  out.search = { first: keys[0], slowest: Math.max(0, ...timed), median: timed.length ? median(timed) : null, longestTask: Math.max(...keys.map((k) => k.longest)), found: await page.locator('.plab-library__count').textContent() };
  await input.fill('');
  await page.waitForTimeout(500);

  // Desplazamiento: primero rápido, como un dedo que recorre la lista; luego parándose
  const list = page.locator('.plab-library__list');
  const coversStart = asked.covers;
  await page.evaluate(() => (window.__long.length = 0));
  for (let i = 0; i < 40; i += 1) {
    await list.evaluate((el) => el.scrollBy(0, 900));
    await page.waitForTimeout(30);
  }
  const coversFast = asked.covers - coversStart;
  await page.waitForTimeout(500);
  const coversFling = asked.covers - coversStart;
  for (let i = 0; i < 6; i += 1) {
    await list.evaluate((el) => el.scrollBy(0, 500));
    await page.waitForTimeout(350);
  }
  out.list = {
    ...(await page.evaluate(() => ({ ...window.__track, loaded: document.querySelector('.plab-library__count').textContent, scrollLongest: Math.max(0, ...window.__long) }))),
    coversAtOpen: coversAtOpen,
    coversFast,
    coversFling,
    coversSettled: asked.covers - coversStart,
  };
  const heap = await cdp.send('Runtime.getHeapUsage');
  out.heapMB = Math.round(heap.usedSize / 1048576);

  // Exponer y registrar, para ver cuánto cuesta un cambio: sirve lo que tarda la pestaña en volver a quedar libre
  await page.evaluate(() => (window.__long.length = 0));
  await page.getByRole('button', { name: /^Exponer en la estantería/ }).first().click();
  await page.waitForTimeout(800);
  out.exhibit = await page.evaluate(() => ({ longest: Math.max(0, ...window.__long), total: window.__long.reduce((s, v) => s + v, 0) }));
  await context.close();
  return out;
}

/** Tiempo propio por función en un tramo. Compilación sin minificar para que los nombres se lean. */
async function profile(browser, base, size) {
  const { context, page, cdp } = await newPage(browser, base);
  const take = async (work) => {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
    await cdp.send('Profiler.start');
    await work();
    const { profile: data } = await cdp.send('Profiler.stop');
    const dt = data.timeDeltas;
    const self = new Map();
    const byId = new Map(data.nodes.map((n) => [n.id, n]));
    data.samples.forEach((id, i) => {
      const { functionName, url, lineNumber } = byId.get(id).callFrame;
      const name = functionName || '(anónima)';
      const key = ['(idle)', '(program)'].includes(name) ? name : `${name} ${url.split('/').pop().split('?')[0]}:${lineNumber + 1}`;
      self.set(key, (self.get(key) ?? 0) + dt[i] / 1000);
    });
    return Object.fromEntries([...self].map(([k, v]) => [k, Math.round(v * 10) / 10]));
  };
  // El primer paso solo siembra
  await page.goto(`${base}/?piloto=piso&biblioteca=${size}`);
  await door(page).waitFor({ timeout: 60000 });
  await page.waitForTimeout(800);
  const load = await take(async () => {
    await page.reload();
    await door(page).waitFor({ timeout: 60000 });
    await page.waitForTimeout(800);
  });
  const enter = await take(async () => {
    await door(page).click();
    await page.waitForFunction(() => window.__pisoLabEntrada != null, null, { timeout: 60000 });
    await page.waitForTimeout(400);
  });
  await context.close();
  return { load, enter };
}

function growth(small, big) {
  const rows = [];
  for (const [name, ms] of Object.entries(big)) {
    if (name === '(idle)' || name === '(program)') continue;
    const was = small[name] ?? 0;
    if (ms - was >= 5) rows.push({ name, small: was, big: ms, grew: Math.round((ms - was) * 10) / 10 });
  }
  return rows.sort((a, b) => b.grew - a.grew).slice(0, 25);
}

const server = serve('dist', PORT);
let profileServer = null;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
const report = { emulated: true, cpu: CPU, viewport: '390x844', sizes: {} };
try {
  const base = `http://localhost:${PORT}`;
  await waitServer(base);
  for (const size of SIZES) {
    const entries = [];
    for (let i = 0; i < RUNS; i += 1) entries.push(await measureEntry(browser, base, size));
    report.sizes[size] = {
      entries,
      portalMs: median(entries.map((e) => e.portalMs)),
      entryMs: median(entries.map((e) => e.entryMs)),
      longTasksMs: median(entries.map((e) => e.longTasksMs)),
      coversBeforeDoor: entries[0].coversBeforeDoor,
      coversEntering: entries[0].coversEntering,
      imagesBeforeDoor: entries[0].imagesBeforeDoor,
      imagesEntering: entries[0].imagesEntering,
      external: entries[0].external,
      ...(await measureInside(browser, base, size)),
    };
    console.log(JSON.stringify(report.sizes[size]));
  }
  // Perfil: sin minificar, en otra carpeta
  const dir = 'qa-report/piso-lab/dist-perfil';
  spawnSync('npx', ['vite', 'build', '--minify', 'false', '--outDir', dir, '--emptyOutDir'], { shell: true, stdio: 'ignore' });
  profileServer = serve(dir, PROFILE_PORT);
  const pBase = `http://localhost:${PROFILE_PORT}`;
  await waitServer(pBase);
  const small = await profile(browser, pBase, 50);
  const big = await profile(browser, pBase, 5000);
  report.growth = { load: growth(small.load, big.load), enter: growth(small.enter, big.enter) };
} finally {
  await browser.close();
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  // Con `shell`, matar al hijo no cierra el servidor en Windows
  for (const child of [server, profileServer].filter(Boolean)) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    else child.kill();
  }
}
console.log(JSON.stringify(report.growth, null, 1));
process.exit(0);
