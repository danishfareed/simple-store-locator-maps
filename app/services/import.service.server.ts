import { sql } from "drizzle-orm";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { getDb, type Database } from "../lib/db/client.server";
import { newId, slugify } from "../lib/utils/slug";
import {
  locations,
  shops as shopsTable,
  type ImportError,
  type NewLocation,
} from "../lib/db/schema";
import {
  createImport,
  updateImportStatus,
} from "../repositories/import.repository.server";
import {
  countLocations,
  getShopSlugs,
  getShopExternalIds,
} from "../repositories/location.repository.server";
import {
  assertImportQuota,
  getPlanForShop,
  PlanFeatureError,
} from "./quota.service.server";
import { planAllowsImportKind } from "../lib/billing/plans";
import {
  blankToUndefined,
  IMPORT_COLUMN_ALIASES,
  ImportRowSchema,
  ImportUploadSchema,
  type ImportRow,
} from "../schemas/import.schema";
import type {
  CloudflareEnv,
  ImportJobMessage,
} from "../../workers/app";

const MAX_BATCH = 100;

/**
 * A DETERMINISTIC import failure — bad file, all rows invalid, a constraint we
 * cannot satisfy by retrying. The queue consumer must NOT `msg.retry()` on
 * these (retrying replays the same failure forever — a poison message). Only
 * transient/unknown errors are retried. See `handleImportBatch`.
 */
export class ImportPermanentError extends Error {
  readonly retryable = false as const;
  constructor(message: string) {
    super(message);
    this.name = "ImportPermanentError";
  }
}

/**
 * Server-side gate: throw unless `planHandle` may run an import of `kind`. Free
 * is CSV-only; premium adds XLSX. Enforced in `enqueueImport` below.
 */
export function assertImportKindAllowed(
  planHandle: string,
  kind: "csv" | "xlsx",
): void {
  if (!planAllowsImportKind(planHandle, kind)) {
    throw new PlanFeatureError(`${kind.toUpperCase()} import`, planHandle);
  }
}

/** Kick off an import: persist row, stream file to R2, enqueue the worker job. */
export async function enqueueImport(
  env: CloudflareEnv,
  shopId: string,
  file: { name: string; contentType: string; stream: ReadableStream; size: number },
): Promise<{ importId: string }> {
  ImportUploadSchema.parse({
    filename: file.name,
    sizeBytes: file.size,
    contentType: file.contentType,
  });

  const db = getDb(env.DB);

  const kind: "csv" | "xlsx" = file.name.toLowerCase().endsWith(".xlsx") ? "xlsx" : "csv";
  const plan = await getPlanForShop(db, shopId);
  assertImportKindAllowed(plan.handle, kind);

  await assertImportQuota(db, shopId);

  // The per-plan location cap is enforced authoritatively in the worker
  // (`runImport`) using net-new accounting, so update-only re-imports at full
  // capacity are still accepted. We intentionally do NOT hard-block on the
  // current count here — a blanket full-cap gate wrongly rejects imports that
  // only update existing locations. Overflow net-new rows are reported as
  // per-row errors by the worker.

  const importId = newId();
  const r2Key = `imports/${shopId}/${importId}/${sanitize(file.name)}`;

  await env.UPLOADS.put(r2Key, file.stream, {
    httpMetadata: { contentType: file.contentType },
    customMetadata: { shopId, importId, filename: file.name },
  });

  await createImport(db, {
    id: importId,
    shopId,
    filename: file.name,
    r2Key,
    kind,
    status: "pending",
  });

  await env.IMPORT_QUEUE.send({ shop: shopId, importId, r2Key, kind });

  return { importId };
}

/** Queue consumer entry — invoked by the Worker's `queue` handler. */
export async function handleImportBatch(
  batch: MessageBatch<ImportJobMessage>,
  env: CloudflareEnv,
  _ctx: ExecutionContext,
): Promise<void> {
  for (const msg of batch.messages) {
    try {
      await processImportJob(msg.body, env);
      msg.ack();
    } catch (err) {
      const permanent = isPermanent(err);
      console.error("import.job.failed", {
        importId: msg.body.importId,
        permanent,
        err,
      });
      const db = getDb(env.DB);
      await updateImportStatus(db, msg.body.importId, {
        status: "failed",
        completedAt: new Date(),
        errorSummary: [
          { row: 0, message: err instanceof Error ? err.message : "unknown" },
        ],
      });
      // Defect #2: only retry transient/unknown errors. A deterministic failure
      // (bad file, constraint we cannot satisfy) would retry forever — a poison
      // message — so we ack it as permanently failed instead.
      if (permanent) {
        msg.ack();
      } else {
        msg.retry();
      }
    }
  }
}

