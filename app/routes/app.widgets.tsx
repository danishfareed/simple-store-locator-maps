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
  Card,
  Checkbox,
  FormLayout,
  Page,
  Select,
  TextField,
  Button,
} from "@shopify/polaris";
import { requireAdmin } from "../lib/auth/admin.server";
import { listWidgets } from "../repositories/widget.repository.server";
import { WidgetInputSchema, type WidgetType } from "../schemas/widget.schema";
import { assertWidgetTypeAllowed, saveWidget } from "../services/widget.service.server";
import { getActivePlanHandle } from "../services/billing.service.server";
import { PlanFeatureError } from "../services/quota.service.server";
import { PROVIDERS } from "../features/providers/providers";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { db, shop } = await requireAdmin(request, context);
  const widgets = await listWidgets(db, shop.id);
  const widget = widgets[0] ?? null;
  return { widget };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { db, shop } = await requireAdmin(request, context);
  const form = await request.formData();

  const type = (String(form.get("type") ?? "map_list") as WidgetType);
  const payload = {
    handle: String(form.get("handle") ?? "default"),
    name: String(form.get("name") ?? "Default widget"),
    provider: (form.get("provider") ?? "leaflet") as "leaflet" | "google",
    type,
    isPublished: form.get("isPublished") === "on",
    config: {
      type,
      defaultCenter:
        form.get("lat") && form.get("lng")
          ? { lat: Number(form.get("lat")), lng: Number(form.get("lng")) }
          : undefined,
      defaultZoom: form.get("zoom") ? Number(form.get("zoom")) : undefined,
      searchRadiusKm: form.get("radius") ? Number(form.get("radius")) : undefined,
      showHours: form.get("showHours") === "on",
      showPhone: form.get("showPhone") === "on",
      showDirections: form.get("showDirections") === "on",
    },
  };

  const parsed = WidgetInputSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }

  // Server-side plan gating: free is limited to map_list. Never trust the
  // client's widget-type selection.
  const planHandle = await getActivePlanHandle(db, shop.id);
  try {
    assertWidgetTypeAllowed(planHandle, parsed.data.type);
  } catch (err) {
    if (err instanceof PlanFeatureError) {
      return { ok: false as const, error: err.message };
    }
    throw err;
  }

  const id = form.get("id") ? String(form.get("id")) : undefined;
  await saveWidget(db, shop.id, parsed.data, id);
  return { ok: true as const };
}

export default function Widgets() {
  const { widget } = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();

  const [handle, setHandle] = useState(widget?.handle ?? "default");
  const [name, setName] = useState(widget?.name ?? "Default widget");
  const [provider, setProvider] = useState(widget?.provider ?? "leaflet");
  const [lat, setLat] = useState(String(widget?.config?.defaultCenter?.lat ?? ""));
  const [lng, setLng] = useState(String(widget?.config?.defaultCenter?.lng ?? ""));
  const [zoom, setZoom] = useState(String(widget?.config?.defaultZoom ?? 10));
  const [radius, setRadius] = useState(String(widget?.config?.searchRadiusKm ?? 25));
  const [showHours, setShowHours] = useState(widget?.config?.showHours ?? true);
  const [showPhone, setShowPhone] = useState(widget?.config?.showPhone ?? true);
  const [showDirections, setShowDirections] = useState(
    widget?.config?.showDirections ?? true,
  );
  const [isPublished, setIsPublished] = useState(widget?.isPublished ?? false);

  return (
    <Page title="Widget">
      <BlockStack gap="400">
        {data?.ok ? <Banner tone="success" title="Widget saved" /> : null}
        <Card>
          <Form method="post">
            <FormLayout>
              {widget ? <input type="hidden" name="id" value={widget.id} /> : null}
              <FormLayout.Group>
                <TextField
                  label="Handle"
                  name="handle"
                  value={handle}
                  onChange={setHandle}
                  autoComplete="off"
                />
                <TextField
                  label="Name"
                  name="name"
                  value={name}
                  onChange={setName}
                  autoComplete="off"
                />
              </FormLayout.Group>
              <Select
                label="Map provider"
                name="provider"
                value={provider}
                onChange={(v) => setProvider(v as "leaflet" | "google")}
                options={Object.values(PROVIDERS).map((p) => ({
                  value: p.id,
                  label: p.displayName,
                }))}
              />
              <FormLayout.Group>
                <TextField
                  label="Default latitude"
                  name="lat"
                  type="number"
                  step={0.001}
                  value={lat}
                  onChange={setLat}
                  autoComplete="off"
                />
                <TextField
                  label="Default longitude"
                  name="lng"
                  type="number"
                  step={0.001}
                  value={lng}
                  onChange={setLng}
                  autoComplete="off"
                />
              </FormLayout.Group>
              <FormLayout.Group>
                <TextField
                  label="Default zoom"
                  name="zoom"
                  type="number"
                  value={zoom}
                  onChange={setZoom}
                  autoComplete="off"
                />
                <TextField
                  label="Search radius (km)"
                  name="radius"
                  type="number"
                  value={radius}
                  onChange={setRadius}
                  autoComplete="off"
                />
              </FormLayout.Group>
              <Checkbox
                label="Show hours"
                name="showHours"
                checked={showHours}
                onChange={setShowHours}
              />
              <Checkbox
                label="Show phone"
                name="showPhone"
                checked={showPhone}
                onChange={setShowPhone}
              />
              <Checkbox
                label="Show directions link"
                name="showDirections"
                checked={showDirections}
                onChange={setShowDirections}
              />
              <Checkbox
                label="Published"
                name="isPublished"
                checked={isPublished}
                onChange={setIsPublished}
              />
              <Button submit variant="primary">
                Save widget
              </Button>
            </FormLayout>
          </Form>
        </Card>
      </BlockStack>
    </Page>
  );
}
