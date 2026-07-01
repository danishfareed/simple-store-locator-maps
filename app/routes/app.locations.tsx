import { useEffect } from "react";
import {
  Link,
  useActionData,
  useLoaderData,
  useSearchParams,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { Banner, Button, Card, Page, TextField } from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { requireAdmin } from "../lib/auth/admin.server";
import { listLocations } from "../repositories/location.repository.server";
import {
  bulkRemoveLocations,
  bulkSetLocationStatus,
} from "../services/location.service.server";
import { LocationsTable } from "../features/locations/LocationsTable";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { db, shop } = await requireAdmin(request, context);
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? undefined;
  const status = (url.searchParams.get("status") as "active" | "inactive" | "draft" | null) ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const { items, nextCursor } = await listLocations(db, shop.id, { query: q, status, cursor });
  return { items, nextCursor, q: q ?? "", status: status ?? "" };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { db, shop } = await requireAdmin(request, context);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const ids = form.getAll("id").map(String).filter(Boolean);

  if (ids.length === 0) {
    return { ok: false as const, error: "No locations selected" };
  }

  if (intent === "activate" || intent === "deactivate") {
    const status = intent === "activate" ? "active" : "inactive";
    const count = await bulkSetLocationStatus(db, shop.id, ids, status);
    return {
      ok: true as const,
      toast: `${count} location${count === 1 ? "" : "s"} ${
        intent === "activate" ? "activated" : "deactivated"
      }`,
    };
  }

  if (intent === "delete") {
    const count = await bulkRemoveLocations(db, shop.id, ids);
    return { ok: true as const, toast: `${count} location${count === 1 ? "" : "s"} deleted` };
  }

  return { ok: false as const, error: "Unknown action" };
}

export default function Locations() {
  const { items, nextCursor, q } = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();
  const [params, setParams] = useSearchParams();
  const shopify = useAppBridge();

  useEffect(() => {
    if (data?.ok && data.toast) {
      shopify.toast?.show(data.toast);
    }
  }, [data, shopify]);

  return (
    <Page
      title="Locations"
      primaryAction={{ content: "Add location", url: "/app/locations/new" }}
    >
      {data && !data.ok && data.error ? (
        <Banner tone="critical" title={data.error} />
      ) : null}
      <Card>
        <TextField
          label="Search"
          labelHidden
          placeholder="Search by name, city, postal code"
          autoComplete="off"
          value={q}
          onChange={(val) => {
            const next = new URLSearchParams(params);
            if (val) next.set("q", val);
            else next.delete("q");
            next.delete("cursor");
            setParams(next, { replace: true });
          }}
        />
      </Card>
      <Card padding="0">
        <LocationsTable items={items} />
      </Card>
      {nextCursor ? (
        <Link to={`?${new URLSearchParams({ ...Object.fromEntries(params), cursor: nextCursor }).toString()}`}>
          <Button>Load more</Button>
        </Link>
      ) : null}
    </Page>
  );
}
