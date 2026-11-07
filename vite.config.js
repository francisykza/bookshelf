import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Rama del piloto: la compilación nunca lleva la nube, aunque Vercel tenga sus variables para las versiones de prueba
  define: {
    ...(process.env.PISO_LAB_CON_NUBE ? {} : { 'import.meta.env.VITE_SUPABASE_URL': '""', 'import.meta.env.VITE_SUPABASE_ANON_KEY': '""' }),
    // Versión privada: la habitación como inicio, por defecto solo en la preview de esta rama (o con PISO_INICIO=1)
    __PISO_INICIO__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_REF === 'experimento/piso-primera-persona' || process.env.PISO_INICIO === '1'),
  },
  // Las pruebas unitarias viven en src/; e2e/ es de Playwright (npm run qa:full)
  test: { include: ['src/**/*.test.js'] },
});
