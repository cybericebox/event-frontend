/**
 * Drift check against the shared design system (docs/design-system, copied here, never imported).
 * These files must stay byte-identical to the DS copy; the other styles that come from the DS carry
 * event-owned additions and are reviewed by hand. The DS lives in the monorepo next to this repo, so the
 * check runs wherever it is checked out (set DS_DIR to point at it) and is skipped where it is not.
 */
import {describe, expect, it} from "vitest"
import fs from "node:fs"
import path from "node:path"

const SRC = path.resolve(import.meta.dirname, "..")
// Without DS_DIR, look for docs/design-system in the folders above (also from a worktree).
function findDS(): string {
  if (process.env.DS_DIR) return process.env.DS_DIR
  for (let dir = SRC; dir !== path.dirname(dir); dir = path.dirname(dir)) {
    const candidate = path.join(dir, "docs", "design-system")
    if (fs.existsSync(path.join(candidate, "tokens.css"))) return candidate
  }
  return ""
}
const DS = findDS()
const IDENTICAL: Record<string, string> = {
  "base.css": "base.css",
  "toc.css": "components/toc/toc.css",
  "field.css": "components/field/field.css",
  "tabs.css": "components/tabs/tabs.css",
  "segmented.css": "components/segmented/segmented.css",
  "link.css": "components/link/link.css",
  "checkbox.css": "components/checkbox/checkbox.css",
  "switch.css": "components/switch/switch.css",
  "banner.css": "components/banner/banner.css",
  "icon-button.css": "components/icon-button/icon-button.css",
  "page-header.css": "patterns/page-header/page-header.css",
}

describe.skipIf(!DS)("design system drift", () => {
  for (const [local, shared] of Object.entries(IDENTICAL)) {
    it(`${local} matches the design system`, () => {
      const file = path.join(DS, shared)
      if (!fs.existsSync(file)) return
      expect(fs.readFileSync(path.join(SRC, "styles", local), "utf8")).toBe(fs.readFileSync(file, "utf8"))
    })
  }
})
