// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {EventExerciseAttachment, ResourcePlan} from "@/api/manageChallenges";
import {ResourcePlanSummary} from "./ResourcePlanSummary";

const api = vi.hoisted(() => ({plan: vi.fn()}));
vi.mock("@/api/manageChallenges", () => ({getEventResourcePlan: api.plan}));

afterEach(() => { cleanup(); vi.resetAllMocks(); });

const MIB = 1024 ** 2;
const res = (cpu: number, mib: number, devices = 0, blocks = devices * 4) => ({Blocks: blocks, CPUMillicores: cpu, MemoryBytes: mib * MIB, Devices: devices});
const amount = (cpu: number, mib: number, blocks = 1) => ({Blocks: blocks, CPUMillicores: cpu, MemoryBytes: mib * MIB});
const attachment = (devices: number) => ({ID: "a", ExerciseName: "Web", Resources: {Min: res(25, 64, devices), Max: res(25, 64, devices)}}) as EventExerciseAttachment;
const id = "11111111-1111-4111-8111-111111111111";
const plan = (over: Partial<ResourcePlan> = {}): ResourcePlan => ({
    Tasks: [
        {EventExerciseID: id, ExerciseID: id, ExerciseName: "Web", Range: {Min: res(250, 1024, 2), Max: res(250, 1024, 2)}, Reserved: res(250, 1024, 2), ResourceHeavy: true, InternetLab: false, NoAgentFits: false},
        {EventExerciseID: id.replace(/1/g, "2"), ExerciseID: id, ExerciseName: "Pwn", Range: {Min: res(125, 512, 1), Max: res(125, 512, 1)}, Reserved: res(125, 512, 1), ResourceHeavy: false, InternetLab: true, NoAgentFits: true},
    ],
    TeamTasks: res(375, 1536, 3), Group: {MaxUsers: 5, InternetLabs: 1, VPN: amount(100, 128, 2), Gateway: amount(50, 64), Known: true, TooLarge: false},
    PerTeam: res(525, 1728, 3), Teams: 10, TeamsBasis: "max_teams", Total: res(5250, 17280, 30), NoAgentFits: false, ...over,
});

function view(attachments: EventExerciseAttachment[]) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(<QueryClientProvider client={client}><ResourcePlanSummary eventID="e" attachments={attachments} /></QueryClientProvider>);
}

describe("ResourcePlanSummary", () => {
    it("shows each task, the group overhead as a separate line, the team total and the total for all teams", async () => {
        api.plan.mockResolvedValue(plan());
        const {container} = view([attachment(2)]);
        await waitFor(() => expect(container.querySelector("[data-plan-total]")).not.toBeNull());
        const rows = Array.from(container.querySelectorAll("[data-plan-task]")).map(row => row.textContent);
        expect(rows[0]).toContain("Web");
        expect(rows[0]).toContain("Ресурсоємне");
        expect(rows[0]).toContain("250 мілі-ядер");
        expect(rows[1]).toContain("Немає лабораторії для запуску");
        const overhead = container.querySelector("[data-plan-overhead]")!;
        expect(overhead.textContent).toContain("Службові поди групи");
        expect(overhead.textContent).toContain("VPN: CPU 100 мілі-ядер · памʼять 128 МіБ · 2 блоки; шлюз: CPU 50 мілі-ядер · памʼять 64 МіБ · 1 блок");
        expect(container.querySelector("[data-plan-team]")!.textContent).toContain("525 мілі-ядер");
        const total = container.querySelector("[data-plan-total]")!.textContent!;
        expect(total).toContain("Разом на 10 команд");
        expect(total).toContain("за максимумом заходу");
        expect(total).toContain("5,25 vCPU");
        expect(total).toContain("120");
        expect(container.querySelector("[data-plan-team]")!.textContent).toContain("12");
    });

    it("says the laboratory has not reported the pod sizing when it is unknown", async () => {
        api.plan.mockResolvedValue(plan({Group: {MaxUsers: 5, InternetLabs: 0, VPN: amount(0, 0), Gateway: amount(0, 0), Known: false, TooLarge: false}}));
        const {container} = view([attachment(2)]);
        await waitFor(() => expect(container.querySelector("[data-overhead-unknown]")).not.toBeNull());
        expect(container.querySelector("[data-overhead-unknown]")!.textContent).toBe("Лабораторія ще не повідомила розміри службових подів, тож вони не враховані");
    });

    it("warns when no laboratory fits and when the team is too large to size", async () => {
        api.plan.mockResolvedValue(plan({NoAgentFits: true, Group: {MaxUsers: 500, InternetLabs: 1, VPN: amount(100, 128), Gateway: amount(50, 64), Known: true, TooLarge: true}}));
        const {container} = view([attachment(2)]);
        await waitFor(() => expect(container.querySelector("[data-plan-no-agent]")).not.toBeNull());
        expect(container.querySelector("[data-plan-too-large]")).not.toBeNull();
    });

    it("renders nothing when no set has devices", () => {
        const {container} = view([attachment(0)]);
        expect(container.firstChild).toBeNull();
        expect(api.plan).not.toHaveBeenCalled();
    });

    it("shows a centered load error with a retry", async () => {
        api.plan.mockRejectedValueOnce(new Error("down")).mockResolvedValue(plan());
        const {container} = view([attachment(2)]);
        fireEvent.click(await screen.findByRole("button", {name: "Спробувати ще раз"}));
        await waitFor(() => expect(container.querySelector("[data-plan-total]")).not.toBeNull());
    });
});
