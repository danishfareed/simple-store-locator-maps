/**
 * Client-safe widget-type registry. Contains only data (no server bindings or
 * DB imports), so both admin UI components (the type gallery) and server
 * routes (plan gating) can import from here.
 */

import type { WidgetType } from "../../schemas/widget.schema";

export interface WidgetTypeMeta {
  id: WidgetType;
  label: string;
  description: string;
  icon: string;
  requiresMap: boolean;
  requiresPremium: boolean;
}

export const WIDGET_TYPES: Record<WidgetType, WidgetTypeMeta> = {
  map_list: {
    id: "map_list",
    label: "Map + list",
    description: "A map with a paginated list of locations alongside it. The classic store locator.",
    icon: "MapIcon",
    requiresMap: true,
    requiresPremium: false,
  },
  finder: {
    id: "finder",
    label: "Store finder",
    description: "A full-page hero finder with a search bar and filters above a map.",
    icon: "SearchIcon",
    requiresMap: true,
    requiresPremium: true,
  },
  carousel: {
    id: "carousel",
    label: "Carousel",
    description: "A horizontally scrolling carousel of location cards, with an optional mini map.",
    icon: "CarouselIcon",
    requiresMap: false,
    requiresPremium: true,
  },
  list: {
    id: "list",
    label: "List",
    description: "A simple grid or list of locations, no map required.",
    icon: "ListIcon",
    requiresMap: false,
    requiresPremium: true,
  },
  single: {
    id: "single",
    label: "Single location",
    description: "A focused widget for one specific location, with optional contact form.",
    icon: "PinIcon",
    requiresMap: true,
    requiresPremium: true,
  },
};

export const WIDGET_TYPE_ORDER: WidgetType[] = [
  "map_list",
  "finder",
  "carousel",
  "list",
  "single",
];
