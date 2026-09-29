// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import type {FormField} from "@/api/manageParticipantForm";
import {AnswerFileError, type AnswerFile} from "@/api/answerFiles";
import {AnswerFileInput} from "./AnswerFileInput";
import {formatAnswer} from "./participation/participationModel";

vi.mock("@/components/event/EventBrandLogo", () => ({EventBrandLogo: () => <span data-testid="busy" />}));

afterEach(cleanup);

const field: FormField = {id: "cv", type: "field", key: "cv", input: "file", label: "CV", fileTypes: ["pdf", "doc"], maxSizeMB: 1};
const stored: AnswerFile = {id: "0190", name: "cv.pdf", size: 4, contentType: "application/pdf"};

function choose(file: File) {
    const input = document.getElementById("answer-cv") as HTMLInputElement;
    fireEvent.change(input, {target: {files: [file]}});
}

describe("file answer", () => {
    it("uploads the chosen file and keeps the server reference", async () => {
        const upload = vi.fn(async () => stored);
        const onChange = vi.fn();
        render(<AnswerFileInput id="answer-cv" field={field} value={undefined} upload={upload} onChange={onChange} />);
        expect(screen.getByText("PDF, Word (DOC, DOCX) · до 1 МБ")).toBeTruthy();
        expect((document.getElementById("answer-cv") as HTMLInputElement).accept).toContain(".docx");
        choose(new File(["%PDF"], "cv.pdf", {type: "application/pdf"}));
        await waitFor(() => expect(onChange).toHaveBeenCalledWith(stored));
        expect(upload).toHaveBeenCalledOnce();
    });

    it("refuses a file over the limit before uploading", () => {
        const upload = vi.fn();
        render(<AnswerFileInput id="answer-cv" field={field} value={undefined} upload={upload} onChange={vi.fn()} />);
        choose(new File([new Uint8Array(1024 * 1024 + 1)], "big.pdf"));
        expect(screen.getByRole("alert").textContent).toBe("Файл більший за 1 МБ.");
        expect(upload).not.toHaveBeenCalled();
    });

    it("shows the server's reason when the upload is refused", async () => {
        render(<AnswerFileInput id="answer-cv" field={field} value={undefined} upload={async () => {throw new AnswerFileError(400, 1129);}} onChange={vi.fn()} />);
        choose(new File(["text"], "cv.pdf"));
        await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Такий формат файлу не дозволено для цього питання."));
    });

    it("clears the answer", () => {
        const onChange = vi.fn();
        render(<AnswerFileInput id="answer-cv" field={field} value={stored} upload={vi.fn()} onChange={onChange} />);
        expect(screen.getByText("cv.pdf")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: "Прибрати файл cv.pdf"}));
        expect(onChange).toHaveBeenCalledWith(undefined);
    });

    it("reads as the file name in answer lists", () => {
        expect(formatAnswer(stored)).toBe("cv.pdf");
        expect(formatAnswer({unexpected: true})).toBe("—");
    });
});
