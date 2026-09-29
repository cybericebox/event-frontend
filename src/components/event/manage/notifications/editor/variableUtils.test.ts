import { describe, expect, it } from "vitest"
import { htmlToRaw, htmlToRawSingleLine, rawToHtml } from "./variableUtils"

describe("variable pills", () => {
  it("turns known tokens into pills and leaves unknown ones as text", () => {
    const html = rawToHtml("Hi {{.event_name}} {{.nope}} <b>", ["event_name"], { dotted: true })
    expect(html).toContain('<span class="var-pill" data-var="event_name">event_name</span>')
    expect(html).toContain("{{.nope}}")
    expect(html).toContain("&lt;b&gt;")
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
