// Theme cookie: `cib_theme` on the parent domain; a pre-rename `ib_theme` is migrated on first read.
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

  it("readThemeChoice moves the old ib_theme cookie to cib_theme", () => {
    const { writes, jar } = fakeBrowser({ ib_theme: "dark" })
    expect(theme.readThemeChoice()).toBe("dark")
    expect(jar.get("cib_theme")).toBe("dark")
    expect(jar.has("ib_theme")).toBe(false)
    expect(writes).toEqual([
      "cib_theme=dark; path=/; SameSite=Lax; Secure; max-age=31536000",
      "ib_theme=; path=/; SameSite=Lax; Secure; max-age=0",
    ])
  })

  it("the boot script migrates before first paint", () => {
    const { jar, attrs } = fakeBrowser({ ib_theme: "dark" })
    new Function(theme.THEME_BOOT_SCRIPT)()
    expect(attrs["data-theme"]).toBe("dark")
    expect(jar.get("cib_theme")).toBe("dark")
    expect(jar.has("ib_theme")).toBe(false)
  })

  it("cib_theme wins over a leftover ib_theme and nothing is rewritten", () => {
    const { writes, attrs } = fakeBrowser({ ib_theme: "dark", cib_theme: "light" })
    expect(theme.readThemeChoice()).toBe("light")
    new Function(theme.THEME_BOOT_SCRIPT)()
    expect(attrs["data-theme"]).toBe("light")
    expect(writes).toEqual([])
  })

  it("setThemeChoice writes cib_theme", () => {
    const { jar, attrs } = fakeBrowser({})
    theme.setThemeChoice("dark")
    expect(jar.get("cib_theme")).toBe("dark")
    expect(attrs["data-theme"]).toBe("dark")
  })
})
