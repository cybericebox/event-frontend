// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const server = vi.hoisted(() => ({status: "published", mode: "all_ready", attempts: null as number | null, staticPoints: 100, scoringMode: 0, putScoring: vi.fn(), put: vi.fn(), policy: null as {SnapshotMode: "skip" | "required"; MaxActiveLabsPerTeam: number | null; RetentionMinutes: number} | null, gate: null as null | (() => void)}));
vi.mock("@/components/event/manage/ManagerShell", () => ({useManager: () => ({event: {EventID: "3f1c2d4e-0000-4000-8000-000000000001", Name: "CTF", Participation: 0, LogoURL: null}, canManage: true})}));
vi.mock("@/api/manage", async original => ({
    ...(await original() as object),
    getManageConfig: async () => ({
        LabPolicy: server.policy, EventID: "3f1c2d4e-0000-4000-8000-000000000001", Participation: 0, Registration: 0, ScoreboardVisibility: 0, ParticipantsVisibility: 0,
        PreviewDescription: "", PreviewPicture: "", MaxTeamSize: 3, MinTeamSize: null, MaxTeams: null, InfrastructureAllowed: true,
        AllowPseudonyms: false, ShowDifficulty: true, HintsDisabled: false, HintChargeMode: "reward", MaxFlagAttempts: server.attempts, TaskRevealMode: server.mode,
    }),
    getManageLifecycle: async () => ({Configured: true, Status: server.status, JoinPolicy: 0}),
    getManageScoring: async () => ({Mode: server.scoringMode, MinPoints: server.scoringMode ? 100 : 0, MaxPoints: server.scoringMode ? 500 : 0, FloorAtPercent: server.scoringMode ? 50 : 0, StaticPoints: server.staticPoints, ForceEventScoring: false}),
    putManageScoring: server.putScoring,
    putManageConfig: server.put,
}));
vi.mock("next/navigation", () => ({usePathname: () => "/manage/challenges/settings", useRouter: () => ({push: vi.fn(), replace: vi.fn(), back: vi.fn()})}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));

vi.mock("@/components/ui/EventSelect", () => ({EventSelect: ({value, options, onValueChange, disabled, ariaLabel}: {
    value: string; options: {value: string; label: string}[]; onValueChange: (value: string) => void; disabled: boolean; ariaLabel: string;
}) => <select aria-label={ariaLabel} value={value} disabled={disabled} onChange={event => onValueChange(event.target.value)}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>}));

import {toast} from "react-hot-toast";
import {ChallengeSettings} from "./ChallengeSettings";
import {ManualDraftProvider} from "@/components/event/manage/manualDraft";

function renderPage(withDraftProvider = false) {
    const page = <ChallengeSettings />;
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>{withDraftProvider ? <ManualDraftProvider userID="user-1" eventID="3f1c2d4e-0000-4000-8000-000000000001">{page}</ManualDraftProvider> : page}</QueryClientProvider>);
}

describe("Показ завдань", () => {
    afterEach(() => {cleanup(); Object.assign(server, {status: "published", mode: "all_ready", attempts: null, policy: null}); server.put.mockReset();});

    it("shows the saved mode and switches at once, without waiting for the server", async () => {
        server.put.mockImplementation(() => new Promise(() => undefined));
        renderPage();
        const training = await screen.findByLabelText(/Для кожної команди окремо/) as HTMLInputElement;
        expect((await screen.findByLabelText(/Одночасно для всіх/) as HTMLInputElement).checked).toBe(true);
        fireEvent.click(training);
        const current = screen.getByLabelText(/Для кожної команди окремо/) as HTMLInputElement;
        await waitFor(() => expect((screen.getByLabelText(/Для кожної команди окремо/) as HTMLInputElement).checked).toBe(true));
        expect(current.matches(":disabled")).toBe(false);
        await waitFor(() => expect(server.put).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({TaskRevealMode: "as_ready"})));
    });

    it("rolls the choice back and shows a toast when the save fails", async () => {
        server.put.mockRejectedValue(new Error("boom"));
        renderPage();
        fireEvent.click(await screen.findByLabelText(/Для кожної команди окремо/));
        await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
        await waitFor(() => expect((screen.getByLabelText(/Одночасно для всіх/) as HTMLInputElement).checked).toBe(true));
        expect((screen.getByLabelText(/Для кожної команди окремо/) as HTMLInputElement).checked).toBe(false);
    });

    it("is locked with a hint after the event has started", async () => {
        server.status = "started";
        renderPage();
        expect((await screen.findByLabelText(/Для кожної команди окремо/) as HTMLInputElement).matches(":disabled")).toBe(true);
        expect(screen.getByText("Після початку заходу режим показу змінити не можна.")).toBeTruthy();
    });
});

