import { Checkbox, FormLayout, TextField } from "@shopify/polaris";
import type { TypeControlProps } from "./types";

/** Store finder: hero height and whether to show the filter bar. */
export function FinderControls({ config, update }: TypeControlProps) {
  return (
    <FormLayout>
      <TextField
        label="Hero height (px)"
        type="number"
        min={0}
        autoComplete="off"
        value={String(config.heroHeight ?? 320)}
        onChange={(v) => update({ heroHeight: v ? Number(v) : undefined })}
        helpText="Height of the search hero above the map. Set 0 to hide it."
      />
      <Checkbox
        label="Show filter bar"
        checked={config.showFilterBar ?? true}
        onChange={(checked) => update({ showFilterBar: checked })}
        helpText="Show a row of category/service filters under the search bar."
      />
    </FormLayout>
  );
}
