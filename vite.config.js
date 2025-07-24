import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copy } from 'vite-plugin-copy';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    sourcemap: false
  },
  plugins: [
    react(),
    copy([
      {
        src: 'node_modules/@mlightcad/libredwg-web/wasm/libredwg-web.wasm',
        dest: 'public/wasm'
      }
    ])
  ]
});
