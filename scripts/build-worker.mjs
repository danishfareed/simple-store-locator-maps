#!/usr/bin/env node
/**
 * Post-build step: bundle our Worker entry (workers/app.ts) with esbuild,
 * using the React Router server build output as the resolution target for the
 * `virtual:react-router/server-build` import. The result is a single-file
 * Worker at `build/worker/index.js` that wrangler points to.
 *
 * We do it this way because:
 *   - `react-router build` alone produces `build/server/index.js`, which has a
 *     fetch handler but not our Queue consumer.
 *   - `@cloudflare/vite-plugin` wants to control the whole build pipeline and
 *     doesn't play nicely with the current RR7 build phases in this repo.
 *
 * A tiny esbuild step is the pragmatic middle ground.
 */

import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

await build({
  entryPoints: [resolve(root, "workers/app.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  outfile: resolve(root, "build/worker/index.js"),
  conditions: ["workerd", "worker", "browser"],
  mainFields: ["workerd", "worker", "browser", "module", "main"],
  external: ["cloudflare:workers", "cloudflare:email", "cloudflare:sockets"],
  plugins: [
    {
      name: "rr-server-build-alias",
      setup(b) {
        b.onResolve({ filter: /^virtual:react-router\/server-build$/ }, () => ({
          path: resolve(root, "build/server/index.js"),
        }));
      },
    },
  ],
  logLevel: "info",
});

console.log("→ build/worker/index.js");