/** True if `err` is a known-deterministic failure that must not be retried. */
function isPermanent(err: unknown): boolean {
  return (
    err instanceof ImportPermanentError ||
    err instanceof PlanFeatureError ||
    (typeof err === "object" &&
      err !== null &&
      "retryable" in err &&
      (err as { retryable?: unknown }).retryable === false)
  );
}

async function processImportJob(job: ImportJobMessage, env: CloudflareEnv) {
  const db = getDb(env.DB);
  await updateImportStatus(db, job.importId, {
    status: "processing",
    startedAt: new Date(),
  });

  const object = await env.UPLOADS.get(job.r2Key);
  // A missing R2 object is transient-ish (eventual consistency / replication);
  // let it retry rather than permanently fail the job.
  if (!object) throw new Error(`R2 object missing: ${job.r2Key}`);

  const rows = job.kind === "csv"
    ? await parseCsv(object)
    : await parseXlsx(object);

  await runImport(db, job.shop, job.importId, rows);
}

/**
 * Validate, cap-enforce, de-collide slugs, and upsert a set of parsed rows for a
 * shop, then finalise the import job's status/counters. Exported so it can be
 * driven directly (with an in-memory DB) in tests without R2/queue plumbing.
 *
 * Contract:
 *  - `failedRows` counts invalid ROWS (once each), while `errorSummary` holds
 *    per-issue detail (defect #5); `processed + failed == totalRows`.
 *  - The plan's `maxLocations` cap is enforced on NET-NEW rows only — rows whose
 *    `externalId` matches an existing location upsert and don't count (defect #1).
 *  - Slugs are made unique within the shop before insert (defect #2).
 *  - A bad row records a per-row error instead of aborting the chunk (defect #2).
 *  - Deterministic, whole-job failures throw `ImportPermanentError` so the queue
 *    consumer acks rather than looping forever (defect #2).
 */
export async function runImport(
  db: Database,
  shopId: string,
  importId: string,
  rawRows: Record<string, unknown>[],
): Promise<void> {
  const totalRows = rawRows.length;
  const errors: ImportError[] = [];
  let failedRows = 0;
  const accepted: ImportRow[] = [];

  rawRows.forEach((raw, i) => {
    const parsed = ImportRowSchema.safeParse(normaliseRow(raw));
    if (!parsed.success) {
      // Defect #5: count the ROW once, but keep per-issue detail in errorSummary.
      failedRows += 1;
      for (const issue of parsed.error.issues) {
        errors.push({
          row: i + 2, // +1 for header, +1 for 1-based
          field: issue.path[0]?.toString(),
          message: issue.message,
        });
      }
    } else {
      accepted.push(parsed.data);
    }
  });

  // Defect #1: enforce the plan's location cap on NET-NEW rows only. Rows whose
  // externalId already exists are UPDATES (upsert) and don't consume capacity.
  const plan = await getPlanForShop(db, shopId);
  const currentCount = await countLocations(db, shopId);
  const existingExternalIds = await getShopExternalIds(db, shopId);
  const remainingCapacity = Math.max(plan.maxLocations - currentCount, 0);

  // Defect #2: seed the slug set from existing shop slugs so we never collide
  // with rows already in the DB, then keep it live as we assign new slugs.
  const usedSlugs = await getShopSlugs(db, shopId);

  const toInsert: NewLocation[] = [];
  let netNewSoFar = 0;
  const seenExternalIds = new Set<string>();

  for (const row of accepted) {
    const externalId = row.external_id ?? null;
    const isUpdate =
      externalId != null &&
      (existingExternalIds.has(externalId) || seenExternalIds.has(externalId));
    if (externalId != null) seenExternalIds.add(externalId);

    if (!isUpdate) {
      // A genuinely new location — must fit under the remaining cap.
      if (netNewSoFar >= remainingCapacity) {
        errors.push({
          row: 0,
          field: "name",
          message:
            `"${row.name}" skipped — location limit reached ` +
            `(${plan.maxLocations} on plan "${plan.handle}"). ` +
            "Upgrade to add more.",
        });
        failedRows += 1;
        continue;
      }
      netNewSoFar += 1;
    }

    toInsert.push(toLocationRow(shopId, row, usedSlugs));
  }

  // Ensure the shop row exists — imports may pre-date first admin visit in tests.
  await db
    .insert(shopsTable)
    .values({ id: shopId, shopDomain: shopId, planHandle: "free" })
    .onConflictDoNothing();

  let processed = 0;
  for (let i = 0; i < toInsert.length; i += MAX_BATCH) {
    const chunk = toInsert.slice(i, i + MAX_BATCH);
    try {
      await insertChunk(db, chunk);
      processed += chunk.length;
    } catch {
      // Defect #2: a batch insert can fail on a single bad row (e.g. a residual
      // constraint violation). Fall back to per-row inserts so ONE bad row
      // records an error instead of aborting the whole chunk.
      for (const value of chunk) {
        try {
          await insertChunk(db, [value]);
          processed += 1;
        } catch (rowErr) {
          failedRows += 1;
          errors.push({
            row: 0,
            field: "name",
            message: `"${value.name}" skipped — ${
              rowErr instanceof Error ? rowErr.message : "insert failed"
            }`,
          });
        }
      }
    }
  }

  // A job is "failed" only when nothing landed AND something went wrong;
  // otherwise it's "completed" (possibly partial with recorded errors).
  const status = processed === 0 && failedRows > 0 ? "failed" : "completed";

  await updateImportStatus(db, importId, {
    status,
    totalRows,
    processedRows: processed,
    failedRows,
    errorSummary: errors.slice(0, 100),
    completedAt: new Date(),
  });
}

