import {
  Link,
  useLoaderData,
  useSearchParams,
  type LoaderFunctionArgs,
} from "react-router";
import { Button, Card, Page, TextField } from "@shopify/polaris";
import { requireAdmin } from "../lib/auth/admin.server";
import { listLocations } from "../repositories/location.repository.server";
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

export default function Locations() {
  const { items, nextCursor, q } = useLoaderData<typeof loader>();
  const [params, setParams] = useSearchParams();

  return (
    <Page
      title="Locations"
      primaryAction={{ content: "Add location", url: "/app/locations/new" }}
    >
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
