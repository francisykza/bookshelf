// Graba el recorrido completo del piloto con 5.000 libros, con toques de verdad (dedo emulado) y un rótulo en cada paso.
// Perfil propio y datos sintéticos, sobre la versión compilada. Emulación, no un móvil físico.
// Uso: npm run build && node scripts/piso-lab-video.mjs [salida.webm]
import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const PORT = 5198;
const BASE = `http://localhost:${PORT}`;
const OUT = process.argv[2] ?? 'qa-report/piso-lab/recorrido-usabilidad.webm';
const SIZE = { width: 390, height: 844 };

mkdirSync(dirname(OUT), { recursive: true });
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { shell: true, stdio: 'ignore' });
for (let i = 0; i < 120; i += 1) {
  try {
    if ((await fetch(`${BASE}/`)).ok) break;
  } catch {
    // aún arrancando
  }
  await new Promise((r) => setTimeout(r, 500));
}
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const dir = mkdtempSync(join(tmpdir(), 'piso-video-'));
const context = await browser.newContext({ viewport: SIZE, isMobile: true, hasTouch: true, locale: 'es-ES', recordVideo: { dir, size: SIZE } });
await context.route(/^https?:\/\//, (route) => (route.request().url().startsWith(BASE) ? route.continue() : route.abort()));
const page = await context.newPage();
await page.addInitScript(() => {
  localStorage.setItem('bookshelf_onboarding_done', 'true');
  localStorage.setItem('bookshelf:signs-hint-done', 'true');
  addEventListener('DOMContentLoaded', () => {
    const caption = document.createElement('div');
    caption.id = 'rotulo';
    caption.style.cssText = 'position:fixed;z-index:99999;left:50%;top:58px;transform:translateX(-50%);max-width:92%;padding:5px 10px;background:rgb(20 12 6 / 88%);color:#fff;font:600 14px/1.25 system-ui;border-radius:6px;pointer-events:none;text-align:center;white-space:nowrap';
    const dot = document.createElement('div');
    dot.style.cssText = 'position:fixed;z-index:99999;width:30px;height:30px;margin:-15px;border-radius:50%;background:rgb(255 255 255 / 45%);border:2px solid #fff;box-shadow:0 0 4px #000;pointer-events:none;display:none';
    document.body.append(caption, dot);
    const place = (e) => {
      dot.style.left = `${e.clientX}px`;
      dot.style.top = `${e.clientY}px`;
    };
    addEventListener('pointerdown', (e) => { place(e); dot.style.display = 'block'; }, true);
    addEventListener('pointermove', place, true);
    addEventListener('pointerup', () => setTimeout(() => (dot.style.display = 'none'), 120), true);
    addEventListener('pointercancel', () => (dot.style.display = 'none'), true);
    window.__rotulo = (text) => { caption.textContent = text; caption.style.display = text ? 'block' : 'none'; };
    window.__rotulo('');
  });
});
const cdp = await context.newCDPSession(page);
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
const wait = (ms) => page.waitForTimeout(ms);
const say = (text) => page.evaluate((t) => window.__rotulo?.(t), text);
async function tapAt(x, y) {
  await touch('touchStart', x, y);
  await wait(90);
  await touch('touchEnd');
}
async function tap(locator) {
  await locator.waitFor();
  const b = await locator.boundingBox();
  await tapAt(b.x + b.width / 2, b.y + b.height / 2);
}
async function drag(x0, x1, y, ms = 800) {
  await touch('touchStart', x0, y);
  const steps = Math.round(ms / 24);
  for (let i = 1; i <= steps; i += 1) {
    await touch('touchMove', x0 + ((x1 - x0) * i) / steps, y);
    await wait(16);
  }
  await touch('touchEnd');
}
const lab = (fn, arg) => page.evaluate(fn, arg);
const settle = async (what) => {
  await page.waitForFunction(() => !window.__pisoLab().debug().paused);
  await wait(800);
  return lab((w) => window.__pisoLab().screenOf(w), what);
};
const button = (name, exact = false) => page.getByRole('button', { name, exact });

try {
  await page.goto(`${BASE}/?piloto=piso&biblioteca=5000&medir=1`);
  await button(/^Entrar en tu piso/).waitFor({ timeout: 120000 });
  await wait(500);
  await say('Con 5.000 libros. Tocar la puerta');
  await wait(1200);
  await tap(button(/^Entrar en tu piso/));
  await page.waitForFunction(() => window.__pisoLabTiempos?.puerta, null, { timeout: 60000 });
  await say('Arrastrar para mirar, sin abrir nada');
  await wait(800);
  const book = await settle('libro');
  // Empieza sobre el libro: es un giro, no un toque
  await drag(book.x, book.x + 110, book.y);
  await wait(500);
  await drag(book.x + 110, book.x - 120, book.y, 1100);
  await wait(500);
  await say('Tocar el libro: registrar lectura');
  await lab(() => window.__pisoLab().lookTo(0));
  await wait(500);
  const at = await settle('libro');
  await tapAt(at.x, at.y);
  const dialog = page.getByRole('dialog').filter({ has: button('Guardar lectura') });
  await dialog.waitFor();
  await wait(700);
  await dialog.locator('.reading-form__input input').fill('25');
  await wait(600);
  await tap(dialog.getByRole('button', { name: 'Guardar lectura' }));
  await dialog.waitFor({ state: 'hidden' });
  await say('Vuelve al mismo encuadre');
  await wait(1300);

  await say('La estantería, a la izquierda');
  await lab(() => window.__pisoLab().lookTo(-0.5));
  await wait(900);
  const shelf = await settle('estanteria');
  await say('Tocar la estantería: la balda cabe entera');
  await tapAt(shelf.x, shelf.y);
  await page.waitForFunction(() => window.__pisoLab().debug().zoomed);
  await wait(1100);
  await page.locator('.plab-spot').first().waitFor();
  await tap(page.locator('.plab-spot').nth(1));
  await wait(600);
  await say('Ficha de un libro');
  await tap(button('Abrir ficha'));
  await wait(1300);
  await say('Al cerrar, sigue en la balda');
  await page.goBack();
  await wait(1200);

  await say('Buscar fuera del bloque cargado');
  await tap(button(/Buscar en toda la biblioteca/));
  await page.getByRole('heading', { name: 'Tu biblioteca' }).waitFor();
  await wait(700);
  const box = page.getByRole('searchbox', { name: /Buscar por título/ });
  await box.pressSequentially('n.º 4873', { delay: 70 });
  await page.locator('.plab-row__open[data-book="lab-4872"]').waitFor();
  await say('El ejemplar 4.873 de 5.000, encontrado');
  await wait(1200);
  await tap(page.locator('.plab-row__open[data-book="lab-4872"]'));
  await wait(1100);
  await page.goBack();
  await say('La búsqueda sigue');
  await wait(900);
  await box.fill('');
  await say('Filtro y recorrido por bloques');
  await tap(page.locator('.plab-library__filters button', { hasText: /^Abandonado$/ }));
  await wait(500);
  const list = page.locator('.plab-library__list');
  for (let i = 0; i < 24; i += 1) {
    await list.evaluate((el) => el.scrollBy(0, 240));
    await wait(40);
  }
  const shown = await lab(() => `${document.querySelectorAll('.plab-row').length} filas y ${document.querySelectorAll('.plab-library img').length} imágenes en memoria`);
  await say(shown);
  await wait(1300);
  await tap(page.locator('.plab-library__filters button', { hasText: /^Todos$/ }));
  await tap(button('Volver a la balda'));
  await wait(500);
  await page.goBack();
  await page.waitForFunction(() => !window.__pisoLab().debug().zoomed);

  await say('El ordenador, girando hasta él');
  await wait(600);
  await lab(() => window.__pisoLab().lookTo(0.22));
  const pc = await settle('ordenador');
  await say('Tocar el ordenador: se acerca');
  await tapAt(pc.x, pc.y);
  await page.getByRole('region', { name: 'Lo principal' }).waitFor();
  await say('Calendario, diario y estadísticas, delante');
  await wait(1600);
  const desk = page.locator('.plab-desktop');
  await desk.evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }));
  await say('El resto, por secciones');
  await wait(1300);
  await desk.evaluate((el) => el.scrollTo({ top: 0, behavior: 'smooth' }));
  await wait(800);
  for (const [name, text] of [['Calendario', 'Calendario'], ['Mi diario', 'Diario'], ['Estadísticas', 'Estadísticas']]) {
    await say(text);
    await tap(desk.getByRole('button', { name: new RegExp(`^${name}`) }));
    await wait(1300);
    await tap(button(/^Cerrar /).first());
    await page.getByRole('region', { name: 'Lo principal' }).waitFor();
    await wait(300);
  }
  await tap(button('Salir del ordenador'));
  await say('Al salir, el mismo giro');
  await wait(1400);

  await say('Decorar y volver');
  await tap(button('Decorar'));
  await wait(1500);
  await page.goBack();
  await page.waitForFunction(() => window.__pisoLabTiempos?.vuelta);
  await say('Volver: la Entrada no cambia');
  await wait(600);
  await tap(button('Medir', true));
  await wait(2600);
  await tap(button('Medir', true));
  await say('Salir por la puerta, al portal');
  await lab(() => window.__pisoLab().lookTo(0.7));
  const door = await settle('puerta');
  await tapAt(door.x, door.y);
  await button(/^Entrar en tu piso/).waitFor();
  await wait(1200);
  await say('');
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) copyFileSync(await video.path(), OUT);
  spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F']);
}
console.log(OUT);
