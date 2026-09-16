import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` makes the production build use relative asset paths, so the
// dist/ folder can be served from any subdirectory OR opened directly via
// file:// — truly portable, truly offline.
//
// Three entry points, so a build is self-contained and the app can link to its
// own documentation. The two site pages are plain HTML with no imports, so Vite
// copies them through unchanged; they still open directly from site/ without a
// build, which is why they carry their own styles instead of sharing the app's.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        app: 'index.html',
        landing: 'site/index.html',
        guide: 'site/guide.html',
      },
    },
  },
  server: { port: 5310, strictPort: true, open: true },
});
