// @vitest-environment jsdom
// PARITY: the same file lives in admin-frontend and event-frontend
// (notifications/editor/variableParity.test.tsx) with identical fixture and
// expectations. If one side drifts, its copy of this test fails.
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { InAppBodyEditor } from "./InAppBodyEditor"
import { RichTextEditor } from "./RichTextEditor"
import { VariableRichText } from "./VariableRichText"
import { htmlToRawSingleLine, rawToHtml } from "./variableUtils"

afterEach(cleanup)

const VARS = [{ name: "event_name", description: "Event", example: "CTF" }, { name: "user_name", description: "User", example: "Jane" }]
const NAMES = VARS.map((variable) => variable.name)
const AMBER = ["border-[var(--ib-warn)]", "bg-[var(--ib-warn-bg)]", "text-[var(--ib-ink)]"]

const text = (value: string) => ({ detail: 0, format: 0, mode: "normal", style: "", text: value, type: "text", version: 1 })
const TEMPLATE = {
  root: {
    children: [{
      children: [text("Hi "), { type: "variable", version: 1, varName: "event_name" }, text(", {{ user_name }} and {{.ghost}}!")],
      direction: "ltr", format: "", indent: 0, type: "paragraph", version: 1, textFormat: 0, textStyle: "",
    }],
    direction: "ltr", format: "", indent: 0, type: "root", version: 1,
  },
}

describe("variable formatting parity (admin = event)", () => {
  it("rich text: stored nodes, plain tokens and unknown names give the same pills", async () => {
    render(<RichTextEditor value={TEMPLATE} onChange={vi.fn()} variables={VARS} showVariableNames />)
    await waitFor(() => expect(document.querySelectorAll("[data-notif-variable]").length).toBe(3))
    const pills = [...document.querySelectorAll("[data-notif-variable]")]
      .map((el) => ({ name: el.getAttribute("data-notif-variable"), invalid: el.hasAttribute("data-notif-variable-invalid"), text: el.textContent }))
    expect(pills).toEqual([
      { name: "event_name", invalid: false, text: "event_name" },
      { name: "user_name", invalid: false, text: "user_name" },
      { name: "ghost", invalid: true, text: "ghost" },
    ])
    expect(document.body.textContent).not.toContain("{{")
  })

  it("single-line field: same HTML for every spelling, same stored form", () => {
    const raw = "A {{.event_name}} {{ user_name }} {{ghost}}"
    const html = rawToHtml(raw, NAMES, { dotted: true })
    expect(html).toContain('<span class="var-pill" data-var="event_name">event_name</span>')
    expect(html).toContain('<span class="var-pill" data-var="user_name">user_name</span>')
    expect(html).toContain('class="var-pill var-pill-invalid" data-var="ghost" data-invalid="true"')
    expect(htmlToRawSingleLine(html, { dotted: true })).toBe("A {{.event_name}} {{.user_name}} {{.ghost}}")
    expect(rawToHtml(raw, [], { dotted: true })).toBe(raw)
  })

  it("single-line field DOM: amber valid pills, flagged invalid pill", () => {
    render(<VariableRichText value="{{.event_name}} {{.ghost}}" onChange={vi.fn()} variables={VARS} dotted placeholder="x" />)
    const field = screen.getByRole("textbox")
    expect(field.className).toContain("[&_.var-pill]:bg-[var(--ib-warn-bg)]")
    expect(field.className).toContain("[&_.var-pill-invalid]:")
    expect(field.querySelector('[data-var="event_name"]')?.hasAttribute("data-invalid")).toBe(false)
    expect(field.querySelector('[data-var="ghost"]')?.getAttribute("data-invalid")).toBe("true")
  })

  it("in-app body DOM: amber valid pills, flagged invalid pill, same stored form", () => {
    render(<InAppBodyEditor value="Hi {{.event_name}} {{ user_name }} {{.ghost}}" onChange={vi.fn()} variables={VARS} />)
    const field = screen.getAllByRole("textbox")[0]
    const valid = [...field.querySelectorAll("[data-var]:not([data-invalid])")]
    expect(valid.map((el) => el.getAttribute("data-var"))).toEqual(["event_name", "user_name"])
    for (const pill of valid) for (const cls of AMBER) expect(pill.className).toContain(cls)
    const invalid = field.querySelector('[data-invalid="true"]')
    expect(invalid?.getAttribute("data-var")).toBe("ghost")
    expect(invalid?.className).toContain("var-pill-invalid")
  })
})
