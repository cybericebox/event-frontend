// @vitest-environment jsdom
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {FormBlock, ParticipantForm, ParticipantFormInput} from "@/api/manageParticipantForm";
import {stackLayout} from "@/components/ui/sortableTestUtils";
import {t} from "@/i18n/t";
import {ExtraFieldsEditor} from "./ExtraFieldsEditor";

// jsdom has no top-layer dialog.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };

let form: ParticipantForm;
const put = vi.fn(async (_eventID: string, input: ParticipantFormInput): Promise<ParticipantForm> => ({...form, ...input, Version: form.Version + 1}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "e1"}, canManage: true})}));
vi.mock("@/components/event/manage/EventLexicalEditor", () => ({EventRichTextEditor: () => null}));
vi.mock("@/components/event/EventBrandLogo", () => ({EventBrandLogo: () => null}));
vi.mock("@/api/manageParticipantForm", async original => ({...(await original() as object), getManageParticipantForm: async () => form, putManageParticipantForm: (eventID: string, input: ParticipantFormInput) => put(eventID, input)}));
vi.mock("@/api/manageTeamFields", () => ({getManageTeamFields: async () => form, putManageTeamFields: (eventID: string, input: ParticipantFormInput) => put(eventID, input)}));

const question = (id: string, extra: Partial<Extract<FormBlock, {type: "field"}>> = {}): FormBlock => ({id, type: "field", key: id, input: "text", label: `Питання ${id}`, ...extra});

afterEach(() => {cleanup(); put.mockClear();});
let restoreLayout: () => void;
beforeAll(() => {restoreLayout = stackLayout();});
afterAll(() => restoreLayout());
beforeEach(() => {
    form = {Version: 1, Enabled: true, Required: true, Answered: 5, Document: {blocks: [question("a", {label: "Курс", required: true})]}};
});

async function renderEditor(scope: "participant" | "team") {
    render(<QueryClientProvider client={new QueryClient()}><ExtraFieldsEditor scope={scope} /></QueryClientProvider>);
    await waitFor(() => screen.getAllByText("Курс"));
}

// Adds a question called «Клуб» and makes it required.
function addRequiredClub() {
    fireEvent.click(screen.getByRole("button", {name: /^Поле$/}));
    const added = screen.getByRole("region", {name: "Питання 2"});
    fireEvent.change(within(added).getByPlaceholderText(t("manage.fields.editor.questionPlaceholder")), {target: {value: "Клуб"}});
    fireEvent.click(within(added).getByRole("switch", {name: "Відповідь обовʼязкова"}));
    return added;
}

