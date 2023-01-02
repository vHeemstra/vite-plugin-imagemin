<h1 align="center">
  <a target="_blank" rel="noopener noreferrer" href="https://github.com/vHeemstra/vite-plugin-imagemin/blob/main/packages/plugin-imagemin/src/logo.svg?raw=true"><img src="https://github.com/vHeemstra/vite-plugin-imagemin/raw/main/packages/plugin-imagemin/src/logo.svg?raw=true" alt="vite-plugin-imagemin - Vite + Imagemin" title="vite-plugin-imagemin - Vite + Imagemin" style="width: 75%; min-width: 280px; max-width: 800px; height: auto"></a>
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

### plugins

Type: `object`<br>
Default: see [Minifier plugins](#minifier-plugins)

> Object containing the configurations for the minifier plugins to use, where:
>
> - `key` is the plugin name
> - `value` is either:
>   - `{ ... }` (use with this configuration)
>   - `true` (use with default configuration)
>   - `false` (deactivate plugin)
>
> See [Minifier plugins](#minifier-plugins) for available plugins and their configuration options.
>
> If set, **plugins** option is merged with the [default minifiers configuration](#minifier-plugins) and overwrites it on a per-plugin (key) basis.
>
> **_Note_**:
>
> Each file type can _only be handled by 1 minifier plugin_ (e.g. **mozjpeg** and **jpegtran** can't both be used).
>
> If more than one standard plugin is activated, only one is used and a warning is prompted in the log.
>
> So, if you activate a different plugin for an image type (e.g. `jpegtran: true`), you need to deactivate the default plugin for that type (e.g. `mozjpeg: false`).
>
> WebP and Avif are considered separately from this.

### include

Type: `String | RegExp | Array[...String|RegExp]`<br>
Default: `/\.(png|jpg|jpeg|gif|svg)$/i`

> Valid [**picomatch**](https://github.com/micromatch/picomatch#globbing-features) pattern to include image files to minify (used in [`createFilter`](https://vitejs.dev/guide/api-plugin.html#filtering-include-exclude-pattern)).

### exclude

Type: `String | RegExp | Array[...String|RegExp]`<br>
Default: `/node_modules/`

> Valid [**picomatch**](https://github.com/micromatch/picomatch#globbing-features) pattern to exclude files from processing (used in [`createFilter`](https://vitejs.dev/guide/api-plugin.html#filtering-include-exclude-pattern)).

### formatFilePath

Type: `function`<br>
Default: `(file: string) => file`

> Callback function to change to output file path, defaults to overwriting the original file.
>
> **_Note_**:
>
> WebP/Avif files will output to the output path with the `.webp`/`.avif` extension appended.
>
> For example (if WebP/Avif enabled):<br>
> `image.jpg` will create `image.jpg.webp` and/or `image.jpg.avif`

### onlyAssets

Type: `boolean`<br>
Default: `false`

> Process only files in project's **assets** folder (`true`) or process all files in project's **dist** folder (`false`).

### skipWebpIfLarger

Type: `boolean`<br>
Default: `false`

> If `true`, created WebP versions of processed images will be removed if larger than the original image file.

### skipAvifIfLarger

Type: `boolean`<br>
Default: `false`

> If `true`, created Avif versions of processed images will be removed if larger than the original image file.

### root

Type: `string`<br>
Default: Vite's [`resolvedConfig.root`](https://vitejs.dev/guide/api-plugin.html#configresolved) or current working directory

> Path to project root directory.

### verbose

Type: `boolean`<br>
Default: `true`

> Whether to log process results to console.

## Minifier plugins

### Standard plugins

| Plugin        | Default | Type    | Options |
| ------------- |:-------:| ------- | ------- |
| **gifsicle**  | ✅      | GIF     | see [docs](https://github.com/imagemin/imagemin-gifsicle#options) |
| **mozjpeg**   | ✅      | JPG     | see [docs](https://github.com/imagemin/imagemin-mozjpeg#options) |
| **jpegoptim** |         | JPG     | see [docs](https://github.com/imagemin/imagemin-jpegoptim#options) |
| **jpegtran**  |         | JPG     | see [docs](https://github.com/imagemin/imagemin-jpegtran#options) |
| **pngquant**  | ✅      | PNG     | see [docs](https://github.com/imagemin/imagemin-pngquant#options) |
| **optipng**   |         | PNG     | see [docs](https://github.com/imagemin/imagemin-optipng#options) |
| **svgo**      | ✅      | SVG     | see [docs](https://github.com/svg/svgo#configuration) |

These standard plugins minify their respective images (only one plugin per file type).

You can choose to use a different plugin for a certain image type by activating it and deactivating its default plugin.

### Additional plugins

| Plugin        | Types   | Options |
| ------------- | ------- | ------- |
| **webp**      | JPG / PNG | see [docs](https://github.com/imagemin/imagemin-webp#options) |
| **gif2webp**  | GIF     | see [docs](https://github.com/imagemin/imagemin-gif2webp#options) |
| **avif**      | JPG / PNG | see [docs](https://github.com/vHeemstra/imagemin-avifenc/#options) |

These additional plugins can be activated as well, to produce copied versions of the processed images.

These alternative versions can be delivered by the server if the client supports its format (see example config below). If not, the original (minified) image is delivered.

**_Tip_**:
Use **skipWebpIfLarger** and/or **skipAvifIfLarger** options to ensure alternative versions of images that are larger than the original are removed.

#### Example `.htaccess` config for WebP

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On

  # If browser supports WebP images...
  RewriteCond %{HTTP_ACCEPT} image/webp

  # ...and WebP replacement image exists in the same directory...
  RewriteCond %{REQUEST_FILENAME}.webp -f

  # ...serve WebP image instead of jpeg/png/gif.
  RewriteRule (.+)\.(jpe?g|png|gif)$ $1.webp [T=image/webp,E=REQUEST_image]
</IfModule>

<IfModule mod_headers.c>
  # Vary: Accept for all the requests to jpeg, png and gif
  Header append Vary Accept env=REQUEST_image
</IfModule>

<IfModule mod_mime.c>
  # Add file type MIME support
  AddType image/webp .webp
</IfModule>
```
_Adopted from answers given [here](https://stackoverflow.com/a/68967381/2142071)._

## License

[MIT](LICENSE)

## Related

- [Vite](https://github.com/vitejs/vite)
- [imagemin](https://github.com/imagemin/imagemin)
- [imagemin-jpegtran](https://github.com/imagemin/imagemin-jpegtran)
- [imagemin-mozjpeg](https://github.com/imagemin/imagemin-mozjpeg)
- [imagemin-jpegoptim](https://github.com/imagemin/imagemin-jpegoptim)
- [imagemin-pngquant](https://github.com/imagemin/imagemin-pngquant)
- [imagemin-optipng](https://github.com/imagemin/imagemin-optipng)
- [imagemin-gifsicle](https://github.com/imagemin/imagemin-gifsicle)
- [imagemin-svgo](https://github.com/imagemin/imagemin-svgo)
- [imagemin-webp](https://github.com/imagemin/imagemin-webp)
- [imagemin-gif2webp](https://github.com/imagemin/imagemin-gif2webp)
- [@vheemstra/imagemin-avifenc](https://github.com/vHeemstra/imagemin-avifenc)
