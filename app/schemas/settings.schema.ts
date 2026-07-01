import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const SettingsSchema = z.object({
  mapProvider: z.enum(["leaflet", "google"]).optional(),
  googleMapsApiKey: z.string().optional(),
  defaultLatitude: z.number().min(-90).max(90).optional(),
  defaultLongitude: z.number().min(-180).max(180).optional(),
  defaultZoom: z.number().int().min(1).max(20).optional(),
  unitSystem: z.enum(["metric", "imperial"]).optional(),
  branding: z
    .object({
      primaryColor: hexColor.optional(),
      logoUrl: z.string().url().optional(),
    })
    .optional(),
  osmGeocoderUrl: z.string().url().optional(),
});

export type SettingsInput = z.infer<typeof SettingsSchema>;
