import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    // Each file's first rendering test pays for jsdom and module start-up; in a full parallel
    // run that alone reaches several seconds on a busy machine (the styleguide test renders
    // the whole design system: ~1.5 s alone, ~6.6 s in a full run). 5 s caused false failures.
    testTimeout: 15_000,
  },
});
