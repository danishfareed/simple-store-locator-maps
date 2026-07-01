import type { Database } from "../lib/db/client.server";
import { bboxForRadius, haversineKm } from "../lib/utils/geo";
import { newId, slugify } from "../lib/utils/slug";
import type { Location } from "../lib/db/schema";
import {
  createLocation,
  getLocationBySlug,
  findLocationsInBbox,
  updateLocation,
} from "../repositories/location.repository.server";
import type { LocationInput } from "../schemas/location.schema";
import { assertLocationQuota } from "./quota.service.server";

export async function saveNewLocation(
  db: Database,
  shopId: string,
  input: LocationInput,
): Promise<Location> {
  await assertLocationQuota(db, shopId, 1);
  const slug = await ensureUniqueSlug(db, shopId, input.slug || slugify(input.name));
  return createLocation(db, {
    id: newId(),
    shopId,
    name: input.name,
    slug,
    status: input.status,
    addressLine1: input.addressLine1 ?? null,
    addressLine2: input.addressLine2 ?? null,
    city: input.city ?? null,
    region: input.region ?? null,
    postalCode: input.postalCode ?? null,
    countryCode: input.countryCode ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    website: input.website ?? null,
    description: input.description ?? null,
    imageUrl: input.imageUrl ?? null,
    hours: input.hours ?? null,
    services: input.services ?? null,
    customFields: input.customFields ?? null,
    externalId: input.externalId ?? null,
  });
}

export async function patchLocation(
  db: Database,
  shopId: string,
  id: string,
  input: Partial<LocationInput>,
) {
  const patch: Partial<Location> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.slug !== undefined) {
    patch.slug = await ensureUniqueSlug(db, shopId, input.slug, id);
  }
  if (input.status !== undefined) patch.status = input.status;
  if (input.addressLine1 !== undefined) patch.addressLine1 = input.addressLine1;
  if (input.addressLine2 !== undefined) patch.addressLine2 = input.addressLine2;
  if (input.city !== undefined) patch.city = input.city;
  if (input.region !== undefined) patch.region = input.region;
  if (input.postalCode !== undefined) patch.postalCode = input.postalCode;
  if (input.countryCode !== undefined) patch.countryCode = input.countryCode;
  if (input.latitude !== undefined) patch.latitude = input.latitude;
  if (input.longitude !== undefined) patch.longitude = input.longitude;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.email !== undefined) patch.email = input.email;
  if (input.website !== undefined) patch.website = input.website;
  if (input.description !== undefined) patch.description = input.description;
  if (input.imageUrl !== undefined) patch.imageUrl = input.imageUrl;
  if (input.hours !== undefined) patch.hours = input.hours;
  if (input.services !== undefined) patch.services = input.services;
  if (input.customFields !== undefined) patch.customFields = input.customFields;
  if (input.externalId !== undefined) patch.externalId = input.externalId;

  return updateLocation(db, shopId, id, patch);
}

async function ensureUniqueSlug(
  db: Database,
  shopId: string,
  base: string,
  selfId?: string,
): Promise<string> {
  let slug = slugify(base);
  if (!slug) slug = newId().slice(0, 8);
  let attempt = slug;
  for (let i = 2; i < 200; i++) {
    const existing = await getLocationBySlug(db, shopId, attempt);
    if (!existing || existing.id === selfId) return attempt;
    attempt = `${slug}-${i}`;
  }
  throw new Error("Could not generate unique slug");
}

export interface SearchResult extends Location {
  distanceKm: number | null;
}

export async function searchLocationsByRadius(
  db: Database,
  shopId: string,
  centre: { lat: number; lng: number },
  radiusKm: number,
  limit: number,
): Promise<SearchResult[]> {
  const bbox = bboxForRadius(centre, radiusKm);
  const candidates = await findLocationsInBbox(db, shopId, bbox, limit * 3);
  const hits: SearchResult[] = [];
  for (const row of candidates) {
    if (row.latitude == null || row.longitude == null) continue;
    const d = haversineKm(centre, { lat: row.latitude, lng: row.longitude });
    if (d <= radiusKm) hits.push({ ...row, distanceKm: d });
  }
  hits.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  return hits.slice(0, limit);
}
