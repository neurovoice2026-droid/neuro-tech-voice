import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Data fetching and one-time mount flags legitimately call setState inside
      // effects (there is no data-fetching library in use). React itself documents
      // these patterns, so we surface this as a warning rather than failing the
      // build on canonical usage. Prop-sync anti-patterns are still worth avoiding.
      "react-hooks/set-state-in-effect": "warn",
      // Allow intentionally-unused identifiers when prefixed with `_`.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
