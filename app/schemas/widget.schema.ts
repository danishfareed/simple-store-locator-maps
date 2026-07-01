import { z } from "zod";

export const WidgetConfigSchema = z.object({
  defaultCenter: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .optional(),
  defaultZoom: z.number().int().min(1).max(20).optional(),
  searchRadiusKm: z.number().min(1).max(500).optional(),
  showHours: z.boolean().optional(),
  showPhone: z.boolean().optional(),
  showDirections: z.boolean().optional(),
  filters: z
    .object({
      services: z.array(z.string()).optional(),
      countries: z.array(z.string().length(2)).optional(),
    })
    .optional(),
  theme: z
    .object({
      primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      markerColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      fontFamily: z.string().max(100).optional(),
    })
    .optional(),
});

export const WidgetInputSchema = z.object({
  handle: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(100),
  provider: z.enum(["leaflet", "google"]).default("leaflet"),
  config: WidgetConfigSchema,
  isPublished: z.boolean().default(false),
});

export type WidgetInput = z.infer<typeof WidgetInputSchema>;
