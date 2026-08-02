import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    // Only runs during `vite build` when SENTRY_AUTH_TOKEN is present.
    // Set SENTRY_AUTH_TOKEN in your CI environment (not in .env; it is a secret).
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  server: {
    host: true,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
  css: {
    devSourcemap: true,
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    manifest: true, // build file includes filenames for CSS/JS for SSR.
    chunkSizeWarningLimit: 500,
    modulePreload: {
      // three-* chunks are only needed when the graph renders (lazy dynamic import).
      resolveDependencies: (_filename, deps) =>
        deps.filter(dep => !/three-(core|module|vendor)/.test(dep)),
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React (and react-reconciler/scheduler, which @react-three/fiber pulls
          // in and which are otherwise only reachable through it) must get an
          // explicit chunk here, not `undefined` — opting out isn't enough, since
          // Rollup's default chunker will still inline a dependency into
          // three-vendor if that's the only chunk that reaches it. That's how a
          // second copy of react-dom's hydration/scheduler code previously ended
          // up bundled inside three-vendor, causing hydration errors (#421).
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-reconciler/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/three/build/three.core.js')) {
            return 'three-core';
          }
          if (id.includes('node_modules/three/build/')) {
            return 'three-module';
          }
          if (id.includes('node_modules/three/') || id.includes('node_modules/@react-three/')) {
            return 'three-vendor';
          }
        },
      },
    },
  },
});
