<p align="center">

![vite-plugin-imagemin](/src/logo.svg?raw=true 'vite-plugin-imagemin')

<img width="180" src="https://raw.github.com/vHeemstra/vite-plugin-imagemin/main/src/logo.svg" alt="vite-plugin-imagemin - Vite + Imagemin">

</p>
<br/>

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
