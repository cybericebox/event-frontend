// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { InAppBodyEditor, normalizeInAppBody } from "./InAppBodyEditor"

afterEach(cleanup)

describe("in-app body format", () => {
  it("keeps bold, italic, breaks and variables, and drops everything else", () => {
    expect(normalizeInAppBody('<b>a</b><script>x</script><i>b</i><br><span data-var="event_name">event_name</span><div>c</div>'))
      .toBe("<strong>a</strong><em>b</em><br>{{.event_name}}c")
  })

  it("escapes text", () => {
    expect(normalizeInAppBody("1 &lt; 2")).toBe("1 &lt; 2")
  })
})

describe("InAppBodyEditor", () => {
  it("renders variables as pills and emits the normalized body", () => {
    const onChange = vi.fn()
    render(<InAppBodyEditor value="Hi {{.event_name}}" onChange={onChange} variables={[{ name: "event_name", description: "Назва" }]} />)
    const field = screen.getByRole("textbox", { name: "Текст" })
    expect(field.querySelector("[data-var]")?.getAttribute("data-var")).toBe("event_name")
    field.appendChild(document.createTextNode("!"))
    fireEvent.input(field)
    expect(onChange).toHaveBeenCalledWith("Hi {{.event_name}}!")
  })

  it("is not editable when disabled", () => {
    render(<InAppBodyEditor value="" onChange={vi.fn()} variables={[]} disabled />)
    expect(screen.getByRole("textbox", { name: "Текст" }).getAttribute("contenteditable")).toBe("false")
  })

  it("decorates every spelling of a known variable and flags an unknown one", () => {
    render(<InAppBodyEditor value="{{.event_name}} {{ event_name }} {{.ghost}}" onChange={vi.fn()} variables={[{ name: "event_name", description: "Назва" }]} />)
    const field = screen.getByRole("textbox", { name: "Текст" })
    expect(field.querySelectorAll('[data-var="event_name"]')).toHaveLength(2)
    expect(field.querySelector('[data-var="event_name"]')?.getAttribute("data-invalid")).toBeNull()
    expect(field.querySelector('[data-var="ghost"]')?.getAttribute("data-invalid")).toBe("true")
  })

  it("leaves tokens as text until the variable list loads", () => {
    const { rerender } = render(<InAppBodyEditor value="Hi {{.event_name}}" onChange={vi.fn()} variables={[]} />)
    const field = screen.getByRole("textbox", { name: "Текст" })
    expect(field.querySelector("[data-var]")).toBeNull()
    rerender(<InAppBodyEditor value="Hi {{.event_name}}" onChange={vi.fn()} variables={[{ name: "event_name", description: "Назва" }]} />)
    expect(field.querySelector('[data-var="event_name"]')).toBeTruthy()
  })
})
