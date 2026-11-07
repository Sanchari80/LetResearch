import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const description = 'Share research, curate your paper index and chat with researchers. Published by SKT Software Land.';

// A new id for every build: content saved on the device by an older release is not reused.
const buildId = Date.now().toString(36);

export default defineConfig({
  resolve: { alias: { '@': '/src' } },
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Libraries change less often than the app, so browsers keep them cached across releases.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/.test(id)) return 'react';
          if (/[\\/]node_modules[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'motion';
          return 'vendor';
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      // Our own service worker (src/sw.ts): app-shell caching, offline start-up and web push.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      manifestFilename: 'manifest.webmanifest',
      includeAssets: [
        'favicon.ico',
        'favicon-v2.ico',
        'icons/favicon.png',
        'icons/favicon-v2.png',
        'icons/apple-touch-icon.png',
        'icons/badge-96.png',
      ],
      manifest: {
        id: '/',
        name: 'LetResearch',
        short_name: 'LetResearch',
        description,
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#E9EBEE',
        theme_color: '#E9EBEE',
        categories: ['education', 'social', 'productivity'],
        icons: [
          { src: '/icons/icon-48.png', sizes: '48x48', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-64.png', sizes: '64x64', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-256.png', sizes: '256x256', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        screenshots: [
          {
            src: '/screenshots/profile.webp',
            sizes: '780x1688',
            type: 'image/webp',
            form_factor: 'narrow',
            label: 'Profile with the research paper index',
          },
          { src: '/screenshots/feed.webp', sizes: '780x1688', type: 'image/webp', form_factor: 'narrow', label: 'Academic feed' },
          {
            src: '/screenshots/chat.webp',
            sizes: '780x1688',
            type: 'image/webp',
            form_factor: 'narrow',
            label: 'Live chat with researchers',
          },
          {
            src: '/screenshots/desktop.webp',
            sizes: '1366x900',
            type: 'image/webp',
            form_factor: 'wide',
            label: 'LetResearch on a computer',
          },
        ],
        shortcuts: [
          { name: 'New post', url: '/compose', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Messages', url: '/messages', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Notifications', url: '/notifications', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      injectManifest: {
        // App shell, icons and sounds are cached for instant, offline start-up. Only the Latin
        // font files are cached; other scripts load on demand.
        globPatterns: ['**/*.{js,css,html,png,svg,ico,wav}', '**/*-latin-*.woff2'],
        globIgnores: ['**/screenshots/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: { enabled: false, type: 'module' },
    }),
  ],
});
