import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Las pruebas unitarias viven en src/; e2e/ es de Playwright (npm run qa:full)
  test: { include: ['src/**/*.test.js'] },
});
