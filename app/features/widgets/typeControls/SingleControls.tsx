import { Banner, Checkbox, FormLayout, Select } from "@shopify/polaris";
import type { TypeControlProps } from "./types";

export interface LocationOption {
  id: string;
  name: string;
}

export interface SingleControlsProps extends TypeControlProps {
  locations: LocationOption[];
  error?: string;
}

/**
 * Single location: pick which location this widget features, plus an optional
 * contact form. The location picker is populated from the shop's locations.
 */
export function SingleControls({ config, update, locations, error }: SingleControlsProps) {
  if (locations.length === 0) {
    return (
      <Banner tone="warning" title="No locations yet">
        <p>
          Add at least one location before configuring a single-location widget.
        </p>
      </Banner>
    );
  }

  const options = [
    { label: "Select a location…", value: "" },
    ...locations.map((l) => ({ label: l.name, value: l.id })),
  ];

  return (
    <FormLayout>
      <Select
        label="Location"
        value={config.locationId ?? ""}
        onChange={(v) => update({ locationId: v || undefined })}
        options={options}
        error={error}
        requiredIndicator
        helpText="The location this widget will feature."
      />
      <Checkbox
        label="Show contact form"
        checked={config.showContactForm ?? false}
        onChange={(checked) => update({ showContactForm: checked })}
        helpText="Show a simple contact form under the location details."
      />
    </FormLayout>
  );
}
