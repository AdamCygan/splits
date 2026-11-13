import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro({
      // Pliki statyczne (JS, CSS, SVG, fonty) dostają wersje .gz i .br już przy buildzie.
      compressPublicAssets: { gzip: true, brotli: true },
      // Pliki z public/ nie mają hasha w nazwie — cache na 30 dni (przy zmianie pliku zmień jego nazwę).
      routeRules: {
        '/media/**': {
          headers: {
            'cache-control':
              'public, max-age=2592000, stale-while-revalidate=86400',
          },
        },
        '/og.png': { headers: { 'cache-control': 'public, max-age=604800' } },
        '/og-pl.png': { headers: { 'cache-control': 'public, max-age=604800' } },
        '/icon.svg': { headers: { 'cache-control': 'public, max-age=604800' } },
        '/icon-192.png': {
          headers: { 'cache-control': 'public, max-age=604800' },
        },
        '/icon-512.png': {
          headers: { 'cache-control': 'public, max-age=604800' },
        },
        '/favicon.ico': {
          headers: { 'cache-control': 'public, max-age=604800' },
        },
        '/apple-touch-icon.png': {
          headers: { 'cache-control': 'public, max-age=604800' },
        },
      },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
