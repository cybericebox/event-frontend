// The shared design system (docs/design-system of the monorepo) is copied into src/styles, never imported.
//   node scripts/sync-ds.mjs           copy the verbatim files, record every DS-derived file in src/styles/ds/manifest.json
//   node scripts/sync-ds.mjs --check   exit 1 on drift (CI)
// Two kinds of files:
//   copy:     verbatim copies (the sync overwrites them; edit the DS, not the copy);
//   extended: copies that carry event-owned additions. The sync never overwrites them; after merging a new DS version
//             by hand, run the sync to record the new hashes.
// The DS folder is not in this repository, so the check has two levels:
//   1. always: every file still has the sha256 in manifest.json (no hand edits, no half-synced files);
//   2. when the DS source is reachable (DS_DIR, docs/design-system in the monorepo checkout, ds-source/):
//      the source hash equals the one recorded (the DS moved on: merge it), and a verbatim copy equals the source.
import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const styles = join(root, "src/styles")
const manifestPath = join(styles, "ds/manifest.json")
const check = process.argv.includes("--check")
const sha = (text) => createHash("sha256").update(text).digest("hex")

const candidates = [process.env.DS_DIR, join(root, "ds-source")]
for (let dir = root; dir !== dirname(dir); dir = dirname(dir)) candidates.push(join(dir, "docs/design-system"))
const src = candidates.filter(Boolean).find((d) => existsSync(join(d, "tokens.css")))

// local file in src/styles → source file in the DS
const copy = {
    "base.css": "base.css",
    "admin-sidebar.css": "patterns/admin-sidebar/admin-sidebar.css",
    "navbar.css": "patterns/navbar/navbar.css",
    "modal.css": "components/modal/modal.css",
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
    "block-facts.css": "patterns/blocks/facts/facts.css",
    "block-faq.css": "patterns/blocks/faq/faq.css",
    "block-doc.css": "patterns/blocks/doc/doc.css",
}
const extended = {
    "accordion.css": "components/accordion/accordion.css",
    "tokens.css": "tokens.css",
    "button.css": "components/button/button.css",
    "category-rail.css": "components/category-rail/category-rail.css",
    "challenge-board.css": "components/challenge-board/challenge-board.css",
    "challenge-modal.css": "components/challenge-modal/challenge-modal.css",
    "challenge-tile.css": "components/challenge-tile/challenge-tile.css",
    "copy-field.css": "components/copy-field/copy-field.css",
    "empty-state.css": "components/empty-state/empty-state.css",
    "footer.css": "patterns/footer/footer.css",
    "hero.css": "patterns/blocks/hero/hero.css",
    "input.css": "components/input/input.css",
    "select.css": "components/select/select.css",
    "tag.css": "components/tag/tag.css",
    "timer.css": "components/timer/timer.css",
    "tooltip.css": "components/tooltip/tooltip.css",
    "tower.css": "patterns/tower/tower.css",
    "block-countdown.css": "patterns/blocks/countdown/countdown.css",
    "block-cta.css": "patterns/blocks/cta/cta.css",
    "block-divider.css": "patterns/blocks/divider/divider.css",
    "block-partners.css": "patterns/blocks/partners/partners.css",
    "block-timeline.css": "patterns/blocks/timeline/timeline.css",
}

const old = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {}
const read = (path) => (existsSync(path) ? readFileSync(path, "utf8") : "")
const all = [...Object.entries(copy).map(([f, s]) => [f, s, "copy"]), ...Object.entries(extended).map(([f, s]) => [f, s, "extended"])]

if (check) {
    let drift = 0
    for (const [file, from, kind] of all) {
        const entry = old[file]
        const local = read(join(styles, file))
        if (!entry || entry.sha !== sha(local)) {
            console.error(`ds drift: src/styles/${file} does not match manifest.json (edited by hand or not synced)`)
            drift++
        }
        if (!src) continue
        const source = read(join(src, from))
        if (!entry || entry.source !== sha(source)) {
            console.error(`ds drift: docs/design-system/${from} changed since src/styles/${file} was synced`)
            drift++
        }
        if (kind === "copy" && local !== source) {
            console.error(`ds drift: src/styles/${file} differs from docs/design-system/${from}`)
            drift++
        }
    }
    if (!src) console.log("ds check: design system source not found, manifest check only")
    if (drift) {
        console.error("run: npm run sync:ds and commit the result")
        process.exit(1)
    }
} else {
    if (!src) {
        console.error("design system source not found (set DS_DIR)")
        process.exit(1)
    }
    const next = {}
    for (const [file, from, kind] of all) {
        const target = join(styles, file)
        if (kind === "copy" && read(target) !== read(join(src, from))) {
            mkdirSync(dirname(target), { recursive: true })
            copyFileSync(join(src, from), target)
            console.log(`synced ${file}`)
        }
        next[file] = { kind, source: sha(read(join(src, from))), sha: sha(read(target)) }
    }
    writeFileSync(manifestPath, JSON.stringify(next, null, 2) + "\n")
}
