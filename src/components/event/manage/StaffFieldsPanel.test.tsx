// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {FormField, ParticipantForm} from "@/api/manageParticipantForm";
import type {StaffFields} from "@/api/manageStaffFields";
import {changedStaffValues, hasStaffFields, StaffFieldsPanel} from "./StaffFieldsPanel";

const get = vi.fn();
const put = vi.fn();
vi.mock("@/api/manageStaffFields", () => ({getManageStaffFields: (...args: unknown[]) => get(...args), putManageStaffFields: (...args: unknown[]) => put(...args)}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));
vi.mock("@/components/event/EventBrandLogo", () => ({EventBrandLogo: () => null}));

const field = (key: string, extra: Partial<FormField> = {}): FormField => ({id: key, type: "field", key, input: "text", label: key, ...extra});
const form: ParticipantForm = {Version: 2, Enabled: true, Required: true, Document: {blocks: [
    field("city", {label: "Місто", required: true}),
    field("note", {label: "Нотатка організаторів", input: "long_text", staffOnly: true}),
    field("came", {label: "Був на заході", input: "checkbox", staffOnly: true}),
]}};

afterEach(() => {cleanup(); get.mockReset(); put.mockReset();});

function setup(saved: StaffFields, canManage = true) {
    get.mockResolvedValue(saved);
    const onSaved = vi.fn();
    render(<QueryClientProvider client={new QueryClient()}><StaffFieldsPanel eventID="e1" scope="participant" subjectID="u1" form={form} answers={{city: "Київ"}} canManage={canManage} onSaved={onSaved} /></QueryClientProvider>);
    return onSaved;
}

describe("StaffFieldsPanel", () => {
    it("shows only the staff-only questions and who changed them last", async () => {
        setup({Values: {note: "VIP"}, Change: {Keys: ["note"], ActorName: "Олена Коваль", At: "2026-09-29T10:00:00Z"}});
        await screen.findByDisplayValue("VIP");
        expect(screen.getByText("Службові поля")).toBeTruthy();
        expect(screen.getByText("Нотатка організаторів")).toBeTruthy();
        expect(screen.getByText("Був на заході")).toBeTruthy();
        expect(screen.queryByText("Місто")).toBeNull();
        expect(screen.getByText(/Востаннє змінено: Олена Коваль/)).toBeTruthy();
        expect(screen.queryByRole("button", {name: "Зберегти службові поля"})).toBeNull();
    });

    it("says when nothing was ever changed", async () => {
        setup({Values: {}, Change: null});
        await screen.findByText("Службові поля ще не змінювали");
    });

    it("saves only the changed keys and reloads the table", async () => {
        const onSaved = setup({Values: {note: "VIP"}, Change: null});
        const note = await screen.findByDisplayValue("VIP");
        put.mockResolvedValue({Values: {note: "VIP", came: true}, Change: {Keys: ["came"], ActorName: "Я", At: "2026-09-29T11:00:00Z"}});
        fireEvent.click(screen.getByRole("checkbox"));
        expect(note).toBeTruthy();
        fireEvent.click(await screen.findByRole("button", {name: "Зберегти службові поля"}));
        await waitFor(() => expect(put).toHaveBeenCalledWith("e1", "participant", "u1", {came: true}));
        await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
        expect(await screen.findByText(/Востаннє змінено: Я/)).toBeTruthy();
        expect(screen.queryByRole("button", {name: "Зберегти службові поля"})).toBeNull();
    });

    it("is read-only without the manage permission", async () => {
        setup({Values: {note: "VIP"}, Change: null}, false);
        const note = await screen.findByDisplayValue("VIP") as HTMLTextAreaElement;
        expect(note.disabled).toBe(true);
    });
});

describe("staff field helpers", () => {
    it("hasStaffFields sees a staff-only question", () => {
        expect(hasStaffFields(form)).toBe(true);
        expect(hasStaffFields({...form, Document: {blocks: [field("city")]}})).toBe(false);
        expect(hasStaffFields(null)).toBe(false);
    });

    it("changedStaffValues keeps only keys that differ, and sends a cleared one as an empty value", () => {
        expect(changedStaffValues({note: "a", came: true}, {note: "a", came: false}, ["note", "came"])).toEqual({came: false});
        expect(changedStaffValues({note: "a"}, {note: ""}, ["note"])).toEqual({note: ""});
        expect(changedStaffValues({}, {city: "x"}, ["note"])).toEqual({});
    });
});
