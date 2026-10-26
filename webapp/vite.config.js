import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base './' keeps every URL relative, so the build works on any GitHub Pages
// path (https://<user>.github.io/<repo>/) without knowing the repo name.
export default defineConfig({
  base: './',
  plugins: [vue()],
  server: { fs: { allow: ['..'] } },  // presets live in ../presets
  build: { outDir: 'dist', assetsDir: 'assets', sourcemap: false },
})
