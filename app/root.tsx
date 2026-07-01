import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
} from "react-router";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import leafletStyles from "leaflet/dist/leaflet.css?url";
import type { LinksFunction } from "react-router";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: polarisStyles },
  { rel: "stylesheet", href: leafletStyles },
  { rel: "preconnect", href: "https://cdn.shopify.com/" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error)) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1>
          {error.status} {error.statusText}
        </h1>
        <pre>{error.data}</pre>
      </main>
    );
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>App error</h1>
      <pre>{message}</pre>
    </main>
  );
}
