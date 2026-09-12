import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: ['src/index.ts', 'src/cli.ts'],

    format: ['esm'],
    outExtensions() {
      return { js: '.js' };
    },

    dts: true,
    clean: true,
    sourcemap: true,
    treeshake: true,
    deps: {
      onlyBundle: false,
    },
  },
});
