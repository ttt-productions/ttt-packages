import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false, // Let tsc handle this via composite mode
  sourcemap: true,
  clean: true,
  external: [
    'react',
    'react-dom',
    'react-hook-form',
    '@hookform/resolvers',
    'class-variance-authority',
    'clsx',
    'tailwind-merge'
  ],
  treeshake: true,
  splitting: false,
});