/** One upsert keyed on (shopId, externalId). Shared by batch + per-row paths. */
function insertChunk(db: Database, values: NewLocation[]) {
  return db
    .insert(locations)
    .values(values)
    .onConflictDoUpdate({
      target: [locations.shopId, locations.externalId],
      set: {
        name: sql`excluded.name`,
        addressLine1: sql`excluded.address_line1`,
        city: sql`excluded.city`,
        region: sql`excluded.region`,
        postalCode: sql`excluded.postal_code`,
        countryCode: sql`excluded.country_code`,
        latitude: sql`excluded.latitude`,
        longitude: sql`excluded.longitude`,
        phone: sql`excluded.phone`,
        email: sql`excluded.email`,
        website: sql`excluded.website`,
        description: sql`excluded.description`,
        imageUrl: sql`excluded.image_url`,
        services: sql`excluded.services`,
        updatedAt: new Date(),
      },
    });
}

/**
 * Build a `NewLocation`, assigning a slug that is unique within the shop.
 * `usedSlugs` is mutated so subsequent rows in the same import don't collide
 * (defect #2). Mirrors `ensureUniqueSlug` in location.service.
 */
function toLocationRow(
  shopId: string,
  r: ImportRow,
  usedSlugs: Set<string>,
): NewLocation {
  const services = r.services
    ? r.services.split(/[|,]/).map((s) => s.trim()).filter(Boolean)
    : null;
  const slug = uniqueSlug(slugify(r.slug || r.name), usedSlugs);
  usedSlugs.add(slug);
  return {
    id: newId(),
    shopId,
    name: r.name,
    slug,
    status: r.status ?? "active",
    addressLine1: r.address_line1 ?? null,
    addressLine2: r.address_line2 ?? null,
    city: r.city ?? null,
    region: r.region ?? null,
    postalCode: r.postal_code ?? null,
    countryCode: r.country_code ? r.country_code.toUpperCase() : null,
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    phone: r.phone ?? null,
    email: r.email ?? null,
    website: r.website ?? null,
    description: r.description ?? null,
    imageUrl: r.image_url ?? null,
    services: services ?? null,
    externalId: r.external_id ?? null,
  };
}

/**
 * Return a slug not already in `used`, appending `-2`, `-3`, … until unique.
 * Empty input (a name that slugifies to nothing) falls back to a short id.
 */
function uniqueSlug(base: string, used: Set<string>): string {
  let slug = base;
  if (!slug) slug = newId().slice(0, 8);
  if (!used.has(slug)) return slug;
  for (let i = 2; i < 10000; i++) {
    const attempt = `${slug}-${i}`;
    if (!used.has(attempt)) return attempt;
  }
  // Astronomically unlikely; keep going rather than throw and lose the row.
  return `${slug}-${newId().slice(0, 8)}`;
}

/**
 * Defect #4: strip empty-string / whitespace-only optional cells to `undefined`
 * before validation so a blank optional column (email/website/country_code/
 * status/image_url) doesn't reject an otherwise-valid row. `name` is never
 * dropped — a blank name must still fail as a required field. Numeric fields are
 * additionally guarded in the schema (defect #3).
 */
function normaliseRow(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === "name") {
      out[k] = v;
      continue;
    }
    out[k] = blankToUndefined(v);
  }
  return out;
}

async function parseCsv(object: R2ObjectBody): Promise<Record<string, unknown>[]> {
  const text = await object.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normaliseHeader,
  });
  return parsed.data;
}

async function parseXlsx(object: R2ObjectBody): Promise<Record<string, unknown>[]> {
  const buf = await object.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  if (!sheet) return [];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });
  return raw.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) out[normaliseHeader(k)] = v;
    return out;
  });
}

function normaliseHeader(header: string): string {
  const h = header.trim().toLowerCase().replace(/\s+/g, "_");
  return IMPORT_COLUMN_ALIASES[h] ?? h;
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}
