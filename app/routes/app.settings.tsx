import { useEffect, useState } from "react";
import {
  Form,
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import {
  BlockStack,
  Button,
  Card,
  FormLayout,
  InlineGrid,
  Link,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { requireAdmin } from "../lib/auth/admin.server";
import { getSettings, saveSettings } from "../services/settings.service.server";
import { getActivePlanHandle } from "../services/billing.service.server";
import { SettingsSchema } from "../schemas/settings.schema";
import { MapPicker } from "../features/locations/MapPicker";
import type { LatLng } from "../features/locations/LeafletMapPicker";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { db, shop } = await requireAdmin(request, context);
  const [settings, plan] = await Promise.all([
    getSettings(db, shop.id),
    getActivePlanHandle(db, shop.id),
  ]);
  return { settings, plan };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { db, shop } = await requireAdmin(request, context);
  const form = await request.formData();

  const raw = normaliseForm(form);
  const parsed = SettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, fieldErrors: flattenZod(parsed.error) };
  }

  await saveSettings(db, shop.id, parsed.data);
  return { ok: true as const };
}

function normaliseForm(form: FormData): Record<string, unknown> {
  const get = (k: string) => {
    const v = form.get(k);
    return v === "" || v == null ? undefined : String(v);
  };
  const num = (k: string) => {
    const v = get(k);
    return v === undefined ? undefined : Number(v);
  };

  const primaryColor = get("primaryColor");
  const logoUrl = get("logoUrl");
  const branding =
    primaryColor || logoUrl ? { primaryColor, logoUrl } : undefined;

  return {
    mapProvider: get("mapProvider"),
    googleMapsApiKey: get("googleMapsApiKey"),
    defaultLatitude: num("defaultLatitude"),
    defaultLongitude: num("defaultLongitude"),
    defaultZoom: num("defaultZoom"),
    unitSystem: get("unitSystem"),
    branding,
    osmGeocoderUrl: get("osmGeocoderUrl"),
  };
}

