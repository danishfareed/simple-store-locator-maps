import type { LoaderFunctionArgs } from "react-router";
import { requireStorefront } from "../lib/auth/storefront.server";
import { LocationSearchSchema } from "../schemas/location.schema";
import { searchLocationsByRadius } from "../services/location.service.server";
import {
  incrementStorefrontRequest,
} from "../services/quota.service.server";
import { recordEvent } from "../repositories/analytics.repository.server";
import { newId } from "../lib/utils/slug";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const gate = await requireStorefront(request, context);
  if (!gate.ok) return gate.response;

  const within = await incrementStorefrontRequest(gate.db, gate.shop.id);
  if (!within) return new Response("Rate limited", { status: 429 });

  const parsed = LocationSearchSchema.safeParse(
    Object.fromEntries(gate.url.searchParams.entries()),
  );
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { lat, lng, radiusKm, limit, q } = parsed.data;
  if (lat == null || lng == null) {
    return Response.json({ results: [] });
  }
  const results = await searchLocationsByRadius(
    gate.db,
    gate.shop.id,
    { lat, lng },
    radiusKm,
    limit,
  );

  // Fire-and-forget analytics — don't block response on write failures.
  try {
    await recordEvent(gate.db, {
      id: newId(),
      shopId: gate.shop.id,
      eventType: "search",
      query: q ?? null,
      countryCode: request.headers.get("cf-ipcountry") ?? null,
      ipHash: await hashIp(request, gate.env.SESSION_SECRET),
      userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
      referer: request.headers.get("referer")?.slice(0, 500) ?? null,
      properties: { lat, lng, radiusKm, resultsCount: results.length },
    });
  } catch {
    // swallow
  }

  return Response.json(
    { results },
    {
      headers: {
        "cache-control": "public, max-age=30, s-maxage=60",
        "content-type": "application/json",
      },
    },
  );
}

async function hashIp(request: Request, secret: string): Promise<string | null> {
  const ip = request.headers.get("cf-connecting-ip");
  if (!ip) return null;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(ip));
  return [...new Uint8Array(sig)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