describe("Спроби", () => {
    afterEach(() => {cleanup(); Object.assign(server, {status: "published", mode: "all_ready", attempts: null, policy: null}); server.put.mockReset();});
    const field = async () => await screen.findByRole("spinbutton", {name: "Максимум невдалих спроб на завдання"}) as HTMLInputElement;

    it("shows the saved limit and an empty field when unlimited", async () => {
        server.attempts = 4;
        renderPage();
        expect((await field()).value).toBe("4");
    });

    it("saves a typed limit at once without disabling anything, and sends it with the rest of the config", async () => {
        server.put.mockImplementation(() => new Promise(() => undefined));
        renderPage();
        const input = await field();
        expect(input.value).toBe("");
        fireEvent.change(input, {target: {value: "5"}});
        fireEvent.blur(input);
        await waitFor(() => expect(server.put).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({MaxFlagAttempts: 5, TaskRevealMode: "all_ready"})));
        expect(input.disabled).toBe(false);
        expect((await screen.findByLabelText(/Для кожної команди окремо/) as HTMLInputElement).matches(":disabled")).toBe(false);
        expect((await field()).value).toBe("5");
    });

    it("clears the limit with an empty field and refuses a value out of range", async () => {
        server.attempts = 4;
        server.put.mockImplementation(() => new Promise(() => undefined));
        renderPage();
        const input = await field();
        fireEvent.change(input, {target: {value: "1001"}});
        fireEvent.blur(input);
        expect(server.put).not.toHaveBeenCalled();
        expect(screen.getByText(/від 1 до 1000/)).toBeTruthy();
        fireEvent.change(input, {target: {value: ""}});
        fireEvent.blur(input);
        await waitFor(() => expect(server.put).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({MaxFlagAttempts: null})));
    });
});


describe("lifecycle policy optimistic save queue", () => {
    beforeEach(() => {vi.mocked(toast.error).mockClear();});
    afterEach(() => {cleanup(); server.policy = null; server.put.mockReset(); vi.mocked(toast.error).mockClear();});
    it("hides only the missing legacy policy section", async () => {
        renderPage(); await screen.findByText("Спроби");
        expect(screen.queryByLabelText("Знімок перед зупинкою")).toBeNull();
        expect(screen.getByLabelText("Максимум невдалих спроб на завдання")).toBeTruthy();
    });
    it("serializes snapshot and active-limit changes, leaves controls enabled and ignores an older reply", async () => {
        server.policy = {SnapshotMode: "skip", MaxActiveLabsPerTeam: null, RetentionMinutes: 90};
        const finishes: ((value: unknown) => void)[] = [];
        server.put.mockImplementation(() => new Promise(resolve => {finishes.push(resolve);}));
        renderPage();
        const snapshot = await screen.findByLabelText("Знімок перед зупинкою") as HTMLSelectElement;
        fireEvent.change(snapshot, {target: {value: "required"}});
        await waitFor(() => expect(server.put).toHaveBeenCalledTimes(1));
        const limit = screen.getByLabelText("Максимум активних середовищ команди") as HTMLInputElement;
        fireEvent.change(limit, {target: {value: "7"}}); fireEvent.blur(limit);
        await waitFor(() => {expect(snapshot.value).toBe("required"); expect(limit.value).toBe("7");});
        expect(snapshot.disabled).toBe(false); expect(limit.disabled).toBe(false);
        expect(server.put).toHaveBeenCalledTimes(1);
        await act(async () => {finishes[0]({...server.put.mock.calls[0][1], LabPolicy: {SnapshotMode: "skip", MaxActiveLabsPerTeam: null, RetentionMinutes: 90}});});
        await waitFor(() => expect(server.put).toHaveBeenCalledTimes(2));
        await waitFor(() => {expect(snapshot.value).toBe("required"); expect(limit.value).toBe("7");});
        expect(server.put.mock.calls[1][1]).toMatchObject({LabPolicy: {SnapshotMode: "required", MaxActiveLabsPerTeam: 7, RetentionMinutes: 90}, MaxFlagAttempts: null, ShowDifficulty: true});
        await act(async () => {finishes[1]({...server.put.mock.calls[1][1]});});
    });
    it("offers no retention setting and rolls back a refused policy save with a toast", async () => {
        server.policy = {SnapshotMode: "required", MaxActiveLabsPerTeam: 7, RetentionMinutes: 90};
        server.put.mockRejectedValue(new Error("refused"));
        renderPage();
        const limit = await screen.findByLabelText("Максимум активних середовищ команди") as HTMLInputElement;
        expect(screen.queryByLabelText("Зберігати зупинене середовище (хвилини)")).toBeNull();
        fireEvent.change(limit, {target: {value: "3"}}); fireEvent.keyDown(limit, {key: "Enter"});
        await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
        expect(server.put.mock.calls[0][1].LabPolicy).toEqual({SnapshotMode: "required", MaxActiveLabsPerTeam: 3, RetentionMinutes: 90});
        await waitFor(() => expect(limit.value).toBe("7"));
    });
});

