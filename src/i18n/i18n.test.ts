/**
 * i18n.test.ts — catalog parity guard.
 * (1) en.json and uk.json carry the SAME key sets, and no value is blank;
 * (2) both catalogs use the same {placeholders} per key;
 * (3) every ApiErrorCode with a uk message also has an en message and vice versa;
 * (4) t() interpolates vars and falls back to the key.
 */
import {describe, expect, it} from "vitest"
import en from "../../messages/en.json"
import uk from "../../messages/uk.json"
import errorsEn from "../../messages/errors.en.json"
import errorsUk from "../../messages/errors.uk.json"
import {t} from "./t"
import {apiErrorMessage} from "./apiError"

const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()

describe("i18n catalogs", () => {
  it("en and uk define the same keys", () => {
    expect(Object.keys(uk).sort()).toEqual(Object.keys(en).sort())
  })

  it("errors.en and errors.uk define the same codes", () => {
    expect(Object.keys(errorsUk).sort()).toEqual(Object.keys(errorsEn).sort())
  })

  it("no value is blank", () => {
    for (const catalog of [en, uk, errorsEn, errorsUk] as Record<string, string>[]) {
      for (const [key, value] of Object.entries(catalog)) expect(value.trim(), `blank value for ${key}`).not.toBe("")
    }
  })

  it("uk and en use the same placeholders", () => {
    const enCatalog = en as Record<string, string>
    for (const [key, value] of Object.entries(uk as Record<string, string>)) {
      expect(placeholders(value), `placeholders differ for ${key}`).toEqual(placeholders(enCatalog[key] ?? ""))
    }
  })
})

describe("t", () => {
  it("renders Ukrainian by default", () => {
    expect(t("error.generic")).toBe((uk as Record<string, string>)["error.generic"])
  })

  it("interpolates vars and keeps unknown placeholders", () => {
    expect(t("missing.key {a} {b}", {a: 1})).toBe("missing.key 1 {b}")
  })

  it("falls back to the key", () => {
    expect(t("missing.key")).toBe("missing.key")
  })
})

describe("apiErrorMessage", () => {
  it("maps a known code to the uk message", () => {
    expect(apiErrorMessage(1707, "fallback")).toBe((errorsUk as Record<string, string>)["1707"])
  })

  it("falls back for unknown or missing codes", () => {
    expect(apiErrorMessage(9999, "fallback")).toBe("fallback")
    expect(apiErrorMessage(undefined)).toBe(t("error.generic"))
  })
})
