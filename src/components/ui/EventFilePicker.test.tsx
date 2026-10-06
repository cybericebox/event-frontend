// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {acceptsFile, EventFilePicker, formatFileSize} from "./EventFilePicker";

vi.mock("@/components/event/EventBrandLogo", () => ({EventBrandLogo: () => <span data-testid="busy-mark" />}));
afterEach(cleanup);

const csv = (name = "people.csv", size = 10) => new File([new Uint8Array(size)], name, {type: "text/csv"});
const zone = () => screen.getByRole("button", {name: "Обрати файл"});
const drop = (files: File[]) => fireEvent.drop(zone(), {dataTransfer: {files, dropEffect: ""}});

describe("file drop zone", () => {
    it("shows the prompt and hint, and opens the picker by click, Enter or Space", () => {
        render(<EventFilePicker id="f" fileName={null} onFile={vi.fn()} accept=".csv" hint="Файл CSV" />);
        expect(zone().textContent).toContain("Перетягніть файл сюди або");
        expect(screen.getByText("Файл CSV")).toBeTruthy();
        const click = vi.spyOn(document.getElementById("f") as HTMLInputElement, "click");
        fireEvent.click(zone());
        fireEvent.keyDown(zone(), {key: "Enter"});
        fireEvent.keyDown(zone(), {key: " "});
        expect(click).toHaveBeenCalledTimes(3);
    });

    it("highlights while a file is dragged over", () => {
        render(<EventFilePicker id="f" fileName={null} onFile={vi.fn()} />);
        fireEvent.dragOver(zone(), {dataTransfer: {dropEffect: ""}});
        expect(zone().className).toContain("is-over");
        fireEvent.dragLeave(zone(), {relatedTarget: document.body});
        expect(zone().className).not.toContain("is-over");
    });

    it("checks a dropped file like a picked one", () => {
        const onFile = vi.fn();
        render(<EventFilePicker id="f" fileName={null} onFile={onFile} accept=".csv,text/csv" maxBytes={100} />);
        drop([new File(["x"], "notes.txt", {type: "text/plain"})]);
        expect(screen.getByRole("alert").textContent).toBe("Цей формат файлу не підтримується.");
        drop([csv("big.csv", 101)]);
        expect(screen.getByRole("alert").textContent).toBe("Файл більший за 100 Б.");
        expect(onFile).not.toHaveBeenCalled();
        drop([csv("a.csv"), csv("b.csv")]);
        expect(onFile).toHaveBeenCalledWith(expect.objectContaining({name: "a.csv"}));
        expect(screen.getByRole("status").textContent).toBe("Можна додати лише один файл — взято перший.");
    });

    it("shows the chosen file with its size and removes it", () => {
        const onFile = vi.fn();
        render(<EventFilePicker id="f" fileName="people.csv" fileSize={2048} onFile={onFile} />);
        expect(screen.queryByRole("button", {name: "Обрати файл"})).toBeNull();
        expect(screen.getByText("people.csv")).toBeTruthy();
        expect(screen.getByText("2 КБ")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: "Прибрати файл people.csv"}));
        expect(onFile).toHaveBeenCalledWith(null);
    });

    it("uses the event logo while busy and has a compact variant", () => {
        render(<EventFilePicker id="f" fileName="cv.pdf" busy compact onFile={vi.fn()} />);
        expect(screen.getByTestId("busy-mark")).toBeTruthy();
        expect(screen.queryByRole("button", {name: /Прибрати/})).toBeNull();
        expect(document.querySelector(".event-file-drop.is-compact")).toBeTruthy();
    });

    it("matches accept rules and formats sizes", () => {
        expect(acceptsFile(csv("x.CSV"), ".csv")).toBe(true);
        expect(acceptsFile(new File([], "p.png", {type: "image/png"}), "image/*")).toBe(true);
        expect(acceptsFile(new File([], "p.gif", {type: "image/gif"}), ".pdf,application/pdf")).toBe(false);
        expect(acceptsFile(new File([], "anything"), undefined)).toBe(true);
        expect(formatFileSize(1536)).toBe("1,5 КБ");
        expect(formatFileSize(10 * 1024 * 1024)).toBe("10 МБ");
    });
});