describe("per-task points ceiling in event defaults", () => {
    afterEach(() => {cleanup(); server.staticPoints = 100; server.putScoring.mockReset();});
    it("preserves a saved value above 999, validates beside the field and refuses submission", async () => {
        server.staticPoints = 1200; renderPage();
        const input = await screen.findByRole("spinbutton", {name: /Бали за завдання/}) as HTMLInputElement;
        expect(input.value).toBe("1200"); expect(input.max).toBe("999");
        fireEvent.change(input, {target: {value: "1000"}});
        expect(input.value).toBe("1000"); expect(input.getAttribute("aria-invalid")).toBe("true");
        expect(input.parentElement?.querySelector("#static-points-error")?.textContent).toContain("від 1 до 999");
        fireEvent.submit(input.closest("form")!); expect(server.putScoring).not.toHaveBeenCalled();
        fireEvent.change(input, {target: {value: "999"}});
        expect(input.getAttribute("aria-invalid")).toBe("false");
        expect(input.closest("form")?.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    });
    it("applies the same ceiling separately to both dynamic point bounds", async () => {
        renderPage(); await screen.findByRole("spinbutton", {name: /Бали за завдання/});
        fireEvent.click(screen.getByLabelText(/^Динамічне/));
        const max = screen.getByRole("spinbutton", {name: /^Максимум балів/}) as HTMLInputElement;
        const min = screen.getByRole("spinbutton", {name: /^Мінімум балів/}) as HTMLInputElement;
        expect(max.max).toBe("999"); expect(min.max).toBe("999");
        fireEvent.change(max, {target: {value: "1001"}}); fireEvent.change(min, {target: {value: "1000"}});
        expect(max.value).toBe("1001"); expect(min.value).toBe("1000");
        expect(document.getElementById(max.getAttribute("aria-describedby")!)?.textContent).toBe("Ціле число від 1 до 999.");
        expect(document.getElementById(min.getAttribute("aria-describedby")!)?.textContent).toBe("Ціле число від 0 до 999.");
        fireEvent.submit(max.closest("form")!); expect(server.putScoring).not.toHaveBeenCalled();
    });
});

it.each([100,1200])("uses persisted dormant static points (%s) after switching away from an invalid static draft", async saved => {
    server.staticPoints=saved;
    server.putScoring.mockImplementation(async (_eventID,input) => ({...input,UpdatedAt:""}));
    try {
        renderPage(); const input=await screen.findByRole("spinbutton",{name:/Бали за завдання/});
        if(saved===100) fireEvent.change(input,{target:{value:"1000"}});
        fireEvent.click(screen.getByLabelText(/^Динамічне/));
        fireEvent.click(screen.getByLabelText(/^Статичне/));
        expect(screen.getByRole("spinbutton",{name:/Бали за завдання/})).toHaveProperty("value",saved===100?"1000":"1200");
        fireEvent.click(screen.getByLabelText(/^Динамічне/));
        fireEvent.submit(screen.getByRole("spinbutton",{name:/Максимум балів/}).closest("form")!);
        await waitFor(()=>expect(server.putScoring).toHaveBeenCalledWith(expect.any(String),expect.objectContaining({Mode:1,StaticPoints:saved,MinPoints:100,MaxPoints:500})));
    } finally {cleanup();server.staticPoints=100;server.putScoring.mockReset();}
});

describe("dormant static draft under the real manual-draft provider", () => {
    beforeEach(() => {sessionStorage.clear(); server.scoringMode=1; server.staticPoints=100; server.putScoring.mockReset();});
    afterEach(() => {cleanup();sessionStorage.clear();server.scoringMode=0;});
    it.each(["250","1000"])("retains typed %s when the unchanged dynamic request is not dirty", async typed=>{
        const first=renderPage(true);
        await screen.findByRole("spinbutton",{name:/Максимум балів/});
        fireEvent.click(screen.getByLabelText(/^Статичне/));
        fireEvent.change(screen.getByRole("spinbutton",{name:/Бали за завдання/}),{target:{value:typed}});
        fireEvent.click(screen.getByLabelText(/^Динамічне/));
        expect(screen.getByRole("button",{name:"Зберегти"})).toHaveProperty("disabled",true);
        fireEvent.submit(screen.getByRole("spinbutton",{name:/Максимум балів/}).closest("form")!);
        expect(server.putScoring).not.toHaveBeenCalled();
        fireEvent.click(screen.getByLabelText(/^Статичне/));
        const field=screen.getByRole("spinbutton",{name:/Бали за завдання/});
        expect(field).toHaveProperty("value",typed);
        expect(field.getAttribute("aria-invalid")).toBe(String(typed==="1000"));
        fireEvent.click(screen.getByLabelText(/^Динамічне/));
        first.unmount();renderPage(true);
        await screen.findByRole("spinbutton",{name:/Максимум балів/});
        fireEvent.click(screen.getByLabelText(/^Статичне/));
        expect(screen.getByRole("spinbutton",{name:/Бали за завдання/})).toHaveProperty("value",typed);
    });
});
