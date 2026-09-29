// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ManageDialog} from "./ManageDialog";
import {EventFilePicker} from "@/components/ui/EventFilePicker";
import {CreateTeamDialog} from "../CreateTeamDialog";
import {InviteParticipantsDialog} from "../InviteParticipantsDialog";

vi.mock("@/components/event/EventBrandLogo", () => ({EventBrandLogo: () => null}));
vi.mock("@/api/manageTeamFields", () => ({getManageTeamFields: async () => null}));
vi.mock("@/api/manageParticipants", () => ({getManageParticipants: async () => ({Items: [], NextCursor: null})}));
vi.mock("@/api/manageInvites", () => ({sendInvitations: vi.fn(async () => []), createManageTeams: vi.fn(async () => ({Teams: [], Issues: [], Assigned: 0, Invited: 2}))}));

afterEach(cleanup);

const overlay = "Відпустіть файл, щоб завантажити CSV";
const files = (list: File[]) => ({dataTransfer: {types: ["Files"], files: list, dropEffect: ""}});
const csv = new File(["team,email,first_name,last_name,captain\nAlpha,a@x.test,A,B,yes\n"], "teams.csv", {type: "text/csv"});

function dialog(onDrop = vi.fn(), children: React.ReactNode = <p>Тіло</p>) {
    render(<ManageDialog open onOpenChange={vi.fn()} title="Діалог" footer={null} fileDrop={{label: overlay, onDrop}}>{children}</ManageDialog>);
    return {content: screen.getByRole("dialog"), onDrop};
}

describe("dialog-wide file drop", () => {
    it("shows the overlay for a file drag and keeps it over children", () => {
        const {content} = dialog();
        fireEvent.dragEnter(content, files([]));
        expect(screen.getByText(overlay)).toBeTruthy();
        fireEvent.dragEnter(screen.getByText("Тіло"), files([]));
        fireEvent.dragLeave(content, files([]));
        expect(screen.getByText(overlay)).toBeTruthy();
        fireEvent.dragLeave(screen.getByText("Тіло"), files([]));
        expect(screen.queryByText(overlay)).toBeNull();
    });

    it("ignores text drags", () => {
        const {content} = dialog();
        fireEvent.dragEnter(content, {dataTransfer: {types: ["text/plain"], files: []}});
        expect(screen.queryByText(overlay)).toBeNull();
    });

    it("hands dropped files on and hides; Esc hides without closing", () => {
        const {content, onDrop} = dialog();
        fireEvent.dragEnter(content, files([]));
        fireEvent.drop(content, files([csv]));
        expect(onDrop).toHaveBeenCalledWith([csv]);
        expect(screen.queryByText(overlay)).toBeNull();
        fireEvent.dragEnter(content, files([]));
        fireEvent.keyDown(content, {key: "Escape"});
        expect(screen.queryByText(overlay)).toBeNull();
        expect(screen.getByRole("dialog")).toBeTruthy();
    });

    it("leaves a drop on the picker's own zone to the picker", () => {
        const onFile = vi.fn();
        const {onDrop} = dialog(vi.fn(), <EventFilePicker id="csv" fileName={null} onFile={onFile} accept=".csv" />);
        fireEvent.drop(screen.getByRole("button", {name: "Обрати файл"}), files([csv]));
        expect(onFile).toHaveBeenCalledOnce();
        expect(onDrop).not.toHaveBeenCalled();
    });
});

describe("create-team dialog", () => {
    it("switches to CSV mode when a CSV is dropped in manual mode", async () => {
        render(<QueryClientProvider client={new QueryClient()}><CreateTeamDialog eventID="e1" open onOpenChange={vi.fn()} onCreated={vi.fn(async () => undefined)} /></QueryClientProvider>);
        expect(screen.getByRole("button", {name: "Одна команда"}).getAttribute("aria-pressed")).toBe("true");
        fireEvent.drop(screen.getByRole("dialog"), files([csv]));
        await waitFor(() => expect(screen.getByText("teams.csv")).toBeTruthy());
        expect(screen.getByRole("button", {name: "З CSV-файлу"}).getAttribute("aria-pressed")).toBe("true");
    });

    it("runs a dropped wrong file through the picker's checks", async () => {
        render(<QueryClientProvider client={new QueryClient()}><CreateTeamDialog eventID="e1" open onOpenChange={vi.fn()} onCreated={vi.fn(async () => undefined)} /></QueryClientProvider>);
        fireEvent.drop(screen.getByRole("dialog"), files([new File(["x"], "notes.txt", {type: "text/plain"})]));
        await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Цей формат файлу не підтримується."));
    });
});

describe("invite dialog", () => {
    it("asks for addresses or a CSV, not for typing, and says the file can be dragged in", async () => {
        render(<InviteParticipantsDialog eventID="e1" open onOpenChange={vi.fn()} onSent={vi.fn(async () => undefined)} />);
        const label = screen.getByText("Адреси електронної пошти", {exact: false});
        expect(label.textContent).not.toContain("*");
        expect(screen.getByText(/Вкажіть адреси або завантажте CSV — потрібна хоча б одна адреса\./)).toBeTruthy();
        expect((screen.getByRole("button", {name: "Надіслати запрошення"}) as HTMLButtonElement).disabled).toBe(true);
        fireEvent.focus(screen.getByRole("button", {name: "Колонки CSV"}));
        await waitFor(() => expect(document.body.textContent).toContain("Файл можна обрати кнопкою або перетягнути будь-куди у вікно."));
        fireEvent.drop(screen.getByRole("dialog"), files([new File(["email\na@x.test\n"], "people.csv", {type: "text/csv"})]));
        await waitFor(() => expect((screen.getByRole("button", {name: "Надіслати запрошення"}) as HTMLButtonElement).disabled).toBe(false));
    });
});
