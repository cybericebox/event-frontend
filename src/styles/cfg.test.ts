// @vitest-environment jsdom
/**
 * cfg.css hides the optional blocks by the setting attributes of <html> (src/utils/settings.ts). The selectors are run by a real selector engine
 * against every state of the settings (absent, empty, set), so the contract of each cfg-* class is pinned: shown exactly when its rule says so.
 */
import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"

const css = fs.readFileSync(path.resolve(import.meta.dirname, "cfg.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
// every rule of the file is "selector list { display: none !important; }"
const hidingSelectors = [...css.matchAll(/([^{}]+)\{\s*display:\s*none\s*!important;\s*\}/g)].flatMap((m) => m[1].split(/,\s*(?![^(]*\))/).map((s) => s.trim()).filter(Boolean))

type Value = "absent" | "empty" | "set"
const VALUES: Value[] = ["absent", "empty", "set"]
const ATTRS = { main: "data-cfg-main-site-url", terms: "data-cfg-terms-url", privacy: "data-cfg-privacy-url", cookies: "data-cfg-cookies-url" } as const

function hidden(cls: string, settings: Record<keyof typeof ATTRS, Value> & { ice: "absent" | "empty" | "true" | "false" }): boolean {
  const html = document.documentElement
  for (const attr of [...Object.values(ATTRS), "data-cfg-ice-support"]) html.removeAttribute(attr)
  for (const [key, attr] of Object.entries(ATTRS)) {
    const v = settings[key as keyof typeof ATTRS]
    if (v !== "absent") html.setAttribute(attr, v === "set" ? "https://example.org/x" : "")
  }
  if (settings.ice !== "absent") html.setAttribute("data-cfg-ice-support", settings.ice === "empty" ? "" : settings.ice)
  document.body.innerHTML = `<div id="probe" class="${cls}"></div>`
  const probe = document.getElementById("probe")!
  return hidingSelectors.some((selector) => probe.matches(selector))
}

const has = (v: Value) => v === "set"
const states: (Record<keyof typeof ATTRS, Value> & { ice: "absent" | "empty" | "true" | "false" })[] = []
for (const main of VALUES) for (const terms of VALUES) for (const privacy of VALUES) for (const cookies of VALUES) {
  for (const ice of ["absent", "empty", "true", "false"] as const) states.push({ main, terms, privacy, cookies, ice })
}

describe("cfg.css", () => {
  it("has at least one rule per contract class", () => {
    expect(hidingSelectors.length).toBeGreaterThan(10)
    for (const cls of ["cfg-main-only", "cfg-main-off", "cfg-terms", "cfg-privacy", "cfg-cookies", "cfg-ice-support", "cfg-ice-support-off", "cfg-consent-row", "cfg-v-both", "cfg-v-terms", "cfg-v-policy"]) {
      expect(hidingSelectors.some((selector) => selector.includes(`.${cls}`)), cls).toBe(true)
    }
  })

  it("shows a block exactly when its rule says so, for every combination of the settings", () => {
    for (const s of states) {
      const terms = has(s.terms)
      const privacy = has(s.privacy)
      const label = JSON.stringify(s)
      expect(hidden("cfg-main-only", s), `main-only ${label}`).toBe(!has(s.main))
      expect(hidden("cfg-main-off", s), `main-off ${label}`).toBe(has(s.main))
      expect(hidden("cfg-terms", s), `terms ${label}`).toBe(!terms)
      expect(hidden("cfg-privacy", s), `privacy ${label}`).toBe(!privacy)
      expect(hidden("cfg-cookies", s), `cookies ${label}`).toBe(!has(s.cookies))
      expect(hidden("cfg-ice-support", s), `ice ${label}`).toBe(s.ice !== "true")
      expect(hidden("cfg-ice-support-off", s), `ice-off ${label}`).toBe(s.ice === "true")
      expect(hidden("cfg-consent-row", s), `row ${label}`).toBe(!terms && !privacy)
      expect(hidden("cfg-v-both", s), `both ${label}`).toBe(!(terms && privacy))
      expect(hidden("cfg-v-terms", s), `terms-only ${label}`).toBe(!(terms && !privacy))
      expect(hidden("cfg-v-policy", s), `policy-only ${label}`).toBe(!(privacy && !terms))
    }
  })

  it("never hides a block that has no cfg class", () => {
    expect(hidden("plain", { main: "absent", terms: "absent", privacy: "absent", cookies: "absent", ice: "absent" })).toBe(false)
  })
})
