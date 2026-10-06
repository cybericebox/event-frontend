import type { PublicEventInfo } from "@/types/publicEventInfo"
import { whiteTextContrast } from "../../deriveTheme"
import { DEFAULT_BRAND, type BrandColors } from "./emailBlocks"

/** What the `theme:*` tokens stand for in this Event's emails: its brand, accent and the readable text on the accent. */
export function eventBrandColors(event: Pick<PublicEventInfo, "Theme">): BrandColors {
  const brand = event.Theme?.Brand || DEFAULT_BRAND["theme:brand"]
  const accent = event.Theme?.Accent || brand
  const contrast = whiteTextContrast(accent)
  return { "theme:brand": brand, "theme:accent": accent, "theme:on_accent": contrast !== null && contrast < 4.5 ? "#000000" : "#FFFFFF" }
}
