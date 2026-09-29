// Server- and client-safe i18n wrapper.
// Build-time JSON import — no runtime locale provider, no locale switching.
//
// Two catalogs are maintained: messages/en.json (source of truth for the key set)
// and messages/uk.json (the ACTIVE language). The UI ships in Ukrainian; English
// is kept in sync as the reference/fallback. To switch the active language, change
// the `active` import below.
import en from "../../messages/en.json"
import uk from "../../messages/uk.json"
import {createElement, Fragment, type ReactNode} from "react"

// `en` defines the canonical key set; `uk` is what users see.
const active = uk as Record<string, string>
const activeLocale = "uk"
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

/**
 * Like t(), but placeholders may be elements (a link): returns the text split
 * around them (keyed fragments), ready to render as children.
 */
export function tRich(key: MessageKey | (string & {}), vars: Record<string, ReactNode>): ReactNode[] {
  return richParts(t(key), vars)
}

function richParts(text: string, vars: Record<string, ReactNode>): ReactNode[] {
  return text.split(/(\{\w+\})/).map((part, i) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1]
    // the split of a fixed message never reorders, so the position is a stable key
    return createElement(Fragment, {key: i}, name !== undefined && name in vars ? vars[name] : part)
  })
}

/**
 * tRich for a « · »-separated credit line: each segment becomes an unbreakable
 * (nowrap) span and keeps its trailing dot, so lines break only after a separator.
 * `groupFrom` glues the segments from that index on into one inline-block group:
 * the group moves to the next line whole and splits (at its dots) only when it
 * cannot fit a line by itself.
 */
export function tSegments(key: MessageKey | (string & {}), vars: Record<string, ReactNode>, {groupFrom}: {groupFrom?: number} = {}): ReactNode[] {
  const parts = t(key).split(" · ")
  const last = parts.length - 1
  const segment = (part: string, i: number): ReactNode[] => [
    createElement("span", {key: i, style: {whiteSpace: "nowrap"}}, ...richParts(part, vars), i < last ? " ·" : null),
    i < last ? " " : null,
  ]
  if (groupFrom === undefined || groupFrom <= 0 || groupFrom > last) return parts.flatMap(segment)
  return [
    ...parts.slice(0, groupFrom).flatMap(segment),
    createElement("span", {key: "group", style: {display: "inline-block"}}, ...parts.slice(groupFrom).flatMap((part, j) => segment(part, groupFrom + j))),
  ]
}

const pluralRules = new Intl.PluralRules(activeLocale)

/**
 * Translate a counted message. Plural keys come in three forms — `key.one`,
 * `key.few`, `key.many` — in both catalogs (en repeats its plural in few/many).
 * `{count}` is always available to the message.
 */
export function tPlural(key: string, count: number, vars?: MessageVars): string {
  const category = pluralRules.select(count)
  const form = category === "one" || category === "few" ? category : "many"
  return t(`${key}.${form}`, {count, ...vars})
}
