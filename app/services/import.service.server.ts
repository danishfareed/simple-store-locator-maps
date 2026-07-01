import { sql } from "drizzle-orm";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { getDb } from "../lib/db/client.server";
import { newId, slugify } from "../lib/utils/slug";
import {
  locations,
  shops as shopsTable,
  type NewLocation,
} from "../lib/db/schema";
import {
  createImport,
  updateImportStatus,
} from "../repositories/import.repository.server";
import { assertImportQuota } from "./quota.service.server";
import {
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
  await assertImportQuota(db, shopId);

  const importId = newId();
  const kind: "csv" | "xlsx" = file.name.toLowerCase().endsWith(".xlsx") ? "xlsx" : "csv";
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
      console.error("import.job.failed", { importId: msg.body.importId, err });
      const db = getDb(env.DB);
      await updateImportStatus(db, msg.body.importId, {
        status: "failed",
        completedAt: new Date(),
        errorSummary: [
          { row: 0, message: err instanceof Error ? err.message : "unknown" },
        ],
      });
      msg.retry();
    }
  }
}

async function processImportJob(job: ImportJobMessage, env: CloudflareEnv) {
  const db = getDb(env.DB);
  await updateImportStatus(db, job.importId, {
    status: "processing",
    startedAt: new Date(),
  });

  const object = await env.UPLOADS.get(job.r2Key);
  if (!object) throw new Error(`R2 object missing: ${job.r2Key}`);

  const rows = job.kind === "csv"
    ? await parseCsv(object)
    : await parseXlsx(object);

  const errors: { row: number; field?: string; message: string }[] = [];
  const accepted: ImportRow[] = [];

  rows.forEach((raw, i) => {
    const parsed = ImportRowSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({
          row: i + 2, // +1 for header, +1 for 1-based
          field: issue.path[0]?.toString(),
          message: issue.message,
        });
      }
      return;
    }
    accepted.push(parsed.data);
  });

  let processed = 0;
  for (let i = 0; i < accepted.length; i += MAX_BATCH) {
    const chunk = accepted.slice(i, i + MAX_BATCH);
    await db
      .insert(locations)
      .values(chunk.map((r) => toLocationRow(job.shop, r)))
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
    processed += chunk.length;
  }

  // Ensure shop row exists — imports may pre-date first admin visit in tests.
  await db
    .insert(shopsTable)
    .values({ id: job.shop, shopDomain: job.shop, planHandle: "free" })
    .onConflictDoNothing();

  await updateImportStatus(db, job.importId, {
    status: errors.length && accepted.length === 0 ? "failed" : "completed",
    totalRows: rows.length,
    processedRows: processed,
    failedRows: errors.length,
    errorSummary: errors.slice(0, 100),
    completedAt: new Date(),
  });
}

function toLocationRow(shopId: string, r: ImportRow): NewLocation {
  const services = r.services
    ? r.services.split(/[|,]/).map((s) => s.trim()).filter(Boolean)
    : null;
  const slug = slugify(r.slug || r.name);
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
