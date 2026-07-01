import { useLoaderData, Link, type LoaderFunctionArgs } from "react-router";
import {
  BlockStack,
  Card,
  InlineGrid,
  Layout,
  Page,
  Text,
} from "@shopify/polaris";
import { requireAdmin } from "../lib/auth/admin.server";
import { countLocations } from "../repositories/location.repository.server";
import { countImportsThisMonth } from "../repositories/import.repository.server";
import { getPlanForShop } from "../services/quota.service.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { db, shop } = await requireAdmin(request, context);
  const [locationCount, importsThisMonth, plan] = await Promise.all([
    countLocations(db, shop.id),
    countImportsThisMonth(db, shop.id),
    getPlanForShop(db, shop.id),
  ]);
  return { locationCount, importsThisMonth, plan, shopId: shop.id };
}

export default function Dashboard() {
  const { locationCount, importsThisMonth, plan } = useLoaderData<typeof loader>();

  return (
    <Page title="Simple Store Locator" subtitle={`Plan: ${plan.name}`}>
      <Layout>
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
            <StatCard label="Locations" value={locationCount} cap={plan.maxLocations} />
            <StatCard
              label="Imports this month"
              value={importsThisMonth}
              cap={plan.maxImportsPerMonth}
            />
            <StatCard label="Plan" value={plan.name} />
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Get started
              </Text>
              <Text as="p" tone="subdued">
                Add your first location, import a CSV, or embed the storefront widget
                via the theme editor.
              </Text>
              <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
                <QuickLink to="/app/locations/new" title="Add a location" />
                <QuickLink to="/app/imports" title="Import CSV / XLSX" />
                <QuickLink to="/app/widgets" title="Configure widget" />
              </InlineGrid>
            </BlockStack>
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

function QuickLink({ to, title }: { to: string; title: string }) {
  return (
    <Card>
      <Link to={to} style={{ textDecoration: "none", color: "inherit" }}>
        <Text as="p" variant="bodyMd" fontWeight="semibold">
          {title} →
        </Text>
      </Link>
    </Card>
  );
}
