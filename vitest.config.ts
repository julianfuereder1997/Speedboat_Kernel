import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
    include: ["packages/*/src/**/*.test.ts", "packs/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
