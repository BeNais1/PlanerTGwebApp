import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig({
  plugins: [react(), { name: 'fixture-database', enforce:'pre', resolveId(source) {
    if (/\/services\/database(?:\.ts)?$/.test(source)) return resolve('tests/ui/database.fixture.ts');
  }}],
  define: { __APP_BUILD_VERSION__: '1' },
  server: { host:'127.0.0.1', port:5178 },
});
