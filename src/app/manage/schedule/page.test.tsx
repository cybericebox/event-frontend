// @vitest-environment jsdom
/* eslint-disable @next/next/no-html-link-for-pages -- Exercises the real manual-draft navigation guard. */
import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {readFileSync} from "node:fs";
import type {ManageConfig, ManageLifecycle, ManageLifecycleInput} from "@/api/manage";
import {ManualDraftProvider} from "@/components/event/manage/manualDraft";
import {t} from "@/i18n/t";
import ManageSchedulePage from "./page";

const server = vi.hoisted(() => ({lifecycle: null as unknown as ManageLifecycle, save: vi.fn(), saveConfig: vi.fn(), canManage: true}));
vi.mock("next/navigation", () => ({usePathname: () => "/manage/schedule", useRouter: () => ({push: vi.fn(), replace: vi.fn()})}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "event-a", Name: "Event", LogoURL: ""}, canManage: server.canManage})}));
vi.mock("@/components/event/manage/StagesManager", () => ({StagesManager: () => null}));
vi.mock("@/api/manage", async original => ({...(await original() as object), getManageConfig: async () => config, getManageLifecycle: async () => server.lifecycle, putManageLifecycle: (...args: unknown[]) => server.save(...args), putManageConfig: (...args: unknown[]) => server.saveConfig(...args)}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));

const lifecycle: ManageLifecycle = {
    Configured: true, JoinPolicy: 0, PublishAt: "2026-10-12T08:00:00.000Z", StartAt: "2026-10-12T10:00:00.000Z",
    FinishAt: "2026-10-26T18:00:00.000Z", WithdrawAt: "2026-11-01T09:00:37.000Z", Status: "not_published", UpdatedAt: "2026-10-11T08:00:00.000Z",
    Infrastructure: {HasDynamicLabs: false, LaboratoriesAvailable: true, RequiresVPN: false, CanStart: true, Reason: null},
};
const config: ManageConfig = {
    EventID: "event-a", Participation: 0, Registration: 0, ScoreboardVisibility: 0, ParticipantsVisibility: 0,
    PreviewDescription: "", PreviewPicture: "", MaxTeamSize: 3, MinTeamSize: null, MaxTeams: null, InfrastructureAllowed: false,
    AllowPseudonyms: false, ShowDifficulty: true, HintsDisabled: false, HintChargeMode: "reward", MaxFlagAttempts: null, TaskRevealMode: "all_ready",
    ShowStartCountdown: true, ShowFinishCountdown: true, FinishCountdownMinutes: 30, FinishCountdownMode: "before_end", LabPolicy: null,
    Theme: {Brand: "#211A52", Accent: "", AccentLight: "#211A52", AccentDark: "#E6E6EE", AccentLive: "#FFFFFF", Version: 1}, UpdatedAt: "2026-10-11T08:00:00.000Z",
};
const styles = readFileSync("src/styles/event-manage.css", "utf8") + readFileSync("src/styles/event-manage-layout.css", "utf8");
let style: HTMLStyleElement;
HTMLDialogElement.prototype.showModal ??= function () {this.setAttribute("open", "");};
HTMLDialogElement.prototype.close ??= function () {this.removeAttribute("open");};

beforeEach(() => {
    sessionStorage.clear(); window.history.replaceState({}, "", "/manage/schedule"); server.canManage = true; server.lifecycle = {...lifecycle};
    server.saveConfig.mockReset().mockImplementation(async (_id: string, input: Record<string, unknown>) => ({...config, ...input}));
    server.save.mockReset().mockImplementation(async (_eventID: string, input: ManageLifecycleInput) => (server.lifecycle = {...server.lifecycle, ...input}));
    style = document.createElement("style"); style.textContent = styles; document.head.append(style);
});
afterEach(() => {cleanup(); style.remove();});

function page() {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(<QueryClientProvider client={client}><ManualDraftProvider userID="user-a" eventID="event-a"><div className="event-manage-shell"><ManageSchedulePage /><a href="/manage/settings" onClick={event => event.preventDefault()}>next</a></div></ManualDraftProvider></QueryClientProvider>);
}
const finish = () => screen.getByRole("button", {name: t("manage.schedule.finish")});
const closing = () => screen.getByRole("button", {name: t("manage.schedule.withdraw")});
const save = () => screen.getByRole("button", {name: t("manage.schedule.save")});
function changeFinishMinutes(minutes: string) {
    fireEvent.click(finish()); fireEvent.change(screen.getByRole("textbox", {name: t("ui.datePicker.minute")}), {target: {value: minutes}}); fireEvent.click(screen.getByRole("button", {name: t("common.done")}));
}
function clearClosing() {fireEvent.click(closing()); fireEvent.click(screen.getByRole("button", {name: t("ui.datePicker.noDate")}));}

