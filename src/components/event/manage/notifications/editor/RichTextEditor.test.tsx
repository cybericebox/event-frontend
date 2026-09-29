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
})
