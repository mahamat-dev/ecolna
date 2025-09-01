import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
   plugins: [
      react(),
      tailwindcss(),
      VitePWA({
         registerType: 'autoUpdate',
         includeAssets: ['favicon.svg'],
         manifest: {
            name: 'School Admin',
            short_name: 'School',
            start_url: '/',
            display: 'standalone',
            background_color: '#0b0b0c',
            theme_color: '#0ea5e9',
            icons: [
               { src: '/favicon.svg', sizes: '192x192', type: 'image/svg+xml' },
               { src: '/favicon.svg', sizes: '512x512', type: 'image/svg+xml' }
            ],
         },
         workbox: {
            runtimeCaching: [
               // Cache GET attendance endpoints for quick backfill
               {
                  urlPattern: ({url}) => url.pathname.startsWith('/api/attendance/'),
                  handler: 'NetworkFirst',
                  options: {
                     cacheName: 'attendance-cache',
                     expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
                  },
               },
               // Images/CSS/JS default
               {
                  urlPattern: ({request}) => ['style','script','image'].includes(request.destination),
                  handler: 'StaleWhileRevalidate',
                  options: { cacheName: 'assets-cache' },
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
   server: {
      proxy: {
         '/api': {
            target: 'http://localhost:4000',
            changeOrigin: true,
            secure: false,
         },
      },
   },
});
