import type { Database } from "../lib/db/client.server";
import { newId } from "../lib/utils/slug";
import { upsertWidget } from "../repositories/widget.repository.server";
import type { WidgetInput } from "../schemas/widget.schema";

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
    config: input.config,
    isPublished: input.isPublished,
  });
}
