import type { Database } from "../lib/db/client.server";
import { newId } from "../lib/utils/slug";
import { upsertWidget } from "../repositories/widget.repository.server";
import type { WidgetInput } from "../schemas/widget.schema";
import type { WidgetType } from "../lib/db/schema";
import { planAllowsWidgetType } from "../lib/billing/plans";
import { PlanFeatureError } from "./quota.service.server";

/**
 * Server-side gate: throw unless `planHandle` may use `type`. Free is limited
 * to `map_list`; premium unlocks every widget type. Call this in the widget
 * save action BEFORE persisting — the client widget-type gallery is advisory
 * only and must never be trusted.
 */
export function assertWidgetTypeAllowed(planHandle: string, type: WidgetType): void {
  if (!planAllowsWidgetType(planHandle, type)) {
    throw new PlanFeatureError(`${type} widget`, planHandle);
  }
}

export async function saveWidget(
  db: Database,
  shopId: string,
  input: WidgetInput,
  existingId?: string,
) {
  return upsertWidget(db, {
    id: existingId ?? newId(),
    shopId,
    handle: input.handle,
    name: input.name,
    provider: input.provider,
    type: input.type,
    config: input.config,
    isPublished: input.isPublished,
  });
}
