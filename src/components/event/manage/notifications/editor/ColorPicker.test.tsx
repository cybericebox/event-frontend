// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { ColorPicker } from "./ColorPicker"
import { eventBrandColors } from "./brandColors"

afterEach(cleanup)

const brand = { "theme:brand": "#123456", "theme:accent": "#ABCDEF", "theme:on_accent": "#000000" } as const

describe("ColorPicker", () => {
  it("shows a colour value as hex and commits a typed hex on blur", () => {
    const onChange = vi.fn()
    render(<ColorPicker label="Колір" help="Довідка" value="#333333" onChange={onChange} brand={brand} />)
    const hex = screen.getByDisplayValue("#333333") as HTMLInputElement
    fireEvent.change(hex, { target: { value: "#fff" } })
    fireEvent.blur(hex)
    expect(onChange).toHaveBeenCalledWith("#ffffff")
    expect(screen.getByRole("button", { name: "Про поле «Колір»" })).toBeTruthy()
  })

  it("keeps the old colour when the typed hex is invalid", () => {
    const onChange = vi.fn()
    render(<ColorPicker value="#333333" onChange={onChange} />)
    const hex = screen.getByDisplayValue("#333333") as HTMLInputElement
    fireEvent.change(hex, { target: { value: "nope" } })
    fireEvent.blur(hex)
    expect(onChange).not.toHaveBeenCalled()
    expect(hex.value).toBe("#333333")
  })

  it("offers the event brand tokens with the event colours", () => {
    const onChange = vi.fn()
    render(<ColorPicker value="theme:accent" onChange={onChange} brand={brand} />)
    expect(screen.getByDisplayValue("#ABCDEF")).toBeTruthy()
    const chips = screen.getAllByRole("button", { pressed: false }).concat(screen.getAllByRole("button", { pressed: true }))
    expect(chips.length).toBe(3)
    fireEvent.click(screen.getAllByRole("button", { pressed: false })[0])
    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^theme:/))
  })
})

describe("event brand colours", () => {
  it("uses the event brand and picks readable text on the accent", () => {
    expect(eventBrandColors({ Theme: { Brand: "#211A52", Accent: "" } } as never)).toEqual({ "theme:brand": "#211A52", "theme:accent": "#211A52", "theme:on_accent": "#FFFFFF" })
    expect(eventBrandColors({ Theme: { Brand: "#211A52", Accent: "#FFEE00" } } as never)["theme:on_accent"]).toBe("#000000")
  })
})
