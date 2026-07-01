import { z } from "zod";

export const WidgetTypeEnum = z.enum(["map_list", "finder", "carousel", "list", "single"]);
export type WidgetType = z.infer<typeof WidgetTypeEnum>;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const BaseConfigSchema = z.object({
  defaultCenter: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .optional(),
  defaultZoom: z.number().int().min(1).max(20).optional(),
  searchRadiusKm: z.number().min(1).max(500).optional(),
  showHours: z.boolean().optional(),
  showPhone: z.boolean().optional(),
  showDirections: z.boolean().optional(),
  clustering: z.boolean().optional(),
  enableNearMe: z.boolean().optional(),
  categories: z.array(z.string()).optional(),
  filters: z
    .object({
      services: z.array(z.string()).optional(),
      countries: z.array(z.string().length(2)).optional(),
    })
    .optional(),
  theme: z
    .object({
      primaryColor: hexColor.optional(),
      markerColor: hexColor.optional(),
      backgroundColor: hexColor.optional(),
      textColor: hexColor.optional(),
      fontFamily: z.string().max(100).optional(),
    })
    .optional(),
});

const mapListConfigSchema = BaseConfigSchema.extend({
  type: z.literal("map_list"),
  sidebarPosition: z.enum(["left", "right"]).optional(),
  resultsPerPage: z.number().int().min(1).max(100).optional(),
}).strict();

const finderConfigSchema = BaseConfigSchema.extend({
  type: z.literal("finder"),
  heroHeight: z.number().int().min(0).optional(),
  showFilterBar: z.boolean().optional(),
}).strict();

const carouselConfigSchema = BaseConfigSchema.extend({
  type: z.literal("carousel"),
  cardsPerView: z.number().int().min(1).max(10).optional(),
  autoplay: z.boolean().optional(),
  showMiniMap: z.boolean().optional(),
}).strict();

const listConfigSchema = BaseConfigSchema.extend({
  type: z.literal("list"),
  columns: z.number().int().min(1).max(6).optional(),
  showMapLink: z.boolean().optional(),
}).strict();

const singleConfigSchema = BaseConfigSchema.extend({
  type: z.literal("single"),
  locationId: z.string().min(1),
  showContactForm: z.boolean().optional(),
}).strict();

export const WidgetConfigSchema = z.discriminatedUnion("type", [
  mapListConfigSchema,
  finderConfigSchema,
  carouselConfigSchema,
  listConfigSchema,
  singleConfigSchema,
]);

export const WidgetInputSchema = z
  .object({
    handle: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
    name: z.string().min(1).max(100),
    provider: z.enum(["leaflet", "google"]).default("leaflet"),
    type: WidgetTypeEnum,
    config: WidgetConfigSchema,
    isPublished: z.boolean().default(false),
  })
  .refine((data) => data.type === data.config.type, {
    message: "type must match config.type",
    path: ["config", "type"],
  });

export type WidgetInput = z.infer<typeof WidgetInputSchema>;
