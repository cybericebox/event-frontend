// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import type {FormField, ParticipantForm} from "@/api/manageParticipantForm";
import {changedEditableAnswers} from "./participationModel";
import {AnswersCard} from "./AnswersCard";

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

    it("is marked «Заповніть» and opens the form even when nothing is editable", () => {
        const locked: ParticipantForm = {...form, Document: {blocks: [field("club", {required: true})]}};
        render(<AnswersCard scope="participant" title="Анкета" form={locked} answers={{}} missing={["club"]} canEdit onSave={vi.fn()} />);
        expect(screen.getAllByText("Заповніть", {selector: ".ib-tag"}).length).toBeGreaterThan(0);
        fireEvent.click(screen.getByRole("button", {name: "Редагувати"}));
        expect(screen.getByLabelText(/Поле club/)).toBeTruthy();
    });

    it("without anything owed a locked form offers no editing", () => {
        const locked: ParticipantForm = {...form, Document: {blocks: [field("club", {required: true})]}};
        render(<AnswersCard scope="participant" title="Анкета" form={locked} answers={{club: "Chess"}} missing={[]} canEdit onSave={vi.fn()} />);
        expect(screen.queryAllByText("Заповніть", {selector: ".ib-tag"})).toHaveLength(0);
        expect(screen.queryByRole("button", {name: "Редагувати"})).toBeNull();
    });
});

describe("the answers form", () => {
    it("shows every field, locks the ones not editable and offers the save bar only when dirty", () => {
        render(<AnswersCard scope="participant" title="Анкета" form={form} answers={{school: "KPI"}} missing={["club"]} canEdit onSave={vi.fn()} />);
        fireEvent.click(screen.getByRole("button", {name: "Редагувати"}));
        expect(screen.getByLabelText("Поле city")).toBeTruthy();
        expect(screen.getByText("KPI")).toBeTruthy();
        expect(screen.getByRole("button", {name: /Про поле «Поле school»: змінити не можна/})).toBeTruthy();
        expect(screen.queryByRole("region", {name: "Збереження змін"})).toBeNull();
        fireEvent.change(screen.getByLabelText("Поле city"), {target: {value: "Lviv"}});
        expect(screen.getByRole("region", {name: "Збереження змін"})).toBeTruthy();
    });

    it("blocks the save with an inline error while a required field is empty, then saves", async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<AnswersCard scope="participant" title="Анкета" form={form} answers={{}} missing={["club"]} canEdit onSave={onSave} />);
        fireEvent.click(screen.getByRole("button", {name: "Редагувати"}));
        fireEvent.change(screen.getByLabelText("Поле city"), {target: {value: "Lviv"}});
        fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
        expect(await screen.findByText("Заповніть поле «Поле club»")).toBeTruthy();
        expect(onSave).not.toHaveBeenCalled();
        fireEvent.change(screen.getByLabelText(/Поле club/), {target: {value: "Chess"}});
        fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
        await waitFor(() => expect(onSave).toHaveBeenCalledWith({city: "Lviv", club: "Chess"}));
    });

    it("shows the failure inline and stays in the form", async () => {
        render(<AnswersCard scope="participant" title="Анкета" form={form} answers={{}} missing={[]} canEdit onSave={vi.fn().mockRejectedValue(new Error("Не вийшло"))} />);
        fireEvent.click(screen.getByRole("button", {name: "Редагувати"}));
        fireEvent.change(screen.getByLabelText("Поле city"), {target: {value: "Lviv"}});
        fireEvent.click(screen.getByRole("button", {name: "Зберегти"}));
        expect(await screen.findByText("Не вийшло")).toBeTruthy();
        expect(screen.getByLabelText("Поле city")).toBeTruthy();
    });
});
