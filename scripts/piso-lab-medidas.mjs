// Medidas de la pasada de usabilidad, sobre la versión compilada y en perfiles propios con datos sintéticos:
//   entrada   50 y 5.000 libros en las mismas condiciones, con sus fases (labTiming.js)
//   giro      tiempos de fotograma
//   descanso  dibujos con la habitación quieta, tapada y oculta
//   biblioteca  búsqueda, filtros, desplazamiento, ficha y registro con 5.000 libros, y lo que queda en memoria
// EMULACIÓN: Chromium móvil a 390 × 844, CPU ×4 y WebGL por software. La limitación de CPU no afecta a la GPU y el dibujo lo hace
// la CPU: sirve para comparar y encontrar regresiones, no dice cuánto tardará en un teléfono concreto.
// Uso: npm run build && node scripts/piso-lab-medidas.mjs [salida.json]
import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const PORT = 5198;
const BASE = `http://localhost:${PORT}`;
const OUT = process.argv[2] ?? 'qa-report/piso-lab/medidas.json';
const RUNS = 7;
const CPU = 4;
const DOOR = /^Entrar en tu piso/;

const sortNum = (list) => [...list].sort((a, b) => a - b);
const stats = (list) => {
  const s = sortNum(list);
  return { mediana: s[Math.floor(s.length / 2)], min: s[0], max: s.at(-1) };
};

async function waitServer() {
  for (let i = 0; i < 120; i += 1) {
    try {
      if ((await fetch(`${BASE}/`)).ok) return;
    } catch {
      // aún arrancando
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('No arrancó el servidor');
}

async function newPage(browser, cpu = CPU) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-ES' });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  const asked = { images: 0, external: 0, externalUrls: [] };
  page.on('request', (r) => {
    if (r.resourceType() === 'image') asked.images += 1;
    if (!r.url().startsWith(BASE)) {
      asked.external += 1;
      asked.externalUrls.push(r.url());
    }
  });
  await context.route(/^https?:\/\//, (route) => (route.request().url().startsWith(BASE) ? route.continue() : route.abort()));
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    window.__long = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__long.push(Math.round(e.duration));
    }).observe({ type: 'longtask', buffered: true });
  });
  return { context, page, asked };
}

const url = (size) => `${BASE}/?piloto=piso&biblioteca=${size}`;
async function goIn(page) {
  await page.getByRole('button', { name: DOOR }).click();
  await page.waitForFunction(() => window.__pisoLabTiempos?.puerta, null, { timeout: 120000 });
}

/** Una entrada: perfil nuevo, se siembra, se carga de nuevo la página y se toca la puerta. */
async function entry(browser, size) {
  const { context, page } = await newPage(browser);
  await page.goto(url(size));
  await page.getByRole('button', { name: DOOR }).waitFor({ timeout: 120000 });
  await page.goto(url(size));
  await page.getByRole('button', { name: DOOR }).waitFor({ timeout: 120000 });
  // Sin tocar nada: el arranque ya ha terminado
  await page.waitForTimeout(1200);
  await goIn(page);
  const t = await page.evaluate(() => window.__pisoLabTiempos);
  const chars = await page.evaluate(() => localStorage.getItem('bookshelf:v1')?.length ?? 0);
  await context.close();
  return {
    arranque: t.arranque.hastaElPortal,
    lectura: t.arranque.lecturaBiblioteca,
    total: t.puerta.total,
    puerta: t.puerta.acercamiento,
    datos: t.puerta.datos,
    escena: t.puerta.escena,
    interactuar: t.puerta.interactuar,
    primerDibujo: t.puerta.primerDibujo,
    chars,
  };
}

async function compare(browser) {
  const runs = { 50: [], 5000: [] };
  // Alternando, para que el calor o el resto del ordenador no favorezcan a ninguna
  for (let i = 0; i < RUNS; i += 1) {
    for (const size of [50, 5000]) {
      runs[size].push(await entry(browser, size));
      console.log(`entrada ${size} n.º ${i + 1}: ${runs[size].at(-1).total} ms`);
    }
  }
  const sum = {};
  for (const size of [50, 5000]) {
    sum[size] = Object.fromEntries(Object.keys(runs[size][0]).map((k) => [k, stats(runs[size].map((r) => r[k]))]));
  }
  return { repeticiones: RUNS, resumen: sum, cada: runs };
}

async function spin(browser) {
  const out = {};
  for (const cpu of [1, CPU]) {
    const { context, page } = await newPage(browser, cpu);
    await page.goto(url(5000));
    await goIn(page);
    await page.waitForTimeout(800);
    out[`cpu${cpu}`] = [];
    for (let i = 0; i < 2; i += 1) out[`cpu${cpu}`].push(await page.evaluate(() => window.__pisoLab().measureYaw(5000)));
    // Esperando a la GPU en cada fotograma: aquí es la CPU, por software, y se paga de verdad
    for (let i = 0; i < 2; i += 1) out[`cpu${cpu}`].push({ conEspera: true, ...(await page.evaluate(() => window.__pisoLab().measureYaw(5000, { sync: true }))) });
    out[`cpu${cpu}`].debug = await page.evaluate(() => {
      const d = window.__pisoLab().debug();
      return { calls: d.calls, memory: d.memory };
    });
    out[`llamadas${cpu}`] = out[`cpu${cpu}`].debug;
    await context.close();
  }
  return out;
}

