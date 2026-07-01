import {
  Form,
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { useState } from "react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  FormLayout,
  Page,
  Select,
  TextField,
} from "@shopify/polaris";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/auth/admin.server";
import { shops, type ShopSettings } from "../lib/db/schema";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { shop } = await requireAdmin(request, context);
  return { settings: shop.settings ?? {} };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { db, shop } = await requireAdmin(request, context);
  const form = await request.formData();
  const settings: ShopSettings = {
    mapProvider: (form.get("mapProvider") as "leaflet" | "google" | null) ?? "leaflet",
    googleMapsApiKey: String(form.get("googleMapsApiKey") ?? "") || undefined,
    unitSystem: (form.get("unitSystem") as "metric" | "imperial" | null) ?? "metric",
  };
  await db
    .update(shops)
    .set({ settings, updatedAt: new Date() })
    .where(eq(shops.id, shop.id));
  return { ok: true as const };
}

export default function Settings() {
  const { settings } = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();

  const [mapProvider, setMapProvider] = useState(settings.mapProvider ?? "leaflet");
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState(
    settings.googleMapsApiKey ?? "",
  );
  const [unitSystem, setUnitSystem] = useState(settings.unitSystem ?? "metric");

  return (
    <Page title="Settings">
      <BlockStack gap="400">
        {data?.ok ? <Banner tone="success" title="Settings saved" /> : null}
        <Card>
          <Form method="post">
            <FormLayout>
              <Select
                label="Map provider"
                name="mapProvider"
                value={mapProvider}
                onChange={(v) => setMapProvider(v as "leaflet" | "google")}
                options={[
                  { label: "Leaflet + OpenStreetMap", value: "leaflet" },
                  { label: "Google Maps (API key required)", value: "google" },
                ]}
              />
              <TextField
                label="Google Maps API key"
                name="googleMapsApiKey"
                autoComplete="off"
                value={googleMapsApiKey}
                onChange={setGoogleMapsApiKey}
                helpText="Only required if you select Google Maps above."
              />
              <Select
                label="Units"
                name="unitSystem"
                value={unitSystem}
                onChange={(v) => setUnitSystem(v as "metric" | "imperial")}
                options={[
                  { label: "Metric (km)", value: "metric" },
                  { label: "Imperial (mi)", value: "imperial" },
                ]}
              />
              <Button submit variant="primary">
                Save
              </Button>
            </FormLayout>
          </Form>
        </Card>
      </BlockStack>
    </Page>
  );
}
