/// <reference types='vitest' />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tsconfigPaths from 'vite-tsconfig-paths';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(async () => {
  const plugins = [
    vue({
      template: {
        compilerOptions: { isCustomElement: (tag) => tag === 'emoji-picker' },
      },
    }),
    tsconfigPaths(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'service-worker.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      manifest: {
        name: 'Chat PWA',
        short_name: 'Chat',
        description: 'Real-time group chat',
        theme_color: '#570df8',
        background_color: '#1d232a',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ];

  if (process.env.ANALYZE) {
    try {
      const { visualizer } = await import('rollup-plugin-visualizer');
      plugins.push(
        visualizer({
          filename: '../../dist/apps/frontend/stats.html',
          open: true,
          gzipSize: true,
          brotliSize: true,
        }) as import('vite').Plugin,
      );
    } catch {
      // rollup-plugin-visualizer not installed, skip
    }
  }

  return {
    root: import.meta.dirname,
    cacheDir: '../../node_modules/.vite/apps/frontend',
    server: {
      port: 4200,
      host: 'localhost',
      hmr: {
        protocol: 'wss',
        host: '192.168.86.20',
        clientPort: 8443,
      },
    },
    preview: {
      port: 4300,
      host: 'localhost',
    },
    plugins,
    // Uncomment this if you are using workers.
    worker: {
      plugins: () => [tsconfigPaths()],
    },
    build: {
      outDir: '../../dist/apps/frontend',
      emptyOutDir: true,
      reportCompressedSize: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      rollupOptions: {
        output: {
          manualChunks: {
            'vue-vendor': ['vue', 'vue-router', 'pinia'],
            supabase: ['@supabase/supabase-js'],
          },
        },
      },
    },
  };
});
