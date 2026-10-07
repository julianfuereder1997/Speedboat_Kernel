import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts", "packs/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
