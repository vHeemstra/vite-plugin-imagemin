import { UserConfigExport } from 'vite'
import vue from '@vitejs/plugin-vue'
import jsx from '@vitejs/plugin-vue-jsx'
import viteInspect from 'vite-plugin-inspect'
import viteImagemin from 'vite-plugin-imagemin'

export default (): UserConfigExport => {
  return {
    // See: https://vitejs.dev/config/build-options.html
    build: {
      assetsInlineLimit: 0,
      manifest: true,
    },
    plugins: [
      vue(),
      jsx(),
      viteImagemin({
        include: [/\.(png|jpg|jpeg|gif|svg)([?#].*)?$/i],
        exclude: [/node_modules/],
        // root: 'src',
        // entry: 'src',
        // processStaticAssets: false,
        // verbose: false,
        // skipWebpIfLarger: true,
        // skipAvifIfLarger: true,
        plugins: {
          gifsicle: {
            optimizationLevel: 7,
            interlaced: false,
          },
          pngquant: {
            quality: [0.8, 0.9],
            speed: 4,
          },
          // optipng: {
          //   optimizationLevel: 7,
          // },
          mozjpeg: {
            quality: 20,
          },
          svgo: {
            plugins: [
              {
                name: 'removeViewBox',
                active: false,
              },
              {
                name: 'removeEmptyAttrs',
                active: false,
              },
            ],
          },
          gif2webp: true,
          webp: true,
          avif: true,
          // avif: {
          //   speed: 6,
          // },
        },
        formatFilePath: (file: string) => {
          // console.log(file);
          // return `${file}.test`;
          return `${file.replace(/([\\/])dist[\\/]/i, '$1dist$1optimized$1')}`
        },
      }),
      viteInspect({
        build: true,
        outputDir: '.vite-inspect',
      }),
    ],
  }
}
