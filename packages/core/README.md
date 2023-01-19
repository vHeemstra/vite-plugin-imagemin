<h1 align="center">
  <a target="_blank" rel="noopener noreferrer" href="https://github.com/vHeemstra/vite-plugin-imagemin/blob/main/packages/core/src/logo.svg?raw=true"><img src="https://github.com/vHeemstra/vite-plugin-imagemin/raw/main/packages/core/src/logo.svg?raw=true" alt="vite-plugin-imagemin - Vite + Imagemin" title="vite-plugin-imagemin - Vite + Imagemin" style="width: 75%; min-width: 280px; max-width: 800px; height: auto"></a><br>

  [![GitHub release (latest SemVer)][release-image]][release-url] [![NPM version][npm-image]][npm-url] [![Build Status][ci-image]][ci-url] [![Coverall Coverage Status][coverage-image]][coverage-url]

</h1>

> Minify bundled asset and static images in your Vite build with **Imagemin**.
> It optimizes all images you want, with the plugins you pick, using the configuration you choose.

## Features

- Supports all Imagemin-* plugins.
- Full control over:
  - which plugin(s) to use
  - what options to apply
  - which files to process
  - output files' path and name
- Can create WebP versions of supported images (jpg/png/gif).
- Can create Avif versions of supported images (jpg/png).
- Skips optimized version if output is larger than original.
- Skips Avif/WebP version if output is larger than original, optimized version or smallest version of an image.

## Install

```sh
npm install @vheemstra/vite-plugin-imagemin --save-dev
```
You also need to install the minifier plugins you want to use.

## Usage

Add **vite-plugin-imagemin** and the minifier plugins to your `vite.config.js`:

```js
// vite.config.js
import { defineConfig } from 'vite'
import viteImagemin from '@vheemstra/vite-plugin-imagemin'

// The minifiers you want to use:
import imageminMozjpeg from 'imagemin-mozjpeg'
import imageminWebp from 'imagemin-webp'

export default defineConfig({
  // ...your Vite config
  plugins: [
    // ...your other plugins
    viteImagemin({
      plugins: {
        jpg: imageminMozjpeg(),
      },
      makeWebp: {
        plugins: {
          jpg: imageminWebp(),
        },
      },
    }),
  ],
})
```

## Options

### plugins <sup>`required`</sup>

Type: `object`<br>