async function rest(browser) {
  const { context, page } = await newPage(browser);
  await page.goto(url(5000));
  await goIn(page);
  const renders = () => page.evaluate(() => window.__pisoLab().debug().exterior.renders);
  const over = async (ms) => {
    const a = await renders();
    await page.waitForTimeout(ms);
    return (await renders()) - a;
  };
  const setHidden = (value) =>
    page.evaluate((v) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (v ? 'hidden' : 'visible') });
      document.dispatchEvent(new Event('visibilitychange'));
    }, value);
  const out = {};
  await page.waitForTimeout(1000);
  out.conLaVentanaAlaVista_5s = await over(5000);
  await page.evaluate(() => window.__pisoLab().lookTo(-0.6));
  await page.waitForTimeout(600);
  out.sinVentana_5s = await over(5000);
  await page.evaluate(() => window.__pisoLab().lookTo(0));
  await page.getByRole('button', { name: /Registrar lectura de/ }).click();
  await page.getByRole('button', { name: 'Guardar lectura' }).waitFor();
  await page.waitForTimeout(600);
  out.tapada_5s = await over(5000);
  out.pausadaTapada = await page.evaluate(() => window.__pisoLab().debug().paused);
  await page.goBack();
  await page.waitForTimeout(800);
  await setHidden(true);
  await page.waitForTimeout(300);
  out.oculta_5s = await over(5000);
  await setHidden(false);
  await page.waitForTimeout(300);
  out.alVolver = (await renders()) > 0;
  await context.close();
  return out;
}

