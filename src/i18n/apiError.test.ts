import {describe, expect, it} from "vitest"
import en from "../../messages/en.json"
import uk from "../../messages/uk.json"
import {apiErrorText, overloadedMessage} from "./apiError"

class TestApiError extends Error {
  constructor(readonly status: number, readonly code?: number, readonly retryAfter?: number) {
    super(`request failed: ${status}`)
  }
}

describe("overload messages", () => {
  it("has the exact copy in uk and en", () => {
    expect(uk["error.overloaded"]).toBe("Сервер перевантажений, спробуйте за кілька секунд")
    expect(en["error.overloaded"]).toBe("The server is overloaded, try again in a few seconds")
    expect(uk["error.overloaded.retry"]).toBe("Спробувати ще раз")
    expect(en["error.overloaded.retry"]).toBe("Try again")
  })

  it("answers the overload 503 (with Retry-After) with the overloaded line", () => {
    expect(overloadedMessage(new TestApiError(503, undefined, 1))).toBe(uk["error.overloaded"])
    expect(overloadedMessage(new TestApiError(503, undefined, 0))).toBe(uk["error.overloaded"])
    expect(apiErrorText(new TestApiError(503, undefined, 1), "fallback")).toBe(uk["error.overloaded"])
  })

  it("keeps other errors on their own text", () => {
    expect(overloadedMessage(new TestApiError(503))).toBeUndefined()
    expect(overloadedMessage(new TestApiError(429, undefined, 5))).toBeUndefined()
    expect(overloadedMessage(new Error("boom"))).toBeUndefined()
    expect(apiErrorText(new TestApiError(503), "fallback")).toBe("fallback")
    expect(apiErrorText(new TestApiError(500, undefined, 1), "fallback")).toBe("fallback")
    expect(apiErrorText(null)).toBe(uk["error.generic"])
  })

  it("prefers the catalog message of a coded error, the wait of a rate limit included", () => {
    expect(apiErrorText(new TestApiError(503, 2608, 1), "fallback")).toBe("Привʼязка лабораторії відновлюється, спробуйте ще раз")
    expect(apiErrorText(new TestApiError(429, 428, 30), "fallback")).toBe("Забагато спроб. Спробуйте ще раз через 30 с.")
  })
})
