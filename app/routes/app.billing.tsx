import {
  Form,
  redirect,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import {
  Badge,
  BlockStack,
  Button,
  Card,
  InlineGrid,
  Page,
  Text,
} from "@shopify/polaris";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/auth/admin.server";
import { shops } from "../lib/db/schema";
import {
  getActiveSubscription,
  listPlans,
} from "../repositories/subscription.repository.server";
import { createCharge } from "../services/billing.service.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { db, shop } = await requireAdmin(request, context);
  const [plans, active] = await Promise.all([
    listPlans(db),
    getActiveSubscription(db, shop.id),
  ]);
  return { plans, active, currentPlan: shop.planHandle };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { db, shop, shopify, env } = await requireAdmin(request, context);
  const form = await request.formData();
  const planHandle = String(form.get("plan") ?? "");
  const [plans] = await Promise.all([listPlans(db)]);
  const plan = plans.find((p) => p.handle === planHandle);
  if (!plan) return { error: "Unknown plan" };

  if (plan.priceCents === 0) {
    await db
      .update(shops)
      .set({ planHandle: "free", updatedAt: new Date() })
      .where(eq(shops.id, shop.id));
    return redirect("/app/billing");
  }

  const { confirmationUrl } = await createCharge(db, {
    shopId: shop.id,
    plan,
    returnUrl: `${env.SHOPIFY_APP_URL}/app/billing?confirmed=1`,
    shopifyCreate: async (args) => {
      // Thin adapter over the Shopify package's billing request. On Workers,
      // the package is responsible for calling the Admin API with the current
      // session and returning the confirmation URL.
      const billing = (shopify as unknown as {
        billing: {
          require: (opts: {
            session: unknown;
            plans: string[];
            isTest: boolean;
            onFailure: (_: unknown) => Promise<Response>;
          }) => Promise<{ confirmationUrl?: string }>;
        };
      }).billing;
      const res = await billing.require({
        session: { shop: shop.id } as unknown,
        plans: [args.handle],
        isTest: env.APP_ENV !== "production",
        onFailure: async () => new Response("Billing required", { status: 402 }),
      });
      return {
        chargeId: "pending",
        confirmationUrl: res.confirmationUrl ?? args.returnUrl,
      };
    },
  });

  return redirect(confirmationUrl);
}

export default function Billing() {
  const { plans, currentPlan } = useLoaderData<typeof loader>();

  return (
    <Page title="Billing">
      <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="300">
        {plans.map((p) => (
          <Card key={p.handle}>
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">
                {p.name}
              </Text>
              {p.handle === currentPlan ? (
                <Badge tone="success">Current</Badge>
              ) : null}
              <Text as="p" variant="headingLg">
                {p.priceCents === 0
                  ? "Free"
                  : `${(p.priceCents / 100).toFixed(0)} ${p.currency}/mo`}
              </Text>
              <Text as="p" tone="subdued">
                {p.maxLocations.toLocaleString()} locations · {p.maxImportsPerMonth}{" "}
                imports/mo
              </Text>
              <Form method="post">
                <input type="hidden" name="plan" value={p.handle} />
                <Button submit disabled={p.handle === currentPlan}>
                  {p.handle === currentPlan ? "Active" : "Choose"}
                </Button>
              </Form>
            </BlockStack>
          </Card>
        ))}
      </InlineGrid>
    </Page>
  );
}
