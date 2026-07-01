import {
  BlockStack,
  Box,
  Button,
  Card,
  Icon,
  InlineStack,
  ProgressBar,
  Text,
} from "@shopify/polaris";
import { CheckCircleIcon } from "@shopify/polaris-icons";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  done: boolean;
  cta: { content: string; url?: string; external?: boolean };
}

export interface OnboardingChecklistProps {
  steps: OnboardingStep[];
}

/**
 * A four-step "get started" checklist shown on the home dashboard. Each step
 * derives its `done` state from real data (see loader in app._index.tsx) —
 * nothing here is tracked separately, so it can never drift from reality.
 */
export function OnboardingChecklist({ steps }: OnboardingChecklistProps) {
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  return (
    <Card>
      <BlockStack gap="400">
        <BlockStack gap="200">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h2" variant="headingMd">
              {allDone ? "You're all set" : "Get started"}
            </Text>
            <Text as="span" tone="subdued" variant="bodySm">
              {doneCount} of {steps.length} complete
            </Text>
          </InlineStack>
          <ProgressBar progress={(doneCount / steps.length) * 100} size="small" />
          {!allDone ? (
            <Text as="p" tone="subdued">
              Follow these steps to get your store locator live on your storefront.
            </Text>
          ) : (
            <Text as="p" tone="subdued">
              Your store locator is live. Come back here anytime to check on things.
            </Text>
          )}
        </BlockStack>

        <BlockStack gap="0">
          {steps.map((step, index) => (
            <Box
              key={step.id}
              paddingBlock="300"
              borderBlockStartWidth={index === 0 ? "0" : "025"}
              borderColor="border"
            >
              <InlineStack align="space-between" blockAlign="center" gap="400" wrap={false}>
                <InlineStack gap="300" blockAlign="center" wrap={false}>
                  {step.done ? (
                    <Icon source={CheckCircleIcon} tone="success" />
                  ) : (
                    <Box
                      minWidth="20px"
                      minHeight="20px"
                      background="bg-surface-secondary"
                      borderRadius="full"
                      borderWidth="025"
                      borderColor="border"
                    >
                      <InlineStack align="center" blockAlign="center">
                        <Text as="span" tone="subdued" variant="bodySm">
                          {index + 1}
                        </Text>
                      </InlineStack>
                    </Box>
                  )}
                  <BlockStack gap="050">
                    <Text as="p" fontWeight="semibold">
                      {step.title}
                    </Text>
                    <Text as="p" tone="subdued" variant="bodySm">
                      {step.description}
                    </Text>
                  </BlockStack>
                </InlineStack>
                {!step.done ? (
                  step.cta.external ? (
                    <Button url={step.cta.url} target="_blank">
                      {step.cta.content}
                    </Button>
                  ) : step.cta.url ? (
                    <Button url={step.cta.url}>{step.cta.content}</Button>
                  ) : null
                ) : (
                  <Text as="span" tone="success" variant="bodySm" fontWeight="medium">
                    Done
                  </Text>
                )}
              </InlineStack>
            </Box>
          ))}
        </BlockStack>
      </BlockStack>
    </Card>
  );
}