function flattenZod(err: { issues: { path: (string | number)[]; message: string }[] }) {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

export default function Settings() {
  const { settings, plan } = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();
  const shopify = useAppBridge();

  const [mapProvider, setMapProvider] = useState(settings.mapProvider ?? "leaflet");
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState(settings.googleMapsApiKey ?? "");
  const [unitSystem, setUnitSystem] = useState(settings.unitSystem ?? "metric");
  const [primaryColor, setPrimaryColor] = useState(settings.branding?.primaryColor ?? "");
  const [logoUrl, setLogoUrl] = useState(settings.branding?.logoUrl ?? "");
  const [defaultZoom, setDefaultZoom] = useState(String(settings.defaultZoom ?? 12));
  const [center, setCenter] = useState<LatLng | null>(
    settings.defaultLatitude != null && settings.defaultLongitude != null
      ? { lat: settings.defaultLatitude, lng: settings.defaultLongitude }
      : null,
  );
  const [osmGeocoderUrl, setOsmGeocoderUrl] = useState(settings.osmGeocoderUrl ?? "");

  const fieldErrors = data && "fieldErrors" in data ? data.fieldErrors : undefined;
  const isPremium = plan === "premium";

  useEffect(() => {
    if (data?.ok) {
      shopify.toast?.show("Settings saved");
    }
  }, [data, shopify]);

  return (
    <Page title="Settings" subtitle="Map provider, defaults, and branding for your store locator.">
      <Form method="post">
        <BlockStack gap="400">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Map provider
              </Text>
              <FormLayout>
                <Select
                  label="Provider"
                  name="mapProvider"
                  value={mapProvider}
                  onChange={(v) => setMapProvider(v as "leaflet" | "google")}
                  options={[
                    { label: "Leaflet + OpenStreetMap (free)", value: "leaflet" },
                    {
                      label: isPremium ? "Google Maps" : "Google Maps (premium)",
                      value: "google",
                      disabled: !isPremium,
                    },
                  ]}
                  error={fieldErrors?.mapProvider}
                />
                <TextField
                  label="Google Maps API key"
                  name="googleMapsApiKey"
                  autoComplete="off"
                  value={googleMapsApiKey}
                  onChange={setGoogleMapsApiKey}
                  disabled={!isPremium}
                  error={fieldErrors?.googleMapsApiKey}
                  helpText={
                    isPremium
                      ? "Only used when the provider above is Google Maps."
                      : "Google Maps is a premium feature — upgrade to unlock it."
                  }
                />
                <Text as="p" tone="subdued" variant="bodySm">
                  For security, restrict this key by HTTP referrer in the Google Cloud
                  Console to your shop's domains (your *.myshopify.com domain and any
                  custom domain). An unrestricted key can be used by anyone who finds it
                  in your storefront's page source.
                </Text>
                {!isPremium ? (
                  <Text as="p" tone="subdued" variant="bodySm">
                    <Link url="/app/billing">Upgrade to premium</Link> to use Google Maps.
                  </Text>
                ) : null}
              </FormLayout>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Defaults
              </Text>
              <FormLayout>
                <Select
                  label="Unit system"
                  name="unitSystem"
                  value={unitSystem}
                  onChange={(v) => setUnitSystem(v as "metric" | "imperial")}
                  options={[
                    { label: "Metric (km)", value: "metric" },
                    { label: "Imperial (mi)", value: "imperial" },
                  ]}
                  error={fieldErrors?.unitSystem}
                />
                <Text as="p" tone="subdued">
                  The default map center is used to position widgets before a shopper
                  searches or shares their location.
                </Text>
                <MapPicker value={center} onChange={setCenter} zoom={Number(defaultZoom) || 12} />
                <input
                  type="hidden"
                  name="defaultLatitude"
                  value={center ? String(center.lat) : ""}
                />
                <input
                  type="hidden"
                  name="defaultLongitude"
                  value={center ? String(center.lng) : ""}
                />
                <TextField
                  label="Default zoom"
                  name="defaultZoom"
                  type="number"
                  min={1}
                  max={20}
                  autoComplete="off"
                  value={defaultZoom}
                  onChange={setDefaultZoom}
                  error={fieldErrors?.defaultZoom}
                  helpText="1 (whole world) to 20 (building level)."
                />
              </FormLayout>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Branding
              </Text>
              <FormLayout>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                  <TextField
                    label="Primary color"
                    name="primaryColor"
                    autoComplete="off"
                    placeholder="#008060"
                    value={primaryColor}
                    onChange={setPrimaryColor}
                    error={fieldErrors?.["branding.primaryColor"]}
                    helpText="Hex color, e.g. #008060"
                  />
                  <TextField
                    label="Logo URL"
                    name="logoUrl"
                    type="url"
                    autoComplete="off"
                    value={logoUrl}
                    onChange={setLogoUrl}
                    error={fieldErrors?.["branding.logoUrl"]}
                  />
                </InlineGrid>
              </FormLayout>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Advanced
              </Text>
              <FormLayout>
                <TextField
                  label="Custom OSM geocoder URL"
                  name="osmGeocoderUrl"
                  type="url"
                  autoComplete="off"
                  value={osmGeocoderUrl}
                  onChange={setOsmGeocoderUrl}
                  error={fieldErrors?.osmGeocoderUrl}
                  helpText="Optional. Point address geocoding at your own Nominatim-compatible
                  instance instead of the public OpenStreetMap service — useful for high
                  volume or custom rate limits. Leave blank to use the public service."
                />
              </FormLayout>
            </BlockStack>
          </Card>

          <InlineGrid columns={{ xs: 1, sm: 2 }} gap="200">
            <Button submit variant="primary">
              Save
            </Button>
          </InlineGrid>
        </BlockStack>
      </Form>
    </Page>
  );
}
