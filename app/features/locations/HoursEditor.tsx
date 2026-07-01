import {
  BlockStack,
  Checkbox,
  InlineGrid,
  InlineStack,
  Text,
  TextField,
} from "@shopify/polaris";
import type { LocationHours } from "../../lib/db/schema";

const DAYS: { key: string; label: string }[] = [
  { key: "1", label: "Monday" },
  { key: "2", label: "Tuesday" },
  { key: "3", label: "Wednesday" },
  { key: "4", label: "Thursday" },
  { key: "5", label: "Friday" },
  { key: "6", label: "Saturday" },
  { key: "7", label: "Sunday" },
];

const DEFAULT_OPEN = "09:00";
const DEFAULT_CLOSE = "17:00";

export interface HoursEditorProps {
  value: LocationHours;
  onChange: (value: LocationHours) => void;
}

/**
 * One row per ISO weekday (Mon–Sun): open/close time inputs plus a "Closed"
 * checkbox. Serializes to the `LocationHours` JSON shape — each day maps to
 * an array with a single `{ open, close, closed }` entry (the schema allows
 * multiple split-shift entries per day, but a single entry per day covers
 * the common case and keeps the editor simple).
 */
export function HoursEditor({ value, onChange }: HoursEditorProps) {
  function dayEntry(key: string) {
    const entries = value[key];
    return entries?.[0] ?? { open: DEFAULT_OPEN, close: DEFAULT_CLOSE, closed: true };
  }

  function updateDay(key: string, patch: Partial<{ open: string; close: string; closed: boolean }>) {
    const current = dayEntry(key);
    const next = { ...current, ...patch };
    onChange({ ...value, [key]: [next] });
  }

  return (
    <BlockStack gap="300">
      {DAYS.map(({ key, label }) => {
        const entry = dayEntry(key);
        const closed = entry.closed ?? false;
        return (
          <InlineGrid key={key} columns={{ xs: 1, sm: "120px 1fr 1fr 100px" }} gap="300">
            <Text as="p" variant="bodyMd" fontWeight="medium">
              {label}
            </Text>
            <TextField
              label={`${label} opening time`}
              labelHidden
              type="time"
              autoComplete="off"
              value={entry.open}
              onChange={(v) => updateDay(key, { open: v })}
              disabled={closed}
            />
            <TextField
              label={`${label} closing time`}
              labelHidden
              type="time"
              autoComplete="off"
              value={entry.close}
              onChange={(v) => updateDay(key, { close: v })}
              disabled={closed}
            />
            <InlineStack blockAlign="center">
              <Checkbox
                label="Closed"
                checked={closed}
                onChange={(v) => updateDay(key, { closed: v })}
              />
            </InlineStack>
          </InlineGrid>
        );
      })}
    </BlockStack>
  );
}

/** An empty week — every day defaulted to closed. Used to seed a new location's hours. */
export function emptyHours(): LocationHours {
  const out: LocationHours = {};
  for (const { key } of DAYS) {
    out[key] = [{ open: DEFAULT_OPEN, close: DEFAULT_CLOSE, closed: true }];
  }
  return out;
}
