import { useNavigate } from "react-router";
import {
  Badge,
  BlockStack,
  Box,
  Icon,
  InlineGrid,
  InlineStack,
  Text,
  type IconSource,
} from "@shopify/polaris";
import {
  LocationIcon,
  SearchIcon,
  ViewIcon,
  ListBulletedIcon,
  PinIcon,
} from "@shopify/polaris-icons";
import { WIDGET_TYPES, WIDGET_TYPE_ORDER } from "./widget-types";
import { planAllowsWidgetType } from "../../lib/billing/plans";

/**
 * The `icon` strings on `WIDGET_TYPES` are client-safe identifiers (no
 * component imports in that data-only module). Resolve them to real
 * Polaris icon components here, falling back to a location pin.
 */
const ICONS: Record<string, IconSource> = {
  MapIcon: LocationIcon,
  SearchIcon: SearchIcon,
  CarouselIcon: ViewIcon,
  ListIcon: ListBulletedIcon,
  PinIcon: PinIcon,
};

export interface WidgetTypeGalleryProps {
  /**
   * Active plan handle. Gating is computed here via `planAllowsWidgetType`
   * (the same helper the server action enforces) so the gallery and the
   * server can never disagree on what's allowed. The server remains the real
   * gate — this is advisory UI only.
   */
  plan: string;
}

/**
 * A gallery of the five widget types as selectable cards. Allowed types
 * navigate to the create editor pre-seeded with `?type=`. A premium type the
 * current plan can't use shows an "Upgrade" badge and routes to billing
 * instead — the real gate is enforced server-side in the editor's action.
 */
export function WidgetTypeGallery({ plan }: WidgetTypeGalleryProps) {
  const navigate = useNavigate();

  return (
    <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
      {WIDGET_TYPE_ORDER.map((type) => {
        const meta = WIDGET_TYPES[type];
        const allowed = planAllowsWidgetType(plan, type);
        const icon = ICONS[meta.icon] ?? LocationIcon;
        const target = allowed
          ? `/app/widgets/new?type=${type}`
          : "/app/billing";

        return (
          <button
            key={type}
            type="button"
            onClick={() => navigate(target)}
            aria-label={
              allowed
                ? `Create a ${meta.label} widget`
                : `${meta.label} — upgrade to Premium`
            }
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              cursor: "pointer",
              padding: 0,
              border: "none",
              background: "transparent",
            }}
          >
            <Box
              background="bg-surface"
              borderColor="border"
              borderWidth="025"
              borderRadius="300"
              padding="400"
              minHeight="100%"
            >
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Box
                    background="bg-surface-secondary"
                    borderRadius="200"
                    padding="200"
                  >
                    <Icon source={icon} tone="base" />
                  </Box>
                  {allowed ? (
                    meta.requiresPremium ? (
                      <Badge tone="info">Premium</Badge>
                    ) : (
                      <Badge tone="success">Free</Badge>
                    )
                  ) : (
                    <Badge tone="attention">Upgrade</Badge>
                  )}
                </InlineStack>
                <Text as="h3" variant="headingMd">
                  {meta.label}
                </Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  {meta.description}
                </Text>
              </BlockStack>
            </Box>
          </button>
        );
      })}
    </InlineGrid>
  );
}
