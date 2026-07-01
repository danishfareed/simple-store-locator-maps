import {
  redirect,
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { Page } from "@shopify/polaris";
import { requireAdmin } from "../lib/auth/admin.server";
import { getWidget } from "../services/widget.service.server";
import { deleteWidget } from "../repositories/widget.repository.server";
import { listLocations } from "../repositories/location.repository.server";
import { getActivePlanHandle } from "../services/billing.service.server";
import { WidgetEditor } from "../features/widgets/WidgetEditor";
import { handleWidgetSave } from "../features/widgets/widget-editor.server";

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const { db, shop } = await requireAdmin(request, context);
  const widget = await getWidget(db, shop.id, params.id!);
  if (!widget) throw new Response("Not found", { status: 404 });
  const [{ items }, plan] = await Promise.all([
    listLocations(db, shop.id, { limit: 100 }),
    getActivePlanHandle(db, shop.id),
  ]);
  return {
    widget,
    type: widget.type,
    locations: items.map((l) => ({ id: l.id, name: l.name })),
    plan,
    settings: { googleMapsApiKey: shop.settings?.googleMapsApiKey },
  };
}

export async function action({ request, context, params }: ActionFunctionArgs) {
  const { db, shop } = await requireAdmin(request, context);
  const form = await request.formData();

  if (form.get("intent") === "delete") {
    await deleteWidget(db, shop.id, params.id!);
    return redirect("/app/widgets?saved=deleted");
  }

  const result = await handleWidgetSave(db, shop.id, form);
  if (result.ok) {
    return redirect("/app/widgets?saved=updated");
  }
  return result;
}

export default function EditWidget() {
  const { widget, type, locations, plan, settings } = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();

  return (
    <Page
      title={widget.name}
      backAction={{ url: "/app/widgets" }}
      secondaryActions={[
        {
          content: "Delete",
          destructive: true,
          onAction: () => {
            if (!confirm(`Delete widget "${widget.name}"?`)) return;
            const f = new FormData();
            f.set("intent", "delete");
            fetch(`/app/widgets/${widget.id}`, { method: "POST", body: f }).then(
              () => (window.location.href = "/app/widgets?saved=deleted"),
            );
          },
        },
      ]}
    >
      <WidgetEditor
        mode="edit"
        type={type}
        widget={widget}
        locations={locations}
        plan={plan}
        settings={settings}
        fieldErrors={data && !data.ok ? data.fieldErrors : undefined}
        formError={data && !data.ok ? data.formError : undefined}
      />
    </Page>
  );
}
