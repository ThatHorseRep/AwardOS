import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

// eslint-config-next 15 still ships eslintrc-shaped configs (`{ extends: [...] }`),
// so they cannot be spread into a flat config directly — FlatCompat converts them.
const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const eslintConfig = [
  // Default ignores of eslint-config-next, restated because a flat config
  // replaces them rather than extending them.
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "playwright-report/**",
      "test-results/**",
      ".tmp-ai-design-skills/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Standalone Node tooling, not part of the bundled app. These are CommonJS
    // by design, so the ESM-import rule does not apply.
    files: ["scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // Tracked technical debt, deliberately a warning rather than an error.
    // The codebase was written without lint enforcement and carries ~170 `any`
    // annotations, mostly on action return values and caught errors. Making
    // this an error would block every build until all of them are typed, so it
    // stays visible without gating CI. Type them as the surrounding code is
    // touched; do not add new ones.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

export default eslintConfig;