describe("event schedule", () => {
    it("shows a disabled Save in both clean cards and enables only the edited card", async () => {
        const {container} = page(); await screen.findByRole("button", {name: t("manage.schedule.finish")});
        const actions = Array.from(container.querySelectorAll<HTMLElement>(".event-manage-section__actions"));
        expect(actions).toHaveLength(2);
        for (const footer of actions) expect(getComputedStyle(footer).display).toBe("flex");
        expect(save()).toHaveProperty("disabled", true);
        const countdownSave = screen.getByRole("button", {name: t("manage.schedule.countdown.save")});
        expect(countdownSave).toHaveProperty("disabled", true);
        changeFinishMinutes("15");
        expect(save()).toHaveProperty("disabled", false);
        changeFinishMinutes("00");
        expect(save()).toHaveProperty("disabled", true);
        fireEvent.change(document.getElementById("countdown-finish-minutes")!, {target: {value: "45"}});
        expect(countdownSave).toHaveProperty("disabled", false);
        fireEvent.change(document.getElementById("countdown-finish-minutes")!, {target: {value: "30"}});
        expect(countdownSave).toHaveProperty("disabled", true);
    });

    it("saves a scheduled end without inventing a closing date", async () => {
        server.lifecycle = {...lifecycle, WithdrawAt: null}; page(); await screen.findByRole("button", {name: t("manage.schedule.finish")});
        expect(screen.queryByRole("alert")).toBeNull();
        changeFinishMinutes("15"); fireEvent.click(save());
        await waitFor(() => expect(server.save).toHaveBeenCalledWith("event-a", expect.objectContaining({FinishAt: "2026-10-26T18:15:00.000Z", WithdrawAt: null})));
        expect(closing().textContent).toContain(t("ui.datePicker.placeholder"));
    });

    it("retains the saved closing timestamp when only the finish is edited", async () => {
        page(); await screen.findByRole("button", {name: t("manage.schedule.finish")}); changeFinishMinutes("15"); fireEvent.click(save());
        await waitFor(() => expect(server.save).toHaveBeenCalledWith("event-a", expect.objectContaining({WithdrawAt: "2026-11-01T09:00:37.000Z"})));
    });

    it("makes closing optional and lets an existing date be explicitly cleared", async () => {
        const {container} = page(); await screen.findByRole("button", {name: t("manage.schedule.withdraw")});
        expect(container.querySelector('label[for="withdraw-at"] .event-field-required')).toBeNull();
        expect(container.querySelector('label[for="finish-at"] .event-field-required')).toBeTruthy();
        clearClosing(); expect(screen.queryByRole("alert")).toBeNull(); fireEvent.click(save());
        await waitFor(() => expect(server.save).toHaveBeenCalledWith("event-a", expect.objectContaining({WithdrawAt: null})));
        await waitFor(() => expect(save()).toHaveProperty("disabled", true));
        expect(Object.keys(sessionStorage).filter(key => key.startsWith("cib_manual_draft_"))).toHaveLength(0);
    });

    it("preserves exact published lifecycle dates when a restored draft clears closing", async () => {
        server.lifecycle = {...lifecycle, Status: "published", PublishAt: "2026-10-12T08:00:37.123Z", StartAt: "2026-10-12T10:00:43.456Z", FinishAt: "2026-10-26T18:00:51.789Z"};
        const first = page(); await screen.findByRole("button", {name: t("manage.schedule.withdraw")});
        expect(screen.getByRole("button", {name: t("manage.schedule.publish")})).toHaveProperty("disabled", true);
        clearClosing(); first.unmount();
        const restored = page(); await screen.findByRole("button", {name: t("manage.schedule.finish")});
        expect(closing().textContent).toContain(t("ui.datePicker.placeholder")); expect(save()).toHaveProperty("disabled", false);
        fireEvent.click(save());
        await waitFor(() => expect(server.save).toHaveBeenCalledWith("event-a", {
            JoinPolicy: lifecycle.JoinPolicy, PublishAt: "2026-10-12T08:00:37.123Z", StartAt: "2026-10-12T10:00:43.456Z", FinishAt: "2026-10-26T18:00:51.789Z", WithdrawAt: null,
        }));
        await waitFor(() => expect(save()).toHaveProperty("disabled", true));
        expect(Object.keys(sessionStorage).filter(key => key.startsWith("cib_manual_draft_"))).toHaveLength(0);
        restored.unmount(); page(); await screen.findByRole("button", {name: t("manage.schedule.finish")});
        expect(closing().textContent).toContain(t("ui.datePicker.placeholder")); expect(save()).toHaveProperty("disabled", true);
    });

    it("still rejects a closing date at or before the finish", async () => {
        server.lifecycle = {...lifecycle, WithdrawAt: "2026-10-26T18:00:00.000Z"}; const {container} = page(); await screen.findByRole("button", {name: t("manage.schedule.finish")});
        expect(screen.getByRole("alert").textContent).toBe(t("manage.schedule.validation.withdrawAfterFinish"));
        changeFinishMinutes("15"); expect(save()).toHaveProperty("disabled", true); fireEvent.submit(container.querySelector("form")!);
        expect(server.save).not.toHaveBeenCalled();
    });

    it("requires a finish when scheduled ending is enabled, without requiring closing", async () => {
        server.lifecycle = {...lifecycle, FinishAt: null, WithdrawAt: null}; page(); await screen.findByRole("switch", {name: t("manage.schedule.scheduleEnd")});
        fireEvent.click(screen.getByRole("switch", {name: t("manage.schedule.scheduleEnd")}));
        expect(screen.getByRole("alert").textContent).toBe(t("manage.schedule.validation.finishRequired"));
        expect(save()).toHaveProperty("disabled", true);
    });

    it("recovers explicit clearing after refresh and guards its unsaved navigation", async () => {
        const first = page(); await screen.findByRole("button", {name: t("manage.schedule.withdraw")}); clearClosing(); first.unmount();
        page(); await screen.findByRole("button", {name: t("manage.schedule.finish")}); expect(closing().textContent).toContain(t("ui.datePicker.placeholder"));
        fireEvent.click(screen.getByText("next")); expect(screen.getByText(t("manage.unsaved.title"))).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: t("common.cancel")})); expect(closing().textContent).toContain(t("ui.datePicker.placeholder"));
    });

    it("keeps later edits and a visible pending save while an earlier save completes", async () => {
        let done!: (value: ManageLifecycle) => void; server.save.mockImplementation(() => new Promise(resolve => {done = resolve;}));
        const first = page(); await screen.findByRole("button", {name: t("manage.schedule.withdraw")}); clearClosing(); fireEvent.click(save());
        expect(save().getAttribute("aria-busy")).toBe("true"); expect(getComputedStyle(save().parentElement!).display).toBe("flex");
        changeFinishMinutes("30"); await act(async () => {done({...lifecycle, WithdrawAt: null});});
        expect(finish().textContent).toContain(":30"); expect(save()).toHaveProperty("disabled", false); first.unmount();
        page(); await screen.findByRole("button", {name: t("manage.schedule.finish")}); expect(finish().textContent).toContain(":30");
    });
    describe("finish countdown", () => {
        const minutes = () => document.getElementById("countdown-finish-minutes") as HTMLInputElement | null;
        const modeSelect = () => screen.getByRole("button", {name: t("manage.schedule.countdown.mode")});
        const pickMode = async (label: string) => {fireEvent.pointerDown(modeSelect(), {button: 0, ctrlKey: false}); fireEvent.click(await screen.findByRole("menuitemradio", {name: label}));};
        const countdownSave = () => screen.getByRole("button", {name: t("manage.schedule.countdown.save")});
        const ready = () => screen.findByRole("button", {name: t("manage.schedule.countdown.mode")});

        it("puts the mode before the minutes", async () => {
            page(); await ready();
            expect(modeSelect().compareDocumentPosition(minutes()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        });

        it("hides the minutes in from_start mode and restores them going back", async () => {
            page(); await ready();
            fireEvent.change(minutes()!, {target: {value: "45"}});
            await pickMode(t("manage.schedule.countdown.mode.fromStart"));
            expect(minutes()).toBeNull();
            await pickMode(t("manage.schedule.countdown.mode.beforeEnd"));
            expect(minutes()!.value).toBe("45");
        });

        it("saves from_start with invalid minutes using the saved value", async () => {
            page(); await ready();
            fireEvent.change(minutes()!, {target: {value: "0"}});
            expect(countdownSave()).toHaveProperty("disabled", true);
            await pickMode(t("manage.schedule.countdown.mode.fromStart"));
            expect(screen.queryByRole("alert")).toBeNull();
            expect(countdownSave()).toHaveProperty("disabled", false);
            fireEvent.click(countdownSave());
            await waitFor(() => expect(server.saveConfig).toHaveBeenCalledWith("event-a", expect.objectContaining({FinishCountdownMode: "from_start", FinishCountdownMinutes: 30})));
        });

        it("is clean again after returning to the saved mode", async () => {
            page(); await ready();
            await pickMode(t("manage.schedule.countdown.mode.fromStart"));
            expect(countdownSave()).toHaveProperty("disabled", false);
            await pickMode(t("manage.schedule.countdown.mode.beforeEnd"));
            expect(countdownSave()).toHaveProperty("disabled", true);
        });
    });
});
