// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
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

  it("flags an unknown variable and converts tokens once the list loads", () => {
    const { rerender } = render(<VariableRichText value="{{.event_name}} {{.ghost}}" onChange={vi.fn()} variables={[]} dotted ariaLabel="Тема" />)
    const field = screen.getByRole("textbox", { name: "Тема" })
    expect(field.querySelector("[data-var]")).toBeNull()
    rerender(<VariableRichText value="{{.event_name}} {{.ghost}}" onChange={vi.fn()} variables={variables} dotted ariaLabel="Тема" />)
    expect(field.querySelector('[data-var="event_name"]')?.getAttribute("data-invalid")).toBeNull()
    expect(field.querySelector('[data-var="ghost"]')?.getAttribute("data-invalid")).toBe("true")
  })

  it("turns a token typed by hand into a pill and keeps the stored form", () => {
    const onChange = vi.fn()
    render(<VariableRichText value="" onChange={onChange} variables={variables} dotted ariaLabel="Тема" />)
    const field = screen.getByRole("textbox", { name: "Тема" })
    field.textContent = "Захід {{event_name}}"
    const range = document.createRange()
    range.setStart(field.firstChild as Text, field.textContent.length)
    range.collapse(true)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
    fireEvent.input(field)
    expect(field.querySelector('[data-var="event_name"]')).toBeTruthy()
    expect(onChange).toHaveBeenLastCalledWith("Захід {{.event_name}}")
  })

  it("normalizes pasted tokens on blur", () => {
    render(<VariableRichText value="" onChange={vi.fn()} variables={variables} dotted ariaLabel="Тема" />)
    const field = screen.getByRole("textbox", { name: "Тема" })
    field.textContent = "{{ .event_name }} {{ghost}}"
    fireEvent.blur(field)
    expect(field.querySelector('[data-var="event_name"]')?.getAttribute("data-invalid")).toBeNull()
    expect(field.querySelector('[data-var="ghost"]')?.getAttribute("data-invalid")).toBe("true")
  })
})

it("uses a custom tooltip for unknown pills by keyboard and touch without serializing its text", () => {
  const onChange = vi.fn()
  render(<VariableRichText value="{{.ghost}}" onChange={onChange} variables={variables} dotted ariaLabel="Тема" />)
  const field = screen.getByRole("textbox", {name: "Тема"})
  const pill = field.querySelector('[data-var="ghost"]') as HTMLElement
  expect(pill.hasAttribute("title")).toBe(false)
  expect(pill.tabIndex).toBe(0)
  fireEvent.focus(pill)
  const tooltip = screen.getByRole("tooltip")
  expect(tooltip.textContent).toContain("ghost")
  expect(pill.getAttribute("aria-describedby")).toBe(tooltip.id)
  fireEvent.keyDown(pill, {key: "Escape"})
  expect(screen.queryByRole("tooltip")).toBeNull()
  fireEvent.click(pill)
  expect(screen.getByRole("tooltip").textContent).toContain("ghost")
  fireEvent.input(field)
  expect(onChange).toHaveBeenLastCalledWith("{{.ghost}}")
})

it("keeps consecutive unknown pills connected and focused while tabbing inside the editor", () => {
  const onChange = vi.fn()
  render(<VariableRichText value="{{.first_unknown}} {{.second_unknown}}" onChange={onChange} variables={variables} dotted ariaLabel="Тема" />)
  const field = screen.getByRole("textbox", {name: "Тема"})
  const first = field.querySelector('[data-var="first_unknown"]') as HTMLElement
  const second = field.querySelector('[data-var="second_unknown"]') as HTMLElement
  act(() => first.focus())
  expect(first.hasAttribute("aria-describedby")).toBe(true)
  act(() => second.focus())
  expect(second.isConnected).toBe(true)
  expect(document.activeElement).toBe(second)
  expect(field.querySelector('[data-var="second_unknown"]')).toBe(second)
  expect(onChange).not.toHaveBeenCalled()
})
