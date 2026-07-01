import type { LoaderFunctionArgs } from "react-router";
import { eq } from "drizzle-orm";
import { requireStorefront } from "../lib/auth/storefront.server";
import { locations } from "../lib/db/schema";
import { incrementStorefrontRequest } from "../services/quota.service.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const gate = await requireStorefront(request, context);
  if (!gate.ok) return gate.response;

  const within = await incrementStorefrontRequest(gate.db, gate.shop.id);
  if (!within) return new Response("Rate limited", { status: 429 });

  const rows = await gate.db
    .select({
      id: locations.id,
      name: locations.name,
      slug: locations.slug,
      addressLine1: locations.addressLine1,
      addressLine2: locations.addressLine2,
      city: locations.city,
      region: locations.region,
      postalCode: locations.postalCode,
      countryCode: locations.countryCode,
      lat: locations.latitude,
      lng: locations.longitude,
      phone: locations.phone,
      email: locations.email,
      website: locations.website,
      imageUrl: locations.imageUrl,
      description: locations.description,
      services: locations.services,
      hours: locations.hours,
    })
    .from(locations)
    .where(eq(locations.shopId, gate.shop.id))
    .all();

  return Response.json(
    { locations: rows.filter((r) => r.lat != null && r.lng != null) },
    {
      headers: {
        "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        "content-type": "application/json",
      },
    },
  );
}
