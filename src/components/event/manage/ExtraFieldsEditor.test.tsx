// @vitest-environment jsdom
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {FormBlock, ParticipantForm} from "@/api/manageParticipantForm";
import {keyboardDrag, stackLayout} from "@/components/ui/sortableTestUtils";
import {ExtraFieldsEditor} from "./ExtraFieldsEditor";

let form: ParticipantForm;
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "e1"}, canManage: true})}));
vi.mock("@/components/event/manage/EventLexicalEditor", () => ({EventRichTextEditor: () => null}));
vi.mock("@/components/event/EventBrandLogo", () => ({EventBrandLogo: () => null}));
vi.mock("@/api/manageParticipantForm", async original => ({...(await original() as object), getManageParticipantForm: async () => form}));
vi.mock("@/api/manageTeamFields", () => ({getManageTeamFields: async () => form, putManageTeamFields: vi.fn()}));

const question = (id: string, extra: Partial<Extract<FormBlock, {type: "field"}>> = {}): FormBlock => ({id, type: "field", key: id, input: "text", label: `Питання ${id}`, ...extra});

afterEach(cleanup);
let restoreLayout: () => void;
beforeAll(() => {restoreLayout = stackLayout();});
afterAll(() => restoreLayout());
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
    it("start collapsed with only the question, its * and muted icons", async () => {
        await renderEditor(scope);
        const first = card("Питання 1");
        expect(chevron(first).getAttribute("aria-expanded")).toBe("false");
        expect(within(first).queryByRole("textbox")).toBeNull();
        expect(within(first).getByText("*")).toBeTruthy();
        expect(within(first).queryByText("Число")).toBeNull();
        expect(within(first).getByRole("button", {name: /Курс/}).textContent).toMatch(/^1Курс\*/);
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

    it("open a new or duplicated card", async () => {
        await renderEditor(scope);
        expect(screen.queryByRole("button", {name: /Згорнути все|Розгорнути все/})).toBeNull();
        fireEvent.click(within(card("Питання 2")).getByRole("button", {name: "Дублювати блок 2"}));
        expect(chevron(card("Питання 3")).getAttribute("aria-expanded")).toBe("true");
        expect(within(card("Питання 3")).getByDisplayValue("Група")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: /Поле/}));
        expect(chevron(card("Питання 4")).getAttribute("aria-expanded")).toBe("true");
    });

    it("collapse every card while one is dragged and restore them after", async () => {
        await renderEditor(scope);
        fireEvent.click(within(card("Питання 1")).getByText("Курс"));
        await keyboardDrag(within(card("Питання 2")).getByRole("button", {name: "Перетягнути блок 2"}), -1, "cancel", () => {
            expect(chevron(card("Питання 1")).getAttribute("aria-expanded")).toBe("false");
        });
        expect(chevron(card("Питання 1")).getAttribute("aria-expanded")).toBe("true");
        expect(chevron(card("Питання 2")).getAttribute("aria-expanded")).toBe("false");
    });

    it("move a card several positions in one drag", async () => {
        form.Document.blocks = [...form.Document.blocks, question("c", {label: "Факультет"}), question("d", {label: "Місто"})];
        await renderEditor(scope);
        await keyboardDrag(within(card("Питання 4")).getByRole("button", {name: "Перетягнути блок 4"}), -3);
        expect(within(card("Питання 1")).getByText("Місто")).toBeTruthy();
        expect(within(card("Питання 4")).getByText("Факультет")).toBeTruthy();
        await keyboardDrag(within(card("Питання 1")).getByRole("button", {name: "Перетягнути блок 1"}), 2);
        expect(within(card("Питання 3")).getByText("Місто")).toBeTruthy();
        expect(screen.getByText("Є незбережені зміни")).toBeTruthy();
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
