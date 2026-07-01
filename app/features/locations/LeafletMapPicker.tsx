import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { LEAFLET_OSM } from "../providers/providers";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface LeafletMapPickerProps {
  value: LatLng | null;
  onChange: (value: LatLng) => void;
  zoom?: number;
  height?: number;
}

/**
 * The Leaflet half of {@link MapPicker}. Imported dynamically (client-only) by
 * MapPicker so that `leaflet` — which touches `window` at module load — never
 * enters the SSR module graph. Do NOT import this file from a component that
 * renders on the server; go through MapPicker.
 */

// A self-contained SVG pin as a Leaflet divIcon. Avoids the well-known
// broken-marker-image problem where Leaflet's default PNG icon URLs don't
// resolve under a bundler, without needing to ship image assets.
const PIN_ICON = L.divIcon({
  className: "ssl-mappicker-pin",
  html: `<svg width="26" height="38" viewBox="0 0 26 38" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 0C5.82 0 0 5.82 0 13c0 9.75 13 25 13 25s13-15.25 13-25C26 5.82 20.18 0 13 0z" fill="#008060"/>
    <circle cx="13" cy="13" r="5" fill="#fff"/>
  </svg>`,
  iconSize: [26, 38],
  iconAnchor: [13, 38],
});

/** Invisible child that turns map clicks into onChange calls. */
function ClickCapture({ onChange }: { onChange: (v: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function LeafletMapPicker({
  value,
  onChange,
  zoom = 12,
  height = 320,
}: LeafletMapPickerProps) {
  // Seed the INITIAL center only (empty deps): the marker if set, else a wide
  // world view. Recentring on later changes is handled by <Recenter/> below so
  // the user's manual pan isn't fought.
  const initial = useRef(value);
  const center = useMemo<[number, number]>(
    () =>
      initial.current ? [initial.current.lat, initial.current.lng] : [20, 0],
    [],
  );

  return (
    <MapContainer
      center={center}
      zoom={value ? zoom : 2}
      style={{ height, width: "100%", borderRadius: 8 }}
      scrollWheelZoom
    >
      <TileLayer url={LEAFLET_OSM.tileUrl!} attribution={LEAFLET_OSM.attribution} />
      <ClickCapture onChange={onChange} />
      {value ? <Marker position={[value.lat, value.lng]} icon={PIN_ICON} /> : null}
      <Recenter value={value} zoom={zoom} />
    </MapContainer>
  );
}

/**
 * Pans the map to `value` when it changes from outside (e.g. the "Use address"
 * geocode or a typed lat/lng), without re-mounting the map.
 */
function Recenter({ value, zoom }: { value: LatLng | null; zoom: number }) {
  const map = useMap();
  const last = useRef<string>("");
  useEffect(() => {
    if (!value || !map) return;
    const key = `${value.lat},${value.lng}`;
    if (key === last.current) return;
    last.current = key;
    map.setView([value.lat, value.lng], Math.max(map.getZoom(), zoom));
  }, [value, zoom, map]);
  return null;
}
