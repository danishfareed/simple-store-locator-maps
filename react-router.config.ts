import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
  future: {
    // Enable progressively after verifying Shopify package + Cloudflare compat.
    // unstable_middleware: true,
    // unstable_splitRouteModules: true,
    // unstable_viteEnvironmentApi: true,
  },
} satisfies Config;
