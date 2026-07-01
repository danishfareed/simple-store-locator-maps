import { FormLayout, Select, TextField } from "@shopify/polaris";
import type { TypeControlProps } from "./types";

/** Map + list: sidebar side and results-per-page. */
export function MapListControls({ config, update }: TypeControlProps) {
  return (
    <FormLayout>
      <Select
        label="Sidebar position"
        value={config.sidebarPosition ?? "left"}
        onChange={(v) => update({ sidebarPosition: v as "left" | "right" })}
        options={[
          { label: "Left of map", value: "left" },
          { label: "Right of map", value: "right" },
        ]}
      />
      <TextField
        label="Results per page"
        type="number"
        min={1}
        max={100}
        autoComplete="off"
        value={String(config.resultsPerPage ?? 10)}
        onChange={(v) => update({ resultsPerPage: v ? Number(v) : undefined })}
        helpText="How many locations to show in the list before paginating."
      />
    </FormLayout>
  );
}
