// Server- and client-safe i18n wrapper.
// Build-time JSON import — no runtime locale provider, no locale switching.
//
// Two catalogs are maintained: messages/en.json (source of truth for the key set)
// and messages/uk.json (the ACTIVE language). The UI ships in Ukrainian; English
// is kept in sync as the reference/fallback. To switch the active language, change
// the `active` import below.
import en from "../../messages/en.json"
import uk from "../../messages/uk.json"

// `en` defines the canonical key set; `uk` is what users see.
const active = uk as Record<string, string>
const fallback = en as Record<string, string>

type MessageKey = keyof typeof en

export type MessageVars = Record<string, string | number>

/**
 * Translate a message key to the active-language (Ukrainian) string.
 * Falls back to English, then to the key itself. `{name}` placeholders are
 * replaced with `vars.name`; unknown placeholders are left as is.
 */
export function t(key: MessageKey | (string & {}), vars?: MessageVars): string {
  const message = active[key] ?? fallback[key] ?? key
  if (!vars) return message
  return message.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match)
}
