// @ts-check
import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
      // App code runs in the browser (React components) and the Cloudflare
      // Worker runtime (loaders/actions); both share the web-platform globals
      // below. Cloudflare-specific types (D1Database, R2ObjectBody, …) are
      // ambient TS types checked by `tsc`, not lint-time values.
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        fetch: "readonly",
        Response: "readonly",
        Request: "readonly",
        Headers: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        FormData: "readonly",
        Blob: "readonly",
        Node: "readonly",
        MessageEvent: "readonly",
        HTMLIFrameElement: "readonly",
        HTMLElement: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        confirm: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      react,
      "react-hooks": reactHooks,
    },
    rules: {
      // Base ESLint's no-unused-vars doesn't understand TS type-position
      // parameter names (e.g. `onChange: (value: T) => void` inside an
      // interface) and flags them as unused bindings. Disable it in favor of
      // the TS-aware version below, which handles this correctly.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Core no-undef is a lint-time-only, non-type-aware check: it can't see
      // ambient/global TS types (D1Database, R2Bucket, ExecutionContext, …)
      // or lib.dom/lib.webworker globals, so it produces false positives on
      // virtually every Cloudflare Worker / browser API identifier. This is
      // the standard typescript-eslint recommendation for TS files — `tsc`
      // (via `npm run typecheck`) is the authority on undefined identifiers
      // in TypeScript and already catches genuinely undefined variables.
      "no-undef": "off",
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
      "react-hooks/rules-of-hooks": "error",
    },
    settings: { react: { version: "detect" } },
  },
  {
    // Node-run build scripts (esbuild via CLI, not bundled): CommonJS-ish
    // globals available under Node's ESM loader.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
  },
  {
    // Storefront widget bundle: framework-free browser JS (esbuild input).
    // Lives OUTSIDE the theme extension folder (Shopify forbids a `src/` dir
    // inside theme app extensions); the built bundle lands in the extension's
    // assets/.
    files: ["extensions-src/store-locator-block/src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        Blob: "readonly",
        Node: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        FormData: "readonly",
        URLSearchParams: "readonly",
      },
    },
  },
  {
    ignores: [
      "build/**",
      ".react-router/**",
      "dist/**",
      "node_modules/**",
      // Wrangler's local dev/build scratch space (bundled Worker code,
      // vendored deps) — not source we own or want linted.
      ".wrangler/**",
      // Shopify CLI scratch (deploy bundles / minified extension output).
      ".shopify/**",
      // Built output of scripts/build-extension.mjs (bundled/minified).
      "extensions/store-locator-block/assets/store-locator.js",
    ],
  },
];
