import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// GitHub Pages repo adı — push öncesi değiştirin
const REPO_NAME = 'aile-organizator';

export default defineConfig({
  // GitHub Pages için base path zorunlu
  base: `/${REPO_NAME}/`,

  plugins: [
    react(),

    VitePWA({
      // Yeni service worker otomatik devreye alınır
      registerType: 'autoUpdate',

      // Dev ortamında SW aktif (test için)
      devOptions: {
        enabled: true,
      },

      // Workbox stratejileri
      workbox: {
        // Tüm statik dosyaları precache et
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

        // Runtime cache: Supabase API yanıtları
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24, // 24 saat
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },

      // manifest.json içeriği
      manifest: {
        name: 'Akıllı Aile Organizatörü',
        short_name: 'AileOrg',
        description: 'Ailenizi organize edin: takvim, görevler, alışveriş ve yemek planı.',
        start_url: `/${REPO_NAME}/`,
        scope: `/${REPO_NAME}/`,
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#ffffff',
        theme_color: '#6366f1',
        lang: 'tr',
        categories: ['lifestyle', 'productivity'],
        icons: [
          {
            src: `/${REPO_NAME}/icons/icon-192.png`,
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: `/${REPO_NAME}/icons/icon-512.png`,
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: `/${REPO_NAME}/icons/icon-512-maskable.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Takvim',
            url: `/${REPO_NAME}/calendar`,
            icons: [{ src: `/${REPO_NAME}/icons/icon-192.png`, sizes: '192x192' }],
          },
          {
            name: 'Görevler',
            url: `/${REPO_NAME}/tasks`,
            icons: [{ src: `/${REPO_NAME}/icons/icon-192.png`, sizes: '192x192' }],
          },
          {
            name: 'Alışveriş',
            url: `/${REPO_NAME}/shopping`,
            icons: [{ src: `/${REPO_NAME}/icons/icon-192.png`, sizes: '192x192' }],
          },
        ],
      },
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Büyük vendor chunk'ları ayır
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs'],
          state: ['zustand'],
          utils: ['date-fns', 'clsx', 'tailwind-merge'],
        },
      },
    },
  },
});
