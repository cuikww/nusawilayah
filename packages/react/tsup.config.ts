import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['react', '@nusawilayah/core'],
  banner: { js: '"use client";' }, // RSC: the picker is a client component
});
