import { Link } from "react-router";
import { Badge, EmptyState, IndexTable, Text, useIndexResourceState } from "@shopify/polaris";
import type { Location } from "../../lib/db/schema";

export function LocationsTable({ items }: { items: Location[] }) {
  const resourceName = { singular: "location", plural: "locations" };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
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

  return (
    <IndexTable
      resourceName={resourceName}
      itemCount={items.length}
      selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
      onSelectionChange={handleSelectionChange}
      bulkActions={[]}
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
