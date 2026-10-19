// Localize an API error by its stable detail code (objectCode*100 + detailCode,
// see errorDetailCode), NOT by the backend's English Status.Message.
// Resolution: uk → en → fallback. errors.uk.json may be partial: codes without
// a uk entry fall through to the English catalog until translated.
import errorsUk from "../../messages/errors.uk.json"
import errorsEn from "../../messages/errors.en.json"
import {isOverloadError, OVERLOAD_DETAIL_CODES} from "../api/retry"
import {t} from "./t"

const uk = errorsUk as Record<string, string>
const en = errorsEn as Record<string, string>

// Codes whose message carries the wait from Retry-After (HTTP 429).
const waitCodes = new Set([428])

// «45 с», «3 хв», «2 год»: the wait rounded up to the unit.
export function waitText(seconds: number): string {
  if (seconds < 60) return t("error.wait.seconds", {count: seconds})
  if (seconds < 3600) return t("error.wait.minutes", {count: Math.ceil(seconds / 60)})
  return t("error.wait.hours", {count: Math.ceil(seconds / 3600)})
}

// Returns a user-facing message for a known backend code, or the fallback
// (the generic UI-language message when none is given). retryAfter is the
// Retry-After header of a 429; rate-limit codes show it as the wait time.
export function apiErrorMessage(code: number | undefined, fallback: string = t("error.generic"), retryAfter?: number): string {
  if (code === undefined) return fallback
  if (waitCodes.has(code)) {
    return retryAfter ? t("error.rateLimited.wait", {wait: waitText(retryAfter)}) : t("error.rateLimited")
  }
  const key = String(code)
  return uk[key] ?? en[key] ?? fallback
}

// The overloaded line for the server's overload signal (a 503 with Retry-After, an overload code); undefined for any
// other error, a 429 (a personal limit with its own message) included.
export function overloadedMessage(error: unknown): string | undefined {
  return isOverloadError(error) ? t("error.overloaded") : undefined
}

// The message for an API error object (its numeric `status`, detail `code` and `retryAfter`): the catalog text
// of its code (a rate limit with its wait), the overloaded line for the overload signal without one, else the fallback.
export function apiErrorText(error: unknown, fallback: string = t("error.generic")): string {
  if (!(error instanceof Error)) return fallback
  const {code, retryAfter} = error as {code?: unknown; retryAfter?: unknown}
  // The overload codes (ServiceOverloaded 431, DatabaseBusy 432) always read as the one overloaded line the app shows
  // with its retry, not as their catalog texts.
  if (typeof code === "number" && OVERLOAD_DETAIL_CODES.includes(code % 10_000) && isOverloadError(error)) return t("error.overloaded")
  const known = apiErrorMessage(typeof code === "number" ? code : undefined, "", typeof retryAfter === "number" ? retryAfter : undefined)
  return known || (overloadedMessage(error) ?? fallback)
}
