// Recorrer los 5.000 libros con portadas reales y variadas, no con las sintéticas. Las imágenes no están en el repositorio:
// cada URL de portada del piloto se sirve con un archivo de la carpeta indicada, con un retraso de red, y las que fallan siguen fallando.
// EMULACIÓN: Chromium móvil a 390 × 844, CPU ×4, 2 ppp y WebGL por software. Ni la red ni la memoria de un teléfono.
//
// Uso:
//   node scripts/piso-lab-portadas-reales.mjs preparar <carpeta con .jpg> <carpeta de salida>
//   node scripts/piso-lab-portadas-reales.mjs medir <carpeta del build> <carpeta de salida de «preparar»> <salida.json> [puerto] [repeticiones]
import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const [mode, ...args] = process.argv.slice(2);
const BYTES_PER_MS = 400; // Unos 3 Mbit/s
const LATENCY_MS = 80;

/** Del mismo original salen tamaños y formatos distintos: lo que trae una biblioteca de verdad. */
async function prepare(from, to) {
  const { default: sharp } = await import('sharp');
  mkdirSync(to, { recursive: true });
  const usable = readdirSync(from).filter((f) => f.endsWith('.jpg') && statSync(join(from, f)).size > 2000);
  let made = 0;
  for (const [i, name] of usable.entries()) {
    const image = sharp(join(from, name));
    const base = name.replace(/\.jpg$/, '');
    const write = async (pipeline, file) => {
      await pipeline.toFile(join(to, file));
      made += 1;
    };
    await write(sharp(join(from, name)), `${base}-tal-cual.jpg`);
    const kind = i % 5;
    if (kind === 1) await write(image.clone().resize({ width: 1600 }).jpeg({ quality: 88 }), `${base}-1600.jpg`);
    if (kind === 2) await write(image.clone().webp({ quality: 75 }), `${base}.webp`);
    if (kind === 3) await write(image.clone().resize({ width: 900 }).png(), `${base}-900.png`);
    if (kind === 4) await write(image.clone().resize({ width: 3000 }).jpeg({ quality: 90 }), `${base}-3000.jpg`);
  }
  console.log(`${usable.length} originales, ${made} archivos en ${to}`);
}

const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

function loadCovers(dir) {
  return readdirSync(dir)
    .sort()
    .map((name) => ({ name, type: TYPES[name.split('.').pop()], body: readFileSync(join(dir, name)) }));
}

const scrollBody = (px) =>
  new Promise((resolve) => {
    const el = document.querySelector('.plab-library__list');
    const stamps = [];
    const t0 = performance.now();
    let images = 0;
    let rows = 0;
    let decoded = 0;
    window.__long.length = 0;
    const step = (now) => {
      stamps.push(now);
      el.scrollTop += px;
      rows = Math.max(rows, document.querySelectorAll('.plab-row').length);
      const mounted = [...document.querySelectorAll('.plab-library img')];
      images = Math.max(images, mounted.length);
      // Lo que ocuparían descomprimidas las imágenes montadas a la vez, sin contar si el navegador las reduce
      decoded = Math.max(decoded, mounted.reduce((sum, img) => sum + img.naturalWidth * img.naturalHeight * 4, 0));
      if (now - t0 < 6000) requestAnimationFrame(step);
      else {
        const gaps = stamps.slice(1).map((v, i) => v - stamps[i]).sort((a, b) => a - b);
        let worstSecond = Infinity;
        for (let i = 0, j = 0; i < stamps.length; i += 1) {
          while (j < stamps.length && stamps[j] < stamps[i] + 1000) j += 1;
          if (stamps[i] + 1000 <= stamps.at(-1)) worstSecond = Math.min(worstSecond, j - i);
        }
        const total = gaps.reduce((s, v) => s + v, 0);
        resolve({
          fps: Math.round((gaps.length * 10000) / total) / 10,
          peorSegundo: worstSecond,
          p95: Math.round(gaps[Math.floor(gaps.length * 0.95)] * 10) / 10,
          peor: Math.round(gaps.at(-1) * 10) / 10,
          filas: rows,
          imagenes: images,
          mbDescomprimidos: Math.round(decoded / 1e5) / 10,
          tareasMas50: window.__long.length,
          peorTarea: Math.max(0, ...window.__long),
          heapMb: Math.round(performance.memory.usedJSHeapSize / 1e5) / 10,
        });
      }
    };
    requestAnimationFrame(step);
  });

