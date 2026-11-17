import { defineConfig } from 'vite';

// Relative base so the built site works from any folder, including a GitHub Pages project path.
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
});
