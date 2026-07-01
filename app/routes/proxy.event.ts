import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { requireStorefront } from "../lib/auth/storefront.server";
import { incrementStorefrontRequest } from "../services/quota.service.server";
import { recordEvent } from "../repositories/analytics.repository.server";
import { newId } from "../lib/utils/slug";
import { hashIp } from "../lib/utils/ip.server";

/**
 * Lightweight storefront analytics beacon. Client-side-first: the Worker
 * just verifies + records — no plan/quota logic beyond the shared storefront
 * rate limiter (same as the other proxy.* routes).
 */
const AnalyticsEventBodySchema = z.object({
  type: z.enum(["search", "view", "click", "directions", "call", "impression"]),
  locationId: z.string().max(100).optional(),
  widgetId: z.string().max(100).optional(),
  query: z.string().max(200).optional(),
});

export async function action({ request, context }: ActionFunctionArgs) {
  const gate = await requireStorefront(request, context);
  if (!gate.ok) return gate.response;

  const within = await incrementStorefrontRequest(gate.db, gate.shop.id);
  if (!within) return new Response("Rate limited", { status: 429 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = AnalyticsEventBodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { type, locationId, widgetId, query } = parsed.data;

  try {
    await recordEvent(gate.db, {
      id: newId(),
      shopId: gate.shop.id,
      eventType: type,
      locationId: locationId ?? null,
      widgetId: widgetId ?? null,
      query: query ?? null,
      countryCode: request.headers.get("cf-ipcountry") ?? null,
      ipHash: await hashIp(request, gate.env.SESSION_SECRET),
      userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
      referer: request.headers.get("referer")?.slice(0, 500) ?? null,
    });
  } catch {
    // Beacon: never fail the storefront response over an analytics write.
  }

  return new Response(null, { status: 204 });
}
