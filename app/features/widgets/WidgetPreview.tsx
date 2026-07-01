import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  BlockStack,
  ButtonGroup,
  Button,
  Card,
  InlineStack,
  Text,
} from "@shopify/polaris";
import type { Location, WidgetConfig } from "../../lib/db/schema";
import type { WidgetType } from "../../schemas/widget.schema";

/**
 * A storefront-shaped location record. Mirrors the fields the app-proxy
 * `/locations` endpoint returns and that the storefront views read.
 */
export interface PreviewLocation {
  id: string;
  name: string;
  addressLine1?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  lat?: number | null;
  lng?: number | null;
  phone?: string | null;
  services?: string[] | null;
  hours?: unknown;
  [key: string]: unknown;
}

/**
 * Map a DB location row to the storefront `/locations` shape the widget views
 * read (notably `lat`/`lng` rather than `latitude`/`longitude`). Pure and
 * client-safe so route loaders can call it to feed the preview.
 */
export function toPreviewLocation(l: Location): PreviewLocation {
  return {
    id: l.id,
    name: l.name,
    addressLine1: l.addressLine1,
    addressLine2: l.addressLine2,
    city: l.city,
    region: l.region,
    postalCode: l.postalCode,
    countryCode: l.countryCode,
    lat: l.latitude,
    lng: l.longitude,
    phone: l.phone,
    email: l.email,
    website: l.website,
    imageUrl: l.imageUrl,
    description: l.description,
    services: l.services,
    hours: l.hours,
  };
}

export interface WidgetPreviewProps {
  type: WidgetType;
  provider: "leaflet" | "google";
  config: WidgetConfig;
  /** The shop's real locations (may be a minimal `{id,name}` list). */
  locations: PreviewLocation[];
  /** Shop settings — used to pass the Google Maps key when provider=google. */
  settings: { googleMapsApiKey?: string };
  timezone?: string | null;
  /** The widget type label, for the header badge. */
  typeLabel: string;
}

// Standard weekly hours used by every sample location so the "open now" pill
// renders. Keys are ISO weekdays "1" (Mon) … "7" (Sun); intervals are
// { open, close } — exactly the shape `isOpenNow` reads.
const SAMPLE_HOURS = {
  "1": [{ open: "09:00", close: "18:00" }],
  "2": [{ open: "09:00", close: "18:00" }],
  "3": [{ open: "09:00", close: "18:00" }],
  "4": [{ open: "09:00", close: "18:00" }],
  "5": [{ open: "09:00", close: "18:00" }],
  "6": [{ open: "10:00", close: "16:00" }],
  "7": [],
};

// Built-in demo locations so the preview is never blank when the shop has no
// (coordinate-bearing) locations yet. Real, plausible coordinates so the map
// actually places markers.
const SAMPLE_LOCATIONS: PreviewLocation[] = [
  {
    id: "sample-1",
    name: "Downtown Flagship",
    addressLine1: "233 Spring St",
    city: "New York",
    region: "NY",
    postalCode: "10013",
    countryCode: "US",
    lat: 40.7248,
    lng: -74.0018,
    phone: "+1 212 555 0100",
    services: ["Flagship"],
    hours: SAMPLE_HOURS,
  },
  {
    id: "sample-2",
    name: "Midtown Outlet",
    addressLine1: "11 W 42nd St",
    city: "New York",
    region: "NY",
    postalCode: "10036",
    countryCode: "US",
    lat: 40.7549,
    lng: -73.9840,
    phone: "+1 212 555 0142",
    services: ["Outlet"],
    hours: SAMPLE_HOURS,
  },
  {
    id: "sample-3",
    name: "Brooklyn Warehouse",
    addressLine1: "55 Washington St",
    city: "Brooklyn",
    region: "NY",
    postalCode: "11201",
    countryCode: "US",
    lat: 40.7033,
    lng: -73.9881,
    phone: "+1 718 555 0173",
    services: ["Warehouse"],
    hours: SAMPLE_HOURS,
  },
];

