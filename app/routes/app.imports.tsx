import {
  Form,
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  DropZone,
  Page,
  Text,
} from "@shopify/polaris";
import { useState } from "react";
import { requireAdmin } from "../lib/auth/admin.server";
import { listImports } from "../repositories/import.repository.server";
import { enqueueImport } from "../services/import.service.server";
import { QuotaExceededError } from "../services/quota.service.server";
import { ImportsTable } from "../features/imports/ImportsTable";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { db, shop } = await requireAdmin(request, context);
  const imports = await listImports(db, shop.id);
  return { imports };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { env, shop } = await requireAdmin(request, context);
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return { ok: false as const, error: "No file uploaded" };
  }
  try {
    const res = await enqueueImport(env, shop.id, {
      name: file.name,
      contentType: file.type,
      stream: file.stream(),
      size: file.size,
    });
    return { ok: true as const, importId: res.importId };
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return { ok: false as const, error: err.message };
    }
    throw err;
  }
}

export default function Imports() {
  const { imports } = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();
  const [files, setFiles] = useState<File[]>([]);

  return (
    <Page title="Imports">
      <BlockStack gap="400">
        {data?.ok ? (
          <Banner tone="success" title="Upload queued">
            <p>Your file is being processed. This page refreshes with status.</p>
          </Banner>
        ) : null}
        {data && "error" in data && data.error ? (
          <Banner tone="critical" title="Upload failed">
            <p>{data.error}</p>
          </Banner>
        ) : null}

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingSm">
              Upload CSV or XLSX
            </Text>
            <Form method="post" encType="multipart/form-data">
              <DropZone
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onDrop={(_accepted, acceptedFiles) => setFiles(acceptedFiles)}
                allowMultiple={false}
              >
                {files.length ? (
                  <BlockStack gap="100">
                    <Text as="p">{files[0]!.name}</Text>
                    <Text as="p" tone="subdued" variant="bodySm">
                      {Math.round(files[0]!.size / 1024)} KB
                    </Text>
                  </BlockStack>
                ) : (
                  <DropZone.FileUpload actionHint="Drag CSV or XLSX, or click to browse" />
                )}
              </DropZone>
              <input
                type="file"
                name="file"
                hidden
                ref={(node) => {
                  if (node && files[0]) {
                    const dt = new DataTransfer();
                    dt.items.add(files[0]);
                    node.files = dt.files;
                  }
                }}
              />
              <Button submit variant="primary" disabled={files.length === 0}>
                Upload
              </Button>
            </Form>
          </BlockStack>
        </Card>

        <Card padding="0">
          <ImportsTable imports={imports} />
        </Card>
      </BlockStack>
    </Page>
  );
}
