import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { environment: 'jsdom', setupFiles: ['./src/react/test/setup.ts'], include: ['src/react/**/*.test.{ts,tsx}'] } });
