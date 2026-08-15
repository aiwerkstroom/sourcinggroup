import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * The app layer now holds testable logic of its own (the wizard's
 * form-to-EngineInput assembly), and it reaches the calculation layer
 * through the same "@/" alias the Next.js build uses. Vitest needs to be
 * told about that alias explicitly; tsconfig paths do not reach it.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    setupFiles: ["./vitest.setup.ts"],
  },
});
