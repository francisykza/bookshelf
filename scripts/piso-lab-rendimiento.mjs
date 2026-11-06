// Antes y después del guardado, el desplazamiento y el arranque, siempre en las mismas condiciones y con los mismos datos.
// EMULACIÓN: Chromium móvil a 390 × 844, CPU ×4, 2 ppp y WebGL por software, perfil nuevo en cada repetición. Datos sintéticos.
// La limitación de CPU no alcanza a la GPU, y el compositor por software pesa más que en un teléfono: sirve para comparar.
//
// Uso:
//   node scripts/piso-lab-rendimiento.mjs medir <carpeta del build> <salida.json> [puerto] [repeticiones]
//   node scripts/piso-lab-rendimiento.mjs perfil <carpeta del build, sin minificar> <salida.json> [puerto]
import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const [mode, dist, out, portArg, runsArg] = process.argv.slice(2);
const PORT = Number(portArg ?? 5198);
const BASE = `http://localhost:${PORT}`;
const RUNS = Number(runsArg ?? 5);
const CPU = 4;
const DOOR = /^Entrar en tu piso/;

const stats = (list) => {
  const s = [...list].sort((a, b) => a - b);
  return { mediana: s[Math.floor(s.length / 2)], min: s[0], max: s.at(-1) };
};
const url = (size) => `${BASE}/?piloto=piso&biblioteca=${size}`;

async function newPage(browser, cpu = CPU) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-ES' });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await context.route(/^https?:\/\//, (route) => (route.request().url().startsWith(BASE) ? route.continue() : route.abort()));
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    window.__long = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__long.push(Math.round(e.duration));
    }).observe({ type: 'longtask', buffered: true });
  });
  return { context, page, cdp };
}

async function goIn(page) {
  await page.getByRole('button', { name: DOOR }).click();
  await page.waitForFunction(() => window.__pisoLabTiempos?.puerta, null, { timeout: 120000 });
}

const longs = (page) => page.evaluate(() => window.__long);
const taskSummary = (tasks) => ({ peor: Math.max(0, ...tasks), mas50: tasks.length, suma: tasks.reduce((s, v) => s + v, 0) });

/** Una lectura guardada: del toque a que se cierra el registro, y las tareas largas de todo lo que provoca. */
async function saveOnce(page, pages) {
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Guardar lectura' }) });
  await page.getByRole('button', { name: /Registrar lectura de/ }).click();
  await dialog.waitFor();
  await page.waitForTimeout(400);
  await dialog.locator('.reading-form__input input').fill(String(pages));
  await page.waitForTimeout(200);
  await page.evaluate(() => (window.__long.length = 0));
  const t0 = Date.now();
  await dialog.getByRole('button', { name: 'Guardar lectura' }).click();
  await dialog.waitFor({ state: 'hidden' });
  const total = Date.now() - t0;
  await page.waitForTimeout(1200);
  return { total, ...taskSummary(await longs(page)), tareas: await longs(page) };
}

async function saves(browser) {
  const runs = [];
  for (let i = 0; i < RUNS; i += 1) {
    const { context, page } = await newPage(browser);
    await page.goto(url(5000));
    await goIn(page);
    await page.waitForTimeout(800);
    // El primero estrena el contexto de audio; el segundo es lo que cuesta cada registro después
    const first = await saveOnce(page, 25);
    runs.push({ ...first, segundo: await saveOnce(page, 5) });
    await context.close();
    console.log('guardar', JSON.stringify(runs.at(-1)));
  }
  return { total: stats(runs.map((r) => r.total)), peor: stats(runs.map((r) => r.peor)), mas50: stats(runs.map((r) => r.mas50)), suma: stats(runs.map((r) => r.suma)), segundoTotal: stats(runs.map((r) => r.segundo.total)), segundoPeor: stats(runs.map((r) => r.segundo.peor)), segundoMas50: stats(runs.map((r) => r.segundo.mas50)), cada: runs };
}

async function openLibrary(page) {
  await page.getByRole('button', { name: 'Ver la balda' }).click();
  await page.waitForFunction(() => window.__pisoLab().debug().zoomed);
  await page.getByRole('button', { name: /Buscar en toda la biblioteca, 5000 libros/ }).click();
  await page.getByRole('heading', { name: 'Tu biblioteca' }).waitFor();
  await page.waitForTimeout(800);
}

