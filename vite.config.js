import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Rama del piloto: la compilación nunca lleva la nube, aunque Vercel tenga sus variables para las versiones de prueba
  define: process.env.PISO_LAB_CON_NUBE ? {} : { 'import.meta.env.VITE_SUPABASE_URL': '""', 'import.meta.env.VITE_SUPABASE_ANON_KEY': '""' },
  // Las pruebas unitarias viven en src/; e2e/ es de Playwright (npm run qa:full)
  test: { include: ['src/**/*.test.js'] },
});
