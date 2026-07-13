import axios, {AxiosInstance, InternalAxiosRequestConfig} from "axios";
import {eventInfoFixture} from "@/api/mock/fixtures/event";
import {notificationsFixture} from "@/api/mock/fixtures/notifications";
import {
    challengesFixture,
    solvedByFixture,
    teamFixture,
    CORRECT_FLAGS,
    markChallengeSolved,
} from "@/api/mock/fixtures/challenges";
import {SolveChallengeSchema} from "@/types/challenge";

// A route body is either a static fixture or a function of the request config
// (needed for /solve, whose response depends on the submitted flag).
type Body = unknown | ((config: InternalAxiosRequestConfig) => unknown);

// Route (method + path suffix) -> fixture body. Extend as later pages add fixtures.
// Matchers use substring checks against the full request URL (baseURL + url).
const ROUTES: { test: (url: string, method?: string) => boolean; body: Body }[] = [
    // "events/self/info" is NOT a substring of "events/self/join/info" (the join-status
    // endpoint), so this matcher does not accidentally swallow that route.
    {test: (u) => u.includes("events/self/info"), body: eventInfoFixture},
    {test: (u) => u.includes("events/self/notifications"), body: notificationsFixture},
    {test: (u) => u.includes("events/self/challenges/info"), body: challengesFixture},
    {test: (u) => u.includes("/solvedBy"), body: solvedByFixture},
    // Match the team route but NOT its /vpn-config sub-path.
    {test: (u) => u.includes("events/self/teams/self") && !u.includes("vpn-config"), body: teamFixture},
    // POST /solve — compute Solved from the submitted flag vs the challenge's correct flag.
    {
        test: (u, m) => u.includes("/solve") && (m ?? "").toLowerCase() === "post",
        body: (config: InternalAxiosRequestConfig) => {
            const id = (config.url ?? "").split("/challenges/")[1]?.split("/solve")[0] ?? "";
            const parsed = SolveChallengeSchema.safeParse(
                typeof config.data === "string" ? JSON.parse(config.data) : config.data
            );
            const solution = parsed.success ? parsed.data.Solution : "";
            const solved = CORRECT_FLAGS[id] === solution;
            if (solved) markChallengeSolved(id);
            return {Status: {Code: 200, Message: "OK"}, Data: {Solved: solved}};
        },
    },
];

// Install a mock adapter that resolves fixtures with a small latency when the flag is on.
// No-op unless NEXT_PUBLIC_USE_MOCKS === "1"; unmocked routes fall through to the real /api.
export function installMockAdapter(api: AxiosInstance): void {
    if (process.env.NEXT_PUBLIC_USE_MOCKS !== "1") return;

    // api.defaults.adapter is the name array (e.g. ["xhr","http","fetch"]), not a callable;
    // axios.getAdapter resolves it to the actual adapter function.
    const passthrough = axios.getAdapter(api.defaults.adapter);

    api.defaults.adapter = async (config) => {
        const url = (config.baseURL ?? "") + (config.url ?? "");
        const hit = ROUTES.find((r) => r.test(url, config.method));
        if (!hit) return passthrough(config);

        await new Promise((resolve) => setTimeout(resolve, 250));

        const body = typeof hit.body === "function" ? (hit.body as (c: typeof config) => unknown)(config) : hit.body;

        return {
            data: body,
            status: 200,
            statusText: "OK",
            headers: {},
            config,
            request: {},
        };
    };
}
