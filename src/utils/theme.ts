/**
 * Event frontend copy of the shared CyberICEBox theme choice behavior.
 *
 * COPY-TO-RP-APPS: app-agnostic, static-export-safe.
 *
 * The choice (light | dark | system) lives in the `cib_theme` cookie on the
 * parent domain (.NEXT_PUBLIC_DOMAIN), so landing, ID, admin and event open in
 * the same theme. `system` follows the OS setting. The resolved theme is put on
 * <html data-theme="…"> — ds-v2 tokens switch on that attribute.
 *
 * THEME_BOOT_SCRIPT runs inline in <head> before first paint (no light flash).
 * Both it and readThemeChoice move a pre-rename `ib_theme` cookie to `cib_theme`.
 */

export type ThemeChoice = "light" | "dark" | "system"

export const THEME_COOKIE = "cib_theme"
export const LEGACY_THEME_COOKIE = "ib_theme"
const MAX_AGE = 60 * 60 * 24 * 365
const DARK_QUERY = "(prefers-color-scheme: dark)"
// Placeholder builds (NEXT_PUBLIC_DOMAIN substituted at container start) and
// dev without a domain fall back to a host-only cookie.
const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN
const DOMAIN_ATTR = DOMAIN && DOMAIN !== "NEXT_PUBLIC_DOMAIN" ? `; domain=.${DOMAIN}` : ""

// Keep in sync with readThemeChoice/resolveTheme/applyTheme below.
export const THEME_BOOT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark|system)/);if(!m){m=document.cookie.match(/(?:^|; )${LEGACY_THEME_COOKIE}=(light|dark|system)/);if(m){var a="; path=/${DOMAIN_ATTR}; SameSite=Lax"+(location.protocol==="https:"?"; Secure":"");document.cookie="${THEME_COOKIE}="+m[1]+a+"; max-age=${MAX_AGE}";document.cookie="${LEGACY_THEME_COOKIE}="+a+"; max-age=0"}}var c=m?m[1]:"system";var d=c==="dark"||(c==="system"&&window.matchMedia("${DARK_QUERY}").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})()`

function matchChoice(name: string): ThemeChoice | undefined {
  return document.cookie.match(new RegExp(`(?:^|; )${name}=(light|dark|system)`))?.[1] as ThemeChoice | undefined
}

function writeCookie(value: string, maxAge: number, name = THEME_COOKIE): void {
  const secure = location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${name}=${value}; path=/${DOMAIN_ATTR}; SameSite=Lax${secure}; max-age=${maxAge}`
}

export function readThemeChoice(): ThemeChoice {
  if (typeof document === "undefined") return "system"
  const choice = matchChoice(THEME_COOKIE)
  if (choice) return choice
  const legacy = matchChoice(LEGACY_THEME_COOKIE)
  if (!legacy) return "system"
  writeCookie(legacy, MAX_AGE)
  writeCookie("", 0, LEGACY_THEME_COOKIE)
  return legacy
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
  writeCookie(choice, MAX_AGE)
  applyTheme(choice)
  window.dispatchEvent(new CustomEvent<ThemeChoice>("ib-theme-change", {detail: choice}))
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
