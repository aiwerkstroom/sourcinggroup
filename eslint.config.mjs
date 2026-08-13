import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * eslint-config-next 16 ships native flat configs, so these are spread
 * directly rather than wrapped in FlatCompat - the compat shim chokes on
 * this config's plugin graph ("Converting circular structure to JSON").
 */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", "node_modules/**", "lib/rules/es/distribution/reference-distribution.json"],
  },
  {
    rules: {
      // A leading underscore is the deliberate signal for "destructured
      // only to omit this key", which the tests use to build an input
      // without a field rather than to read it.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
];

export default eslintConfig;
