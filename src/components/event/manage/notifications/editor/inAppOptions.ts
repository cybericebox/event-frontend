/**
 * inAppOptions.ts — In-app notification channel option constants.
 *
 * The frontend defines the label/value pairs; the backend accepts free strings
 * for Icon, Tone, Surface, and AccentColor. Appearance options drive the editor UI
 * and the live InAppPreview card.
 */

// ── Icons ─────────────────────────────────────────────────────────────────────

export const ICONS: { value: string; labelKey: string }[] = [
  { value: "info",    labelKey: "manage.tpl.inapp.icon.info" },
  { value: "success", labelKey: "manage.tpl.inapp.icon.success" },
  { value: "warning", labelKey: "manage.tpl.inapp.icon.warning" },
  { value: "error",   labelKey: "manage.tpl.inapp.icon.error" },
  { value: "bell",    labelKey: "manage.tpl.inapp.icon.bell" },
  { value: "mail",    labelKey: "manage.tpl.inapp.icon.mail" },
  { value: "calendar", labelKey: "manage.tpl.inapp.icon.calendar" },
  { value: "user",    labelKey: "manage.tpl.inapp.icon.user" },
  { value: "shield",  labelKey: "manage.tpl.inapp.icon.shield" },
  { value: "trophy",  labelKey: "manage.tpl.inapp.icon.trophy" },
]

export const APPEARANCES = [
  { tone: "neutral", icon: "bell", labelKey: "manage.tpl.inapp.tone.neutral" },
  { tone: "info", icon: "info", labelKey: "manage.tpl.inapp.tone.info" },
  { tone: "success", icon: "success", labelKey: "manage.tpl.inapp.tone.success" },
  { tone: "warning", icon: "warning", labelKey: "manage.tpl.inapp.tone.warning" },
  { tone: "danger", icon: "error", labelKey: "manage.tpl.inapp.tone.danger" },
] as const

// ── Tones (default accent/border colours) ─────────────────────────────────────

export const TONES: { value: string; labelKey: string; color: string }[] = [
  { value: "neutral", labelKey: "manage.tpl.inapp.tone.neutral", color: "#64748B" },
  { value: "info",    labelKey: "manage.tpl.inapp.tone.info",    color: "#0091EA" },
  { value: "success", labelKey: "manage.tpl.inapp.tone.success", color: "#16A34A" },
  { value: "warning", labelKey: "manage.tpl.inapp.tone.warning", color: "#D97706" },
  { value: "danger",  labelKey: "manage.tpl.inapp.tone.danger",  color: "#DC2626" },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the default border/accent color for a tone value.
 * Falls back to neutral (#64748B) for unknown tones.
 */
export function toneColor(tone: string): string {
  return TONES.find((t) => t.value === tone)?.color ?? TONES[0].color
}

/**
 * Resolves the effective accent color for a template-like object.
 * If `AccentColor` is non-empty it takes precedence; otherwise the
 * tone's default color is used.
 */
export function accentOf(tmplLike: { Tone: string; AccentColor: string }): string {
  return /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(tmplLike.AccentColor)
    ? tmplLike.AccentColor
    : toneColor(tmplLike.Tone)
}

export const POP_IN_MIN_SECONDS = 3
export const POP_IN_MAX_SECONDS = 10