describe.each(["participant", "team"] as const)("a new required field while answers exist (%s)", scope => {
    it("asks first and defaults to new registrations only", async () => {
        await renderEditor(scope);
        addRequiredClub();
        fireEvent.click(screen.getByRole("button", {name: "Зберегти додаткові поля"}));
        const dialog = await screen.findByRole("alertdialog");
        expect(within(dialog).getByText("Нове обовʼязкове поле")).toBeTruthy();
        expect(within(dialog).getByText("Нові обовʼязкові поля: Клуб")).toBeTruthy();
        expect((within(dialog).getByRole("radio", {name: /Лише для нових реєстрацій/}) as HTMLInputElement).checked).toBe(true);
        expect(within(dialog).queryByRole("switch")).toBeNull();
        expect(put).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole("button", {name: "Зберегти додаткові поля"}));
        await waitFor(() => expect(put).toHaveBeenCalledOnce());
        expect(put.mock.calls[0][1]).toMatchObject({RequireExisting: false, BlockSubmissions: false});
    });

    it("requires it from everyone, with the blocking opt-in off until chosen", async () => {
        await renderEditor(scope);
        addRequiredClub();
        fireEvent.click(screen.getByRole("button", {name: "Зберегти додаткові поля"}));
        const dialog = await screen.findByRole("alertdialog");
        fireEvent.click(within(dialog).getByRole("radio", {name: scope === "team" ? /Вимагати від усіх команд/ : /Вимагати від усіх учасників/}));
        const block = within(dialog).getByRole("switch", {name: /Блокувати відправку рішень, доки не заповнено/}) as HTMLInputElement;
        expect(block.checked).toBe(false);
        fireEvent.click(block);
        fireEvent.click(within(dialog).getByRole("button", {name: "Зберегти додаткові поля"}));
        await waitFor(() => expect(put).toHaveBeenCalledOnce());
        expect(put.mock.calls[0][1]).toMatchObject({RequireExisting: true, BlockSubmissions: true});
    });

    it("cancelling the question saves nothing", async () => {
        await renderEditor(scope);
        addRequiredClub();
        fireEvent.click(screen.getByRole("button", {name: "Зберегти додаткові поля"}));
        const dialog = await screen.findByRole("alertdialog");
        fireEvent.click(within(dialog).getByRole("button", {name: "Скасувати"}));
        expect(put).not.toHaveBeenCalled();
    });

    it("does not ask when nobody answered yet, and leaves the policy out", async () => {
        form = {...form, Answered: 0};
        await renderEditor(scope);
        addRequiredClub();
        fireEvent.click(screen.getByRole("button", {name: "Зберегти додаткові поля"}));
        await waitFor(() => expect(put).toHaveBeenCalledOnce());
        expect(screen.queryByRole("alertdialog")).toBeNull();
        expect(put.mock.calls[0][1]).not.toHaveProperty("RequireExisting");
    });

    it("does not ask for an optional field", async () => {
        await renderEditor(scope);
        fireEvent.click(screen.getByRole("button", {name: /^Поле$/}));
        const added = screen.getByRole("region", {name: "Питання 2"});
        fireEvent.change(within(added).getByPlaceholderText(t("manage.fields.editor.questionPlaceholder")), {target: {value: "Клуб"}});
        fireEvent.click(screen.getByRole("button", {name: "Зберегти додаткові поля"}));
        await waitFor(() => expect(put).toHaveBeenCalledOnce());
        expect(screen.queryByRole("alertdialog")).toBeNull();
    });

    it("tells when everyone is already asked for the new fields", async () => {
        form = {...form, RequireExisting: true, BlockSubmissions: true};
        await renderEditor(scope);
        const notice = screen.getByText(/Нові обовʼязкові поля вимагаються від усіх/);
        expect(notice.textContent).toContain(scope === "team" ? "від усіх команд" : "від усіх учасників");
        expect(notice.textContent).toContain("надсилати відповіді на завдання не можна");
    });
});

describe("a staff-only field", () => {
    it("hides the required and editable switches and is saved as staffOnly", async () => {
        await renderEditor("participant");
        const first = screen.getByRole("region", {name: "Питання 1"});
        fireEvent.click(within(first).getByText("Курс"));
        expect(within(first).getByRole("switch", {name: "Відповідь обовʼязкова"})).toBeTruthy();
        fireEvent.click(within(first).getByRole("switch", {name: /Службове поле/}));
        expect(within(first).queryByRole("switch", {name: "Відповідь обовʼязкова"})).toBeNull();
        expect(within(first).queryByRole("switch", {name: /Учасник може змінити/})).toBeNull();
        expect(within(first).getByRole("img", {name: "Службове поле: бачать лише організатори"})).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: "Зберегти додаткові поля"}));
        await waitFor(() => expect(put).toHaveBeenCalledOnce());
        const saved = put.mock.calls[0][1].Document.blocks[0];
        expect(saved).toMatchObject({staffOnly: true, required: false});
        // no new required field, so no question about existing people
        expect(screen.queryByRole("alertdialog")).toBeNull();
    });

    it("refuses to save while a participant question depends on it", async () => {
        form = {...form, Document: {blocks: [question("a", {label: "Курс", input: "checkbox", staffOnly: true}), question("b", {label: "Група", condition: {fieldKey: "a", operator: "equals", value: true}})]}};
        await renderEditor("participant");
        expect(screen.getByRole("alert").textContent).toMatch(/службового поля/);
    });
});
