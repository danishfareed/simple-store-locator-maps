import type { Database } from "../../lib/db/client.server";
import { WidgetInputSchema } from "../../schemas/widget.schema";
import { saveWidget } from "../../services/widget.service.server";
import { PlanFeatureError } from "../../services/quota.service.server";

export type WidgetEditorActionResult =
  | { ok: false; fieldErrors?: Record<string, string>; formError?: string }
  | { ok: true; id: string };

/** Recursively drop keys whose value is empty string, null, or undefined. */
function pruneEmpty<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => pruneEmpty(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === "" || v === null || v === undefined) continue;
      const pruned = pruneEmpty(v);
      // Drop empty objects that resulted from pruning (e.g. an all-blank theme).
      if (
        pruned &&
        typeof pruned === "object" &&
        !Array.isArray(pruned) &&
        Object.keys(pruned).length === 0
      ) {
        continue;
      }
      out[k] = pruned;
    }
    return out as T;
  }
  return value;
}

/**
 * Shared save path for both widget editor routes. Parses the single hidden
 * `payload` JSON field, validates with `WidgetInputSchema`, and calls
 * `saveWidget` (which enforces plan gating). Returns inline field errors on
 * validation failure and a `formError` on `PlanFeatureError`.
 */
export async function handleWidgetSave(
  db: Database,
  shopId: string,
  form: FormData,
): Promise<WidgetEditorActionResult> {
  const raw = form.get("payload");
  if (typeof raw !== "string") {
    return { ok: false, formError: "Missing form data. Please try again." };
  }

  let parsedJson: unknown;
  try {
    parsedJson = pruneEmpty(JSON.parse(raw));
  } catch {
    return { ok: false, formError: "Malformed form data. Please try again." };
  }

  const parsed = WidgetInputSchema.safeParse(parsedJson);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, fieldErrors };
  }

  const existingId = form.get("id");
  try {
    const widget = await saveWidget(
      db,
      shopId,
      parsed.data,
      typeof existingId === "string" && existingId ? existingId : undefined,
    );
    return { ok: true, id: widget.id };
  } catch (err) {
    if (err instanceof PlanFeatureError) {
      return { ok: false, formError: err.message };
    }
    throw err;
  }
}
