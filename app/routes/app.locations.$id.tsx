import {
  redirect,
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { Banner, Page } from "@shopify/polaris";
import { requireAdmin } from "../lib/auth/admin.server";
import {
  deleteLocation,
  getLocationById,
} from "../repositories/location.repository.server";
import { LocationForm } from "../features/locations/LocationForm";
import { LocationInputSchema } from "../schemas/location.schema";
import { patchLocation } from "../services/location.service.server";

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const { db, shop } = await requireAdmin(request, context);
  const location = await getLocationById(db, shop.id, params.id!);
  if (!location) throw new Response("Not found", { status: 404 });
  return { location };
}

export async function action({ request, context, params }: ActionFunctionArgs) {
  const { db, shop } = await requireAdmin(request, context);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "delete") {
    await deleteLocation(db, shop.id, params.id!);
    return redirect("/app/locations");
  }

  const parsed = LocationInputSchema.partial().safeParse(normaliseForm(form));
  if (!parsed.success) {
    return { ok: false as const, fieldErrors: flattenZod(parsed.error) };
  }
  await patchLocation(db, shop.id, params.id!, parsed.data);
  return { ok: true as const };
}

export default function EditLocation() {
  const { location } = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();

  return (
    <Page
      title={location.name}
      backAction={{ url: "/app/locations" }}
      secondaryActions={[
        {
          content: "Delete",
          destructive: true,
          onAction: () => {
            if (confirm("Delete this location?")) {
              const f = new FormData();
              f.set("intent", "delete");
              fetch(`/app/locations/${location.id}`, { method: "POST", body: f }).then(
                () => (window.location.href = "/app/locations"),
              );
            }
          },
        },
      ]}
    >
      {data && "ok" in data && data.ok ? (
        <Banner tone="success" title="Saved" />
      ) : null}
      <LocationForm
        defaultValues={location}
        fieldErrors={data && "fieldErrors" in data ? data.fieldErrors : undefined}
        submitLabel="Save changes"
      />
    </Page>
  );
}

function normaliseForm(form: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) obj[k] = v === "" ? undefined : v;
  return obj;
}

function flattenZod(err: { flatten: () => { fieldErrors: Record<string, string[]> } }) {
  const out: Record<string, string> = {};
  for (const [k, msgs] of Object.entries(err.flatten().fieldErrors))
    if (msgs?.[0]) out[k] = msgs[0];
  return out;
}
