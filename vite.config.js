import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 1.157: el inicio es siempre tu piso (ya no hay __PISO_INICIO__); la habitación ilustrada está en archivo/, fuera del build
  // Las pruebas unitarias viven en src/; e2e/ es de Playwright (npm run qa:full)
  test: { include: ['src/**/*.test.js'] },
});