/** Bajar a ritmo constante durante 6 s: tiempos de fotograma de la página, tareas largas, y filas e imágenes montadas. */
const scrollBody = (px) =>
  new Promise((resolve) => {
    const el = document.querySelector('.plab-library__list');
    const frames = [];
    const stamps = [];
    let last = performance.now();
    const t0 = last;
    let rows = 0;
    let images = 0;
    window.__long.length = 0;
    const step = (now) => {
      frames.push(now - last);
      stamps.push(now);
      last = now;
      el.scrollTop += px;
      rows = Math.max(rows, document.querySelectorAll('.plab-row').length);
      images = Math.max(images, document.querySelectorAll('.plab-library img').length);
      if (now - t0 < 6000) requestAnimationFrame(step);
      else {
        const s = frames.slice(1).sort((a, b) => a - b);
        const total = s.reduce((sum, v) => sum + v, 0);
        const q = (k) => Math.round(s[Math.min(s.length - 1, Math.floor(s.length * k))] * 10) / 10;
        // «Sostenido»: los fotogramas del peor segundo seguido del recorrido
        let worstSecond = Infinity;
        for (let i = 0, j = 0; i < stamps.length; i += 1) {
          while (j < stamps.length && stamps[j] < stamps[i] + 1000) j += 1;
          if (stamps[i] + 1000 <= stamps.at(-1)) worstSecond = Math.min(worstSecond, j - i);
        }
        resolve({ peorSegundo: worstSecond, fps: Math.round((s.length * 10000) / total) / 10, p50: q(0.5), p95: q(0.95), peor: q(1), mas33: s.filter((v) => v > 34).length, filas: rows, imagenes: images, tareas: window.__long.slice() });
      }
    };
    requestAnimationFrame(step);
  });

async function scrolls(browser) {
  const runs = [];
  for (let i = 0; i < RUNS; i += 1) {
    const { context, page } = await newPage(browser);
    await page.goto(url(5000));
    await goIn(page);
    await openLibrary(page);
    runs.push(await page.evaluate(scrollBody, 40));
    await context.close();
    const r = runs.at(-1);
    console.log('desplazar', JSON.stringify({ ...r, tareas: taskSummary(r.tareas) }));
  }
  const pick = (k) => stats(runs.map((r) => r[k]));
  return { peorSegundo: pick('peorSegundo'), fps: pick('fps'), p50: pick('p50'), p95: pick('p95'), peor: pick('peor'), mas33: pick('mas33'), filas: pick('filas'), imagenes: pick('imagenes'), tareasMas50: stats(runs.map((r) => r.tareas.length)), peorTarea: stats(runs.map((r) => Math.max(0, ...r.tareas))) };
}

async function starts(browser) {
  const out = {};
  const runs = { 50: [], 5000: [] };
  for (let i = 0; i < RUNS; i += 1) {
    for (const size of [50, 5000]) {
      const { context, page } = await newPage(browser);
      await page.goto(url(size));
      await page.getByRole('button', { name: DOOR }).waitFor({ timeout: 120000 });
      await page.waitForTimeout(600);
      await page.goto(url(size));
      await page.getByRole('button', { name: DOOR }).waitFor({ timeout: 120000 });
      const atPortal = await page.evaluate(() => performance.now());
      await page.waitForTimeout(1800);
      const tasks = await longs(page);
      const t = await page.evaluate(() => window.__pisoLabTiempos ?? null);
      const lectura = await page.evaluate(() => {
        const a = performance.getEntriesByName('piso-lab:biblioteca-inicio').at(-1);
        const b = performance.getEntriesByName('piso-lab:biblioteca-fin').at(-1);
        return a && b ? b.startTime - a.startTime : null;
      });
      runs[size].push({ hastaElPortal: Math.round(atPortal), lectura: Math.round(lectura), ...taskSummary(tasks), publicado: t?.arranque ?? null });
      await context.close();
    }
    console.log('arranque', JSON.stringify(runs[50].at(-1)), JSON.stringify(runs[5000].at(-1)));
  }
  for (const size of [50, 5000]) out[size] = Object.fromEntries(['hastaElPortal', 'lectura', 'peor', 'mas50', 'suma'].map((k) => [k, stats(runs[size].map((r) => r[k]))]));
  return out;
}

// ── Perfiles ──
async function traceOf(cdp, work) {
  const events = [];
  const onData = ({ value }) => events.push(...value);
  cdp.on('Tracing.dataCollected', onData);
  await cdp.send('Tracing.start', { transferMode: 'ReportEvents', categories: 'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,v8,blink,cc,gpu,viz' });
  await work();
  const done = new Promise((resolve) => cdp.once('Tracing.tracingComplete', resolve));
  await cdp.send('Tracing.end');
  await done;
  cdp.off('Tracing.dataCollected', onData);
  const threads = new Map();
  for (const e of events) if (e.name === 'thread_name') threads.set(`${e.pid}:${e.tid}`, e.args.name);
  // Tiempo propio por evento, en cada hilo
  const self = {};
  const byThread = new Map();
  for (const e of events) {
    if (e.ph !== 'X' || !e.dur) continue;
    const key = `${e.pid}:${e.tid}`;
    if (!byThread.has(key)) byThread.set(key, []);
    byThread.get(key).push(e);
  }
  const busy = {};
  for (const [key, list] of byThread) {
    const thread = threads.get(key) ?? 'otro';
    list.sort((a, b) => a.ts - b.ts || b.dur - a.dur);
    const stack = [];
    for (const e of list) {
      while (stack.length && stack.at(-1).ts + stack.at(-1).dur <= e.ts) stack.pop();
      if (stack.length) stack.at(-1).own -= e.dur;
      else busy[thread] = (busy[thread] ?? 0) + e.dur / 1000;
      e.own = e.dur;
      stack.push(e);
    }
    for (const e of list) {
      const name = `${thread} · ${e.name}`;
      self[name] = (self[name] ?? 0) + Math.max(0, e.own) / 1000;
    }
  }
  const top = Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => [k, Math.round(v)]);
  return { ocupado: Object.fromEntries(Object.entries(busy).map(([k, v]) => [k, Math.round(v)])), propio: top };
}