const VIEWPORTS = {
  desktop: { label: "Desktop", width: "100%" },
  mobile: { label: "Mobile", width: 390 },
} as const;

type ViewportKey = keyof typeof VIEWPORTS;

/**
 * Live widget preview. Renders the ACTUAL storefront widget inside a
 * same-origin iframe (`/widget-preview`) and feeds it the in-progress editor
 * config over `postMessage`. The iframe loads the same view/provider bundle the
 * storefront uses, so what the merchant sees here is what ships.
 *
 * Data flow: the authenticated parent (this component) builds a proxy-shaped
 * `widget` object from live editor state and posts `{type:"ssl-preview", widget,
 * locations}` to the iframe — on the iframe's `ssl-preview-ready` signal and on
 * every (debounced) config change. The iframe never fetches and holds no
 * secrets; everything flows one-way from parent to frame at same origin.
 */
export function WidgetPreview({
  type,
  provider,
  config,
  locations,
  settings,
  timezone,
  typeLabel,
}: WidgetPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const [viewport, setViewport] = useState<ViewportKey>("desktop");

  // Prefer the shop's real locations, but only if they carry coordinates the
  // map can place. A `{id,name}`-only list (what the editor loader supplies)
  // can't render markers, so fall back to demo data.
  const previewLocations = useMemo<PreviewLocation[]>(() => {
    const usable = (locations ?? []).filter(
      (l) => l.lat != null && l.lng != null,
    );
    return usable.length ? usable : SAMPLE_LOCATIONS;
  }, [locations]);

  // The proxy.widget response shape the storefront `renderWidget` expects.
  const widget = useMemo(
    () => ({
      type,
      provider,
      config: { ...config, type },
      timezone: timezone ?? null,
      showPoweredBy: false,
      googleMapsApiKey:
        provider === "google" ? settings?.googleMapsApiKey : undefined,
    }),
    [type, provider, config, timezone, settings?.googleMapsApiKey],
  );

  const post = useCallback(() => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame) return;
    frame.postMessage(
      { type: "ssl-preview", widget, locations: previewLocations },
      window.location.origin,
    );
  }, [widget, previewLocations]);

  // Listen for the iframe announcing it's ready to receive config.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type === "ssl-preview-ready") setReady(true);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Push config once the frame is ready and whenever it changes (debounced so a
  // burst of keystrokes/color drags collapses into one re-render).
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(post, 300);
    return () => clearTimeout(t);
  }, [ready, post]);

  const width = VIEWPORTS[viewport].width;

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Text as="h2" variant="headingSm">
              Preview
            </Text>
            <Badge tone="info">{typeLabel}</Badge>
          </InlineStack>
          <ButtonGroup variant="segmented">
            <Button
              pressed={viewport === "desktop"}
              onClick={() => setViewport("desktop")}
              accessibilityLabel="Desktop preview width"
            >
              Desktop
            </Button>
            <Button
              pressed={viewport === "mobile"}
              onClick={() => setViewport("mobile")}
              accessibilityLabel="Mobile preview width"
            >
              Mobile
            </Button>
          </ButtonGroup>
        </InlineStack>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            background: "var(--p-color-bg-surface-secondary)",
            borderRadius: "var(--p-border-radius-200)",
            padding: 8,
            overflow: "hidden",
          }}
        >
          <iframe
            ref={iframeRef}
            src="/widget-preview"
            title="Widget preview"
            style={{
              width,
              maxWidth: "100%",
              height: 520,
              border: "1px solid var(--p-color-border)",
              borderRadius: "var(--p-border-radius-200)",
              background: "#fff",
              transition: "width 150ms ease",
            }}
          />
        </div>

        {previewLocations === SAMPLE_LOCATIONS ? (
          <Text as="p" tone="subdued" variant="bodySm">
            Showing sample locations. Add locations with coordinates to preview
            your own.
          </Text>
        ) : null}
      </BlockStack>
    </Card>
  );
}
