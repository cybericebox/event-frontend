// Localize an API error by its stable detail code (objectCode*100 + detailCode,
// see errorDetailCode), NOT by the backend's English Status.Message.
// Resolution: uk → en → fallback. errors.uk.json may be partial: codes without
// a uk entry fall through to the English catalog until translated.
import errorsUk from "../../messages/errors.uk.json"
import errorsEn from "../../messages/errors.en.json"
import {t} from "./t"

const uk = errorsUk as Record<string, string>
const en = errorsEn as Record<string, string>

// Returns a user-facing message for a known backend code, or the fallback
// (the generic UI-language message when none is given).
export function apiErrorMessage(code: number | undefined, fallback: string = t("error.generic")): string {
  if (code === undefined) return fallback
  const key = String(code)
  return uk[key] ?? en[key] ?? fallback
}
