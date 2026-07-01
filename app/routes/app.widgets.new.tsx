import {
  redirect,
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { Page } from "@shopify/polaris";
import { requireAdmin } from "../lib/auth/admin.server";
import { listLocations } from "../repositories/location.repository.server";
import { getActivePlanHandle } from "../services/billing.service.server";
import { WidgetTypeEnum, type WidgetType } from "../schemas/widget.schema";
import { WIDGET_TYPES } from "../features/widgets/widget-types";
import { WidgetEditor } from "../features/widgets/WidgetEditor";
import { handleWidgetSave } from "../features/widgets/widget-editor.server";

function parseType(raw: string | null): WidgetType {
  const result = WidgetTypeEnum.safeParse(raw);
  return result.success ? result.data : "map_list";
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { db, shop } = await requireAdmin(request, context);
  const type = parseType(new URL(request.url).searchParams.get("type"));
  const [{ items }, plan] = await Promise.all([
    listLocations(db, shop.id, { limit: 100 }),
    getActivePlanHandle(db, shop.id),
  ]);
  return {
    type,
    locations: items.map((l) => ({ id: l.id, name: l.name })),
    plan,
    settings: { googleMapsApiKey: shop.settings?.googleMapsApiKey },
  };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { db, shop } = await requireAdmin(request, context);
  const form = await request.formData();
  const result = await handleWidgetSave(db, shop.id, form);
  if (result.ok) {
    return redirect("/app/widgets?saved=created");
  }
  return result;
}

export default function NewWidget() {
  const { type, locations, plan, settings } = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();

  return (
    <Page
      title={`New ${WIDGET_TYPES[type].label} widget`}
      backAction={{ url: "/app/widgets" }}
    >
      <WidgetEditor
        mode="create"
        type={type}
        locations={locations}
        plan={plan}
        settings={settings}
        fieldErrors={data && !data.ok ? data.fieldErrors : undefined}
        formError={data && !data.ok ? data.formError : undefined}
      />
    </Page>
  );
}
