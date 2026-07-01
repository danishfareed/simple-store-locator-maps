import type { Database } from "../lib/db/client.server";
import { newId, slugify } from "../lib/utils/slug";
import {
  deleteWidget as deleteWidgetRow,
  getWidget as getWidgetRow,
  getWidgetByHandle,
  updateWidget,
  upsertWidget,
} from "../repositories/widget.repository.server";
import type { WidgetInput } from "../schemas/widget.schema";
import type { Widget, WidgetType } from "../lib/db/schema";
import { planAllowsWidgetType } from "../lib/billing/plans";
import { getActivePlanHandle } from "./billing.service.server";
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

/**
 * Find a free handle for this shop starting at `base`, appending `-2`, `-3`, …
 * until no OTHER widget owns it. `selfId` lets an edit keep its own handle.
 */
async function ensureUniqueHandle(
  db: Database,
  shopId: string,
  base: string,
  selfId?: string,
): Promise<string> {
  let handle = slugify(base);
  if (!handle) handle = newId().slice(0, 8);
  let attempt = handle;
  for (let i = 2; i < 200; i++) {
    const existing = await getWidgetByHandle(db, shopId, attempt);
    if (!existing || existing.id === selfId) return attempt;
    attempt = `${handle}-${i}`;
  }
  throw new Error("Could not generate unique widget handle");
}

/**
 * Create or update a widget. Resolves the shop's active plan and enforces
 * `assertWidgetTypeAllowed` BEFORE persisting — never trust the client widget
 * type gallery. Handle uniqueness is auto-resolved: on create, a colliding
 * handle gets `-2`, `-3`, … suffixed; on edit, the widget keeps its own
 * handle (matched via `existingId`) and only collides with OTHER widgets.
 */
export async function saveWidget(
  db: Database,
  shopId: string,
  input: WidgetInput,
  existingId?: string,
): Promise<Widget> {
  const planHandle = await getActivePlanHandle(db, shopId);
  assertWidgetTypeAllowed(planHandle, input.type);

  const handle = await ensureUniqueHandle(db, shopId, input.handle, existingId);

  if (existingId) {
    const updated = await updateWidget(db, shopId, existingId, {
      handle,
      name: input.name,
      provider: input.provider,
      type: input.type,
      config: input.config,
      isPublished: input.isPublished,
    });
    if (!updated) {
      throw new Error(`Widget not found: ${existingId}`);
    }
    return updated;
  }

  return upsertWidget(db, {
    id: newId(),
    shopId,
    handle,
    name: input.name,
    provider: input.provider,
    type: input.type,
    config: input.config,
    isPublished: input.isPublished,
  });
}

export async function getWidget(db: Database, shopId: string, id: string) {
  return getWidgetRow(db, shopId, id);
}

export async function deleteWidget(db: Database, shopId: string, id: string) {
  return deleteWidgetRow(db, shopId, id);
}

/**
 * Duplicate a widget: same type/config/provider, a fresh unique handle
 * (`<handle>-copy`, auto-suffixed on further collisions), name suffixed with
 * " (copy)", and always unpublished so the copy doesn't go live unreviewed.
 */
export async function duplicateWidget(
  db: Database,
  shopId: string,
  id: string,
): Promise<Widget> {
  const source = await getWidgetRow(db, shopId, id);
  if (!source) {
    throw new Error(`Widget not found: ${id}`);
  }

  const handle = await ensureUniqueHandle(db, shopId, `${source.handle}-copy`);

  return upsertWidget(db, {
    id: newId(),
    shopId,
    handle,
    name: `${source.name} (copy)`,
    provider: source.provider,
    type: source.type,
    config: source.config,
    isPublished: false,
  });
}