async function libraryRun(browser) {
  const { context, page, asked } = await newPage(browser);
  await page.goto(url(5000));
  await goIn(page);
  const took = async (run) => {
    const t0 = Date.now();
    await run();
    return Date.now() - t0;
  };
  const count = page.locator('.plab-library__count');
  const list = page.locator('.plab-library__list');
  const search = page.getByRole('searchbox', { name: /Buscar por título/ });
  const mounted = () => page.evaluate(() => ({ filas: document.querySelectorAll('.plab-row').length, imagenes: document.querySelectorAll('.plab-library img').length, nodos: document.querySelectorAll('*').length, memoria: performance.memory?.usedJSHeapSize ?? 0 }));
  const out = {};
  await page.getByRole('button', { name: 'Ver la balda' }).click();
  await page.waitForFunction(() => window.__pisoLab().debug().zoomed);
  out.abrirBiblioteca = await took(async () => {
    await page.getByRole('button', { name: /Buscar en toda la biblioteca, 5000 libros/ }).click();
    await page.getByRole('heading', { name: 'Tu biblioteca' }).waitFor();
  });
  out.alAbrir = await mounted();
  out.textoAlAbrir = await count.textContent();

  // Un ejemplar lejos del bloque cargado (40 primeros)
  out.fueraDelBloque = {};
  for (const [q, id] of [
    ['n.º 4873', 'lab-4872'],
    ['N.º 5000', 'lab-4999'],
    ['n.º 2500', 'lab-2499'],
  ]) {
    const ms = await took(async () => {
      await search.fill(q);
      await page.locator(`.plab-row__open[data-book="${id}"]`).waitFor();
    });
    out.fueraDelBloque[q] = { ms, filas: await page.locator('.plab-row').count(), encontrado: id };
  }

  // Tecla a tecla, con muchos resultados
  await search.fill('');
  await count.filter({ hasText: 'cargados' }).waitFor();
  const keys = [];
  for (const ch of 'la casa') {
    const t = await page.evaluate(
      async (c) => {
        const box = document.querySelector('.plab-library input[type="search"]');
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        const t0 = performance.now();
        set.call(box, box.value + c);
        box.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r)));
        return performance.now() - t0;
      },
      ch,
    );
    keys.push(Math.round(t));
    await page.waitForTimeout(40);
  }
  out.teclas = { ms: keys, peor: Math.max(...keys), texto: await count.textContent() };

  // Recorrer unos resultados enteros: las filas y las imágenes no pueden crecer
  await search.fill('la');
  await count.filter({ hasText: /libros/ }).waitFor();
  out.recorrerResultados = { texto: await count.textContent() };
  const trail = [];
  const heapStart = (await mounted()).memoria;
  const imagesStart = asked.images;
  for (let i = 0; i < 400; i += 1) {
    await list.evaluate((el) => el.scrollBy(0, el.clientHeight * 3));
    await page.waitForTimeout(40);
    // Parado un momento, para que las portadas lleguen a montarse
    if (i % 25 === 0) {
      await page.waitForTimeout(500);
      trail.push(await mounted());
    }
    const end = await list.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2);
    if (end && !(await count.textContent()).includes('cargados')) break;
  }
  const last = await mounted();
  out.recorrerResultados = {
    ...out.recorrerResultados,
    textoAlFinal: await count.textContent(),
    filasMax: Math.max(...trail.map((t) => t.filas), last.filas),
    imagenesMax: Math.max(...trail.map((t) => t.imagenes), last.imagenes),
    nodosMax: Math.max(...trail.map((t) => t.nodos), last.nodos),
    nodosInicio: trail[0]?.nodos,
    memoriaMB: { inicio: Math.round(heapStart / 1048576), fin: Math.round(last.memoria / 1048576) },
    imagenesPedidas: asked.images - imagesStart,
  };

  // Desplazamiento: fotogramas mientras se baja sin parar
  await search.fill('');
  await count.filter({ hasText: 'cargados' }).waitFor();
  out.desplazamiento = await page.evaluate(async () => {
    const el = document.querySelector('.plab-library__list');
    const frames = [];
    let last = performance.now();
    const t0 = last;
    return new Promise((resolve) => {
      const step = (now) => {
        frames.push(now - last);
        last = now;
        el.scrollTop += 90;
        if (now - t0 < 4000) requestAnimationFrame(step);
        else {
          const s = frames.slice(1).sort((a, b) => a - b);
          resolve({ fotogramas: s.length, medianaMs: Math.round(s[Math.floor(s.length / 2)] * 10) / 10, p95Ms: Math.round(s[Math.floor(s.length * 0.95)] * 10) / 10, peorMs: Math.round(s.at(-1) * 10) / 10, filas: document.querySelectorAll('.plab-row').length, imagenes: document.querySelectorAll('.plab-library img').length });
        }
      };
      requestAnimationFrame(step);
    });
  });

  // Filtros
  out.filtros = {};
  for (const name of await page.locator('.plab-library__filters button').allInnerTexts()) {
    const before = await count.textContent();
    const button = page.locator('.plab-library__filters button', { hasText: new RegExp(`^${name}$`) });
    out.filtros[name] = { ms: await took(async () => {
      await button.click();
      await page.waitForFunction((t) => document.querySelector('.plab-library__count').textContent !== t, before, { timeout: 3000 }).catch(() => {});
    }), texto: await count.textContent(), filas: await page.locator('.plab-row').count() };
  }
  await page.getByRole('button', { name: 'Todos', exact: true }).click().catch(() => {});

  // Ficha, desde un resultado lejano, y vuelta con la búsqueda intacta
  await search.fill('n.º 4873');
  await page.locator('.plab-row__open[data-book="lab-4872"]').waitFor();
  out.abrirFicha = await took(async () => {
    await page.locator('.plab-row__open').click();
    await page.getByRole('dialog').first().waitFor();
  });
  out.cerrarFicha = await took(async () => {
    await page.goBack();
    await page.locator('.plab-row__open[data-book="lab-4872"]').waitFor();
  });
  out.busquedaConservada = await search.inputValue();
  await page.getByRole('button', { name: 'Volver a la balda' }).click();
  await page.getByRole('button', { name: /Buscar en toda la biblioteca/ }).waitFor();
  await page.goBack();
  await page.waitForFunction(() => !window.__pisoLab().debug().zoomed);

  // Registro
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('bookshelf:v1')).books.find((b) => b.id === 'lab-0').currentPage);
  const before = await stored();
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Guardar lectura' }) });
  out.abrirRegistro = await took(async () => {
    await page.getByRole('button', { name: /Registrar lectura de/ }).click();
    await dialog.waitFor();
  });
  await dialog.locator('.reading-form__input input').fill('25');
  await page.evaluate(() => (window.__long.length = 0));
  out.guardarRegistro = await took(async () => {
    await dialog.getByRole('button', { name: 'Guardar lectura' }).click();
    await dialog.waitFor({ state: 'hidden' });
  });
  await page.waitForTimeout(1500);
  out.tareasLargasAlGuardar = await page.evaluate(() => window.__long);
  out.registro = { antes: before, despues: await stored() };
  out.externas = { total: asked.external, cuales: asked.externalUrls };
  await context.close();
  return out;
}

mkdirSync(dirname(OUT), { recursive: true });
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { shell: true, stdio: 'ignore' });
try {
  await waitServer();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
  const result = { fecha: new Date().toISOString(), condiciones: 'Chromium móvil 390 × 844, CPU ×4, WebGL por software, versión compilada, perfil nuevo en cada entrada' };
  const only = process.env.SOLO?.split(',');
  const wanted = (name) => !only || only.includes(name);
  if (wanted('biblioteca')) result.biblioteca = await libraryRun(browser);
  console.log('biblioteca', JSON.stringify(result.biblioteca));
  if (wanted('descanso')) result.descanso = await rest(browser);
  console.log('descanso', JSON.stringify(result.descanso));
  if (wanted('giro')) result.giro = await spin(browser);
  console.log('giro', JSON.stringify(result.giro));
  if (wanted('entrada')) {
    result.entrada = await compare(browser);
    console.log('entrada', JSON.stringify(result.entrada.resumen));
  }
  await browser.close();
  writeFileSync(OUT, JSON.stringify(result, null, 1));
} finally {
  spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F']);
}
