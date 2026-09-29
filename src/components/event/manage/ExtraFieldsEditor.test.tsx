// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {FormBlock, ParticipantForm} from "@/api/manageParticipantForm";
import {ExtraFieldsEditor} from "./ExtraFieldsEditor";

let form: ParticipantForm;
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "e1"}, canManage: true})}));
vi.mock("@/components/event/manage/EventLexicalEditor", () => ({EventRichTextEditor: () => null}));
vi.mock("@/components/event/EventBrandLogo", () => ({EventBrandLogo: () => null}));
vi.mock("@/api/manageParticipantForm", async original => ({...(await original() as object), getManageParticipantForm: async () => form}));
vi.mock("@/api/manageTeamFields", () => ({getManageTeamFields: async () => form, putManageTeamFields: vi.fn()}));

const question = (id: string, extra: Partial<Extract<FormBlock, {type: "field"}>> = {}): FormBlock => ({id, type: "field", key: id, input: "text", label: `Питання ${id}`, ...extra});

afterEach(cleanup);
beforeEach(() => {
    form = {Version: 1, Enabled: true, Required: false, Document: {blocks: [
        question("a", {label: "Курс", input: "number", required: true, editable: true}),
        question("b", {label: "Група", condition: {fieldKey: "a", operator: "equals", value: 3}}),
    ]}};
});

async function renderEditor(scope: "participant" | "team") {
    render(<QueryClientProvider client={new QueryClient()}><ExtraFieldsEditor scope={scope} /></QueryClientProvider>);
    await waitFor(() => screen.getAllByText("Курс"));
}

const card = (label: string) => screen.getByRole("region", {name: label});
const chevron = (region: HTMLElement) => within(region).getByRole("button", {name: /Розгорнути блок|Згорнути блок/});

describe.each(["participant", "team"] as const)("field cards (%s)", scope => {
    it("start collapsed with the question, its * and small hints on one line", async () => {
        await renderEditor(scope);
        const first = card("Питання 1");
        expect(chevron(first).getAttribute("aria-expanded")).toBe("false");
        expect(within(first).queryByRole("textbox")).toBeNull();
        expect(within(first).getByText("*")).toBeTruthy();
        expect(within(first).getByText("Число")).toBeTruthy();
        expect(within(first).getByRole("img", {name: scope === "team" ? "Можна змінювати після створення" : "Учасник може змінити після реєстрації"})).toBeTruthy();
        expect(within(card("Питання 2")).getByRole("img", {name: "Показується за умовою"})).toBeTruthy();
    });

    it("toggle from the header but not from the action buttons", async () => {
        await renderEditor(scope);
        const first = card("Питання 1");
        fireEvent.click(within(first).getByText("Курс"));
        expect(chevron(first).getAttribute("aria-expanded")).toBe("true");
        expect(within(first).getByDisplayValue("Курс")).toBeTruthy();
        fireEvent.click(within(first).getByRole("button", {name: "Перемістити блок 1 нижче"}));
        expect(chevron(card("Питання 2")).getAttribute("aria-expanded")).toBe("true");
        fireEvent.click(chevron(card("Питання 2")));
        expect(chevron(card("Питання 2")).getAttribute("aria-expanded")).toBe("false");
    });

    it("open a new or duplicated card and collapse or expand all", async () => {
        await renderEditor(scope);
        fireEvent.click(screen.getByRole("button", {name: "Розгорнути все"}));
        expect(screen.getAllByRole("button", {name: "Згорнути блок"})).toHaveLength(2);
        fireEvent.click(screen.getByRole("button", {name: "Згорнути все"}));
        expect(screen.queryAllByRole("button", {name: "Згорнути блок"})).toHaveLength(0);
        fireEvent.click(within(card("Питання 2")).getByRole("button", {name: "Дублювати блок 2"}));
        expect(chevron(card("Питання 3")).getAttribute("aria-expanded")).toBe("true");
        expect(within(card("Питання 3")).getByDisplayValue("Група")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: /Поле/}));
        expect(chevron(card("Питання 4")).getAttribute("aria-expanded")).toBe("true");
    });

    it("collapse every card while one is dragged and restore them after", async () => {
        await renderEditor(scope);
        fireEvent.click(within(card("Питання 1")).getByText("Курс"));
        fireEvent.pointerDown(within(card("Питання 2")).getByRole("button", {name: "Перетягнути блок 2"}), {button: 0, pointerId: 1});
        expect(chevron(card("Питання 1")).getAttribute("aria-expanded")).toBe("false");
        fireEvent.pointerUp(document, {pointerId: 1});
        expect(chevron(card("Питання 1")).getAttribute("aria-expanded")).toBe("true");
        expect(chevron(card("Питання 2")).getAttribute("aria-expanded")).toBe("false");
    });
});

describe("invalid cards", () => {
    it("open once on a new error and keep the red outline when closed", async () => {
        form.Document.blocks = [question("a", {label: "Курс"}), question("b", {label: "", input: "select", options: ["x", "x"]})];
        render(<QueryClientProvider client={new QueryClient()}><ExtraFieldsEditor scope="participant" /></QueryClientProvider>);
        await waitFor(() => screen.getAllByText("Курс"));
        const bad = card("Питання 2");
        expect(chevron(bad).getAttribute("aria-expanded")).toBe("true");
        expect(within(bad).getByRole("alert").textContent).toBe("Питання 2: додайте текст питання.");
        fireEvent.click(chevron(bad));
        expect(chevron(card("Питання 2")).getAttribute("aria-expanded")).toBe("false");
        expect(card("Питання 2").className).toContain("is-invalid");
        expect(screen.getByText("Питання 2: додайте текст питання.")).toBeTruthy();
    });
});
