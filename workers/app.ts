import { createRequestHandler } from "react-router";
import { handleImportBatch } from "../app/services/import.service.server";

import * as build from "virtual:react-router/server-build";

export interface CloudflareEnv {
  DB: D1Database;
  UPLOADS: R2Bucket;
  IMPORT_QUEUE: Queue<ImportJobMessage>;
  ASSETS: Fetcher;
  SHOPIFY_API_KEY: string;
  SHOPIFY_API_SECRET: string;
  SHOPIFY_APP_URL: string;
  SCOPES: string;
  SHOPIFY_API_VERSION: string;
  SESSION_SECRET: string;
  APP_ENV: string;
}

export interface ImportJobMessage {
  shop: string;
  importId: string;
  r2Key: string;
  kind: "csv" | "xlsx";
}

const handler = createRequestHandler(build, import.meta.env?.MODE ?? "production");

const worker = {
  async fetch(
    request: Request,
    env: CloudflareEnv,
    ctx: ExecutionContext,
  ): Promise<Response> {
    return handler(request, {
      cloudflare: { env, ctx },
    });
  },

  async queue(
    batch: MessageBatch<ImportJobMessage>,
    env: CloudflareEnv,
    ctx: ExecutionContext,
  ): Promise<void> {
    await handleImportBatch(batch, env, ctx);
  },
};

export default worker satisfies ExportedHandler<CloudflareEnv, ImportJobMessage>;

declare module "react-router" {
  interface AppLoadContext {
    cloudflare: {
      env: CloudflareEnv;
      ctx: ExecutionContext;
    };
  }
}
