import { useEffect, useState } from "react";
import {
  useActionData,
  useLoaderData,
  useSearchParams,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import {
  Banner,
  BlockStack,
  Card,
  EmptyState,
  Modal,
  Page,
  Text,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { requireAdmin } from "../lib/auth/admin.server";
import {
  deleteWidget as deleteWidgetRow,
  listWidgets,
} from "../repositories/widget.repository.server";
import { duplicateWidget } from "../services/widget.service.server";
import { getActivePlanHandle } from "../services/billing.service.server";
import { WidgetsTable } from "../features/widgets/WidgetsTable";
import { WidgetTypeGallery } from "../features/widgets/WidgetTypeGallery";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { db, shop } = await requireAdmin(request, context);
  const [widgets, plan] = await Promise.all([
    listWidgets(db, shop.id),
    getActivePlanHandle(db, shop.id),
  ]);
  return { widgets, plan };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { db, shop } = await requireAdmin(request, context);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const id = String(form.get("id") ?? "");

  if (!id) {
    return { ok: false as const, error: "Missing widget id" };
  }

  if (intent === "duplicate") {
    await duplicateWidget(db, shop.id, id);
    return { ok: true as const, toast: "Widget duplicated" };
  }

  if (intent === "delete") {
    await deleteWidgetRow(db, shop.id, id);
    return { ok: true as const, toast: "Widget deleted" };
  }

  return { ok: false as const, error: "Unknown action" };
}

export default function Widgets() {
  const { widgets, plan } = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const shopify = useAppBridge();

  // After the editor redirects back with ?saved=<created|updated>, surface a
  // success toast (App Bridge) and clear the param so a refresh won't repeat it.
  const saved = params.get("saved");
  useEffect(() => {
    if (!saved) return;
    shopify.toast?.show(saved === "created" ? "Widget created" : "Widget saved");
    const next = new URLSearchParams(params);
    next.delete("saved");
    setParams(next, { replace: true });
  }, [saved, params, setParams, shopify]);

  return (
    <Page
      title="Widgets"
      subtitle="Store locator blocks you can add to your theme."
      primaryAction={{
        content: "Create widget",
        onAction: () => setGalleryOpen(true),
      }}
    >
      <BlockStack gap="400">
        {data?.ok && data.toast ? (
          <Banner tone="success" title={data.toast} />
        ) : null}
        {data && !data.ok && data.error ? (
          <Banner tone="critical" title={data.error} />
        ) : null}

        {widgets.length === 0 ? (
          <Card>
            <EmptyState
              heading="Create your first widget"
              action={{
                content: "Create widget",
                onAction: () => setGalleryOpen(true),
              }}
              secondaryAction={{ content: "Manage plan", url: "/app/billing" }}
              image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
            >
              <p>
                Widgets are the store-locator blocks your customers see. Pick a
                type, configure it, then add the Store Locator block to your
                theme.
              </p>
            </EmptyState>
          </Card>
        ) : (
          <Card padding="0">
            <WidgetsTable widgets={widgets} />
          </Card>
        )}
      </BlockStack>

      <Modal
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        title="Choose a widget type"
        size="large"
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p" tone="subdued">
              Every widget shares the same locations. Pick the layout that fits
              where you want to place it.
            </Text>
            <WidgetTypeGallery plan={plan} />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
