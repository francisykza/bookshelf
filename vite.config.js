import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // 1.87: la habitación en primera persona es el inicio en todo lo que compila Vercel (producción y previews). En local y
    // en las pruebas sigue la habitación ilustrada, salvo con PISO_INICIO=1; PISO_INICIO=0 la apaga también en Vercel
    __PISO_INICIO__: JSON.stringify(process.env.PISO_INICIO === '1' || (process.env.VERCEL === '1' && process.env.PISO_INICIO !== '0')),
  },
  // Las pruebas unitarias viven en src/; e2e/ es de Playwright (npm run qa:full)
  test: { include: ['src/**/*.test.js'] },
});
