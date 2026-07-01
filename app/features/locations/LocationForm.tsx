import { Form } from "react-router";
import { useMemo, useState } from "react";
import {
  BlockStack,
  Button,
  Card,
  FormLayout,
  InlineGrid,
  Select,
  TextField,
  Text,
} from "@shopify/polaris";
import type { Location, LocationHours } from "../../lib/db/schema";
import { MapPicker } from "./MapPicker";
import type { LatLng } from "./LeafletMapPicker";
import { HoursEditor, emptyHours } from "./HoursEditor";

export interface LocationFormProps {
  defaultValues?: Partial<Location>;
  fieldErrors?: Record<string, string>;
  submitLabel?: string;
}

type FormShape = Record<string, string>;

const FIELDS = [
  "name",
  "slug",
  "status",
  "description",
  "addressLine1",
  "addressLine2",
  "city",
  "region",
  "postalCode",
  "countryCode",
  "latitude",
  "longitude",
  "phone",
  "email",
  "website",
  "imageUrl",
] as const;

export function LocationForm({
  defaultValues,
  fieldErrors,
  submitLabel = "Save",
}: LocationFormProps) {
  const [vals, setVals] = useState<FormShape>(() => {
    const d = defaultValues ?? {};
    const out: FormShape = {};
    for (const k of FIELDS) {
      const raw = (d as Record<string, unknown>)[k];
      out[k] = raw == null ? "" : String(raw);
    }
    if (!out.status) out.status = "active";
    return out;
  });

  const [hours, setHours] = useState<LocationHours>(
    () => defaultValues?.hours ?? emptyHours(),
  );

  const bind = (name: (typeof FIELDS)[number]) => ({
    name,
    value: vals[name] ?? "",
    onChange: (value: string) => setVals((s) => ({ ...s, [name]: value })),
  });

  const pin: LatLng | null =
    vals.latitude && vals.longitude
      ? { lat: Number(vals.latitude), lng: Number(vals.longitude) }
      : null;

  function setPin(next: LatLng) {
    setVals((s) => ({
      ...s,
      latitude: String(next.lat),
      longitude: String(next.lng),
    }));
  }

  // Prefills MapPicker's "Use address" search with the address currently on
  // the form, so the merchant doesn't have to retype it to geocode.
  const addressQuery = useMemo(
    () =>
      [vals.addressLine1, vals.city, vals.region, vals.postalCode, vals.countryCode]
        .filter(Boolean)
        .join(", "),
    [vals.addressLine1, vals.city, vals.region, vals.postalCode, vals.countryCode],
  );

  return (
    <Form method="post">
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingSm">
              Details
            </Text>
            <FormLayout>
              <TextField
                label="Name"
                autoComplete="off"
                error={fieldErrors?.name}
                requiredIndicator
                {...bind("name")}
              />
              <TextField
                label="Slug"
                autoComplete="off"
                helpText="Leave blank to auto-generate from name"
                error={fieldErrors?.slug}
                {...bind("slug")}
              />
              <Select
                label="Status"
                name="status"
                value={vals.status ?? "active"}
                onChange={(v) => setVals((s) => ({ ...s, status: v }))}
                options={[
                  { label: "Active", value: "active" },
                  { label: "Inactive", value: "inactive" },
                  { label: "Draft", value: "draft" },
                ]}
              />
              <TextField
                label="Description"
                multiline={3}
                autoComplete="off"
                {...bind("description")}
              />
            </FormLayout>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingSm">
              Address
            </Text>
            <FormLayout>
              <TextField
                label="Address line 1"
                autoComplete="address-line1"
                {...bind("addressLine1")}
              />
              <TextField
                label="Address line 2"
                autoComplete="address-line2"
                {...bind("addressLine2")}
              />
              <FormLayout.Group>
                <TextField
                  label="City"
                  autoComplete="address-level2"
                  {...bind("city")}
                />
                <TextField
                  label="Region / State"
                  autoComplete="address-level1"
                  {...bind("region")}
                />
              </FormLayout.Group>
              <FormLayout.Group>
                <TextField
                  label="Postal code"
                  autoComplete="postal-code"
                  {...bind("postalCode")}
                />
                <TextField
                  label="Country code"
                  autoComplete="country"
                  maxLength={2}
                  helpText="ISO 3166-1 alpha-2"
                  {...bind("countryCode")}
                />
              </FormLayout.Group>
              <FormLayout.Group>
                <TextField
                  label="Latitude"
                  type="number"
                  step={0.000001}
                  autoComplete="off"
                  error={fieldErrors?.latitude}
                  {...bind("latitude")}
                />
                <TextField
                  label="Longitude"
                  type="number"
                  step={0.000001}
                  autoComplete="off"
                  error={fieldErrors?.longitude}
                  {...bind("longitude")}
                />
              </FormLayout.Group>
            </FormLayout>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingSm">
              Map location
            </Text>
            <Text as="p" tone="subdued">
              Click the map to drop a pin, or search the address above to geocode it.
            </Text>
            <MapPicker value={pin} onChange={setPin} initialAddress={addressQuery} />
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingSm">
              Hours
            </Text>
            <Text as="p" tone="subdued">
              Set opening and closing times for each day, or mark a day closed.
            </Text>
            <HoursEditor value={hours} onChange={setHours} />
            <input type="hidden" name="hours" value={JSON.stringify(hours)} />
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingSm">
              Contact
            </Text>
            <FormLayout>
              <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                <TextField
                  label="Phone"
                  autoComplete="tel"
                  {...bind("phone")}
                />
                <TextField
                  label="Email"
                  type="email"
                  autoComplete="email"
                  {...bind("email")}
                />
              </InlineGrid>
              <TextField
                label="Website"
                type="url"
                autoComplete="url"
                {...bind("website")}
              />
              <TextField
                label="Image URL"
                type="url"
                autoComplete="off"
                {...bind("imageUrl")}
              />
            </FormLayout>
          </BlockStack>
        </Card>

        <InlineGrid columns={{ xs: 1, sm: 2 }} gap="200">
          <Button submit variant="primary">
            {submitLabel}
          </Button>
        </InlineGrid>
      </BlockStack>
    </Form>
  );
}
