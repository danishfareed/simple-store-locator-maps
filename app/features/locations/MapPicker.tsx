import { useEffect, useState, type ComponentType } from "react";
import {
  BlockStack,
  Box,
  Button,
  InlineStack,
  Spinner,
  Text,
  TextField,
} from "@shopify/polaris";
import type { LatLng, LeafletMapPickerProps } from "./LeafletMapPicker";

export interface MapPickerProps {
  /** Current marker position, or null when unset. */
  value: LatLng | null;
  /** Called with the new position when the user clicks the map or geocodes. */
  onChange: (value: LatLng) => void;
  /** Zoom used when a position is set / geocoded. */
  zoom?: number;
  /** Map height in px. */
  height?: number;
  /** Prefills the "Use address" search field (e.g. from a form's address inputs). */
  initialAddress?: string;
}

/**
 * Generic interactive map for setting a `{ lat, lng }`. Reused by widgets
 * (default map center) and, later, locations.
 *
 * SSR strategy: Leaflet reads `window` at module-load time, so it must never
 * be imported on the server. This wrapper renders a placeholder during SSR and
 * on the first client render, then — after mount — dynamically `import()`s the
 * Leaflet map component and swaps it in. The Leaflet code therefore never
 * enters the server module graph.
 */
export function MapPicker({
  value,
  onChange,
  zoom = 12,
  height = 320,
  initialAddress,
}: MapPickerProps) {
  const [MapComp, setMapComp] = useState<ComponentType<LeafletMapPickerProps> | null>(
    null,
  );
  const [address, setAddress] = useState(initialAddress ?? "");
  const [addressTouched, setAddressTouched] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void import("./LeafletMapPicker").then((mod) => {
      if (active) setMapComp(() => mod.default);
    });
    return () => {
      active = false;
    };
  }, []);

  // Keep the search field in sync with the form's address fields until the
  // merchant edits it directly — after that, respect their input.
  useEffect(() => {
    if (!addressTouched && initialAddress !== undefined) {
      setAddress(initialAddress);
    }
  }, [initialAddress, addressTouched]);

  async function geocode() {
    const q = address.trim();
    if (!q) return;
    setGeocoding(true);
    setGeoError(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
        q,
      )}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const results = (await res.json()) as Array<{ lat: string; lon: string }>;
      const hit = results[0];
      if (!hit) {
        setGeoError("No match found for that address.");
        return;
      }
      onChange({ lat: Number(hit.lat), lng: Number(hit.lon) });
    } catch {
      setGeoError("Could not look up that address. Try again.");
    } finally {
      setGeocoding(false);
    }
  }

  return (
    <BlockStack gap="300">
      <InlineStack gap="200" blockAlign="end" wrap={false}>
        <div style={{ flex: 1 }}>
          <TextField
            label="Find an address"
            labelHidden
            placeholder="Search an address to drop the pin"
            autoComplete="off"
            value={address}
            onChange={(v) => {
              setAddressTouched(true);
              setAddress(v);
            }}
            error={geoError ?? undefined}
            connectedRight={
              <Button onClick={geocode} loading={geocoding} disabled={!address.trim()}>
                Use address
              </Button>
            }
          />
        </div>
      </InlineStack>

      {MapComp ? (
        <MapComp value={value} onChange={onChange} zoom={zoom} height={height} />
      ) : (
        <Box
          background="bg-surface-secondary"
          borderRadius="200"
          minHeight={`${height}px`}
        >
          <div
            style={{
              height,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Spinner accessibilityLabel="Loading map" size="small" />
          </div>
        </Box>
      )}

      <InlineStack gap="200" align="space-between" blockAlign="center">
        <Text as="span" tone="subdued" variant="bodySm">
          Click the map to set the default center.
        </Text>
        {value ? (
          <Text as="span" tone="subdued" variant="bodySm">
            {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          </Text>
        ) : (
          <Text as="span" tone="subdued" variant="bodySm">
            No center set
          </Text>
        )}
      </InlineStack>
    </BlockStack>
  );
}
