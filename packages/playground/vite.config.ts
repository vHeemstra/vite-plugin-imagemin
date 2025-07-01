import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteImagemin from '@vheemstra/vite-plugin-imagemin'

// Your chosen Imagemin plugins:
import imageminMozjpeg from 'imagemin-mozjpeg'
// import imageminJpegtran from 'imagemin-jpegtran'
// import imageminJpegoptim from 'imagemin-jpegoptim'
// import imageminPngquant from 'imagemin-pngquant'
// import imageminOptipng from 'imagemin-optipng'
import imageminOxipng from '@vheemstra/imagemin-oxipng'
import imageminGifsicle from 'imagemin-gifsicle'
import imageminSvgo from 'imagemin-svgo'
import imageminWebp from 'imagemin-webp'
import imageminGif2webp from 'imagemin-gif2webp'
// import imageminAvif from 'imagemin-avif'
import imageminAvif from '@vheemstra/imagemin-avifenc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // fastRefresh: process.env.NODE_ENV !== 'test',
    }),
    viteImagemin({
      // verbose: false,
      plugins: {
        png: imageminOxipng(),
        jpg: imageminMozjpeg(),
        gif: imageminGifsicle(),
        svg: imageminSvgo(),
      },
      makeAvif: {
        plugins: {
          png: imageminAvif(),
          jpg: imageminAvif(),
        },
        // formatFilePath: (filename) => `${filename}.avif`,
        // skipIfLargerThan: false,
        // skipIfLargerThan: 'optimized', // default
        // skipIfLargerThan: 'smallest',
      },
      makeWebp: {
        plugins: {
          png: imageminWebp(),
          jpg: imageminWebp(),
          gif: imageminGif2webp(),
        },
        // formatFilePath: (filename) => `${filename}.webp`,
        // skipIfLargerThan: false,
        // skipIfLargerThan: 'optimized', // default
        // skipIfLargerThan: 'smallest',
      },
      // cache: false,
      // clearCache: true,
      // cacheDir: 'cache',
    }),
  ],
})
