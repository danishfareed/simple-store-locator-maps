import { useState } from "react";
import {
  Form,
  useActionData,
  useLoaderData,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "react-router";
import {
  AppProvider as PolarisAppProvider,
  Button,
  Card,
  FormLayout,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import { LoginErrorType } from "@shopify/shopify-app-react-router/server";
import { getShopify } from "../shopify.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const shopify = getShopify(context.cloudflare.env);
  const error = await shopify.login(request);
  return { error, polarisTranslations };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const shopify = getShopify(context.cloudflare.env);
  const error = await shopify.login(request);
  return { error };
}

export default function Login() {
  const { error, polarisTranslations: t } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const err = actionData?.error ?? error;
  const [shop, setShop] = useState("");

  const shopError =
    err?.shop === LoginErrorType.MissingShop
      ? "Shop domain is required"
      : err?.shop === LoginErrorType.InvalidShop
        ? "Must be a valid *.myshopify.com domain"
        : undefined;

  return (
    <PolarisAppProvider i18n={t}>
      <Page narrowWidth title="Log in">
        <Card>
          <Form method="post">
            <FormLayout>
              <Text as="h2" variant="headingMd">
                Install Simple Store Locator
              </Text>
              <TextField
                type="text"
                name="shop"
                label="Shop domain"
                helpText="Example: my-store.myshopify.com"
                autoComplete="on"
                value={shop}
                onChange={setShop}
                error={shopError}
              />
              <Button submit variant="primary">
                Log in
              </Button>
            </FormLayout>
          </Form>
        </Card>
      </Page>
    </PolarisAppProvider>
  );
}
