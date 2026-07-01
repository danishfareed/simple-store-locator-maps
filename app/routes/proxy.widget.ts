import type { LoaderFunctionArgs } from "react-router";
import { and, eq } from "drizzle-orm";
import { requireStorefront } from "../lib/auth/storefront.server";
import { widgets } from "../lib/db/schema";
import { resolveProvider } from "../services/provider.service.server";
import { incrementStorefrontRequest } from "../services/quota.service.server";
import { planShowsPoweredBy } from "../lib/billing/plans";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const gate = await requireStorefront(request, context);
  if (!gate.ok) return gate.response;

  const within = await incrementStorefrontRequest(gate.db, gate.shop.id);
  if (!within) return new Response("Rate limited", { status: 429 });

  const handle = gate.url.searchParams.get("handle") ?? "default";
  const widget = await gate.db
    .select()
    .from(widgets)
    .where(and(eq(widgets.shopId, gate.shop.id), eq(widgets.handle, handle)))
    .get();

  if (!widget || !widget.isPublished) {
    return new Response("Widget not published", { status: 404 });
  }

  const hasApiKey = Boolean(gate.shop.settings?.googleMapsApiKey);
  const provider = resolveProvider(widget.provider, {
    hasApiKey,
    planHandle: gate.shop.planHandle,
  });

  const googleMapsApiKey =
    provider.id === "google" && gate.shop.settings?.googleMapsApiKey
      ? gate.shop.settings.googleMapsApiKey
      : undefined;

  return Response.json(
    {
      widget: {
        handle: widget.handle,
        name: widget.name,
        type: widget.type,
        provider: provider.id,
        providerMeta: {
          tileUrl: provider.tileUrl,
          attribution: provider.attribution,
        },
        config: widget.config,
        timezone: gate.shop.timezone ?? null,
        showPoweredBy: planShowsPoweredBy(gate.shop.planHandle),
        googleMapsApiKey,
      },
    },
    {
      headers: {
        "cache-control": "public, max-age=120, s-maxage=300",
        "content-type": "application/json",
      },
    },
  );
}
