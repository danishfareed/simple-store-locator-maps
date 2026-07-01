#!/usr/bin/env node
/**
 * Bundle the storefront widget (theme app extension) with esbuild.
 *
 * The widget is framework-free vanilla JS living under
 * `extensions/store-locator-block/src/`. Its entry (`core.js`) also pulls in a
 * couple of pure, client-safe TypeScript utilities from `app/lib/utils/*`;
 * esbuild transpiles + tree-shakes those into a single IIFE that the Liquid
 * block loads as a classic `<script>`.
 */

import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { statSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const entry = resolve(root, "extensions/store-locator-block/src/core.js");
const outfile = resolve(root, "extensions/store-locator-block/assets/store-locator.js");

await build({
  entryPoints: [entry],
  bundle: true,
  format: "iife",
  minify: true,
  target: ["es2019"],
  platform: "browser",
  sourcemap: false,
  outfile,
  logLevel: "info",
});

const { size } = statSync(outfile);
console.log(
  `→ extensions/store-locator-block/assets/store-locator.js (${(size / 1024).toFixed(1)} kB)`,
);
