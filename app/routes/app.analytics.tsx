import { useLoaderData, type LoaderFunctionArgs } from "react-router";
import {
  BlockStack,
  Card,
  DataTable,
  InlineGrid,
  Page,
  Text,
} from "@shopify/polaris";
import { requireAdmin } from "../lib/auth/admin.server";
import {
  getDashboardRollup,
  getTopLocations,
} from "../services/analytics.service.server";
import { Sparkline } from "../features/analytics/Sparkline";
import { getLocationById } from "../repositories/location.repository.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { db, shop } = await requireAdmin(request, context);
  const [rollup, top] = await Promise.all([
    getDashboardRollup(db, shop.id, 30),
    getTopLocations(db, shop.id, 30),
  ]);
  const resolvedTop = await Promise.all(
    top.map(async (t) => ({
      count: t.count,
      name: t.locationId
        ? (await getLocationById(db, shop.id, t.locationId))?.name ?? "(deleted)"
        : "(unknown)",
    })),
  );
  return { rollup, top: resolvedTop };
}

export default function Analytics() {
  const { rollup, top } = useLoaderData<typeof loader>();

  const totals = rollup.map((r) => r.total);
  const searches = rollup.map((r) => r.byType["search"] ?? 0);
  const views = rollup.map((r) => r.byType["view"] ?? 0);

  return (
    <Page title="Analytics" subtitle="Last 30 days">
      <BlockStack gap="400">
        <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
          <Metric
            label="All events"
            value={sum(totals)}
            series={totals}
          />
          <Metric label="Searches" value={sum(searches)} series={searches} />
          <Metric label="Views" value={sum(views)} series={views} />
        </InlineGrid>

        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingSm">
              Top locations
            </Text>
            <DataTable
              columnContentTypes={["text", "numeric"]}
              headings={["Location", "Events"]}
              rows={top.map((t) => [t.name, String(t.count)])}
            />
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

function Metric({
  label,
  value,
  series,
}: {
  label: string;
  value: number;
  series: number[];
}) {
  return (
    <Card>
      <BlockStack gap="100">
        <Text as="p" tone="subdued">
          {label}
        </Text>
        <Text as="p" variant="headingLg">
          {value.toLocaleString()}
        </Text>
        <Sparkline values={series} />
      </BlockStack>
    </Card>
  );
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
