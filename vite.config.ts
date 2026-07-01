import { reactRouter } from "@react-router/dev/vite";
import { cloudflareDevProxy } from "@react-router/dev/vite/cloudflare";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import type { AppLoadContext } from "react-router";
import type { CloudflareEnv } from "./workers/app";

type CloudflareContext = AppLoadContext["cloudflare"];

export default defineConfig({
  plugins: [
    cloudflareDevProxy<CloudflareEnv, Record<string, unknown>>({
      getLoadContext({ context }) {
        // The dev proxy's `ctx` is a no-op mock (see wrangler's `PlatformProxy`
        // docs) that predates newer `ExecutionContext` members (e.g. `tracing`)
        // added to `@cloudflare/workers-types`. It's dev-only and never invoked
        // for those members, so the cast is safe.
        return {
          cloudflare: context.cloudflare as unknown as CloudflareContext,
        };
      },
    }),
    reactRouter(),
    tsconfigPaths(),
  ],
  ssr: {
    resolve: {
      externalConditions: ["workerd", "worker"],
    },
  },
  server: {
    port: 3000,
  },
});
