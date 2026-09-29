// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { convertTypedToken, htmlToRaw, htmlToRawSingleLine, rawToHtml } from "./variableUtils"

describe("variable pills", () => {
  it("turns known tokens into pills and flags unknown ones as invalid pills", () => {
    const html = rawToHtml("Hi {{.event_name}} {{.nope}} <b>", ["event_name"], { dotted: true })
    expect(html).toContain('<span class="var-pill" data-var="event_name">event_name</span>')
    expect(html).toContain('class="var-pill var-pill-invalid" data-var="nope" data-invalid="true"')
    expect(html).not.toContain("{{")
    expect(html).toContain("&lt;b&gt;")
    expect(htmlToRawSingleLine(html, { dotted: true })).toBe("Hi {{.event_name}} {{.nope}} <b>")
  })

  it("reads every spelling of a token and keeps plain text while the list is empty", () => {
    for (const token of ["{{x}}", "{{.x}}", "{{ x }}", "{{ .x }}"]) {
      for (const dotted of [true, false]) expect(rawToHtml(`A ${token}`, ["x"], { dotted })).toContain('data-var="x"')
    }
    expect(rawToHtml("A {{.x}} {{y}}", [])).toBe("A {{.x}} {{y}}")
  })

  it("round-trips dotted and bare forms", () => {
    for (const dotted of [true, false]) {
      const raw = dotted ? "A {{.x}} B" : "A {{x}} B"
      expect(htmlToRawSingleLine(rawToHtml(raw, ["x"], { dotted }), { dotted })).toBe(raw)
    }
    expect(htmlToRaw('<p>a</p><span class="var-pill" data-var="x">x</span>​')).toBe("<p>a</p>{{x}}")
  })

  it("collapses html of a single-line field to plain text", () => {
    expect(htmlToRawSingleLine("<div>a&nbsp;&amp;<br>b</div>")).toBe("a &b")
  })
})

describe("convertTypedToken", () => {
  function caretAtEndOf(value: string) {
    const host = document.createElement("div")
    host.contentEditable = "true"
    host.textContent = value
    document.body.appendChild(host)
    const range = document.createRange()
    range.setStart(host.firstChild as Text, value.length)
    range.collapse(true)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
  }
  afterEach(() => { document.body.innerHTML = "" })

  it("turns a completed token before the caret into a pill, flagging an unknown name", () => {
    caretAtEndOf("Hi {{ event_name }}")
    expect(convertTypedToken(["event_name"])).toBe(true)
    expect(document.querySelector('[data-var="event_name"]')?.getAttribute("data-invalid")).toBeNull()
    document.body.innerHTML = ""
    caretAtEndOf("{{.ghost}}")
    expect(convertTypedToken(["event_name"])).toBe(true)
    expect(document.querySelector('[data-var="ghost"]')?.getAttribute("data-invalid")).toBe("true")
  })

  it("does nothing for an unfinished token or an empty list", () => {
    caretAtEndOf("{{event")
    expect(convertTypedToken(["event_name"])).toBe(false)
    document.body.innerHTML = ""
    caretAtEndOf("{{event_name}}")
    expect(convertTypedToken([])).toBe(false)
  })
})
