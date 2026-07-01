import { useState } from "react";
import {
  Form,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import {
  Badge,
  BlockStack,
  Box,
  Button,
  ButtonGroup,
  Card,
  InlineGrid,
  InlineStack,
  List,
  Page,
  Text,
} from "@shopify/polaris";
import { requireAdmin } from "../lib/auth/admin.server";
import { listPlans } from "../repositories/subscription.repository.server";
import {
  billingKeyForCadence,
  cancelSubscription,
  getActivePlanHandle,
  recordPendingCharge,
  type BillingCadence,
} from "../services/billing.service.server";
import {
  PREMIUM_ANNUAL_CENTS,
  PREMIUM_MONTHLY_CENTS,
  PREMIUM_TRIAL_DAYS,
} from "../lib/billing/plans";

function charm(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { db, shop } = await requireAdmin(request, context);
  const [plans, currentPlan] = await Promise.all([
    listPlans(db),
    getActivePlanHandle(db, shop.id),
  ]);
  return {
    plans,
    currentPlan,
    premiumMonthly: charm(PREMIUM_MONTHLY_CENTS),
    premiumAnnual: charm(PREMIUM_ANNUAL_CENTS),
    trialDays: PREMIUM_TRIAL_DAYS,
  };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { db, shop, auth, env } = await requireAdmin(request, context);
  const form = await request.formData();
  const planHandle = String(form.get("plan") ?? "");
  const cadence = (String(form.get("cadence") ?? "monthly") as BillingCadence);

  if (planHandle === "free") {
    const isTest = env.APP_ENV !== "production";

    // Adapter: performs the REAL Shopify cancellation. `auth.billing.check`
    // returns the shop's currently active `appSubscriptions` (with their
    // gids); we cancel each one via `auth.billing.cancel`. If there's
    // nothing active on Shopify's side (already cancelled, trial never
    // converted, etc.) this is a no-op rather than an error — but a genuine
    // Shopify API failure propagates so we don't tell the merchant they've
    // downgraded while Shopify keeps billing them.
    const shopifyCancel = async () => {
      const { appSubscriptions } = await auth.billing.check({ isTest });
      for (const subscription of appSubscriptions) {
        await auth.billing.cancel({
          subscriptionId: subscription.id,
          isTest,
          prorate: true,
        });
      }
    };

    await cancelSubscription(db, shop.id, shopifyCancel);
    return { ok: true as const };
  }

  if (planHandle !== "premium") {
    return { ok: false as const, error: "Unknown plan" };
  }

  // Persist our pending-subscription row, then hand the merchant off to
  // Shopify's managed confirmation page. `auth.billing.request` returns
  // `Promise<never>` — it THROWS a redirect Response — so control never
  // returns here on success; the thrown Response propagates and redirects.
  await recordPendingCharge(db, shop.id);

  // `auth.billing.request` returns `Promise<never>` and throws a redirect
  // Response to Shopify's confirmation page. Its `plan` param is typed as
  // `keyof Config['billing']`, which collapses to `never` because our
  // `shopifyApp` config is built dynamically in a factory (TS can't infer the
  // literal billing keys statically). The runtime value is a real billing key,
  // so we cast the options to the request's parameter type.
  type RequestFn = typeof auth.billing.request;
  type RequestOpts = Parameters<RequestFn>[0];
  return auth.billing.request({
    plan: billingKeyForCadence(cadence),
    isTest: env.APP_ENV !== "production",
    returnUrl: `${env.SHOPIFY_APP_URL}/app/billing?confirmed=1`,
  } as unknown as RequestOpts);
}

export default function Billing() {
  const { plans, currentPlan, premiumMonthly, premiumAnnual, trialDays } =
    useLoaderData<typeof loader>();
  const [cadence, setCadence] = useState<BillingCadence>("monthly");

  const free = plans.find((p) => p.handle === "free");
  const premium = plans.find((p) => p.handle === "premium");

  return (
    <Page title="Plans & billing">
      <BlockStack gap="400">
        <Text as="p" tone="subdued">
          Pick the plan that fits your store. Upgrade or downgrade anytime.
        </Text>

        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          {/* ── Free ── */}
          {free ? (
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h3" variant="headingMd">
                    {free.name}
                  </Text>
                  {currentPlan === "free" ? (
                    <Badge tone="success">Current plan</Badge>
                  ) : null}
                </InlineStack>
                <Text as="p" variant="heading2xl">
                  $0
                  <Text as="span" variant="bodyMd" tone="subdued">
                    {" "}
                    /mo
                  </Text>
                </Text>
                <List>
                  <List.Item>Up to {free.maxLocations} locations</List.Item>
                  <List.Item>Map + list widget</List.Item>
                  <List.Item>OpenStreetMap</List.Item>
                  <List.Item>CSV import</List.Item>
                </List>
                <Box>
                  <Form method="post">
                    <input type="hidden" name="plan" value="free" />
                    <Button submit disabled={currentPlan === "free"} fullWidth>
                      {currentPlan === "free" ? "Current plan" : "Downgrade to Free"}
                    </Button>
                  </Form>
                </Box>
              </BlockStack>
            </Card>
          ) : null}

          {/* ── Premium ── */}
          {premium ? (
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h3" variant="headingMd">
                    {premium.name}
                  </Text>
                  {currentPlan === "premium" ? (
                    <Badge tone="success">Current plan</Badge>
                  ) : (
                    <Badge tone="info">Recommended</Badge>
                  )}
                </InlineStack>

                <Box>
                  <ButtonGroup variant="segmented">
                    <Button
                      pressed={cadence === "monthly"}
                      onClick={() => setCadence("monthly")}
                    >
                      Monthly
                    </Button>
                    <Button
                      pressed={cadence === "annual"}
                      onClick={() => setCadence("annual")}
                    >
                      Annual
                    </Button>
                  </ButtonGroup>
                </Box>

                <Text as="p" variant="heading2xl">
                  {cadence === "monthly" ? premiumMonthly : premiumAnnual}
                  <Text as="span" variant="bodyMd" tone="subdued">
                    {" "}
                    {cadence === "monthly" ? "/mo" : "/yr"}
                  </Text>
                </Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  {trialDays}-day free trial. Cancel anytime.
                </Text>

                <List>
                  <List.Item>Up to {premium.maxLocations} locations</List.Item>
                  <List.Item>All 5 widget types</List.Item>
                  <List.Item>OpenStreetMap + Google Maps</List.Item>
                  <List.Item>CSV + XLSX import</List.Item>
                  <List.Item>Remove “Powered by” branding</List.Item>
                </List>

                <Box>
                  <Form method="post">
                    <input type="hidden" name="plan" value="premium" />
                    <input type="hidden" name="cadence" value={cadence} />
                    <Button
                      submit
                      variant="primary"
                      fullWidth
                      disabled={currentPlan === "premium"}
                    >
                      {currentPlan === "premium"
                        ? "Current plan"
                        : `Start ${trialDays}-day trial`}
                    </Button>
                  </Form>
                </Box>
              </BlockStack>
            </Card>
          ) : null}
        </InlineGrid>
      </BlockStack>
    </Page>
  );
}
