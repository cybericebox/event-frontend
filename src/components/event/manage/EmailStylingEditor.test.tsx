// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {EmailStylingEditor} from "./EmailStylingEditor";

afterEach(cleanup);

const brand = {"theme:brand": "#123456", "theme:accent": "#ABCDEF", "theme:on_accent": "#000000"} as const;

describe("EmailStylingEditor", () => {
    it("follows the event brand by default and labels every field", () => {
        render(<EmailStylingEditor styling={{}} disabled={false} brand={brand} onChange={vi.fn()} />);
        expect(screen.getByDisplayValue("#ABCDEF")).toBeTruthy();
        expect(screen.getByDisplayValue("#000000")).toBeTruthy();
        for (const name of [/^Про поле «Заокруглення кнопки/, /^Про поле «Розмір шрифту кнопки/, /^Про поле «Шрифт листа/, /^Про поле «Розмір основного тексту/]) expect(screen.getAllByRole("button", {name}).length).toBeGreaterThan(0);
    });

    it("stores numbers with their unit", () => {
        const onChange = vi.fn();
        render(<EmailStylingEditor styling={{cta_border_radius: "4px"}} disabled={false} brand={brand} onChange={onChange} />);
        fireEvent.change(screen.getByRole("spinbutton", {name: /Заокруглення кнопки/}), {target: {value: "8"}});
        expect(onChange).toHaveBeenCalledWith({cta_border_radius: "8px"});
        fireEvent.change(screen.getByRole("spinbutton", {name: /Міжрядковий інтервал тексту/}), {target: {value: "1.6"}});
        expect(onChange).toHaveBeenLastCalledWith({cta_border_radius: "4px", text_line_height: "1.6"});
    });

    it("cannot be changed when disabled", () => {
        render(<EmailStylingEditor styling={{}} disabled brand={brand} onChange={vi.fn()} />);
        expect((screen.getByRole("spinbutton", {name: /Заокруглення кнопки/}) as HTMLInputElement).disabled).toBe(true);
    });
});
