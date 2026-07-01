import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/db";
import { shops } from "../../app/lib/db/schema";
import { handleWidgetSave } from "../../app/features/widgets/widget-editor.server";
import { listWidgets, getWidget } from "../../app/repositories/widget.repository.server";

async function seedShop(id: string, planHandle: "free" | "premium" = "free") {
  const db = await makeTestDb();
  const now = new Date();
  await db.insert(shops).values({
    id,
    shopDomain: `${id}.myshopify.com`,
    planHandle,
    installedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  return db;
}

/** Build the single-field FormData the editor submits. */
function form(payload: unknown, extra: Record<string, string> = {}): FormData {
  const f = new FormData();
  f.set("payload", JSON.stringify(payload));
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return f;
}

const mapListPayload = {
  handle: "store-map",
  name: "Store Map",
  provider: "leaflet",
  type: "map_list",
  isPublished: true,
  config: { type: "map_list", sidebarPosition: "left", resultsPerPage: 10 },
};

describe("handleWidgetSave", () => {
  it("creates a valid map_list widget and persists it", async () => {
    const db = await seedShop("s1");
    const result = await handleWidgetSave(db, "s1", form(mapListPayload));
    expect(result.ok).toBe(true);
    const rows = await listWidgets(db, "s1");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Store Map");
    expect(rows[0]?.isPublished).toBe(true);
  });

  it("prunes empty strings so a blank theme doesn't fail hex validation", async () => {
    const db = await seedShop("s2", "premium");
    const payload = {
      ...mapListPayload,
      config: {
        type: "map_list",
        theme: {
          primaryColor: "#008060",
          markerColor: "",
          backgroundColor: "",
          textColor: "",
          fontFamily: "",
        },
        defaultCenter: { lat: 40.7, lng: -74 },
        defaultZoom: 12,
      },
    };
    const result = await handleWidgetSave(db, "s2", form(payload));
    expect(result.ok).toBe(true);
    const rows = await listWidgets(db, "s2");
    expect(rows[0]?.config.theme?.primaryColor).toBe("#008060");
    // Blank fields were pruned, not stored as invalid empty strings.
    expect(rows[0]?.config.theme?.markerColor).toBeUndefined();
  });

  it("returns a formError (not a throw) when the plan can't use the type", async () => {
    const db = await seedShop("s3", "free");
    const payload = {
      handle: "finder",
      name: "Finder",
      provider: "leaflet",
      type: "finder",
      isPublished: false,
      config: { type: "finder", showFilterBar: true },
    };
    const result = await handleWidgetSave(db, "s3", form(payload));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.formError).toBeTruthy();
    expect(await listWidgets(db, "s3")).toHaveLength(0);
  });

  it("returns an inline field error for a single widget with no location", async () => {
    const db = await seedShop("s4", "premium");
    const payload = {
      handle: "single",
      name: "Single",
      provider: "leaflet",
      type: "single",
      isPublished: false,
      config: { type: "single", locationId: "" },
    };
    const result = await handleWidgetSave(db, "s4", form(payload));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors).toBeDefined();
      expect(Object.keys(result.fieldErrors ?? {}).join()).toContain("locationId");
    }
  });

  it("updates an existing widget when an id is supplied", async () => {
    const db = await seedShop("s5");
    const created = await handleWidgetSave(db, "s5", form(mapListPayload));
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = await handleWidgetSave(
      db,
      "s5",
      form({ ...mapListPayload, name: "Renamed" }, { id: created.id }),
    );
    expect(updated.ok).toBe(true);
    const row = await getWidget(db, "s5", created.id);
    expect(row?.name).toBe("Renamed");
    // Still a single widget — updated in place, not duplicated.
    expect(await listWidgets(db, "s5")).toHaveLength(1);
  });

  it("rejects malformed payloads gracefully", async () => {
    const db = await seedShop("s6");
    const f = new FormData();
    f.set("payload", "{not json");
    const result = await handleWidgetSave(db, "s6", f);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.formError).toBeTruthy();
  });
});
