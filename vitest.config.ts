import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`. Requires Vite 8, which ships this option.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Cobertura de la lógica: se excluye código generado, declarativo o de arranque.
      exclude: [
        'src/generated/**',
        'src/testing/**',
        'src/**/*.spec.ts',
        'src/**/*.dto.ts',
        'src/**/*.entity.ts',
        'src/**/*.module.ts',
        'src/**/*.controller.ts',
        'src/main.ts',
        'src/openapi.ts',
      ],
      reporter: ['text', 'html'],
    },
  },
});
