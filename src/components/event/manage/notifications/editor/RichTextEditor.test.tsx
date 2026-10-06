// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { RichTextEditor } from "./RichTextEditor"

afterEach(cleanup)

const text = (value: string) => ({ detail: 0, format: 0, mode: "normal", style: "", text: value, type: "text", version: 1 })
const state = {
  root: {
    children: [{ children: [text("Привіт, "), { type: "variable", version: 1, varName: "event_name" }], direction: "ltr", format: "", indent: 0, type: "paragraph", version: 1, textFormat: 0, textStyle: "" }],
    direction: "ltr", format: "", indent: 0, type: "root", version: 1,
  },
}
const variables = [{ name: "event_name", description: "Назва заходу", example: "CTF 2027" }]

describe("RichTextEditor", () => {
  it("loads the state and shows a variable pill with its example value", async () => {
    render(<RichTextEditor value={state} onChange={vi.fn()} variables={variables} />)
    await waitFor(() => expect(screen.getByText("CTF 2027")).toBeTruthy())
    expect(screen.getByText(/Привіт,/)).toBeTruthy()
  })

  it("can show the variable names instead of the values", async () => {
    render(<RichTextEditor value={state} onChange={vi.fn()} variables={variables} showVariableNames />)
    await waitFor(() => expect(screen.getByText("event_name")).toBeTruthy())
  })

  it("has the formatting toolbar and toggles the format buttons", () => {
    render(<RichTextEditor value={null} onChange={vi.fn()} variables={variables} />)
    expect(screen.getByRole("toolbar")).toBeTruthy()
    const bold = screen.getByRole("button", { name: "Жирний" })
    expect(bold.getAttribute("aria-pressed")).toBe("false")
    for (const name of ["Курсив", "Підкреслений", "Маркований список", "Нумерований список", "Вставити посилання"]) expect(screen.getByRole("button", { name })).toBeTruthy()
  })

  it("opens the variable picker from the toolbar", () => {
    render(<RichTextEditor value={null} onChange={vi.fn()} variables={variables} />)
    fireEvent.click(screen.getByRole("button", { name: "Вставити змінну" }))
    expect(screen.getByText("Назва заходу")).toBeTruthy()
  })

  it("is read-only without a toolbar when disabled", () => {
    render(<RichTextEditor value={state} onChange={vi.fn()} variables={variables} disabled />)
    expect(screen.queryByRole("toolbar")).toBeNull()
  })

  it("turns a {{token}} stored as plain text into a variable and flags an unknown one", async () => {
    const plain = {
      root: {
        children: [{ children: [text("Привіт, {{event_name}}! Також {{ .ghost }}.")], direction: "ltr", format: "", indent: 0, type: "paragraph", version: 1, textFormat: 0, textStyle: "" }],
        direction: "ltr", format: "", indent: 0, type: "root", version: 1,
      },
    }
    const onChange = vi.fn()
    render(<RichTextEditor value={plain} onChange={onChange} variables={variables} showVariableNames />)
    await waitFor(() => expect(document.querySelector('[data-notif-variable="event_name"]')).toBeTruthy())
    expect(document.querySelector('[data-notif-variable="event_name"]')?.hasAttribute("data-notif-variable-invalid")).toBe(false)
    expect(document.querySelector('[data-notif-variable-invalid="ghost"]')).toBeTruthy()
    expect(document.body.textContent).not.toContain("{{")
    const saved = JSON.stringify(onChange.mock.calls.at(-1)?.[0])
    expect(saved).toContain('"varName":"event_name"')
    expect(saved).toContain('"varName":"ghost"')
  })

  it("does not convert plain tokens while the list is empty or the editor is read-only", async () => {
    const plain = {
      root: {
        children: [{ children: [text("Hi {{event_name}}")], direction: "ltr", format: "", indent: 0, type: "paragraph", version: 1, textFormat: 0, textStyle: "" }],
        direction: "ltr", format: "", indent: 0, type: "root", version: 1,
      },
    }
    const { unmount } = render(<RichTextEditor value={plain} onChange={vi.fn()} variables={[]} />)
    await waitFor(() => expect(document.body.textContent).toContain("Hi {{event_name}}"))
    unmount()
    render(<RichTextEditor value={plain} onChange={vi.fn()} variables={variables} disabled />)
    await waitFor(() => expect(document.body.textContent).toContain("Hi {{event_name}}"))
  })
})
