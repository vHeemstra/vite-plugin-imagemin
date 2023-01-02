<h1 align="center">
  <a target="_blank" rel="noopener noreferrer" href="https://github.com/vHeemstra/vite-plugin-imagemin/blob/main/src/logo.svg?raw=true"><img src="https://github.com/vHeemstra/vite-plugin-imagemin/raw/main/src/logo.svg?raw=true" alt="vite-plugin-imagemin - Vite + Imagemin" title="vite-plugin-imagemin - Vite + Imagemin" style="width: 75%; min-width: 280px; max-width: 800px; height: auto"></a>
</h1>

> Minify bundled asset and static images in your Vite build with **Imagemin**

## Features

- Minifies all image files
- Supported minifiers:
  - GIF: gifsicle
  - JPG: mozjpeg, jpegtran or jpegoptim
  - PNG: pngquant or optipng
  - SVG: svgo
  - JPG/PNG/GIF: webp / gif2webp
  - JPG/PNG: avif
- (optional) Creates WebP versions of supported images (jpg/png/gif)
- (optional) Creates Avif versions of supported images (jpg/png)
- (optional) Skips WebP/Avif version if they are larger than original

## Install

```sh
npm install @vheemstra/vite-plugin-imagemin --save-dev
```

## Usage

Add **vite-plugin-imagemin** to your `vite.config.js`:

```js
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteImagemin from '@vheemstra/vite-plugin-imagemin'

export default defineConfig({
  plugins: [
    react(),
    viteImagemin({
      // options
    }),
  ],
})
```

## Options

...
