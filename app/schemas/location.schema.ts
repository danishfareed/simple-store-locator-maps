import { z } from "zod";

const phoneRegex = /^[+\d\s().-]{5,25}$/;
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const LocationHoursDaySchema = z.array(
  z.object({
    open: z.string().regex(/^\d{2}:\d{2}$/),
    close: z.string().regex(/^\d{2}:\d{2}$/),
    closed: z.boolean().optional(),
  }),
);

export const LocationHoursSchema = z.record(
  z.enum(["1", "2", "3", "4", "5", "6", "7"]),
  LocationHoursDaySchema,
);

export const LocationInputSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(slugRegex, "lowercase letters, digits, single dashes"),
  status: z.enum(["active", "inactive", "draft"]).default("active"),
  addressLine1: z.string().max(200).optional().nullable(),
  addressLine2: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  region: z.string().max(100).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  countryCode: z
    .string()
    .length(2)
    .transform((v) => v.toUpperCase())
    .optional()
    .nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  phone: z.string().regex(phoneRegex).optional().nullable(),
  email: z.string().email().optional().nullable(),
  website: z.string().url().max(500).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  imageUrl: z.string().url().max(500).optional().nullable(),
  hours: LocationHoursSchema.optional().nullable(),
  services: z.array(z.string().max(50)).max(50).optional().nullable(),
  customFields: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional()
    .nullable(),
  externalId: z.string().max(100).optional().nullable(),
});

export type LocationInput = z.infer<typeof LocationInputSchema>;

export const LocationSearchSchema = z.object({
  q: z.string().max(200).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(0.1).max(500).default(25),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
  services: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined)),
  country: z.string().length(2).optional(),
});

export type LocationSearchInput = z.infer<typeof LocationSearchSchema>;
