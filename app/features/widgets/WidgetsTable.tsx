import { Link, useSubmit } from "react-router";
import { useCallback } from "react";
import {
  Badge,
  Button,
  ButtonGroup,
  Icon,
  IndexTable,
  InlineStack,
  Text,
  Tooltip,
  useIndexResourceState,
} from "@shopify/polaris";
import { ClipboardIcon, DuplicateIcon, DeleteIcon } from "@shopify/polaris-icons";
import type { Widget } from "../../lib/db/schema";
import { WIDGET_TYPES } from "./widget-types";
import { PROVIDERS } from "../providers/providers";

export interface WidgetsTableProps {
  widgets: Widget[];
}

/**
 * The widget list table. Each row shows the widget name (linking to the
 * editor), a type badge, provider, published status, and the theme handle
 * with a copy button. Per-row Duplicate / Delete post to the route `action`
 * via `useSubmit` with an `intent`.
 */
export function WidgetsTable({ widgets }: WidgetsTableProps) {
  const submit = useSubmit();
  const resourceName = { singular: "widget", plural: "widgets" };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(
      widgets as unknown as { [key: string]: unknown; id: string }[],
    );

  const copyHandle = useCallback((handle: string) => {
    void navigator.clipboard?.writeText(handle);
  }, []);

  const rowAction = useCallback(
    (intent: "duplicate" | "delete", id: string, name: string) => {
      if (intent === "delete" && !confirm(`Delete widget "${name}"?`)) return;
      const form = new FormData();
      form.set("intent", intent);
      form.set("id", id);
      submit(form, { method: "post" });
    },
    [submit],
  );

  return (
    <IndexTable
      resourceName={resourceName}
      itemCount={widgets.length}
      selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
      onSelectionChange={handleSelectionChange}
      selectable={false}
      headings={[
        { title: "Name" },
        { title: "Type" },
        { title: "Provider" },
        { title: "Status" },
        { title: "Handle" },
        { title: "Actions", alignment: "end" },
      ]}
    >
      {widgets.map((widget, index) => {
        const typeMeta = WIDGET_TYPES[widget.type];
        const providerMeta = PROVIDERS[widget.provider];
        return (
          <IndexTable.Row id={widget.id} key={widget.id} position={index}>
            <IndexTable.Cell>
              <Link to={`/app/widgets/${widget.id}`}>
                <Text as="span" fontWeight="medium">
                  {widget.name}
                </Text>
              </Link>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Badge tone="info">{typeMeta?.label ?? widget.type}</Badge>
            </IndexTable.Cell>
            <IndexTable.Cell>{providerMeta?.displayName ?? widget.provider}</IndexTable.Cell>
            <IndexTable.Cell>
              {widget.isPublished ? (
                <Badge tone="success">Published</Badge>
              ) : (
                <Badge>Draft</Badge>
              )}
            </IndexTable.Cell>
            <IndexTable.Cell>
              <InlineStack gap="100" blockAlign="center" wrap={false}>
                <Text as="span" tone="subdued">
                  {widget.handle}
                </Text>
                <Tooltip content="Copy handle">
                  <Button
                    variant="tertiary"
                    size="micro"
                    icon={<Icon source={ClipboardIcon} tone="subdued" />}
                    accessibilityLabel={`Copy handle ${widget.handle}`}
                    onClick={() => copyHandle(widget.handle)}
                  />
                </Tooltip>
              </InlineStack>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <InlineStack align="end" gap="100" wrap={false}>
                <ButtonGroup>
                  <Button
                    variant="tertiary"
                    icon={<Icon source={DuplicateIcon} tone="subdued" />}
                    accessibilityLabel={`Duplicate ${widget.name}`}
                    onClick={() => rowAction("duplicate", widget.id, widget.name)}
                  >
                    Duplicate
                  </Button>
                  <Button
                    variant="tertiary"
                    tone="critical"
                    icon={<Icon source={DeleteIcon} tone="critical" />}
                    accessibilityLabel={`Delete ${widget.name}`}
                    onClick={() => rowAction("delete", widget.id, widget.name)}
                  >
                    Delete
                  </Button>
                </ButtonGroup>
              </InlineStack>
            </IndexTable.Cell>
          </IndexTable.Row>
        );
      })}
    </IndexTable>
  );
}
