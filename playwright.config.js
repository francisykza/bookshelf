// QA de la Fase 1 (SPEC §16.10): Playwright arranca y detiene su propio servidor de Vite. Matriz mínima de
// Chromium (tres móviles verticales, uno horizontal y escritorio), WebKit (vertical y horizontal) y un
// recorrido con movimiento reducido. WebKit automatizado NO equivale a Safari en un iPhone real.
import { defineConfig, devices } from '@playwright/test';

const PORT = 5195;

/**
 * Reloj de las pruebas a mediodía del mismo día de Madrid (1.51): la habitación cambia de ilustración de noche, así que
 * las pruebas no deben depender de la hora a la que se lanzan. Se elige la zona Etc/GMT que pone el reloj del
 * navegador en las 12 h del mismo día de calendario que en Madrid (las que prueban la noche la eligen a mano).
 */
function middayZone(now = new Date()) {
  const madridH = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hourCycle: 'h23' }).format(now));
  const madridOffset = ((madridH - now.getUTCHours() + 36) % 24) - 12;
  const k = madridOffset + (12 - madridH);
  return k >= 0 ? `Etc/GMT-${k}` : `Etc/GMT+${-k}`;
}
const mobile = (width, height) => ({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

export default defineConfig({
  testDir: './e2e',
  outputDir: './qa-report/test-results',
  fullyParallel: false,
  workers: 2,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['json', { outputFile: 'qa-report/results.json' }]],
  globalTeardown: './e2e/telemetry-teardown.js',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'es-ES',
    timezoneId: middayZone(),
    trace: 'off',
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium-360x800', use: { ...devices['Desktop Chrome'], ...mobile(360, 800) } },
    { name: 'chromium-390x844', use: { ...devices['Desktop Chrome'], ...mobile(390, 844) } },
    { name: 'chromium-412x915', use: { ...devices['Desktop Chrome'], ...mobile(412, 915) } },
    { name: 'chromium-430x932', use: { ...devices['Desktop Chrome'], ...mobile(430, 932) } },
    { name: 'chromium-844x390', use: { ...devices['Desktop Chrome'], ...mobile(844, 390) } },
    { name: 'chromium-1440x900', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'webkit-390x844', use: { ...devices['Desktop Safari'], ...mobile(390, 844) } },
    { name: 'webkit-844x390', use: { ...devices['Desktop Safari'], ...mobile(844, 390) } },
    { name: 'chromium-390x844-reduced', use: { ...devices['Desktop Chrome'], ...mobile(390, 844), contextOptions: { reducedMotion: 'reduce' } } },
  ],
});
