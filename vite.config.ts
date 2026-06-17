import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
// @ts-ignore - plain ESM module, no types needed
import { handleSquig } from './scripts/squig-proxy.mjs'

// Mounts the CrinGraph / squig.link proxy at /squig for the dev and preview
// servers, so live measurement data can be fetched from the browser.
function squigProxy() {
  // Note: return void here. A value returned from configureServer is treated by
  // Vite as a post-hook function, so returning the connect app would break boot.
  const mount = (server: any) => {
    server.middlewares.use('/squig', (req: any, res: any) => handleSquig(req, res, req.url))
  }
  return {
    name: 'squig-proxy',
    configureServer: mount,
    configurePreviewServer: mount,
  }
}

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    squigProxy(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used, do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
