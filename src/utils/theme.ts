/**
 * Event frontend copy of the shared CyberICEBox theme choice behavior.
 *
 * COPY-TO-RP-APPS: app-agnostic, static-export-safe.
 *
 * The choice (light | dark | system) lives in the `ib_theme` cookie on the
 * parent domain (.NEXT_PUBLIC_DOMAIN), so landing, ID, admin and event open in
 * the same theme. `system` follows the OS setting. The resolved theme is put on
 * <html data-theme="…"> — ds-v2 tokens switch on that attribute.
 *
 * THEME_BOOT_SCRIPT runs inline in <head> before first paint (no light flash).
 */

export type ThemeChoice = "light" | "dark" | "system"

export const THEME_COOKIE = "ib_theme"
const MAX_AGE = 60 * 60 * 24 * 365
const DARK_QUERY = "(prefers-color-scheme: dark)"

// Keep in sync with readThemeChoice/resolveTheme/applyTheme below.
export const THEME_BOOT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark|system)/);var c=m?m[1]:"system";var d=c==="dark"||(c==="system"&&window.matchMedia("${DARK_QUERY}").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})()`

export function readThemeChoice(): ThemeChoice {
  if (typeof document === "undefined") return "system"
  const m = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=(light|dark|system)`))
  return (m?.[1] as ThemeChoice) ?? "system"
}

export function resolveTheme(choice: ThemeChoice): "light" | "dark" {
  if (choice !== "system") return choice
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light"
}

export function applyTheme(choice: ThemeChoice): void {
  document.documentElement.setAttribute("data-theme", resolveTheme(choice))
}

/** Persist the choice on the parent domain and apply it immediately. */
export function setThemeChoice(choice: ThemeChoice): void {
  const domain = process.env.NEXT_PUBLIC_DOMAIN
  const parts = [
    `${THEME_COOKIE}=${choice}`,
    "path=/",
    `max-age=${MAX_AGE}`,
    "SameSite=Lax",
  ]
  // Placeholder builds (NEXT_PUBLIC_DOMAIN substituted at container start) and
  // dev without a domain fall back to a host-only cookie.
  if (domain && domain !== "NEXT_PUBLIC_DOMAIN") parts.push(`domain=.${domain}`)
  if (location.protocol === "https:") parts.push("Secure")
  document.cookie = parts.join("; ")
  applyTheme(choice)
}

/** Re-apply when the OS theme changes while the choice is `system`. Returns an unsubscribe. */
export function watchSystemTheme(getChoice: () => ThemeChoice): () => void {
  const mq = window.matchMedia(DARK_QUERY)
  const onChange = () => {
    if (getChoice() === "system") applyTheme("system")
  }
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}
