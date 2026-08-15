/**
 * Loaded before every test file (vitest.config.ts's setupFiles). Extends
 * `expect` with jest-dom's DOM matchers (toHaveTextContent, etc.) for the
 * handful of tests that render into a real DOM (fase 4's useAuth.test.tsx
 * and anything similar later) - a no-op import cost for the rest of the
 * suite, which never touches these matchers.
 *
 * @testing-library/react normally registers its own afterEach(cleanup)
 * automatically, but only when it detects `afterEach` as a global - this
 * project calls describe/it/expect as explicit imports everywhere rather
 * than setting Vitest's `globals: true`, so that auto-registration never
 * fires and renders from one test stay mounted into the next (screen
 * queries then match multiple stacked copies). Registering cleanup here
 * explicitly is the fix that keeps `globals: true` off the rest of the
 * suite.
 */
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

afterEach(() => {
  cleanup();
});
