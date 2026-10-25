// QA de interfaz de la comunidad (SPEC §25.15): su propio servidor de Vite con la nube apuntando a
// `http://supabase.test` (clave anónima de prueba, no real), que el simulador de `e2e-community/mockSupabase.js`
// atiende. La autorización se prueba aparte contra Postgres real (Vitest + PGlite).
import { defineConfig, devices } from '@playwright/test';

const PORT = 5196;
const mobile = (width, height) => ({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

export default defineConfig({
  testDir: './e2e-community',
  outputDir: './qa-report/test-results-community',
  fullyParallel: false,
  workers: 2,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 8_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    trace: 'off',
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_SUPABASE_URL: 'http://supabase.test', VITE_SUPABASE_ANON_KEY: 'clave-anonima-de-prueba' },
  },
  projects: [
    { name: 'chromium-320x640', use: { ...devices['Desktop Chrome'], ...mobile(320, 640) } },
    { name: 'chromium-390x844', use: { ...devices['Desktop Chrome'], ...mobile(390, 844) } },
    { name: 'chromium-430x932', use: { ...devices['Desktop Chrome'], ...mobile(430, 932) } },
    { name: 'chromium-1440x900', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'webkit-390x844', use: { ...devices['Desktop Safari'], ...mobile(390, 844) } },
  ],
});
