import { Badge, DataTable, EmptyState } from "@shopify/polaris";
import type { ImportJob } from "../../lib/db/schema";

export function ImportsTable({ imports }: { imports: ImportJob[] }) {
  if (imports.length === 0) {
    return (
      <EmptyState heading="No imports yet" image="">
        <p>Upload a CSV or XLSX file to bulk-add locations.</p>
      </EmptyState>
    );
  }
  return (
    <DataTable
      columnContentTypes={["text", "text", "numeric", "numeric", "text"]}
      headings={["Filename", "Status", "Rows", "Failed", "Created"]}
      rows={imports.map((i) => [
        i.filename,
        <Badge tone={statusTone(i.status)} key={i.id}>
          {i.status}
        </Badge>,
        String(i.processedRows),
        String(i.failedRows),
        new Date(i.createdAt).toLocaleString(),
      ])}
    />
  );
}

function statusTone(status: ImportJob["status"]) {
  switch (status) {
    case "completed":
      return "success" as const;
    case "failed":
      return "critical" as const;
    case "processing":
      return "info" as const;
    default:
      return undefined;
  }
}
