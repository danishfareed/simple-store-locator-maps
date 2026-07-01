import {
  redirect,
  useActionData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { Banner, Page } from "@shopify/polaris";
import { requireAdmin } from "../lib/auth/admin.server";
import { LocationForm } from "../features/locations/LocationForm";
import { LocationInputSchema } from "../schemas/location.schema";
import { saveNewLocation } from "../services/location.service.server";
import { QuotaExceededError } from "../services/quota.service.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  await requireAdmin(request, context);
  return null;
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { db, shop } = await requireAdmin(request, context);
  const form = await request.formData();
  const parsed = LocationInputSchema.safeParse(normaliseForm(form));
  if (!parsed.success) {
    return {
      ok: false as const,
      fieldErrors: flattenZod(parsed.error),
    };
  }
  try {
    const loc = await saveNewLocation(db, shop.id, parsed.data);
    return redirect(`/app/locations/${loc.id}`);
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return { ok: false as const, quotaError: err.message };
    }
    throw err;
  }
}

export default function NewLocation() {
  const data = useActionData<typeof action>();
  return (
    <Page title="New location" backAction={{ url: "/app/locations" }}>
      {data?.quotaError ? (
        <Banner tone="warning" title="Plan limit reached">
          <p>{data.quotaError}</p>
        </Banner>
      ) : null}
      <LocationForm fieldErrors={data?.fieldErrors} submitLabel="Create" />
    </Page>
  );
}

function normaliseForm(form: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    obj[k] = v === "" ? undefined : v;
  }
  return obj;
}

function flattenZod(err: { flatten: () => { fieldErrors: Record<string, string[]> } }) {
  const out: Record<string, string> = {};
  const flat = err.flatten().fieldErrors;
  for (const [k, msgs] of Object.entries(flat)) if (msgs?.[0]) out[k] = msgs[0];
  return out;
}
