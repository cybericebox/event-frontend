// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import type {FormField, ParticipantForm} from "@/api/manageParticipantForm";
import {changedEditableAnswers} from "./participationModel";
import {FieldRows, FieldsEditor} from "./participationParts";

vi.mock("@/components/event/EventBrandLogo", () => ({EventBrandLogo: () => null}));

const field = (key: string, extra: Partial<FormField> = {}): FormField => ({id: key, type: "field", key, input: "text", label: `Поле ${key}`, ...extra});
const form: ParticipantForm = {Version: 3, Enabled: true, Required: true, Document: {blocks: [
    field("city", {editable: true}),
    field("school"),
    field("club", {required: true}),
]}};

afterEach(cleanup);

describe("a required field the person still owes", () => {
    it("can be sent once even though it is not editable", () => {
        const before = {school: "KPI"};
        const after = {school: "LNU", club: "Chess", city: "Lviv"};
        expect(changedEditableAnswers(form, before, after)).toEqual({city: "Lviv"});
        expect(changedEditableAnswers(form, before, after, ["club"])).toEqual({city: "Lviv", club: "Chess"});
    });

    it("is marked «Заповніть» and opens the editor even when nothing is editable", () => {
        const onEdit = vi.fn();
        const locked: ParticipantForm = {...form, Document: {blocks: [field("club", {required: true})]}};
        render(<FieldRows form={locked} answers={{}} canEdit missing={["club"]} onEdit={onEdit} />);
        expect(screen.getByText("Заповніть")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: "Змінити поля"}));
        expect(onEdit).toHaveBeenCalledOnce();
    });

    it("without anything owed a locked form offers no editing", () => {
        const locked: ParticipantForm = {...form, Document: {blocks: [field("club", {required: true})]}};
        render(<FieldRows form={locked} answers={{club: "Chess"}} canEdit onEdit={vi.fn()} />);
        expect(screen.queryByText("Заповніть")).toBeNull();
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("the editor shows the editable fields and the fillable one, not the locked ones", () => {
        render(<FieldsEditor form={form} answers={{school: "KPI"}} fillable={["club"]} onCancel={vi.fn()} onSave={vi.fn()} />);
        expect(screen.getByText("Поле city")).toBeTruthy();
        expect(screen.getByText(/Поле club/)).toBeTruthy();
        expect(screen.queryByText("Поле school")).toBeNull();
    });
});
