import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
      '@services': fileURLToPath(new URL('./src/services', import.meta.url)),
    }
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts', 'src/application/**/*.ts', 'src/platform/persistence/**/*.ts', 'src/engine/nodes/**/*.ts', 'src/engine/resources/**/*.ts', 'src/engine/picking/**/*.ts', 'src/engine/RenderScheduler.ts'],
      reporter: ['text', 'html', 'json-summary'],
      reportOnFailure: true,
      thresholds: { lines: 78, statements: 78, functions: 76, branches: 74 },
    },
  },
});
