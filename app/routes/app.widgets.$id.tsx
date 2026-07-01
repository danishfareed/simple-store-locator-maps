import { type LoaderFunctionArgs } from "react-router";
import { Page, Card, Text } from "@shopify/polaris";
import { requireAdmin } from "../lib/auth/admin.server";
import { getWidget } from "../services/widget.service.server";

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const { db, shop } = await requireAdmin(request, context);
  const widget = await getWidget(db, shop.id, params.id!);
  if (!widget) throw new Response("Not found", { status: 404 });
  return { widget };
}

export default function EditWidget() {
  return (
    <Page title="Edit widget" backAction={{ url: "/app/widgets" }}>
      <Card>
        <Text as="p">Editor coming up.</Text>
      </Card>
    </Page>
  );
}
