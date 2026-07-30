import { defineConfig } from 'vite';
import baseConfig from './vite.config';

export default defineConfig(async () => {
  const { visualizer } = await import('rollup-plugin-visualizer');
  return {
    ...baseConfig,
    plugins: [
      ...(baseConfig.plugins ?? []),
      visualizer({ open: true, gzipSize: true, filename: 'dist/stats.html' }),
    ],
  };
});