async function run(browser, base, covers, px) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-ES' });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const asked = { portadas: 0, bytes: 0 };
  const types = {};
  await context.route(/^https?:\/\//, (route) => (route.request().url().startsWith(base) ? route.continue() : route.abort()));
  await context.route(/\/lab\/covers\/c\d+\.png/, async (route) => {
    const n = Number(new URL(route.request().url()).searchParams.get('n')) || 0;
    const cover = covers[n % covers.length];
    asked.portadas += 1;
    asked.bytes += cover.body.length;
    types[cover.type] = (types[cover.type] ?? 0) + 1;
    await new Promise((r) => setTimeout(r, LATENCY_MS + cover.body.length / BYTES_PER_MS));
    await route.fulfill({ status: 200, contentType: cover.type, body: cover.body }).catch(() => {});
  });
  await page.addInitScript(() => {
    localStorage.setItem('bookshelf_onboarding_done', 'true');
    localStorage.setItem('bookshelf:signs-hint-done', 'true');
    window.__long = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__long.push(Math.round(e.duration));
    }).observe({ type: 'longtask', buffered: true });
  });
  await page.goto(`${base}/?piloto=piso&biblioteca=5000`);
  await page.getByRole('button', { name: /^Entrar en tu piso/ }).click();
  await page.waitForFunction(() => window.__pisoLabTiempos?.puerta, null, { timeout: 120000 });
  await page.getByRole('button', { name: 'Ver la balda' }).click();
  await page.waitForFunction(() => window.__pisoLab().debug().zoomed);
  await page.getByRole('button', { name: /Buscar en toda la biblioteca, 5000 libros/ }).click();
  await page.getByRole('heading', { name: 'Tu biblioteca' }).waitFor();
  await page.waitForTimeout(800);
  const result = await page.evaluate(scrollBody, px);

  // Al parar: las que se ven llegan y se dibujan, con su forma
  await page.waitForTimeout(2500);
  const settled = await page.evaluate(() => {
    const list = document.querySelector('.plab-library__list').getBoundingClientRect();
    const seen = [...document.querySelectorAll('.plab-library img')].filter((img) => {
      const r = img.getBoundingClientRect();
      return r.bottom > list.top && r.top < list.bottom;
    });
    const sizes = new Set(seen.map((img) => `${Math.round(img.getBoundingClientRect().width)}×${Math.round(img.getBoundingClientRect().height)}`));
    return { visibles: seen.length, cargadas: seen.filter((img) => img.complete && img.naturalWidth > 0).length, tamanos: [...sizes] };
  });
  await context.close();
  return { ...result, ...asked, mbPedidos: Math.round(asked.bytes / 1e5) / 10, bytes: undefined, formatos: types, alParar: settled };
}

async function measure(dist, dir, out, port = '5199', repeats = '3') {
  const covers = loadCovers(dir);
  const base = `http://localhost:${port}`;
  const server = spawn('npx', ['vite', 'preview', '--port', port, '--strictPort', '--outDir', dist], { stdio: 'ignore', shell: true });
  try {
    for (let i = 0; i < 60; i += 1) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {
        // aún arrancando
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
    const passes = { rapido: [], despacio: [] };
    for (let i = 0; i < Number(repeats); i += 1) {
      for (const [name, px] of [['rapido', 40], ['despacio', 8]]) {
        const r = await run(browser, base, covers, px);
        passes[name].push(r);
        console.log(name, JSON.stringify(r));
      }
    }
    await browser.close();
    const sizes = covers.map((c) => c.body.length).sort((a, b) => a - b);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({ build: dist, archivos: covers.length, kbMediana: Math.round(sizes[sizes.length >> 1] / 1000), kbMax: Math.round(sizes.at(-1) / 1000), ...passes }, null, 1));
    console.log('escrito', out);
  } finally {
    spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F']);
  }
}

if (mode === 'preparar') await prepare(...args);
else await measure(...args);
