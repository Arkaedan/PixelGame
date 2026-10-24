import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

/** GitHub Pages serves the site from /<repo>/; the dev server stays at the root. */
const PAGES_BASE = '/PixelGame/';

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? PAGES_BASE : '/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/favicon-64.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'PixelGame',
        short_name: 'PixelGame',
        description: 'Clear pixel art by sending coloured shooters around the track.',
        theme_color: '#14161c',
        background_color: '#14161c',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Everything the game needs is in the build; cache it all so it plays offline.
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
}));
