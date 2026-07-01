import { type LoaderFunctionArgs } from "react-router";
import { Page, Card, Text } from "@shopify/polaris";
import { requireAdmin } from "../lib/auth/admin.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  await requireAdmin(request, context);
  return null;
}

export default function NewWidget() {
  return (
    <Page title="New widget" backAction={{ url: "/app/widgets" }}>
      <Card>
        <Text as="p">Editor coming up.</Text>
      </Card>
    </Page>
  );
}
