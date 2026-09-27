// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen, waitFor} from "@testing-library/react";
import {EventRichTextEditor} from "./EventRichTextEditor";
import {emptyRichText} from "../content/richTextState";

afterEach(cleanup);
describe("EventRichTextEditor", () => {
    it("mounts the admin-equivalent formatting tools and editable content", () => {
        render(<EventRichTextEditor value={emptyRichText()} onChange={vi.fn()} variables={[]} values={{}} />);
        expect(screen.getByRole("toolbar", {name: "Форматування тексту"})).toBeTruthy();
        for (const label of ["Жирний", "Курсив", "Підкреслений", "Закреслений", "Заголовок", "Звичайний абзац", "Вирівнювання", "Маркований список", "Нумерований список", "Цитата", "Блок коду", "Код у рядку", "Посилання", "Очистити форматування"]) {
            expect(screen.getByRole("button", {name: label})).toBeTruthy();
        }
        expect(screen.getByRole("textbox")).toBeTruthy();
    });
    it("does not overwrite saved content with an empty initial editor state", async () => {
        const onChange = vi.fn();
        const value = {root: {type: "root" as const, version: 1, children: [{type: "paragraph", version: 1, children: [{type: "text", version: 1, text: "Збережений текст"}]}]}};
        render(<EventRichTextEditor value={value} onChange={onChange} variables={[]} values={{}} />);
        expect(await screen.findByText("Збережений текст")).toBeTruthy();
        await waitFor(() => expect(onChange).not.toHaveBeenCalled());
    });
    it("shows the saved text when read-only", async () => {
        const value = {root: {type: "root", version: 1, children: [{type: "paragraph", version: 1, children: [{type: "text", version: 1, text: "Збережений текст"}]}]}};
        render(<EventRichTextEditor value={value as Parameters<typeof EventRichTextEditor>[0]["value"]} onChange={vi.fn()} variables={[]} values={{}} disabled />);
        expect(await screen.findByText("Збережений текст")).toBeTruthy();
        expect(screen.queryByRole("toolbar")).toBeNull();
    });
});
