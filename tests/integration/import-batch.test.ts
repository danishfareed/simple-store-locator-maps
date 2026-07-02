import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb } from "../helpers/db";
import { shops, imports } from "../../app/lib/db/schema";
import {
  handleImportBatch,
  ImportPermanentError,
} from "../../app/services/import.service.server";
import * as dbClient from "../../app/lib/db/client.server";
import type { CloudflareEnv, ImportJobMessage } from "../../workers/app";

/**
 * These tests exercise the queue consumer's ack/retry decision (defect #2's
 * poison-message half). We stub `getDb` to hand back the in-memory test DB and
 * a minimal R2 stub for `env.UPLOADS`.
 */

function makeMsg(body: ImportJobMessage) {
  return {
    body,
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

function makeEnv(csvText: string | null): CloudflareEnv {
  const uploads = {
    get: vi.fn(async () =>
      csvText == null ? null : ({ text: async () => csvText } as unknown),
    ),
  };
  return { UPLOADS: uploads, DB: {} } as unknown as CloudflareEnv;
}

async function seed(db: Awaited<ReturnType<typeof makeTestDb>>, shopId: string) {
  const now = new Date();
  await db.insert(shops).values({
    id: shopId,
    shopDomain: `${shopId}.myshopify.com`,
    planHandle: "premium",
    installedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

describe("handleImportBatch — retry vs ack (defect #2)", () => {
  it("acks (does NOT retry) a valid CSV job and marks it completed", async () => {
    const db = await makeTestDb();
    await seed(db, "sb1");
    await db.insert(imports).values({
      id: "impb1",
      shopId: "sb1",
      filename: "t.csv",
      r2Key: "k",
      kind: "csv",
      status: "pending",
    });
    vi.spyOn(dbClient, "getDb").mockReturnValue(db);

    const env = makeEnv("name\nStore One\nStore Two");
    const msg = makeMsg({ shop: "sb1", importId: "impb1", r2Key: "k", kind: "csv" });
    await handleImportBatch(
      { messages: [msg] } as never,
      env,
      {} as ExecutionContext,
    );

    expect(msg.ack).toHaveBeenCalledTimes(1);
    expect(msg.retry).not.toHaveBeenCalled();
    const imp = await db.select().from(imports).where(eq(imports.id, "impb1")).get();
    expect(imp?.status).toBe("completed");
    vi.restoreAllMocks();
  });

  it("RETRIES a transient failure (missing R2 object)", async () => {
    const db = await makeTestDb();
    await seed(db, "sb2");
    await db.insert(imports).values({
      id: "impb2",
      shopId: "sb2",
      filename: "t.csv",
      r2Key: "missing",
      kind: "csv",
      status: "pending",
    });
    vi.spyOn(dbClient, "getDb").mockReturnValue(db);

    const env = makeEnv(null); // R2 get returns null → transient
    const msg = makeMsg({ shop: "sb2", importId: "impb2", r2Key: "missing", kind: "csv" });
    await handleImportBatch(
      { messages: [msg] } as never,
      env,
      {} as ExecutionContext,
    );

    expect(msg.retry).toHaveBeenCalledTimes(1);
    expect(msg.ack).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("ACKS (does NOT retry) a permanent failure — no poison-message loop", async () => {
    const db = await makeTestDb();
    await seed(db, "sb3");
    await db.insert(imports).values({
      id: "impb3",
      shopId: "sb3",
      filename: "t.csv",
      r2Key: "k",
      kind: "csv",
      status: "pending",
    });
    vi.spyOn(dbClient, "getDb").mockReturnValue(db);

    // Force a deterministic (permanent) throw from inside processing (R2 read).
    const env = {
      DB: {},
      UPLOADS: {
        get: vi.fn(async () => {
          throw new ImportPermanentError("deterministic boom");
        }),
      },
    } as unknown as CloudflareEnv;
    const msg = makeMsg({ shop: "sb3", importId: "impb3", r2Key: "k", kind: "csv" });
    await handleImportBatch(
      { messages: [msg] } as never,
      env,
      {} as ExecutionContext,
    );

    // Permanent → ack, never retry (would loop forever otherwise).
    expect(msg.ack).toHaveBeenCalledTimes(1);
    expect(msg.retry).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
