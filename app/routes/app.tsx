import {
  Link,
  Outlet,
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
  type LoaderFunctionArgs,
  type HeadersFunction,
} from "react-router";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import { NavMenu } from "@shopify/app-bridge-react";
import { requireAdmin } from "../lib/auth/admin.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { shop } = await requireAdmin(request, context);
  return {
    apiKey: context.cloudflare.env.SHOPIFY_API_KEY,
    shop: { id: shop.id, planHandle: shop.planHandle },
  };
}

export const headers: HeadersFunction = (args) => {
  return new Headers({
    // Shopify package sets CSP + frame-ancestors; this propagates them.
    ...Object.fromEntries(
      Object.entries(args.loaderHeaders).filter(([k]) =>
        k.toLowerCase().startsWith("content-security-policy"),
      ),
    ),
  });
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <PolarisAppProvider i18n={polarisTranslations}>
        <NavMenu>
        <Link to="/app" rel="home">
          Home
        </Link>
        <Link to="/app/locations">Locations</Link>
        <Link to="/app/imports">Imports</Link>
        <Link to="/app/widgets">Widgets</Link>
        <Link to="/app/analytics">Analytics</Link>
        <Link to="/app/settings">Settings</Link>
        <Link to="/app/billing">Billing</Link>
      </NavMenu>
        <Outlet />
      </PolarisAppProvider>
    </AppProvider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error)) {
    return (
      <main style={{ padding: 24 }}>
        <h1>
          {error.status} {error.statusText}
        </h1>
      </main>
    );
  }
  return (
    <main style={{ padding: 24 }}>
      <h1>Unexpected error</h1>
      <pre>{error instanceof Error ? error.message : "unknown"}</pre>
    </main>
  );
}