async function profileOf(cdp, work) {
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
  await cdp.send('Profiler.start');
  await work();
  const { profile } = await cdp.send('Profiler.stop');
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const own = new Map();
  profile.samples.forEach((id, i) => own.set(id, (own.get(id) ?? 0) + profile.timeDeltas[i] / 1000));
  const label = (n) => {
    const { functionName, url: u, lineNumber } = n.callFrame;
    if (['(idle)', '(program)', '(garbage collector)', '(root)'].includes(functionName)) return functionName;
    return `${functionName || '(anónima)'} ${u.split('/').pop().split('?')[0]}:${lineNumber + 1}`;
  };
  const self = {};
  const inclusive = {};
  const walk = (node, seen) => {
    const name = label(node);
    let total = own.get(node.id) ?? 0;
    self[name] = (self[name] ?? 0) + total;
    const fresh = !seen.has(name);
    const nextSeen = fresh ? new Set(seen).add(name) : seen;
    for (const child of node.children ?? []) total += walk(byId.get(child), nextSeen);
    if (fresh) inclusive[name] = (inclusive[name] ?? 0) + total;
    return total;
  };
  walk(profile.nodes[0], new Set());
  const top = (o, n) => Object.entries(o).filter(([k]) => k !== '(idle)' && k !== '(root)').sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => [k, Math.round(v * 10) / 10]);
  return { propio: top(self, 30), incluido: top(inclusive, 45) };
}

async function profiles(browser) {
  const out = {};
  {
    const { context, page, cdp } = await newPage(browser);
    await page.goto(url(5000));
    await goIn(page);
    await page.waitForTimeout(800);
    const dialog = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Guardar lectura' }) });
    await page.getByRole('button', { name: /Registrar lectura de/ }).click();
    await dialog.waitFor();
    await page.waitForTimeout(400);
    await dialog.locator('.reading-form__input input').fill('25');
    const act = async () => {
      await dialog.getByRole('button', { name: 'Guardar lectura' }).click();
      await dialog.waitFor({ state: 'hidden' });
      await page.waitForTimeout(900);
    };
    out.guardar = await profileOf(cdp, act);
    await context.close();
  }
  {
    const { context, page, cdp } = await newPage(browser);
    await page.goto(url(5000));
    await goIn(page);
    await page.waitForTimeout(800);
    const dialog = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Guardar lectura' }) });
    await page.getByRole('button', { name: /Registrar lectura de/ }).click();
    await dialog.waitFor();
    await page.waitForTimeout(400);
    await dialog.locator('.reading-form__input input').fill('25');
    out.guardarTraza = await traceOf(cdp, async () => {
      await dialog.getByRole('button', { name: 'Guardar lectura' }).click();
      await dialog.waitFor({ state: 'hidden' });
      await page.waitForTimeout(900);
    });
    await context.close();
  }
  for (const cpu of [CPU, 1]) {
    const { context, page, cdp } = await newPage(browser, cpu);
    await page.goto(url(5000));
    await goIn(page);
    await openLibrary(page);
    const key = `desplazarCpu${cpu}`;
    let result;
    out[`${key}Traza`] = await traceOf(cdp, async () => {
      result = await page.evaluate(scrollBody, 40);
    });
    out[`${key}Resultado`] = { ...result, tareas: taskSummary(result.tareas) };
    out[key] = await profileOf(cdp, () => page.evaluate(scrollBody, 40));
    await context.close();
  }
  for (const size of [50, 5000]) {
    const { context, page, cdp } = await newPage(browser);
    await page.goto(url(size));
    await page.getByRole('button', { name: DOOR }).waitFor({ timeout: 120000 });
    await page.waitForTimeout(600);
    out[`arranque${size}`] = await profileOf(cdp, async () => {
      await page.goto(url(size));
      await page.getByRole('button', { name: DOOR }).waitFor({ timeout: 120000 });
      await page.waitForTimeout(800);
    });
    await context.close();
  }
  return out;
}

mkdirSync(dirname(out), { recursive: true });
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--outDir', dist], { shell: true, stdio: 'ignore' });
try {
  for (let i = 0; i < 120; i += 1) {
    try {
      if ((await fetch(`${BASE}/`)).ok) break;
    } catch {
      // aún arrancando
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
  const result = { condiciones: 'Chromium móvil 390 × 844, 2 ppp, CPU ×4, WebGL por software, versión compilada, 5.000 libros sintéticos, perfil nuevo', build: dist, fecha: new Date().toISOString() };
  if (mode === 'perfil') Object.assign(result, await profiles(browser));
  else {
    result.guardado = await saves(browser);
    result.desplazamiento = await scrolls(browser);
    result.arranque = await starts(browser);
  }
  await browser.close();
  writeFileSync(out, JSON.stringify(result, null, 1));
  console.log('escrito', out);
} finally {
  spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F']);
}
