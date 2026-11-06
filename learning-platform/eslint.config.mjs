import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "app/.well-known/workflow/**",
    "next-env.d.ts",
    // Vendored pdf.js worker copied from node_modules (served as a static asset).
    "public/pdf.worker.min.mjs",
  ]),
]);

export default eslintConfig;
