import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['react', '@nusawilayah/geo'],
  banner: { js: '"use client";' }, // RSC: the map is a client component
});
