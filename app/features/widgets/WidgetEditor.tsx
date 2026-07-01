import { useMemo, useState } from "react";
import { Form } from "react-router";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
  Divider,
  FormLayout,
  Icon,
  InlineGrid,
  InlineStack,
  Layout,
  Link as PolarisLink,
  RangeSlider,
  Select,
  Tag,
  Text,
  TextField,
} from "@shopify/polaris";
import { ClipboardIcon } from "@shopify/polaris-icons";
import type { Widget, WidgetConfig } from "../../lib/db/schema";
import type { WidgetType } from "../../schemas/widget.schema";
import { WIDGET_TYPES } from "./widget-types";
import { PROVIDERS } from "../providers/providers";
import { planAllows, planAllowsProvider } from "../../lib/billing/plans";
import { MapPicker } from "../locations/MapPicker";
import type { LatLng } from "../locations/LeafletMapPicker";
import { MapListControls } from "./typeControls/MapListControls";
import { FinderControls } from "./typeControls/FinderControls";
import { CarouselControls } from "./typeControls/CarouselControls";
import { ListControls } from "./typeControls/ListControls";
import { SingleControls } from "./typeControls/SingleControls";
import { WidgetPreview, type PreviewLocation } from "./WidgetPreview";

const FONT_OPTIONS = [
  { label: "Theme default", value: "" },
  { label: "System sans-serif", value: "system-ui, sans-serif" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Monospace", value: "ui-monospace, monospace" },
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Roboto", value: "Roboto, sans-serif" },
];

const DEFAULT_THEME = {
  primaryColor: "#008060",
  markerColor: "#008060",
  backgroundColor: "#ffffff",
  textColor: "#202223",
};

export interface WidgetEditorProps {
  mode: "create" | "edit";
  type: WidgetType;
  widget?: Widget;
  /** Storefront-shaped locations (a superset of the `{id,name}` LocationOption
   *  the type controls read) so the live preview can render real markers. */
  locations: PreviewLocation[];
  plan: string;
  /** Shop settings — used to know whether a Google Maps key is configured. */
  settings: { googleMapsApiKey?: string };
  /** Shop IANA timezone — forwarded to the preview for "open now" evaluation. */
  timezone?: string | null;
  fieldErrors?: Record<string, string>;
  formError?: string;
}

function slugifyHandle(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/**
 * The full create/edit widget editor. Left pane = grouped configuration cards;
 * right pane = a preview placeholder (real live preview is a follow-up task).
 * All controls are controlled React state; on submit the whole config is
 * serialized into a single hidden `payload` JSON field that the route action
 * parses and validates with `WidgetInputSchema`.
 */
export function WidgetEditor({
  mode,
  type,
  widget,
  locations,
  plan,
  settings,
  timezone,
  fieldErrors,
  formError,
}: WidgetEditorProps) {
  const typeMeta = WIDGET_TYPES[type];

  // ── top-level fields ──
  const [name, setName] = useState(widget?.name ?? typeMeta.label);
  const [handle, setHandle] = useState(
    widget?.handle ?? slugifyHandle(typeMeta.label),
  );
  const [provider, setProvider] = useState<"leaflet" | "google">(
    (widget?.provider as "leaflet" | "google") ?? "leaflet",
  );
  const [isPublished, setIsPublished] = useState(widget?.isPublished ?? false);

  // ── config (base + type-specific merged into one object) ──
  const [config, setConfig] = useState<WidgetConfig>(() => ({
    ...(widget?.config ?? {}),
    type,
  }));
  const update = (patch: Partial<WidgetConfig>) =>
    setConfig((c) => ({ ...c, ...patch }));

  // ── plan gating ──
  const canTheme = planAllows(plan, "custom_theme");
  const canCluster = planAllows(plan, "clustering");
  const canNearMe = planAllows(plan, "near_me");
  const canFilters = planAllows(plan, "filters");
  const hasGoogleKey = Boolean(settings.googleMapsApiKey);
  const canGoogle = planAllowsProvider(plan, "google") && hasGoogleKey;

  const theme = config.theme ?? {};
  const setTheme = (patch: Partial<NonNullable<WidgetConfig["theme"]>>) =>
    update({ theme: { ...theme, ...patch } });

  const center: LatLng | null = config.defaultCenter
    ? { lat: config.defaultCenter.lat, lng: config.defaultCenter.lng }
    : null;

  // Category tag manager
  const [categoryInput, setCategoryInput] = useState("");
  const categories = config.categories ?? [];
  const addCategory = () => {
    const v = categoryInput.trim();
    if (!v || categories.includes(v)) {
      setCategoryInput("");
      return;
    }
    update({ categories: [...categories, v] });
    setCategoryInput("");
  };
  const removeCategory = (c: string) =>
    update({ categories: categories.filter((x) => x !== c) });

  const showMap = type !== "list";

  // Serialize everything for the action. Keep `type` on config so it stays a
  // valid discriminated union; the action re-parses this with the Zod schema.
  const payload = useMemo(
    () =>
      JSON.stringify({
        handle,
        name,
        provider,
        type,
        isPublished,
        config: { ...config, type },
      }),
    [handle, name, provider, type, isPublished, config],
  );

  const blockSnippet = `Add the Store Locator block in your theme and choose handle: ${handle}`;

  return (
    <Form method="post">
      <input type="hidden" name="payload" value={payload} />
      {mode === "edit" && widget ? (
        <input type="hidden" name="id" value={widget.id} />
      ) : (
        <input type="hidden" name="type" value={type} />
      )}

      <Layout>
        {/* ───────────────── LEFT: controls ───────────────── */}
        <Layout.Section>
          <BlockStack gap="400">
            {formError ? (
              <Banner tone="critical" title="Couldn't save widget">
                <p>{formError}</p>
              </Banner>
            ) : null}

            {/* General */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingSm">
                  General
                </Text>
                <FormLayout>
                  <TextField
                    label="Name"
                    autoComplete="off"
                    value={name}
                    onChange={setName}
                    error={fieldErrors?.name}
                    requiredIndicator
                    helpText="Internal name to help you tell widgets apart."
                  />
                  <TextField
                    label="Handle"
                    autoComplete="off"
                    value={handle}
                    onChange={(v) => setHandle(slugifyHandle(v))}
                    error={fieldErrors?.handle}
                    helpText={blockSnippet}
                    connectedRight={
                      <Button
                        icon={<Icon source={ClipboardIcon} />}
                        onClick={() =>
                          void navigator.clipboard?.writeText(handle)
                        }
                        accessibilityLabel="Copy handle"
                      >
                        Copy
                      </Button>
                    }
                  />
                  <Select
                    label="Map provider"
                    value={provider}
                    onChange={(v) => setProvider(v as "leaflet" | "google")}
                    options={Object.values(PROVIDERS).map((p) => ({
                      label: p.displayName,
                      value: p.id,
                      disabled: p.id === "google" && !canGoogle,
                    }))}
                  />
                  {!canGoogle ? (
                    <Text as="p" tone="subdued" variant="bodySm">
                      {planAllowsProvider(plan, "google")
                        ? "Add a Google Maps API key in "
                        : "Google Maps is a Premium feature. Upgrade and add a key in "}
                      <PolarisLink url="/app/settings">Settings</PolarisLink> to
                      use Google Maps.
                    </Text>
                  ) : null}
                  <Checkbox
                    label="Published"
                    checked={isPublished}
                    onChange={setIsPublished}
                    helpText="Only published widgets render on your storefront."
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Type-specific */}
            <Card>
              <BlockStack gap="300">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="h2" variant="headingSm">
                    {typeMeta.label} options
                  </Text>
                  <Badge tone="info">{typeMeta.label}</Badge>
                </InlineStack>
                {type === "map_list" ? (
                  <MapListControls config={config} update={update} />
                ) : null}
                {type === "finder" ? (
                  <FinderControls config={config} update={update} />
                ) : null}
                {type === "carousel" ? (
                  <CarouselControls config={config} update={update} />
                ) : null}
                {type === "list" ? (
                  <ListControls config={config} update={update} />
                ) : null}
                {type === "single" ? (
                  <SingleControls
                    config={config}
                    update={update}
                    locations={locations}
                    error={fieldErrors?.["config.locationId"]}
                  />
                ) : null}
              </BlockStack>
            </Card>

            {/* Map */}
            {showMap ? (
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingSm">
                    Map
                  </Text>
                  <MapPicker
                    value={center}
                    onChange={(v) => update({ defaultCenter: v })}
                    zoom={config.defaultZoom ?? 12}
                  />
                  <RangeSlider
                    label={`Default zoom: ${config.defaultZoom ?? 12}`}
                    min={1}
                    max={20}
                    value={config.defaultZoom ?? 12}
                    onChange={(v) =>
                      update({ defaultZoom: Array.isArray(v) ? v[0] : v })
                    }
                  />
                  <TextField
                    label="Search radius (km)"
                    type="number"
                    min={1}
                    max={500}
                    autoComplete="off"
                    value={String(config.searchRadiusKm ?? 25)}
                    onChange={(v) =>
                      update({ searchRadiusKm: v ? Number(v) : undefined })
                    }
                    error={fieldErrors?.["config.searchRadiusKm"]}
                  />
                </BlockStack>
              </Card>
            ) : null}

            {/* Appearance */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingSm">
                    Appearance
                  </Text>
                  {!canTheme ? <Badge tone="attention">Premium</Badge> : null}
                </InlineStack>
                {!canTheme ? (
                  <Banner tone="info">
                    <p>
                      Upgrade to Premium to customize the theme.{" "}
                      <PolarisLink url="/app/billing">View plans</PolarisLink>
                    </p>
                  </Banner>
                ) : null}
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                  <ColorField
                    label="Primary color"
                    value={theme.primaryColor ?? DEFAULT_THEME.primaryColor}
                    onChange={(v) => setTheme({ primaryColor: v })}
                    disabled={!canTheme}
                  />
                  <ColorField
                    label="Marker color"
                    value={theme.markerColor ?? DEFAULT_THEME.markerColor}
                    onChange={(v) => setTheme({ markerColor: v })}
                    disabled={!canTheme}
                  />
                  <ColorField
                    label="Background color"
                    value={
                      theme.backgroundColor ?? DEFAULT_THEME.backgroundColor
                    }
                    onChange={(v) => setTheme({ backgroundColor: v })}
                    disabled={!canTheme}
                  />
                  <ColorField
                    label="Text color"
                    value={theme.textColor ?? DEFAULT_THEME.textColor}
                    onChange={(v) => setTheme({ textColor: v })}
                    disabled={!canTheme}
                  />
                </InlineGrid>
                <Select
                  label="Font family"
                  value={theme.fontFamily ?? ""}
                  onChange={(v) => setTheme({ fontFamily: v || undefined })}
                  options={FONT_OPTIONS}
                  disabled={!canTheme}
                />
              </BlockStack>
            </Card>

            {/* Behavior */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingSm">
                  Behavior
                </Text>
                <FormLayout>
                  <Checkbox
                    label="Show opening hours"
                    checked={config.showHours ?? true}
                    onChange={(c) => update({ showHours: c })}
                  />
                  <Checkbox
                    label="Show phone number"
                    checked={config.showPhone ?? true}
                    onChange={(c) => update({ showPhone: c })}
                  />
                  <Checkbox
                    label="Show directions link"
                    checked={config.showDirections ?? true}
                    onChange={(c) => update({ showDirections: c })}
                  />
                </FormLayout>

                <Divider />

                <BlockStack gap="200">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h3" variant="headingXs">
                      Advanced
                    </Text>
                    {!canCluster && !canNearMe && !canFilters ? (
                      <Badge tone="attention">Premium</Badge>
                    ) : null}
                  </InlineStack>
                  {!canCluster || !canNearMe || !canFilters ? (
                    <Text as="p" tone="subdued" variant="bodySm">
                      Some advanced features require Premium.{" "}
                      <PolarisLink url="/app/billing">View plans</PolarisLink>
                    </Text>
                  ) : null}
                  <Checkbox
                    label="Cluster nearby markers"
                    checked={config.clustering ?? false}
                    onChange={(c) => update({ clustering: c })}
                    disabled={!canCluster}
                  />
                  <Checkbox
                    label='Enable "near me" (uses visitor location)'
                    checked={config.enableNearMe ?? false}
                    onChange={(c) => update({ enableNearMe: c })}
                    disabled={!canNearMe}
                  />
                </BlockStack>

                <Divider />

                {/* Category / filter tag manager */}
                <BlockStack gap="200">
                  <Text as="h3" variant="headingXs">
                    Filter categories
                  </Text>
                  <TextField
                    label="Add category"
                    labelHidden
                    autoComplete="off"
                    placeholder="e.g. Flagship, Outlet, Warehouse"
                    value={categoryInput}
                    onChange={setCategoryInput}
                    disabled={!canFilters}
                    connectedRight={
                      <Button onClick={addCategory} disabled={!canFilters}>
                        Add
                      </Button>
                    }
                    helpText={
                      canFilters
                        ? "Customers can filter locations by these categories."
                        : "Filtering is a Premium feature."
                    }
                  />
                  {categories.length > 0 ? (
                    <InlineStack gap="200">
                      {categories.map((c) => (
                        <Tag key={c} onRemove={() => removeCategory(c)}>
                          {c}
                        </Tag>
                      ))}
                    </InlineStack>
                  ) : null}
                </BlockStack>
              </BlockStack>
            </Card>

            <InlineStack gap="200">
              <Button submit variant="primary">
                {mode === "create" ? "Create widget" : "Save changes"}
              </Button>
              <Button url="/app/widgets">Cancel</Button>
            </InlineStack>
          </BlockStack>
        </Layout.Section>

        {/* ───────────────── RIGHT: live preview ───────────────── */}
        <Layout.Section variant="oneThird">
          <BlockStack gap="300">
            <WidgetPreview
              type={type}
              provider={provider}
              config={{ ...config, type }}
              locations={locations}
              settings={settings}
              timezone={timezone}
              typeLabel={typeMeta.label}
            />
            <Text as="p" tone="subdued" variant="bodySm">
              {typeMeta.description}
            </Text>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Form>
  );
}

// Strips characters that have no legitimate use in a CSS color value (quotes,
// angle brackets, etc.) so a pasted/typed value can't carry markup-breaking
// characters into the live preview's postMessage payload. This is UX polish
// only — the authoritative guard is `safeColor` at the render sink in
// extensions/store-locator-block/src/providers/leaflet.js.
const UNSAFE_COLOR_CHARS = /["'<>`;]/g;
function stripUnsafeColorChars(v: string): string {
  return v.replace(UNSAFE_COLOR_CHARS, "");
}

/**
 * A hex color field pairing a native color swatch with a text input, so a
 * merchant can either pick visually or paste an exact hex.
 */
function ColorField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <BlockStack gap="100">
      <Text as="span" variant="bodyMd">
        {label}
      </Text>
      <InlineStack gap="200" blockAlign="center" wrap={false}>
        <input
          type="color"
          aria-label={`${label} swatch`}
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 36,
            height: 36,
            padding: 0,
            border: "1px solid var(--p-color-border)",
            borderRadius: 6,
            background: "none",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        />
        <div style={{ flex: 1 }}>
          <TextField
            label={label}
            labelHidden
            autoComplete="off"
            value={value}
            onChange={(v) => onChange(stripUnsafeColorChars(v))}
            disabled={disabled}
          />
        </div>
      </InlineStack>
    </BlockStack>
  );
}
