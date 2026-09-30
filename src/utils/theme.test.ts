// Theme cookie: `cib_theme` on the parent domain.
import { afterEach, describe, expect, it, vi } from "vitest"
import * as theme from "./theme"

// Minimal browser globals: a cookie jar that records every write, and <html data-theme>.
function fakeBrowser(initial: Record<string, string>) {
  const writes: string[] = []
  const jar = new Map(Object.entries(initial))
  const attrs: Record<string, string> = {}
  vi.stubGlobal("document", {
    get cookie() { return [...jar].map(([k, v]) => `${k}=${v}`).join("; ") },
    set cookie(s: string) {
      writes.push(s)
      const [k, v] = s.split("; ")[0].split("=")
      if (/max-age=0\b/.test(s)) jar.delete(k)
      else jar.set(k, v)
    },
    documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v } },
  })
  vi.stubGlobal("location", { protocol: "https:" })
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), dispatchEvent: () => true })
  return { writes, jar, attrs }
}

describe("theme cookie", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("readThemeChoice reads cib_theme", () => {
    fakeBrowser({ cib_theme: "dark" })
    expect(theme.readThemeChoice()).toBe("dark")
  })

  it("the boot script applies the choice before first paint", () => {
    const { attrs } = fakeBrowser({ cib_theme: "dark" })
    new Function(theme.THEME_BOOT_SCRIPT)()
    expect(attrs["data-theme"]).toBe("dark")
  })

  it("setThemeChoice writes cib_theme", () => {
    const { jar, attrs } = fakeBrowser({})
    theme.setThemeChoice("dark")
    expect(jar.get("cib_theme")).toBe("dark")
    expect(attrs["data-theme"]).toBe("dark")
  })
})
