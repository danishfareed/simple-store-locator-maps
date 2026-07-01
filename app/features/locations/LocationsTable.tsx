import { Link, useSubmit } from "react-router";
import { Badge, EmptyState, IndexTable, Text, useIndexResourceState } from "@shopify/polaris";
import type { Location } from "../../lib/db/schema";

export interface LocationsTableProps {
  items: Location[];
}

/**
 * The locations list table. Selecting rows surfaces promoted bulk actions
 * (Activate / Deactivate / Delete) that post to the route `action` via
 * `useSubmit` with an `intent` + repeated `id` entries — the route handles
 * every intent shop-scoped, so a merchant can never touch another shop's
 * rows regardless of what ids get submitted.
 */
export function LocationsTable({ items }: LocationsTableProps) {
  const submit = useSubmit();
  const resourceName = { singular: "location", plural: "locations" };
  const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection } =
    useIndexResourceState(items as unknown as { [key: string]: unknown; id: string }[]);

  if (items.length === 0) {
    return (
      <EmptyState
        heading="No locations yet"
        action={{ content: "Add location", url: "/app/locations/new" }}
        image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
      >
        <p>Create your first store location to begin showing it on the storefront.</p>
      </EmptyState>
    );
  }

  function runBulk(intent: "activate" | "deactivate" | "delete") {
    if (selectedResources.length === 0) return;
    if (
      intent === "delete" &&
      !confirm(
        `Delete ${selectedResources.length} location${
          selectedResources.length === 1 ? "" : "s"
        }? This can't be undone.`,
      )
    ) {
      return;
    }
    const form = new FormData();
    form.set("intent", intent);
    for (const id of selectedResources) form.append("id", id);
    submit(form, { method: "post" });
    clearSelection();
  }

  return (
    <IndexTable
      resourceName={resourceName}
      itemCount={items.length}
      selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
      onSelectionChange={handleSelectionChange}
      promotedBulkActions={[
        { content: "Activate", onAction: () => runBulk("activate") },
        { content: "Deactivate", onAction: () => runBulk("deactivate") },
        { content: "Delete", onAction: () => runBulk("delete") },
      ]}
      headings={[
        { title: "Name" },
        { title: "City" },
        { title: "Country" },
        { title: "Status" },
      ]}
    >
      {items.map((loc, index) => (
        <IndexTable.Row
          id={loc.id}
          key={loc.id}
          position={index}
          selected={selectedResources.includes(loc.id)}
        >
          <IndexTable.Cell>
            <Link to={`/app/locations/${loc.id}`}>
              <Text as="span" fontWeight="medium">
                {loc.name}
              </Text>
            </Link>
          </IndexTable.Cell>
          <IndexTable.Cell>{loc.city ?? "—"}</IndexTable.Cell>
          <IndexTable.Cell>{loc.countryCode ?? "—"}</IndexTable.Cell>
          <IndexTable.Cell>
            <Badge tone={loc.status === "active" ? "success" : undefined}>
              {loc.status}
            </Badge>
          </IndexTable.Cell>
        </IndexTable.Row>
      ))}
    </IndexTable>
  );
}
