import type { WidgetConfig } from "../../../lib/db/schema";

/**
 * Shared prop shape for every per-type control group. Each control reads the
 * fields it cares about off `config` and reports edits via `update`, a shallow
 * partial-merge into the parent editor's config state.
 */
export interface TypeControlProps {
  config: WidgetConfig;
  update: (patch: Partial<WidgetConfig>) => void;
}
