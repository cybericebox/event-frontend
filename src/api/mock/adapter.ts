import {AxiosAdapter, AxiosInstance} from "axios";
import {eventInfoFixture} from "@/api/mock/fixtures/event";
import {notificationsFixture} from "@/api/mock/fixtures/notifications";

// Route (method + path suffix) -> fixture body. Extend as later pages add fixtures.
// Matchers use substring checks against the full request URL (baseURL + url).
const ROUTES: { test: (url: string, method?: string) => boolean; body: unknown }[] = [
    // "events/self/info" is NOT a substring of "events/self/join/info" (the join-status
    // endpoint), so this matcher does not accidentally swallow that route.
    {test: (u) => u.includes("events/self/info"), body: eventInfoFixture},
    {test: (u) => u.includes("events/self/notifications"), body: notificationsFixture},
];

// Install a mock adapter that resolves fixtures with a small latency when the flag is on.
// No-op unless NEXT_PUBLIC_USE_MOCKS === "1"; unmocked routes fall through to the real /api.
export function installMockAdapter(api: AxiosInstance): void {
    if (process.env.NEXT_PUBLIC_USE_MOCKS !== "1") return;

    const passthrough = api.defaults.adapter as AxiosAdapter;

    api.defaults.adapter = async (config) => {
        const url = (config.baseURL ?? "") + (config.url ?? "");
        const hit = ROUTES.find((r) => r.test(url, config.method));
        if (!hit) return passthrough(config);

        await new Promise((resolve) => setTimeout(resolve, 250));

        return {
            data: hit.body,
            status: 200,
            statusText: "OK",
            headers: {},
            config,
            request: {},
        };
    };
}
