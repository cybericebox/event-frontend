// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
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
    it("formats a clicked variable atomically and can toggle it off", async () => {
        const value = {root: {type: "root" as const, version: 1, children: [{type: "paragraph", version: 1, children: [{type: "variable", version: 1, varName: "event.name"}]}]}};
        const onChange = vi.fn();
        const {container} = render(<EventRichTextEditor value={value} onChange={onChange} variables={[{name: "event.name", label: "Назва", format: "text", audience: 0}]} values={{"event.name": "Подія"}} />);
        await waitFor(() => expect(container.querySelector('.event-lexical__editor [data-event-variable]')).toBeTruthy());
        const badge = container.querySelector('.event-lexical__editor [data-event-variable]') as HTMLElement;
        fireEvent.mouseDown(badge);
        fireEvent.click(screen.getByRole("button", {name: "Курсив"}));
        await waitFor(() => expect(container.querySelector('.event-lexical__editor [data-event-variable]')?.getAttribute('style')).toContain('italic'));
        fireEvent.click(screen.getByRole("button", {name: "Курсив"}));
        await waitFor(() => expect(container.querySelector('.event-lexical__editor [data-event-variable]')?.getAttribute('style')).not.toContain('italic'));
    });
    it("shows the saved text when read-only", async () => {
        const value = {root: {type: "root", version: 1, children: [{type: "paragraph", version: 1, children: [{type: "text", version: 1, text: "Збережений текст"}]}]}};
        render(<EventRichTextEditor value={value as Parameters<typeof EventRichTextEditor>[0]["value"]} onChange={vi.fn()} variables={[]} values={{}} disabled />);
        expect(await screen.findByText("Збережений текст")).toBeTruthy();
        expect(screen.queryByRole("toolbar")).toBeNull();
    });
});
