import { z } from "zod";

// Canonical CSV/XLSX row shape. Column names are lowercase snake_case;
// the importer normalises header casing and common aliases before validating.
export const ImportRowSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().optional(),
  status: z.enum(["active", "inactive", "draft"]).optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  postal_code: z.string().optional(),
  country_code: z.string().length(2).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  description: z.string().optional(),
  image_url: z.string().url().optional(),
  services: z.string().optional(), // pipe- or comma-separated in source file
  external_id: z.string().optional(),
});

export type ImportRow = z.infer<typeof ImportRowSchema>;

export const ImportUploadSchema = z.object({
  filename: z
    .string()
    .min(1)
    .max(200)
    .refine((f) => /\.(csv|xlsx)$/i.test(f), "must be .csv or .xlsx"),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(50 * 1024 * 1024, "max 50MB"),
  contentType: z
    .string()
    .refine(
      (t) =>
        [
          "text/csv",
          "application/csv",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ].includes(t),
      "unsupported content-type",
    ),
});

export type ImportUploadInput = z.infer<typeof ImportUploadSchema>;

export const IMPORT_COLUMN_ALIASES: Record<string, keyof ImportRow> = {
  name: "name",
  store_name: "name",
  location_name: "name",
  title: "name",
  slug: "slug",
  handle: "slug",
  status: "status",
  address: "address_line1",
  address1: "address_line1",
  address_line_1: "address_line1",
  street: "address_line1",
  address2: "address_line2",
  address_line_2: "address_line2",
  city: "city",
  town: "city",
  state: "region",
  province: "region",
  region: "region",
  zip: "postal_code",
  zipcode: "postal_code",
  postcode: "postal_code",
  postal_code: "postal_code",
  country: "country_code",
  country_code: "country_code",
  lat: "latitude",
  latitude: "latitude",
  lng: "longitude",
  lon: "longitude",
  longitude: "longitude",
  phone: "phone",
  telephone: "phone",
  email: "email",
  website: "website",
  url: "website",
  description: "description",
  notes: "description",
  image: "image_url",
  image_url: "image_url",
  photo: "image_url",
  services: "services",
  tags: "services",
  categories: "services",
  external_id: "external_id",
  ref: "external_id",
};
