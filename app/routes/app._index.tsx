import { useLoaderData, type LoaderFunctionArgs } from "react-router";
import {
  BlockStack,
  Button,
  Card,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  Text,
} from "@shopify/polaris";
import { requireAdmin } from "../lib/auth/admin.server";
import { countLocations } from "../repositories/location.repository.server";
import { listWidgets } from "../repositories/widget.repository.server";
import { getPlanForShop } from "../services/quota.service.server";
import { getDashboardRollup } from "../services/analytics.service.server";
import {
  OnboardingChecklist,
  type OnboardingStep,
} from "../features/dashboard/OnboardingChecklist";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { db, shop } = await requireAdmin(request, context);
  const [locationCount, widgets, plan, rollup] = await Promise.all([
    countLocations(db, shop.id),
    listWidgets(db, shop.id),
    getPlanForShop(db, shop.id),
    getDashboardRollup(db, shop.id, 30),
  ]);

  const hasWidget = widgets.length > 0;
  const hasPublishedWidget = widgets.some((w) => w.isPublished);

  const views30d = rollup.reduce((sum, day) => sum + (day.byType["view"] ?? 0), 0);
  const searches30d = rollup.reduce((sum, day) => sum + (day.byType["search"] ?? 0), 0);

  return {
    shopDomain: shop.shopDomain,
    locationCount,
    hasWidget,
    hasPublishedWidget,
    plan: { name: plan.name, handle: plan.handle, maxLocations: plan.maxLocations },
    views30d,
    searches30d,
  };
}

export default function Dashboard() {
  const {
    shopDomain,
    locationCount,
    hasWidget,
    hasPublishedWidget,
    plan,
    views30d,
    searches30d,
  } = useLoaderData<typeof loader>();

  const steps: OnboardingStep[] = [
    {
      id: "add-locations",
      title: "Add locations",
      description: "Add your first store or pickup location so it can appear on the map.",
      done: locationCount > 0,
      cta: { content: "Add a location", url: "/app/locations/new" },
    },
    {
      id: "create-widget",
      title: "Create a widget",
      description: "Pick a layout — map & list, finder, carousel, list, or single store.",
      done: hasWidget,
      cta: { content: "Create a widget", url: "/app/widgets" },
    },
    {
      id: "add-block",
      title: "Add the Store Locator block to your theme",
      description: "Open the theme editor and add the block wherever you want it to appear.",
      done: hasWidget,
      cta: {
        content: "Open theme editor",
        url: `https://${shopDomain}/admin/themes/current/editor`,
        external: true,
      },
    },
    {
      id: "go-live",
      title: "Publish and go live",
      description: "Publish your widget so shoppers can start finding your locations.",
      done: hasPublishedWidget,
      cta: { content: "Review widgets", url: "/app/widgets" },
    },
  ];

  return (
    <Page title="Simple Store Locator" subtitle="Home">
      <Layout>
        <Layout.Section>
          <OnboardingChecklist steps={steps} />
        </Layout.Section>

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
            <StatCard label="Locations" value={locationCount} cap={plan.maxLocations} />
            <StatCard label="Views (30 days)" value={views30d} />
            <StatCard label="Searches (30 days)" value={searches30d} />
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <InlineStack align="space-between" blockAlign="center" gap="400" wrap={false}>
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  You're on the {plan.name} plan
                </Text>
                <Text as="p" tone="subdued">
                  {plan.handle === "free"
                    ? "Upgrade for more locations, extra widget types, and Google Maps."
                    : "Manage your subscription, view invoices, or change your plan."}
                </Text>
              </BlockStack>
              <Button url="/app/billing">Manage plan</Button>
            </InlineStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function StatCard({
  label,
  value,
  cap,
}: {
  label: string;
  value: number | string;
  cap?: number;
}) {
  return (
    <Card>
      <BlockStack gap="100">
        <Text as="p" tone="subdued" variant="bodySm">
          {label}
        </Text>
        <Text as="p" variant="headingLg">
          {value}
          {cap ? <Text as="span" tone="subdued">{` / ${cap}`}</Text> : null}
        </Text>
      </BlockStack>
    </Card>
  );
}
