// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { VariableRichText } from "./VariableRichText"

afterEach(cleanup)

const variables = [{ name: "event_name", description: "Назва заходу", example: "CTF" }]

describe("VariableRichText", () => {
  it("shows variables as pills and emits the dotted token form", () => {
    const onChange = vi.fn()
    render(<VariableRichText value="Захід {{.event_name}}" onChange={onChange} variables={variables} dotted ariaLabel="Тема" />)
    const field = screen.getByRole("textbox", { name: "Тема" })
    expect(field.querySelector(".var-pill")?.getAttribute("data-var")).toBe("event_name")
    field.appendChild(document.createTextNode("!"))
    fireEvent.input(field)
    expect(onChange).toHaveBeenCalledWith("Захід {{.event_name}}!")
  })

  it("inserts a variable from the picker", () => {
    const onChange = vi.fn()
    render(<VariableRichText value="" onChange={onChange} variables={variables} dotted ariaLabel="Тема" />)
    fireEvent.click(screen.getByRole("button", { name: "Вставити змінну" }))
    fireEvent.click(screen.getByText("Назва заходу"))
    expect(onChange).toHaveBeenCalledWith("{{.event_name}}")
  })

  it("does not accept a line break", () => {
    render(<VariableRichText value="" onChange={vi.fn()} ariaLabel="Тема" />)
    const field = screen.getByRole("textbox", { name: "Тема" })
    expect(fireEvent.keyDown(field, { key: "Enter" })).toBe(false)
  })
})
