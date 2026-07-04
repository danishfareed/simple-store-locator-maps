#!/usr/bin/env node
/**
 * Bundle the storefront widget (theme app extension) with esbuild.
 *
 * The widget is framework-free vanilla JS living under
 * `extensions-src/store-locator-block/src/` (kept OUTSIDE the theme extension
 * folder, because Shopify only permits assets/blocks/locales/snippets inside a
 * theme app extension — the built bundle is emitted into the extension's
 * `assets/`). Its entry (`core.js`) also pulls in a
 * couple of pure, client-safe TypeScript utilities from `app/lib/utils/*`;
 * esbuild transpiles + tree-shakes those into a single IIFE that the Liquid
 * block loads as a classic `<script>`.
 *
 * A SECOND bundle (`preview.js`) shares the same view + provider code via
 * `render.js` and is emitted into `build/client/` so the ASSETS binding serves
 * it at `/store-locator-preview.js` for the admin live-preview iframe. The
 * matching stylesheet is copied alongside it. Both live in `build/client/`,
 * which already exists because `react-router build` runs earlier in the npm
 * `build` chain; this esbuild step runs after.
 */

import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { statSync, copyFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function kb(file) {
  return `${(statSync(file).size / 1024).toFixed(1)} kB`;
}

// ── Storefront bundle (theme app extension asset) ──────────────────────────
const storefrontEntry = resolve(
  root,
  "extensions-src/store-locator-block/src/core.js",
);
const storefrontOut = resolve(
  root,
  "extensions/store-locator-block/assets/store-locator.js",
);

await build({
  entryPoints: [storefrontEntry],
  bundle: true,
  format: "iife",
  minify: true,
  target: ["es2019"],
  platform: "browser",
  sourcemap: false,
  outfile: storefrontOut,
  logLevel: "info",
});

console.log(
  `→ extensions/store-locator-block/assets/store-locator.js (${kb(storefrontOut)})`,
);

// ── Admin live-preview bundle (served by the ASSETS binding) ───────────────
// Emitted into build/client so the app origin serves it at
// /store-locator-preview.js for the /widget-preview iframe.
const previewEntry = resolve(
  root,
  "extensions-src/store-locator-block/src/preview.js",
);
const previewJsOut = resolve(root, "build/client/store-locator-preview.js");
const previewCssOut = resolve(root, "build/client/store-locator-preview.css");
const previewCssSrc = resolve(
  root,
  "extensions/store-locator-block/assets/store-locator.css",
);

await build({
  entryPoints: [previewEntry],
  bundle: true,
  format: "iife",
  minify: true,
  target: ["es2019"],
  platform: "browser",
  sourcemap: false,
  outfile: previewJsOut,
  logLevel: "info",
});

copyFileSync(previewCssSrc, previewCssOut);

console.log(`→ build/client/store-locator-preview.js (${kb(previewJsOut)})`);
console.log(`→ build/client/store-locator-preview.css (${kb(previewCssOut)})`);
