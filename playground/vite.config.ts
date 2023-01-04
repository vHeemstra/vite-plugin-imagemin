import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteImagemin from '@vheemstra/vite-plugin-imagemin'
// import viteInspect from 'vite-plugin-inspect'

export default defineConfig({
  plugins: [
    react(),
    viteImagemin({
      // options
      plugins: {
        webp: true,
        avif: true,
      },
    }),
    // viteInspect({
    //   build: true,
    //   outputDir: '.vite-inspect',
    // }),
  ],
})
