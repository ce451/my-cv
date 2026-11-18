import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// two pages: the story and the legal notice (/datenschutz, as on the first version of the site)
export default defineConfig({
  build: {
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        datenschutz: resolve(import.meta.dirname, 'datenschutz.html'),
      },
    },
  },
});
