import { Checkbox, FormLayout, TextField } from "@shopify/polaris";
import type { TypeControlProps } from "./types";

/** Carousel: cards per view, autoplay, and an optional mini map. */
export function CarouselControls({ config, update }: TypeControlProps) {
  return (
    <FormLayout>
      <TextField
        label="Cards per view"
        type="number"
        min={1}
        max={10}
        autoComplete="off"
        value={String(config.cardsPerView ?? 3)}
        onChange={(v) => update({ cardsPerView: v ? Number(v) : undefined })}
        helpText="How many location cards are visible at once."
      />
      <Checkbox
        label="Autoplay"
        checked={config.autoplay ?? false}
        onChange={(checked) => update({ autoplay: checked })}
        helpText="Automatically advance the carousel."
      />
      <Checkbox
        label="Show mini map"
        checked={config.showMiniMap ?? false}
        onChange={(checked) => update({ showMiniMap: checked })}
        helpText="Show a small map that follows the active card."
      />
    </FormLayout>
  );
}
