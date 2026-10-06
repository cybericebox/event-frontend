// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { BlockEditor } from "./BlockEditor"
import type { BlockPreset, EmailBodyBlock } from "./emailBlocks"

afterEach(cleanup)

const presets: BlockPreset[] = [{ ID: "p1", Name: "Підпис", Description: "", Blocks: [{ type: "divider" }, { type: "divider" }] }]

function setup(value: EmailBodyBlock[], extra: Partial<Parameters<typeof BlockEditor>[0]> = {}) {
  const onChange = vi.fn()
  const onUploadImage = vi.fn().mockResolvedValue("file-1")
  const view = render(<BlockEditor value={value} onChange={onChange} presets={presets} onUploadImage={onUploadImage} imageURL={id => `/img/${id}`} {...extra} />)
  return { onChange, onUploadImage, view }
}

describe("BlockEditor", () => {
  it("adds the block types and shared presets", () => {
    const { onChange } = setup([])
    fireEvent.click(screen.getByRole("button", { name: "Додати блок кнопки" }))
    expect(onChange).toHaveBeenLastCalledWith([{ type: "button", label: "", url: "" }])
    fireEvent.click(screen.getByRole("button", { name: "Додати блок розділювача" }))
    expect(onChange).toHaveBeenLastCalledWith([{ type: "divider" }])
    fireEvent.click(screen.getByRole("button", { name: /Підпис · 2/ }))
    expect(onChange).toHaveBeenLastCalledWith([{ type: "preset", preset_id: "p1", name: "Підпис" }])
  })

  it("edits a button with labelled fields", () => {
    const { onChange } = setup([{ type: "button", label: "Йти", url: "https://a.b" }])
    for (const name of [/^Про поле «Текст кнопки/, /^Про поле «Посилання/, /^Про поле «Вирівнювання/]) expect(screen.getByRole("button", { name })).toBeTruthy()
    fireEvent.change(screen.getByRole("textbox", { name: /Текст кнопки/ }), { target: { value: "Йдемо" } })
    expect(onChange).toHaveBeenCalledWith([{ type: "button", label: "Йдемо", url: "https://a.b" }])
  })

  it("moves a block up", () => {
    const { onChange } = setup([{ type: "divider" }, { type: "button", label: "A", url: "u" }])
    fireEvent.click(within(screen.getAllByTestId("block-item")[1]).getByRole("button", { name: "Перемістити блок вгору" }))
    expect(onChange).toHaveBeenLastCalledWith([{ type: "button", label: "A", url: "u" }, { type: "divider" }])
  })

  it("removes a block", () => {
    const { onChange } = setup([{ type: "divider" }, { type: "button", label: "A", url: "u" }])
    fireEvent.click(within(screen.getAllByTestId("block-item")[0]).getByRole("button", { name: "Видалити блок" }))
    expect(onChange).toHaveBeenLastCalledWith([{ type: "button", label: "A", url: "u" }])
  })

  it("uploads an image into the block that asked for it", async () => {
    const { onChange, onUploadImage } = setup([{ type: "image", alt: "" }])
    const file = new File(["x"], "a.png", { type: "image/png" })
    fireEvent.change(screen.getByTestId("image-file-input"), { target: { files: [file] } })
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([{ type: "image", alt: "", file_id: "file-1", url: undefined }]))
    expect(onUploadImage).toHaveBeenCalledWith(file)
  })

  it("shows an upload failure inside the block", async () => {
    const { onUploadImage } = setup([{ type: "image", alt: "" }])
    onUploadImage.mockRejectedValue(new Error("x"))
    fireEvent.change(screen.getByTestId("image-file-input"), { target: { files: [new File(["x"], "a.png")] } })
    expect(await screen.findByText(/^Не вдалося додати зображення/)).toBeTruthy()
  })

  it("is read-only when disabled: no controls to add, move or remove", () => {
    setup([{ type: "button", label: "A", url: "u" }], { disabled: true })
    expect(screen.queryByRole("button", { name: "Додати блок кнопки" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Видалити блок" })).toBeNull()
    expect((screen.getByRole("textbox", { name: /Текст кнопки/ }) as HTMLInputElement).disabled).toBe(true)
  })
})
