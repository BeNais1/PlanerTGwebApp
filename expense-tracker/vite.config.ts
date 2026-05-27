import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_BUILD_VERSION__: JSON.stringify(
      JSON.parse(readFileSync(new URL('./public/version.json', import.meta.url), 'utf8')).version
    ),
  },
})
