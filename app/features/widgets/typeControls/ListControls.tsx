import { Checkbox, FormLayout, TextField } from "@shopify/polaris";
import type { TypeControlProps } from "./types";

/** List / grid: column count and an optional "view on map" link. */
export function ListControls({ config, update }: TypeControlProps) {
  return (
    <FormLayout>
      <TextField
        label="Columns"
        type="number"
        min={1}
        max={6}
        autoComplete="off"
        value={String(config.columns ?? 3)}
        onChange={(v) => update({ columns: v ? Number(v) : undefined })}
        helpText="Number of columns in the grid (1 renders a single-column list)."
      />
      <Checkbox
        label="Show map link"
        checked={config.showMapLink ?? true}
        onChange={(checked) => update({ showMapLink: checked })}
        helpText="Show a 'view on map' link on each location card."
      />
    </FormLayout>
  );
}