> Object containing the minifiers to use per file extension, where:
>
> - `key` is the file extension<br>_Side note: `jpg` matches `.jpg` and `.jpeg` files._
> - `value` is the initiated minifier plugin (or array of plugins)
>
> All **imagemin-*** plugins can be used. See their documentation for install instructions and options.
> See also [Suggested minifier plugins](#suggested-minifier-plugins).

### onlyAssets

Type: `boolean`<br>
Default: `false`

> Process only files in project's **assets** folder (`true`) or process all files in project's **dist** folder (`false`).

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

> Callback function to change the output filepath, defaults to overwriting the original file.<br>The **file** argument holds the input filepath relative to the project's **root** directory (e.g. `dist/assets/image.jpg`).

### skipIfLarger

Type: `boolean`<br>
Default: `true`

> Ignore the optimized output if it is larger than the original file.

### makeAvif / makeWebp

Type: `object`<br>
Default: `undefined`

> Opt-in to create additional Avif and/or WebP versions of the processed images.

#### make*.plugins <sup>`required`</sup>

Type: `object`<br>

> Same as [**options.plugins**](#plugins-required).

#### make*.formatFilePath

Type: `function`<br>
Default: <code>(file: string) => \`${file}.avif\`</code>

> Like [**options.formatFilePath**](#formatfilepath), but by default the `.avif`/`.webp` extension is appended to the filepath.<br>The **file** argument holds the filepath as produced by `options.formatFilePath`.

#### make*.skipIfLargerThan

Type: `false | 'original' | 'optimized' | 'smallest'`<br>
Default: `'optimized'`

> Skip Avif/WebP version if:
> - larger than the original image (`'original'`)
> - larger than the optimized image (`'optimized'`)
> - it is not the smallest version of the image (`'smallest'`)
> - never skip (`false`)

### root

Type: `string`<br>
Default: Vite's [`resolvedConfig.root`](https://vitejs.dev/guide/api-plugin.html#configresolved) or current working directory

> Path to project root directory.

### verbose

Type: `boolean`<br>
Default: `true`

> Whether to log process results to console.

### logger

Type: `object | Logger`<br>
Default: Vite's [`resolvedConfig.logger`](https://vitejs.dev/guide/api-plugin.html#configresolved)

> Logger object with callback functions on the `info`, `warn` and `error` keys.

### logByteDivider

Type: `number`<br>
Default: `1000`

> Choose the size format to use in the logs:
> - `1000` displays size in kilobytes (kB)
> - `1024` displays size in kibibytes (KiB)

## Suggested minifier plugins

#### Optimize plugins

| Plugin        | Recommended | Type    | Options |
| ------------- |:-------:| ------- | ------- |
| **imagemin-gifsicle**  | ✅      | GIF     | see [docs](https://github.com/imagemin/imagemin-gifsicle#options) |
| **imagemin-mozjpeg**   | ✅      | JPG     | see [docs](https://github.com/imagemin/imagemin-mozjpeg#options) |
| **imagemin-jpegoptim** |         | JPG     | see [docs](https://github.com/imagemin/imagemin-jpegoptim#options) |
| **imagemin-jpegtran**  |         | JPG     | see [docs](https://github.com/imagemin/imagemin-jpegtran#options) |
| **imagemin-pngquant**  | ✅      | PNG     | see [docs](https://github.com/imagemin/imagemin-pngquant#options) |
| **imagemin-optipng**   |         | PNG     | see [docs](https://github.com/imagemin/imagemin-optipng#options) |
| **imagemin-svgo**      | ✅      | SVG     | see [docs](https://github.com/svg/svgo#configuration) |

#### Make plugins

| Plugin        | Types   | Options |
| ------------- | ------- | ------- |
| **imagemin-webp**      | JPG / PNG | see [docs](https://github.com/imagemin/imagemin-webp#options) |
| **imagemin-gif2webp**  | GIF     | see [docs](https://github.com/imagemin/imagemin-gif2webp#options) |
| **@vheemstra/imagemin-avifenc**      | JPG / PNG | see [docs](https://github.com/vHeemstra/imagemin-avifenc/#options) |

Additional created versions can be delivered by the server if the client supports its format (see example config below). If not, the original (optimized) image can be delivered.

**_Tip_**:
Use [**skipIfLargerThan**](#makeskipiflargerthan) option to ensure additional versions of images are smaller than the regular ones. (Otherwise, what was the point... :wink:)

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

[release-url]: https://github.com/vHeemstra/vite-plugin-imagemin/releases
[release-image]: https://img.shields.io/github/v/release/vHeemstra/vite-plugin-imagemin?sort=semver&logo=github&logoColor=959DA5&labelColor=444D56

[npm-url]: https://www.npmjs.com/package/@vheemstra/vite-plugin-imagemin
[npm-image]: https://img.shields.io/npm/v/@vheemstra/vite-plugin-imagemin.svg?color=cb0000&labelColor=444D56&logo=data:image/svg+xml;base64,PHN2ZyByb2xlPSJpbWciIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBmaWxsPSIjOTU5REE1IiBkPSJNMS43NjMgMEMuNzg2IDAgMCAuNzg2IDAgMS43NjN2MjAuNDc0QzAgMjMuMjE0Ljc4NiAyNCAxLjc2MyAyNGgyMC40NzRjLjk3NyAwIDEuNzYzLS43ODYgMS43NjMtMS43NjNWMS43NjNDMjQgLjc4NiAyMy4yMTQgMCAyMi4yMzcgMHpNNS4xMyA1LjMyM2wxMy44MzcuMDE5LS4wMDkgMTMuODM2aC0zLjQ2NGwuMDEtMTAuMzgyaC0zLjQ1NkwxMi4wNCAxOS4xN0g1LjExM3oiPjwvcGF0aD48L3N2Zz4=

[ci-url]: https://github.com/vHeemstra/vite-plugin-imagemin/actions/workflows/publish_on_release.yml
[ci-image]: https://img.shields.io/github/actions/workflow/status/vHeemstra/vite-plugin-imagemin/publish_on_release.yml?label=lint%20%26%20test&logo=github&logoColor=959DA5&labelColor=444D56

[coverage-url]: https://coveralls.io/github/vHeemstra/vite-plugin-imagemin?branch=main
[coverage-image]: https://img.shields.io/coveralls/github/vHeemstra/vite-plugin-imagemin?logo=coveralls&logoColor=959DA5&labelColor=444D56
